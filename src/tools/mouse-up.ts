/**
 * Puppeteer mouse up tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseUpParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Up tool - releases mouse button at precise coordinates
 */
export class MouseUpTool extends BaseTool {
  name = 'puppeteer_mouse_up';
  description = 'Release mouse button at precise coordinates';
  
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
        description: 'Mouse button to release',
        enum: ['left', 'right', 'middle', 'back', 'forward'],
        default: 'left',
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
    const validatedParams = validate.toolParams(this.name, params) as MouseUpParams;
    
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

      // Get page state before mouse up for change detection
      const beforeUrl = url;
      const beforeTitle = title;

      // Move mouse to coordinates first (in case it's not already there)
      await page.mouse.move(validatedParams.x, validatedParams.y);

      // Perform mouse up
      await page.mouse.up({
        button: validatedParams.button || 'left',
      });

      // Wait for potential navigation or page changes
      try {
        await page.waitForTimeout(500); // Brief wait for any immediate changes
      } catch (error) {
        // Ignore timeout errors
      }

      const duration = Date.now() - startTime;

      // Log mouse up action
      logger.info('Mouse button released', {
        sessionId: context.sessionId,
        coordinates: { x: validatedParams.x, y: validatedParams.y },
        button: validatedParams.button || 'left',
        duration,
      });

      // Get updated page info to detect changes
      const newUrl = await this.getPageUrl(page);
      const newTitle = await this.getPageTitle(page);
      
      const urlChanged = newUrl !== beforeUrl;
      const titleChanged = newTitle !== beforeTitle;

      let message = `Successfully released ${validatedParams.button || 'left'} mouse button at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      message += `\nPage: ${title} (${url})`;
      
      if (urlChanged) {
        message += `\nNavigation detected: ${newUrl}`;
      }
      
      if (titleChanged && !urlChanged) {
        message += `\nPage title changed: ${newTitle}`;
      }
      
      message += `\nOperation completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        x: validatedParams.x,
        y: validatedParams.y,
        button: validatedParams.button || 'left',
        originalUrl: beforeUrl,
        originalTitle: beforeTitle,
        newUrl,
        newTitle,
        urlChanged,
        titleChanged,
        duration,
        buttonState: 'up',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('mouse-up', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to release ${validatedParams.button || 'left'} mouse button at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nCoordinates are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during mouse button release';
        } else if (error.message.includes('not pressed') || error.message.includes('button up')) {
          errorMessage += '\nMouse button may not be currently pressed down';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        x: validatedParams.x,
        y: validatedParams.y,
        button: validatedParams.button || 'left',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const mouseUpTool = new MouseUpTool();
export default mouseUpTool;