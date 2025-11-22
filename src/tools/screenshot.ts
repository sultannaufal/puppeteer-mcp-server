/**
 * Puppeteer screenshot tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { ScreenshotParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';
import { getConfig } from '@/utils/config';
import { imageStorage } from '@/services/image-storage';

const config = getConfig();

/**
 * Screenshot tool - takes a screenshot of the current page or specific element
 */
export class ScreenshotTool extends BaseTool {
  name = 'puppeteer_screenshot';
  description = 'Take a screenshot of the current page or a specific element';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Name for the screenshot',
      },
      selector: {
        type: 'string',
        description: 'CSS selector for element to screenshot (optional, viewport/full page if not provided)',
      },
      width: {
        type: 'number',
        description: 'Viewport width in pixels. When specified, captures viewport only instead of full page (default: 800)',
        minimum: 100,
        maximum: 4096,
      },
      height: {
        type: 'number',
        description: 'Viewport height in pixels. When specified, captures viewport only instead of full page (default: 600)',
        minimum: 100,
        maximum: 4096,
      },
      encoded: {
        type: 'boolean',
        description: 'If true, capture the screenshot as a base64-encoded data URI (as text). If false, return raw image data.',
        default: false,
      },
      useBinaryUrl: {
        type: 'boolean',
        description: 'If true and binary serving is enabled, return a URL to the binary image instead of base64 data. More efficient for HTTP transport.',
        default: false,
      },
    },
    required: ['name'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as ScreenshotParams;
    
    // Validate and sanitize filename
    const sanitizedName = validate.fileName(validatedParams.name);
    
    // Validate selector if provided
    if (validatedParams.selector) {
      validate.selectorSafety(validatedParams.selector);
    }

    const startTime = Date.now();
    
    try {
      // Set viewport if width/height specified
      if (validatedParams.width || validatedParams.height) {
        const width = Math.min(
          validatedParams.width || config.screenshot.defaultWidth,
          config.screenshot.maxWidth
        );
        const height = Math.min(
          validatedParams.height || config.screenshot.defaultHeight,
          config.screenshot.maxHeight
        );
        
        await page.setViewport({ width, height });
      }

      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      let screenshotBuffer: Buffer;
      let screenshotInfo: any = {
        name: sanitizedName,
        url,
        title,
        timestamp: new Date().toISOString(),
      };

      if (validatedParams.selector) {
        // Screenshot specific element
        await this.waitForElement(page, validatedParams.selector);
        
        const element = await page.$(validatedParams.selector);
        if (!element) {
          return this.createErrorResult(`Element not found: ${validatedParams.selector}`);
        }

        screenshotBuffer = await element.screenshot({
          type: 'png',
        }) as Buffer;

        screenshotInfo.selector = validatedParams.selector;
        screenshotInfo.type = 'element';
      } else {
        // Screenshot full page or viewport
        const useFullPage = !validatedParams.width && !validatedParams.height;
        screenshotBuffer = await this.safeScreenshot(page, {
          type: 'png',
          fullPage: useFullPage,
        }) as Buffer;

        screenshotInfo.type = useFullPage ? 'fullpage' : 'viewport';
      }

      const duration = Date.now() - startTime;
      screenshotInfo.duration = duration;
      screenshotInfo.size = screenshotBuffer.length;

      // Log screenshot
      browserLogger.screenshot(sanitizedName, context.sessionId, screenshotBuffer.length);

      // Determine response format based on parameters
      const shouldUseBinaryUrl = validatedParams.useBinaryUrl &&
                                 config.screenshot.enableBinaryServing;

      let message = `Screenshot '${sanitizedName}' captured successfully`;
      if (validatedParams.selector) {
        message += ` (element: ${validatedParams.selector})`;
      } else {
        message += screenshotInfo.type === 'fullpage' ? ' (full page)' : ' (viewport)';
      }
      message += `\nSize: ${Math.round(screenshotBuffer.length / 1024)}KB`;
      message += `\nDuration: ${duration}ms`;
      message += `\nPage: ${title} (${url})`;

      if (shouldUseBinaryUrl) {
        // Store image and return URL reference
        try {
          const { url: imageUrl, expiresAt } = await imageStorage.storeImage(
            screenshotBuffer,
            context.sessionId,
            sanitizedName,
            'image/png'
          );

          message += `\nBinary URL: ${imageUrl}`;
          message += `\nExpires: ${expiresAt.toISOString()}`;
          message += `\nFormat: Binary PNG (more efficient than base64)`;

          return {
            content: [
              {
                type: 'text',
                text: message,
              },
              {
                type: 'text',
                text: `Binary Image URL: ${imageUrl}`,
              }
            ],
            isError: false,
          };
        } catch (storageError) {
          // Fall back to base64 if storage fails
          browserLogger.error('screenshot-storage', storageError instanceof Error ? storageError : new Error(String(storageError)), context.sessionId);
          message += `\nWarning: Binary storage failed, falling back to base64`;
        }
      }

      if (validatedParams.encoded) {
        // Return as base64 data URI
        const base64Data = screenshotBuffer.toString('base64');
        const dataUri = `data:image/png;base64,${base64Data}`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
            {
              type: 'text',
              text: `Data URI: ${dataUri}`,
            }
          ],
          isError: false,
        };
      } else {
        // Return as image content (base64 in MCP format)
        const base64Data = screenshotBuffer.toString('base64');
        return this.createImageResult(message, base64Data, 'image/png');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('screenshot', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to take screenshot '${sanitizedName}'`;
      
      if (validatedParams.selector) {
        errorMessage += ` of element '${validatedParams.selector}'`;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('Element not found')) {
          errorMessage += ': Element not found or not visible';
        } else if (error.message.includes('timeout')) {
          errorMessage += ': Timeout waiting for element';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        name: sanitizedName,
        selector: validatedParams.selector,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const screenshotTool = new ScreenshotTool();
export default screenshotTool;