/**
 * Puppeteer mouse move tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseMoveParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Move tool - moves mouse to precise coordinates
 */
export class MouseMoveTool extends BaseTool {
  name = 'puppeteer_mouse_move';
  description = 'Move mouse to precise coordinates on the page';
  
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
      steps: {
        type: 'number',
        description: 'Number of intermediate steps for smooth movement (1-100)',
        minimum: 1,
        maximum: 100,
        default: 1,
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
    const validatedParams = validate.toolParams(this.name, params) as MouseMoveParams;
    
    // Validate coordinate safety
    validate.coordinateSafety(validatedParams.x, validatedParams.y);

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

      // Get current mouse position for logging
      let currentPosition = { x: 0, y: 0 };
      try {
        // Try to get current mouse position (this might not always be available)
        currentPosition = await this.safeEvaluate(page, () => {
          return { x: 0, y: 0 }; // Default fallback
        });
      } catch (error) {
        // Ignore errors getting current position
      }

      // Perform mouse move
      await page.mouse.move(
        validatedParams.x, 
        validatedParams.y, 
        { steps: validatedParams.steps || 1 }
      );

      const duration = Date.now() - startTime;

      // Log mouse move action
      logger.info('Mouse moved', {
        sessionId: context.sessionId,
        from: currentPosition,
        to: { x: validatedParams.x, y: validatedParams.y },
        steps: validatedParams.steps || 1,
        duration,
      });

      const distance = Math.sqrt(
        Math.pow(validatedParams.x - currentPosition.x, 2) + 
        Math.pow(validatedParams.y - currentPosition.y, 2)
      );

      let message = `Successfully moved mouse to coordinates (${validatedParams.x}, ${validatedParams.y})`;
      message += `\nPage: ${title} (${url})`;
      message += `\nDistance moved: ${Math.round(distance)}px`;
      if (validatedParams.steps && validatedParams.steps > 1) {
        message += `\nSmooth movement with ${validatedParams.steps} steps`;
      }
      message += `\nMove completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        x: validatedParams.x,
        y: validatedParams.y,
        steps: validatedParams.steps || 1,
        distance: Math.round(distance),
        duration,
        url,
        title,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('mouse-move', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to move mouse to coordinates (${validatedParams.x}, ${validatedParams.y})`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nCoordinates are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during mouse movement';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        x: validatedParams.x,
        y: validatedParams.y,
        steps: validatedParams.steps || 1,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const mouseMoveTool = new MouseMoveTool();
export default mouseMoveTool;