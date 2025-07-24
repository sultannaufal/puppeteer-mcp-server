/**
 * Puppeteer select tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { SelectParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Select tool - selects an option from a select element
 */
export class SelectTool extends BaseTool {
  name = 'puppeteer_select';
  description = 'Select an option from a select element';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for select element',
      },
      value: {
        type: 'string',
        description: 'Value to select',
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
    const validatedParams = validate.toolParams(this.name, params) as SelectParams;
    
    // Validate selector safety
    validate.selectorSafety(validatedParams.selector);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Perform select with retry logic
      const selectedValues = await this.safeElementInteraction(
        page,
        validatedParams.selector,
        async (element) => {
          // Scroll element into view
          await element.scrollIntoView();
          
          // Wait a bit for any animations
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Get available options first
          const options = await page.$$eval(
            `${validatedParams.selector} option`,
            (opts: any[]) => opts.map(opt => ({
              value: opt.value,
              text: opt.textContent?.trim() || '',
              selected: opt.selected,
            }))
          );
          
          // Try to select by value first, then by text
          let selectedValues: string[];
          try {
            selectedValues = await page.select(validatedParams.selector, validatedParams.value);
          } catch (error) {
            // If selecting by value fails, try to find by text
            const optionByText = options.find(opt => 
              opt.text.toLowerCase() === validatedParams.value.toLowerCase()
            );
            
            if (optionByText) {
              selectedValues = await page.select(validatedParams.selector, optionByText.value);
            } else {
              throw new Error(`Option not found: "${validatedParams.value}". Available options: ${options.map(o => `"${o.text}" (value: "${o.value}")`).join(', ')}`);
            }
          }
          
          return { selectedValues, availableOptions: options };
        }
      );

      const duration = Date.now() - startTime;

      // Log select action
      browserLogger.select(validatedParams.selector, validatedParams.value, context.sessionId);

      const wasSelected = selectedValues.selectedValues.includes(validatedParams.value) || 
                         selectedValues.availableOptions.some(opt => 
                           opt.selected && (opt.value === validatedParams.value || opt.text === validatedParams.value)
                         );

      let message = `Successfully selected option in: ${validatedParams.selector}`;
      message += `\nRequested value: "${validatedParams.value}"`;
      message += `\nSelected values: [${selectedValues.selectedValues.join(', ')}]`;
      
      if (!wasSelected) {
        message += `\nWarning: The requested value may not have been selected`;
      }
      
      message += `\nAvailable options: ${selectedValues.availableOptions.length}`;
      message += `\nPage: ${title} (${url})`;
      message += `\nSelection completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        selector: validatedParams.selector,
        requestedValue: validatedParams.value,
        selectedValues: selectedValues.selectedValues,
        availableOptions: selectedValues.availableOptions,
        wasSelected,
        duration,
        url,
        title,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('select', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to select option in: ${validatedParams.selector}`;
      
      if (error instanceof Error) {
        if (error.message.includes('Element not found')) {
          errorMessage += '\nSelect element not found or not visible';
        } else if (error.message.includes('timeout')) {
          errorMessage += '\nTimeout waiting for select element to be available';
        } else if (error.message.includes('Option not found')) {
          errorMessage += `\n${error.message}`;
        } else if (error.message.includes('not a select element')) {
          errorMessage += '\nThe specified element is not a select element';
        } else if (error.message.includes('detached')) {
          errorMessage += '\nSelect element is no longer attached to the DOM';
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
export const selectTool = new SelectTool();
export default selectTool;