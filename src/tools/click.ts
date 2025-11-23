/**
 * Puppeteer click tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { ClickParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Click tool - clicks an element on the page
 */
export class ClickTool extends BaseTool {
  name = 'puppeteer_click';
  description = 'Click an element on the page';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for element to click',
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
    const validatedParams = validate.toolParams(this.name, params) as ClickParams;
    
    // Validate selector safety
    validate.selectorSafety(validatedParams.selector);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Perform click with retry logic
      await this.safeElementInteraction(
        page,
        validatedParams.selector,
        async (element) => {
          // Scroll element into view
          await element.scrollIntoView();
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Click the element
          await element.click();
          
          return true;
        }
      );

      // Wait for potential navigation or page changes
      try {
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief wait for any immediate changes
      } catch (error) {
        // Ignore timeout errors
      }

      const duration = Date.now() - startTime;

      // Log click action
      browserLogger.click(validatedParams.selector, context.sessionId);

      // Get updated page info to detect changes
      const newUrl = await this.getPageUrl(page);
      const newTitle = await this.getPageTitle(page);
      
      const urlChanged = newUrl !== url;
      const titleChanged = newTitle !== title;

      let message = `Successfully clicked element: ${validatedParams.selector}`;
      message += `\nPage: ${title} (${url})`;
      
      if (urlChanged) {
        message += `\nNavigation detected: ${newUrl}`;
      }
      
      if (titleChanged && !urlChanged) {
        message += `\nPage title changed: ${newTitle}`;
      }
      
      message += `\nClick completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        selector: validatedParams.selector,
        originalUrl: url,
        originalTitle: title,
        newUrl,
        newTitle,
        urlChanged,
        titleChanged,
        duration,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('click', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to click element: ${validatedParams.selector}`;
      
      if (error instanceof Error) {
        if (error.message.includes('Element not found')) {
          errorMessage += '\nElement not found or not visible';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout waiting for element to be clickable';
        } else if (error.message.includes('not clickable')) {
          errorMessage += '\nElement is not clickable (may be covered by another element)';
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
export const clickTool = new ClickTool();
export default clickTool;
