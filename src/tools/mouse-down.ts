/**
 * Puppeteer mouse down tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseDownParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Down tool - presses mouse button at precise coordinates
 */
export class MouseDownTool extends BaseTool {
  name = 'puppeteer_mouse_down';
  description = 'Press mouse button down at precise coordinates';
  
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
        description: 'Mouse button to press down',
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
    const validatedParams = validate.toolParams(this.name, params) as MouseDownParams;
    
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

      // Move mouse to coordinates first (required for mouse down)
      await page.mouse.move(validatedParams.x, validatedParams.y);

      // Perform mouse down
      await page.mouse.down({
        button: validatedParams.button || 'left',
      });

      const duration = Date.now() - startTime;

      // Log mouse down action
      logger.info('Mouse button pressed down', {
        sessionId: context.sessionId,
        coordinates: { x: validatedParams.x, y: validatedParams.y },
        button: validatedParams.button || 'left',
        duration,
      });

      let message = `Successfully pressed ${validatedParams.button || 'left'} mouse button down at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      message += `\nPage: ${title} (${url})`;
      message += `\nNote: Mouse button is now held down. Use mouse_up to release it.`;
      message += `\nOperation completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        x: validatedParams.x,
        y: validatedParams.y,
        button: validatedParams.button || 'left',
        duration,
        url,
        title,
        buttonState: 'down',
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('mouse-down', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to press ${validatedParams.button || 'left'} mouse button down at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nCoordinates are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during mouse button press';
        } else if (error.message.includes('already pressed') || error.message.includes('button down')) {
          errorMessage += '\nMouse button may already be pressed down';
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
export const mouseDownTool = new MouseDownTool();
export default mouseDownTool;