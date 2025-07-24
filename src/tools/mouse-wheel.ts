/**
 * Puppeteer mouse wheel tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { MouseWheelParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { logger, browserLogger } from '@/utils/logger';

/**
 * Mouse Wheel tool - scrolls mouse wheel at precise coordinates
 */
export class MouseWheelTool extends BaseTool {
  name = 'puppeteer_mouse_wheel';
  description = 'Scroll mouse wheel at precise coordinates';
  
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
      deltaX: {
        type: 'number',
        description: 'Horizontal scroll delta (-1000 to 1000)',
        minimum: -1000,
        maximum: 1000,
        default: 0,
      },
      deltaY: {
        type: 'number',
        description: 'Vertical scroll delta (-1000 to 1000, negative = up, positive = down)',
        minimum: -1000,
        maximum: 1000,
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
    const validatedParams = validate.toolParams(this.name, params) as MouseWheelParams;
    
    // Validate coordinate safety
    validate.coordinateSafety(validatedParams.x, validatedParams.y);
    
    // Validate wheel delta safety
    validate.wheelDeltaSafety(validatedParams.deltaX, validatedParams.deltaY);

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

      // Get scroll position before wheel action
      const beforeScroll = await this.safeEvaluate<{x: number, y: number}>(page, () => {
        return {
          x: window.scrollX || window.pageXOffset || 0,
          y: window.scrollY || window.pageYOffset || 0,
        };
      });

      // Move mouse to coordinates first
      await page.mouse.move(validatedParams.x, validatedParams.y);

      // Perform mouse wheel scroll
      await page.mouse.wheel({
        deltaX: validatedParams.deltaX || 0,
        deltaY: validatedParams.deltaY || 0,
      });

      // Wait for scroll to complete
      await page.waitForTimeout(200);

      const duration = Date.now() - startTime;

      // Get scroll position after wheel action
      const afterScroll = await this.safeEvaluate<{x: number, y: number}>(page, () => {
        return {
          x: window.scrollX || window.pageXOffset || 0,
          y: window.scrollY || window.pageYOffset || 0,
        };
      });

      const scrollChanged = beforeScroll.x !== afterScroll.x || beforeScroll.y !== afterScroll.y;
      const scrollDistance = {
        x: afterScroll.x - beforeScroll.x,
        y: afterScroll.y - beforeScroll.y,
      };

      // Log mouse wheel action
      logger.info('Mouse wheel scrolled', {
        sessionId: context.sessionId,
        coordinates: { x: validatedParams.x, y: validatedParams.y },
        deltaX: validatedParams.deltaX || 0,
        deltaY: validatedParams.deltaY || 0,
        scrollBefore: beforeScroll,
        scrollAfter: afterScroll,
        scrollDistance,
        duration,
      });

      let message = `Successfully scrolled mouse wheel at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      message += `\nDelta X: ${validatedParams.deltaX || 0}`;
      message += `\nDelta Y: ${validatedParams.deltaY || 0}`;
      
      if (validatedParams.deltaY) {
        message += validatedParams.deltaY > 0 ? ' (scroll down)' : ' (scroll up)';
      }
      if (validatedParams.deltaX) {
        message += validatedParams.deltaX > 0 ? ' (scroll right)' : ' (scroll left)';
      }
      
      message += `\nPage: ${title} (${url})`;
      
      if (scrollChanged) {
        message += `\nPage scrolled by: X=${scrollDistance.x}px, Y=${scrollDistance.y}px`;
        message += `\nNew scroll position: X=${afterScroll.x}px, Y=${afterScroll.y}px`;
      } else {
        message += `\nNo scroll change detected (may have reached scroll limits)`;
      }
      
      message += `\nOperation completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        x: validatedParams.x,
        y: validatedParams.y,
        deltaX: validatedParams.deltaX || 0,
        deltaY: validatedParams.deltaY || 0,
        scrollBefore: beforeScroll,
        scrollAfter: afterScroll,
        scrollDistance,
        scrollChanged,
        duration,
        url,
        title,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('mouse-wheel', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to scroll mouse wheel at coordinates (${validatedParams.x}, ${validatedParams.y})`;
      errorMessage += `\nDelta X: ${validatedParams.deltaX || 0}, Delta Y: ${validatedParams.deltaY || 0}`;
      
      if (error instanceof Error) {
        if (error.message.includes('out of bounds') || error.message.includes('exceed')) {
          errorMessage += '\nCoordinates are outside the viewport bounds';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout during mouse wheel scroll';
        } else if (error.message.includes('delta')) {
          errorMessage += '\nInvalid wheel delta values';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        x: validatedParams.x,
        y: validatedParams.y,
        deltaX: validatedParams.deltaX || 0,
        deltaY: validatedParams.deltaY || 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const mouseWheelTool = new MouseWheelTool();
export default mouseWheelTool;