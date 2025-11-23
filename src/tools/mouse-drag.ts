/**
 * Puppeteer mouse drag tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseDragParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Drag tool - performs drag and drop operations between coordinates
 */
export class MouseDragTool extends BaseTool {
  name = 'puppeteer_mouse_drag';
  description = 'Drag from start coordinates to end coordinates (drag and drop)';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      startX: {
        type: 'number',
        description: 'Start X coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      startY: {
        type: 'number',
        description: 'Start Y coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      endX: {
        type: 'number',
        description: 'End X coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      endY: {
        type: 'number',
        description: 'End Y coordinate (0-4096)',
        minimum: 0,
        maximum: 4096,
      },
      steps: {
        type: 'number',
        description: 'Number of intermediate steps for smooth dragging (1-100)',
        minimum: 1,
        maximum: 100,
        default: 1,
      },
      delay: {
        type: 'number',
        description: 'Delay between drag steps in milliseconds (0-5000)',
        minimum: 0,
        maximum: 5000,
        default: 0,
      },
    },
    required: ['startX', 'startY', 'endX', 'endY'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as MouseDragParams;
    
    // Validate coordinate safety for both start and end points
    validate.coordinateSafety(validatedParams.startX, validatedParams.startY);
    validate.coordinateSafety(validatedParams.endX, validatedParams.endY);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Get viewport size for bounds checking
      const viewport = page.viewport();
      if (viewport) {
        validate.coordinateSafety(validatedParams.startX, validatedParams.startY, {
          width: viewport.width,
          height: viewport.height,
        });
        validate.coordinateSafety(validatedParams.endX, validatedParams.endY, {
          width: viewport.width,
          height: viewport.height,
        });
      }

      // Get page state before drag for change detection
      const beforeUrl = url;
      const beforeTitle = title;

      // Calculate drag distance and direction
      const dragDistance = Math.sqrt(
        Math.pow(validatedParams.endX - validatedParams.startX, 2) + 
        Math.pow(validatedParams.endY - validatedParams.startY, 2)
      );

      // Perform drag operation
      // Step 1: Move to start position
      await page.mouse.move(validatedParams.startX, validatedParams.startY);
      
      // Step 2: Press mouse button down
      await page.mouse.down({ button: 'left' });
      
      // Step 3: Add small delay to ensure drag is recognized
      if (validatedParams.delay && validatedParams.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(validatedParams.delay ?? 0, 100)));
      }
      
      // Step 4: Move to end position with steps
      await page.mouse.move(
        validatedParams.endX, 
        validatedParams.endY, 
        { steps: validatedParams.steps || 1 }
      );
      
      // Step 5: Add delay between steps if specified
      if (validatedParams.delay && validatedParams.delay > 100) {
        await new Promise(resolve => setTimeout(resolve, (validatedParams.delay ?? 0) - 100));
      }
      
      // Step 6: Release mouse button
      await page.mouse.up({ button: 'left' });

      // Wait for potential navigation or page changes
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief wait for any immediate changes
      } catch (error) {
        // Ignore timeout errors
      }

      const duration = Date.now() - startTime;

      // Log mouse drag action
      logger.info('Mouse drag completed', {
        sessionId: context.sessionId,
        startCoordinates: { x: validatedParams.startX, y: validatedParams.startY },
        endCoordinates: { x: validatedParams.endX, y: validatedParams.endY },
        distance: Math.round(dragDistance),
        steps: validatedParams.steps || 1,
        delay: validatedParams.delay || 0,
        duration,
      });

      // Get updated page info to detect changes
      const newUrl = await this.getPageUrl(page);
      const newTitle = await this.getPageTitle(page);
      
      const urlChanged = newUrl !== beforeUrl;
      const titleChanged = newTitle !== beforeTitle;

      let message = `Successfully dragged from (${validatedParams.startX}, ${validatedParams.startY}) to (${validatedParams.endX}, ${validatedParams.endY})`;
      message += `\nDrag distance: ${Math.round(dragDistance)}px`;
      if (validatedParams.steps && validatedParams.steps > 1) {
        message += `\nSmooth drag with ${validatedParams.steps} steps`;
      }
      if (validatedParams.delay && validatedParams.delay > 0) {
        message += `\nDelay between steps: ${validatedParams.delay}ms`;
      }
      message += `\nPage: ${title} (${url})`;
      
      if (urlChanged) {
        message += `\nNavigation detected: ${newUrl}`;
      }
      
      if (titleChanged && !urlChanged) {
        message += `\nPage title changed: ${newTitle}`;
      }
      
      message += `\nDrag operation completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        startX: validatedParams.startX,
        startY: validatedParams.startY,
        endX: validatedParams.endX,
        endY: validatedParams.endY,
        distance: Math.round(dragDistance),
        steps: validatedParams.steps || 1,
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
      
      browserLogger.error('mouse-drag', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to drag from (${validatedParams.startX}, ${validatedParams.startY}) to (${validatedParams.endX}, ${validatedParams.endY})`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nOne or both coordinate pairs are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during drag operation';
        } else if (error.message.includes('not draggable')) {
          errorMessage += '\nElement at start coordinates may not be draggable';
        } else if (error.message.includes('button')) {
          errorMessage += '\nMouse button state error during drag operation';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        startX: validatedParams.startX,
        startY: validatedParams.startY,
        endX: validatedParams.endX,
        endY: validatedParams.endY,
        steps: validatedParams.steps || 1,
        delay: validatedParams.delay || 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const mouseDragTool = new MouseDragTool();
export default mouseDragTool;
