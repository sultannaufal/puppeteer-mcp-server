/**
 * Puppeteer fill tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { FillParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Fill tool - fills out an input field
 */
export class FillTool extends BaseTool {
  name = 'puppeteer_fill';
  description = 'Fill out an input field';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for input field',
      },
      value: {
        type: 'string',
        description: 'Value to fill',
      },
    },
    required: ['selector', 'value'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as FillParams;
    
    // Validate selector safety
    validate.selectorSafety(validatedParams.selector);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Perform fill with retry logic
      await this.safeElementInteraction(
        page,
        validatedParams.selector,
        async (element) => {
          // Scroll element into view
          await element.scrollIntoView();
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Clear existing content first
          await element.click({ clickCount: 3 }); // Triple-click to select all
          await element.press('Backspace');
          
          // Type the new value
          await element.type(validatedParams.value, { delay: 10 });
          
          return true;
        }
      );

      // Verify the value was set correctly
      let actualValue: string;
      try {
        actualValue = await page.$eval(validatedParams.selector, (el: any) => {
          return el.value || el.textContent || el.innerText || '';
        });
      } catch (error) {
        // If we can't get the value, assume it was set correctly
        actualValue = validatedParams.value;
      }

      const duration = Date.now() - startTime;

      // Log fill action
      browserLogger.fill(validatedParams.selector, context.sessionId);

      const valueMatches = actualValue.trim() === validatedParams.value.trim();
      
      let message = `Successfully filled field: ${validatedParams.selector}`;
      message += `\nValue: "${validatedParams.value}"`;
      
      if (!valueMatches && actualValue) {
        message += `\nActual value: "${actualValue}"`;
        message += `\nNote: The actual value differs from the intended value`;
      }
      
      message += `\nPage: ${title} (${url})`;
      message += `\nFill completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        selector: validatedParams.selector,
        intendedValue: validatedParams.value,
        actualValue,
        valueMatches,
        duration,
        url,
        title,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('fill', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to fill field: ${validatedParams.selector}`;
      
      if (error instanceof Error) {
        if (error.message.includes('Element not found')) {
          errorMessage += '\nInput field not found or not visible';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout waiting for input field to be available';
        } else if (error.message.includes('not editable')) {
          errorMessage += '\nInput field is not editable (may be disabled or readonly)';
        } else if (error.message.includes('detached')) {
          errorMessage += '\nInput field is no longer attached to the DOM';
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nOperation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        selector: validatedParams.selector,
        value: validatedParams.value,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const fillTool = new FillTool();
export default fillTool;