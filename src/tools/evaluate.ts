/**
 * Puppeteer evaluate tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { EvaluateParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Evaluate tool - executes JavaScript in the browser console
 */
export class EvaluateTool extends BaseTool {
  name = 'puppeteer_evaluate';
  description = 'Execute JavaScript in the browser console';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute',
      },
    },
    required: ['script'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as EvaluateParams;
    
    // Validate script safety
    validate.scriptSafety(validatedParams.script);

    const startTime = Date.now();
    
    try {
      // Get current page info
      const url = await this.getPageUrl(page);
      const title = await this.getPageTitle(page);

      // Capture console logs during execution
      const consoleLogs: any[] = [];
      const consoleHandler = (msg: any) => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString(),
        });
      };

      // Add console listener
      page.on('console', consoleHandler);

      let result: any;
      let error: Error | null = null;

      try {
        // Execute the script with a wrapper to capture both result and console output
        result = await this.safeEvaluate(page, `
          (() => {
            // Store original console methods
            const originalConsole = {
              log: console.log,
              info: console.info,
              warn: console.warn,
              error: console.error,
              debug: console.debug
            };
            
            // Create logs array to capture console output
            window.mcpHelper = window.mcpHelper || {};
            window.mcpHelper.logs = [];
            window.mcpHelper.originalConsole = originalConsole;
            
            // Override console methods to capture output
            ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
              console[method] = (...args) => {
                window.mcpHelper.logs.push({
                  method: method,
                  args: args.map(arg => {
                    try {
                      return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
                    } catch (e) {
                      return '[Object]';
                    }
                  }),
                  timestamp: Date.now()
                });
                originalConsole[method](...args);
              };
            });
            
            try {
              // Execute the user script
              const result = eval(${JSON.stringify(validatedParams.script)});
              
              // Restore original console methods
              Object.assign(console, originalConsole);
              
              return {
                result: result,
                logs: window.mcpHelper.logs,
                error: null
              };
            } catch (error) {
              // Restore original console methods
              Object.assign(console, originalConsole);
              
              return {
                result: null,
                logs: window.mcpHelper.logs,
                error: {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                }
              };
            }
          })()
        `);
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      } finally {
        // Remove console listener
        page.off('console', consoleHandler);
      }

      const duration = Date.now() - startTime;

      // Log evaluate action
      browserLogger.evaluate(context.sessionId, duration);

      if (error || (result && result.error)) {
        const scriptError = error || new Error(result.error.message);
        
        let errorMessage = `Script execution failed`;
        errorMessage += `\nScript: ${validatedParams.script.substring(0, 100)}${validatedParams.script.length > 100 ? '...' : ''}`;
        errorMessage += `\nError: ${scriptError.message}`;
        
        if (result && result.logs && result.logs.length > 0) {
          errorMessage += `\nConsole output:`;
          result.logs.forEach((log: any) => {
            errorMessage += `\n  ${log.method}: ${log.args.join(' ')}`;
          });
        }
        
        errorMessage += `\nExecution failed after ${duration}ms`;

        return this.createErrorResult(errorMessage, {
          script: validatedParams.script,
          error: scriptError.message,
          logs: result?.logs || [],
          duration,
        });
      }

      // Format the result
      let resultString: string;
      try {
        if (result.result === undefined) {
          resultString = 'undefined';
        } else if (result.result === null) {
          resultString = 'null';
        } else if (typeof result.result === 'object') {
          resultString = JSON.stringify(result.result, null, 2);
        } else {
          resultString = String(result.result);
        }
      } catch (err) {
        resultString = '[Unable to serialize result]';
      }

      let message = `Script executed successfully`;
      message += `\nResult: ${resultString}`;
      
      if (result.logs && result.logs.length > 0) {
        message += `\nConsole output (${result.logs.length} entries):`;
        result.logs.forEach((log: any, index: number) => {
          if (index < 10) { // Limit to first 10 log entries
            message += `\n  ${log.method}: ${log.args.join(' ')}`;
          }
        });
        if (result.logs.length > 10) {
          message += `\n  ... and ${result.logs.length - 10} more entries`;
        }
      }
      
      message += `\nPage: ${title} (${url})`;
      message += `\nExecution completed in ${duration}ms`;

      return this.createSuccessResult(message, {
        script: validatedParams.script,
        result: result.result,
        logs: result.logs || [],
        duration,
        url,
        title,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('evaluate', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to execute script`;
      errorMessage += `\nScript: ${validatedParams.script.substring(0, 100)}${validatedParams.script.length > 100 ? '...' : ''}`;
      
      if (error instanceof Error) {
        if (error.message.includes('Evaluation failed')) {
          errorMessage += `\nScript evaluation error: ${error.message}`;
        } else if (error.message.includes('timeout')) {
          errorMessage += `\nScript execution timeout`;
        } else {
          errorMessage += `\nError: ${error.message}`;
        }
      }
      
      errorMessage += `\nExecution failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        script: validatedParams.script,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const evaluateTool = new EvaluateTool();
export default evaluateTool;