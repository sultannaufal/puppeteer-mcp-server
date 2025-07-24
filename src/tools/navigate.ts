/**
 * Puppeteer navigate tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { NavigateParams } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger } from '@/utils/logger';

/**
 * Navigate tool - navigates to a URL
 */
export class NavigateTool extends BaseTool {
  name = 'puppeteer_navigate';
  description = 'Navigate to a URL';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      url: {
        type: 'string',
        description: 'URL to navigate to',
      },
      launchOptions: {
        type: 'object',
        description: 'Puppeteer launch options (optional)',
        properties: {
          headless: { type: 'boolean' },
          args: { 
            type: 'array',
            items: { type: 'string' }
          },
          executablePath: { type: 'string' },
        },
      },
      allowDangerous: {
        type: 'boolean',
        description: 'Allow dangerous launch options that reduce security. When false, dangerous arguments are filtered out.',
        default: false,
      },
    },
    required: ['url'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as NavigateParams;
    
    // Validate URL safety
    validate.urlSafety(validatedParams.url);
    
    // Validate launch options if provided
    if (validatedParams.launchOptions) {
      validate.launchOptionsSafety(
        validatedParams.launchOptions, 
        validatedParams.allowDangerous
      );
    }

    const startTime = Date.now();
    
    try {
      // Navigate to the URL
      await this.safeNavigate(page, validatedParams.url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Get page information
      const title = await this.getPageTitle(page);
      const finalUrl = await this.getPageUrl(page);
      const duration = Date.now() - startTime;

      // Log navigation
      browserLogger.navigate(finalUrl, context.sessionId, duration);

      // Check if we were redirected
      const wasRedirected = finalUrl !== validatedParams.url;
      
      let message = `Successfully navigated to ${validatedParams.url}`;
      if (wasRedirected) {
        message += ` (redirected to ${finalUrl})`;
      }
      message += `\nPage title: ${title}`;
      message += `\nNavigation took ${duration}ms`;

      return this.createSuccessResult(message, {
        originalUrl: validatedParams.url,
        finalUrl,
        title,
        duration,
        wasRedirected,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('navigate', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to navigate to ${validatedParams.url}`;
      
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          errorMessage += ': Navigation timeout (30s)';
        } else if (error.message.includes('net::ERR_')) {
          errorMessage += `: Network error (${error.message})`;
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          errorMessage += ': Page not found (404)';
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          errorMessage += ': Access forbidden (403)';
        } else if (error.message.includes('500')) {
          errorMessage += ': Server error (500)';
        } else {
          errorMessage += `: ${error.message}`;
        }
      }
      
      errorMessage += `\nNavigation failed after ${duration}ms`;

      return this.createErrorResult(errorMessage, {
        url: validatedParams.url,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Create and export tool instance
export const navigateTool = new NavigateTool();
export default navigateTool;