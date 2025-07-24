/**
 * Puppeteer delete cookies tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { DeleteCookiesParams, DeleteCookieParam, CookieError } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger, logger } from '@/utils/logger';

/**
 * Delete Cookies tool - removes cookies from the current page
 * Optimized for logout scenarios and authentication cleanup
 */
export class DeleteCookiesTool extends BaseTool {
  name = 'puppeteer_delete_cookies';
  description = 'Delete cookies from the current page. Useful for logout scenarios, clearing authentication state, and cookie cleanup.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      cookies: {
        type: 'array',
        description: 'Array of cookies to delete. Use "*" as name to delete all cookies.',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Cookie name to delete (use "*" to delete all cookies for the domain/URL)',
            },
            url: {
              type: 'string',
              description: 'URL for the cookie (optional, uses current page URL if not provided)',
            },
            domain: {
              type: 'string',
              description: 'Cookie domain (e.g., ".example.com")',
            },
            path: {
              type: 'string',
              description: 'Cookie path (default: "/")',
              default: '/',
            },
          },
          required: ['name'],
        },
        minItems: 1,
      },
    },
    required: ['cookies'],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as DeleteCookiesParams;
    
    // Validate each cookie deletion request
    for (const cookie of validatedParams.cookies) {
      this.validateDeleteCookieParam(cookie);
    }

    const startTime = Date.now();
    const currentUrl = await this.getPageUrl(page);
    const currentTitle = await this.getPageTitle(page);
    
    try {
      // Get current cookies to see what we're working with
      const currentCookies = await page.cookies();
      
      const deletionResults: Array<{
        request: DeleteCookieParam;
        success: boolean;
        deletedCount: number;
        error?: string;
      }> = [];

      // Process each deletion request
      for (const deleteRequest of validatedParams.cookies) {
        try {
          let deletedCount = 0;

          if (deleteRequest.name === '*') {
            // Delete all cookies for the domain/URL
            const cookiesToDelete = this.findCookiesToDelete(currentCookies, deleteRequest);
            
            for (const cookie of cookiesToDelete) {
              await page.deleteCookie({
                name: cookie.name,
                url: deleteRequest.url,
                domain: deleteRequest.domain || cookie.domain,
                path: deleteRequest.path || cookie.path,
              });
              deletedCount++;
            }
          } else {
            // Delete specific cookie
            await page.deleteCookie({
              name: deleteRequest.name,
              url: deleteRequest.url,
              domain: deleteRequest.domain,
              path: deleteRequest.path || '/',
            });
            
            // Check if the cookie actually existed
            const existingCookie = currentCookies.find(c => 
              c.name === deleteRequest.name &&
              (!deleteRequest.domain || c.domain === deleteRequest.domain || c.domain === `.${deleteRequest.domain}`) &&
              (!deleteRequest.path || c.path === deleteRequest.path)
            );
            
            deletedCount = existingCookie ? 1 : 0;
          }

          deletionResults.push({
            request: deleteRequest,
            success: true,
            deletedCount,
          });

          // Log successful cookie deletion
          logger.info(`Cookies deleted: ${deleteRequest.name}`, {
            sessionId: context.sessionId,
            deletedCount,
            domain: deleteRequest.domain,
            path: deleteRequest.path,
          });

        } catch (error) {
          deletionResults.push({
            request: deleteRequest,
            success: false,
            deletedCount: 0,
            error: error instanceof Error ? error.message : String(error),
          });

          browserLogger.error(`Failed to delete cookie: ${deleteRequest.name}`, error instanceof Error ? error : new Error(String(error)), context.sessionId);
        }
      }

      const duration = Date.now() - startTime;
      const totalDeleted = deletionResults.reduce((sum, result) => sum + result.deletedCount, 0);
      const successfulRequests = deletionResults.filter(r => r.success).length;
      const failedRequests = deletionResults.length - successfulRequests;

      // Verify deletion by getting updated cookies
      const remainingCookies = await page.cookies();
      const cookiesRemoved = currentCookies.length - remainingCookies.length;

      // Create detailed response
      let message = `Cookie deletion completed in ${duration}ms\n`;
      message += `Successfully processed: ${successfulRequests} requests\n`;
      if (failedRequests > 0) {
        message += `Failed requests: ${failedRequests}\n`;
      }
      message += `Total cookies deleted: ${totalDeleted}\n`;
      message += `Cookies before: ${currentCookies.length}, after: ${remainingCookies.length}\n`;
      message += `Page: ${currentTitle} (${currentUrl})\n\n`;

      // Add details for each deletion request
      message += 'Deletion Details:\n';
      deletionResults.forEach((result, index) => {
        const { request, success, deletedCount, error } = result;
        const status = success ? '✓' : '✗';
        
        if (request.name === '*') {
          message += `${index + 1}. ${status} Delete all cookies`;
        } else {
          message += `${index + 1}. ${status} Delete "${request.name}"`;
        }
        
        if (success) {
          message += ` - ${deletedCount} cookie(s) deleted`;
          if (request.domain) {
            message += ` (domain: ${request.domain})`;
          }
          if (request.path && request.path !== '/') {
            message += ` (path: ${request.path})`;
          }
        } else {
          message += ` - Error: ${error}`;
        }
        message += '\n';
      });

      // Add authentication cleanup summary
      const authCookiesRemoved = this.countAuthCookiesRemoved(currentCookies, remainingCookies);
      if (authCookiesRemoved > 0) {
        message += `\n🔐 Authentication cleanup: ${authCookiesRemoved} auth-related cookies removed\n`;
      }

      // Add security recommendations
      if (remainingCookies.length > 0) {
        const remainingAuthCookies = remainingCookies.filter(cookie => this.isLikelyAuthCookie(cookie.name));
        if (remainingAuthCookies.length > 0) {
          message += `\n⚠️  ${remainingAuthCookies.length} authentication cookies still remain:\n`;
          remainingAuthCookies.forEach(cookie => {
            message += `   • ${cookie.name} (${cookie.domain})\n`;
          });
        }
      }

      // Determine if this is an error result
      const isError = failedRequests > 0;

      return {
        content: [{
          type: 'text',
          text: message,
        }],
        isError,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('delete_cookies', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to delete cookies after ${duration}ms\n`;
      errorMessage += `Page: ${currentTitle} (${currentUrl})\n`;
      
      if (error instanceof Error) {
        if (error.message.includes('Protocol error')) {
          errorMessage += 'Browser protocol error - the page may have navigated or closed';
        } else if (error.message.includes('Invalid cookie')) {
          errorMessage += 'Invalid cookie deletion parameters provided';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
      }

      return this.createErrorResult(errorMessage, {
        cookies: validatedParams.cookies.map(c => ({ name: c.name, domain: c.domain })),
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate cookie deletion parameters
   */
  private validateDeleteCookieParam(cookie: DeleteCookieParam): void {
    // Validate cookie name
    if (!cookie.name || typeof cookie.name !== 'string') {
      throw new CookieError('Cookie name is required and must be a string');
    }

    if (cookie.name !== '*' && !/^[a-zA-Z0-9_-]+$/.test(cookie.name)) {
      throw new CookieError(`Invalid cookie name: ${cookie.name}. Only alphanumeric characters, underscores, hyphens, or "*" are allowed`);
    }

    // Validate domain if provided
    if (cookie.domain) {
      if (typeof cookie.domain !== 'string') {
        throw new CookieError('Cookie domain must be a string');
      }
      
      // Basic domain validation
      if (!/^\.?[a-zA-Z0-9.-]+$/.test(cookie.domain)) {
        throw new CookieError(`Invalid cookie domain: ${cookie.domain}`);
      }
    }

    // Validate path if provided
    if (cookie.path && typeof cookie.path !== 'string') {
      throw new CookieError('Cookie path must be a string');
    }

    // Validate URL if provided
    if (cookie.url) {
      validate.urlSafety(cookie.url);
    }
  }

  /**
   * Find cookies to delete when using wildcard
   */
  private findCookiesToDelete(currentCookies: any[], deleteRequest: DeleteCookieParam): any[] {
    return currentCookies.filter(cookie => {
      // Filter by domain if specified
      if (deleteRequest.domain) {
        const domain = deleteRequest.domain;
        const matches = cookie.domain === domain || 
                       cookie.domain === `.${domain}` ||
                       (domain.startsWith('.') && cookie.domain === domain);
        if (!matches) return false;
      }

      // Filter by path if specified
      if (deleteRequest.path && deleteRequest.path !== '/') {
        if (cookie.path !== deleteRequest.path) return false;
      }

      return true;
    });
  }

  /**
   * Check if cookie name suggests it's an authentication cookie
   */
  private isLikelyAuthCookie(name: string): boolean {
    const authPatterns = [
      /session/i,
      /auth/i,
      /token/i,
      /jwt/i,
      /login/i,
      /user/i,
      /csrf/i,
      /xsrf/i,
      /oauth/i,
      /saml/i,
      /bearer/i,
      /api[_-]?key/i,
    ];

    return authPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Count authentication cookies that were removed
   */
  private countAuthCookiesRemoved(beforeCookies: any[], afterCookies: any[]): number {
    const beforeAuthCookies = beforeCookies.filter(cookie => this.isLikelyAuthCookie(cookie.name));
    const afterAuthCookies = afterCookies.filter(cookie => this.isLikelyAuthCookie(cookie.name));
    
    // Count cookies that existed before but not after
    let removedCount = 0;
    beforeAuthCookies.forEach(beforeCookie => {
      const stillExists = afterAuthCookies.some(afterCookie => 
        afterCookie.name === beforeCookie.name && 
        afterCookie.domain === beforeCookie.domain &&
        afterCookie.path === beforeCookie.path
      );
      if (!stillExists) {
        removedCount++;
      }
    });
    
    return removedCount;
  }
}

// Create and export tool instance
export const deleteCookiesTool = new DeleteCookiesTool();
export default deleteCookiesTool;