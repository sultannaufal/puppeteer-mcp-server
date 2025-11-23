/**
 * Puppeteer mouse click tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseClickParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Click tool - clicks at precise coordinates with button options
 */
export class MouseClickTool extends BaseTool {
  name = 'puppeteer_mouse_click';
  description = 'Click at precise coordinates with mouse button options';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      x: {
        type: 'number',
        description: 'X coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      y: {
        type: 'number',
        description: 'Y coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      button: {
        type: 'string',
        description: 'Mouse button to click',
        enum: ['left', 'right', 'middle', 'back', 'forward'],
        default: 'left',
      },
      clickCount: {
        type: 'number',
        description: 'Number of clicks (1-3)',
        minimum: 1,
        maximum: 3,
        default: 1,
      },
      delay: {
        type: 'number',
        description: 'Delay between clicks in milliseconds (0-5000)',
        minimum: 0,
        maximum: 5000,
        default: 0,
      },
    },
    required: ['x', 'y'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as MouseClickParams;
    
    // Validate coordinate safety
    validate.coordinateSafety(validatedParams.x, validatedParams.y);
    
    // Validate mouse button safety
    if (validatedParams.button) {
      validate.mouseButtonSafety(validatedParams.button);
    }

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Get viewport size for bounds checking
      const viewport = page.viewport();
      if (viewport) {
        validate.coordinateSafety(validatedParams.x, validatedParams.y, {
          width: viewport.width,
          height: viewport.height,
        });
      }

      // Get page state before click for change detection
      const beforeUrl = url;
      const beforeTitle = title;

      // Perform mouse click
      await page.mouse.click(
        validatedParams.x, 
        validatedParams.y, 
        {
          button: validatedParams.button || 'left',
          clickCount: validatedParams.clickCount || 1,
          delay: validatedParams.delay || 0,
        }
      );

      // Wait for potential navigation or page changes
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief wait for any immediate changes
      } catch (error) {
        // Ignore timeout errors
      }

      const duration = Date.now() - startTime;

      // Log mouse click action
      logger.info('Mouse clicked', {
        sessionId: context.sessionId,
        coordinates: { x: validatedParams.x, y: validatedParams.y },
        button: validatedParams.button || 'left',
        clickCount: validatedParams.clickCount || 1,
        delay: validatedParams.delay || 0,
        duration,
      });

      // Get updated page info to detect changes
      const newUrl = await this.getPageUrl(page);
      const newTitle = await this.getPageTitle(page);
      
      const urlChanged = newUrl !== beforeUrl;
      const titleChanged = newTitle !== beforeTitle;

      let message = `Successfully clicked at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      message += `\nButton: ${validatedParams.button || 'left'}`;
      if (validatedParams.clickCount && validatedParams.clickCount > 1) {
        message += `\nClick count: ${validatedParams.clickCount}`;
      }
      if (validatedParams.delay && validatedParams.delay > 0) {
        message += `\nDelay between clicks: ${validatedParams.delay}ms`;
      }
      message += `\nPage: ${title} (${url})`;
      
      if (urlChanged) {
        message += `\nNavigation detected: ${newUrl}`;
      }
      
      if (titleChanged && !urlChanged) {
        message += `\nPage title changed: ${newTitle}`;
      }
      
      message += `\nClick completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        x: validatedParams.x,
        y: validatedParams.y,
        button: validatedParams.button || 'left',
        clickCount: validatedParams.clickCount || 1,
        delay: validatedParams.delay || 0,
        originalUrl: beforeUrl,
        originalTitle: beforeTitle,
        newUrl,
        newTitle,
        urlChanged,
        titleChanged,
        duration,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('mouse-click', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to click at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      errorMessage += `\nButton: ${validatedParams.button || 'left'}`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nCoordinates are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during mouse click';
        } else if (error.message.includes('not clickable')) {
          errorMessage += '\nArea at coordinates is not clickable';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        x: validatedParams.x,
        y: validatedParams.y,
        button: validatedParams.button || 'left',
        clickCount: validatedParams.clickCount || 1,
        delay: validatedParams.delay || 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const mouseClickTool = new MouseClickTool();
export default mouseClickTool;
