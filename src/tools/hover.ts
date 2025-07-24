/**
 * Puppeteer hover tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { HoverParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Hover tool - hovers over an element
 */
export class HoverTool extends BaseTool {
  name = 'puppeteer_hover';
  description = 'Hover over an element';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for element to hover over',
      },
    },
    required: ['selector'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as HoverParams;
    
    // Validate selector safety
    validate.selectorSafety(validatedParams.selector);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Perform hover with retry logic
      await this.safeElementInteraction(
        page,
        validatedParams.selector,
        async (element) => {
          // Scroll element into view
          await element.scrollIntoView();
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Hover over the element
          await element.hover();
          
          // Wait a bit to allow hover effects to trigger
          await new Promise(resolve => setTimeout(resolve, 200));
          
          return true;
        }
      );

      const duration = Date.now() - startTime;

      // Log hover action
      browserLogger.hover(validatedParams.selector, context.sessionId);

      // Check if any visible changes occurred (like tooltips, dropdowns, etc.)
      let visibilityChanges: any[] = [];
      try {
        // Look for common hover-triggered elements
        const commonHoverSelectors = [
          '[role="tooltip"]',
          '.tooltip',
          '.dropdown-menu',
          '.hover-content',
          '[data-tooltip]',
          '.popover',
        ];

        for (const hoverSelector of commonHoverSelectors) {
          const elements = await page.$$(hoverSelector);
          if (elements.length > 0) {
            const visibleElements = await Promise.all(
              elements.map(async (el) => {
                const isVisible = await el.evaluate((element: any) => {
                  const style = window.getComputedStyle(element);
                  return style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0';
                });
                return isVisible;
              })
            );
            
            const visibleCount = visibleElements.filter(Boolean).length;
            if (visibleCount > 0) {
              visibilityChanges.push({
                selector: hoverSelector,
                count: visibleCount,
              });
            }
          }
        }
      } catch (error) {
        // Ignore errors when checking for visibility changes
      }

      let message = `Successfully hovered over element: ${validatedParams.selector}`;
      message += `\nPage: ${title} (${url})`;
      
      if (visibilityChanges.length > 0) {
        message += `\nDetected hover effects:`;
        visibilityChanges.forEach(change => {
          message += `\n  - ${change.count} ${change.selector} element(s) became visible`;
        });
      } else {
        message += `\nNo visible hover effects detected`;
      }
      
      message += `\nHover completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        selector: validatedParams.selector,
        duration,
        url,
        title,
        visibilityChanges,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('hover', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to hover over element: ${validatedParams.selector}`;
      
      if (error instanceof Error) {
        if (error.message.includes('Element not found')) {
          errorMessage += '\nElement not found or not visible';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout waiting for element to be hoverable';
        } else if (error.message.includes('not hoverable')) {
          errorMessage += '\nElement is not hoverable (may be covered by another element)';
        } else if (error.message.includes('detached')) {
          errorMessage += '\nElement is no longer attached to the DOM';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        selector: validatedParams.selector,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const hoverTool = new HoverTool();
export default hoverTool;