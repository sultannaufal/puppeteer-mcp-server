/**
 * Puppeteer set cookies tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { SetCookiesParams, CookieParam, CookieError } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger, logger } from '@/utils/logger';

/**
 * Set Cookies tool - sets authentication and other cookies for the current page
 * Optimized for authentication scenarios including session tokens, JWT, OAuth cookies
 */
export class SetCookiesTool extends BaseTool {
  name = 'puppeteer_set_cookies';
  description = 'Set authentication cookies for the current page. Supports session tokens, JWT, OAuth, and other auth cookies with security features.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      cookies: {
        type: 'array',
        description: 'Array of cookies to set',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Cookie name (e.g., "sessionId", "jwt_token", "auth_token")',
            },
            value: {
              type: 'string',
              description: 'Cookie value (e.g., session ID, JWT token, API key)',
            },
            url: {
              type: 'string',
              description: 'URL for the cookie (optional, uses current page URL if not provided)',
            },
            domain: {
              type: 'string',
              description: 'Cookie domain (e.g., ".example.com" for subdomain access)',
            },
            path: {
              type: 'string',
              description: 'Cookie path (default: "/")',
              default: '/',
            },
            secure: {
              type: 'boolean',
              description: 'Secure flag - cookie only sent over HTTPS (recommended for auth cookies)',
              default: true,
            },
            httpOnly: {
              type: 'boolean',
              description: 'HttpOnly flag - prevents XSS attacks by blocking JavaScript access (recommended for auth cookies)',
              default: true,
            },
            sameSite: {
              type: 'string',
              enum: ['Strict', 'Lax', 'None'],
              description: 'SameSite attribute for CSRF protection. Strict=most secure, Lax=balanced, None=cross-site (requires Secure)',
              default: 'Lax',
            },
            expires: {
              type: 'number',
              description: 'Expiration timestamp in seconds since Unix epoch (optional, session cookie if not set)',
            },
            priority: {
              type: 'string',
              enum: ['Low', 'Medium', 'High'],
              description: 'Cookie priority for network requests',
              default: 'Medium',
            },
          },
          required: ['name', 'value'],
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
    const validatedParams = validate.toolParams(this.name, params) as SetCookiesParams;
    
    // Validate each cookie
    for (const cookie of validatedParams.cookies) {
      this.validateCookie(cookie);
    }

    const startTime = Date.now();
    const currentUrl = await this.getPageUrl(page);
    const currentTitle = await this.getPageTitle(page);
    
    try {
      const setCookieResults: Array<{
        cookie: CookieParam;
        success: boolean;
        error?: string;
      }> = [];

      // Process each cookie
      for (const cookie of validatedParams.cookies) {
        try {
          // Prepare cookie for Puppeteer
          const puppeteerCookie = this.prepareCookieForPuppeteer(cookie, currentUrl);
          
          // Set the cookie
          await page.setCookie(puppeteerCookie);
          
          setCookieResults.push({
            cookie,
            success: true,
          });

          // Log successful cookie setting using the main logger
          logger.info(`Cookie set: ${cookie.name}`, {
            sessionId: context.sessionId,
            domain: puppeteerCookie.domain,
            secure: puppeteerCookie.secure,
            httpOnly: puppeteerCookie.httpOnly,
            sameSite: puppeteerCookie.sameSite,
          });

        } catch (error) {
          setCookieResults.push({
            cookie,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          browserLogger.error(`Failed to set cookie: ${cookie.name}`, error instanceof Error ? error : new Error(String(error)), context.sessionId);
        }
      }

      const duration = Date.now() - startTime;
      const successCount = setCookieResults.filter(r => r.success).length;
      const failureCount = setCookieResults.length - successCount;

      // Create detailed response
      let message = `Cookie operation completed in ${duration}ms\n`;
      message += `Successfully set: ${successCount} cookies\n`;
      if (failureCount > 0) {
        message += `Failed to set: ${failureCount} cookies\n`;
      }
      message += `Page: ${currentTitle} (${currentUrl})\n\n`;

      // Add details for each cookie
      message += 'Cookie Details:\n';
      setCookieResults.forEach((result, index) => {
        const { cookie, success, error } = result;
        const status = success ? '✓' : '✗';
        message += `${index + 1}. ${status} ${cookie.name}`;
        
        if (success) {
          const features = [];
          if (cookie.secure !== false) features.push('Secure');
          if (cookie.httpOnly !== false) features.push('HttpOnly');
          if (cookie.sameSite) features.push(`SameSite=${cookie.sameSite}`);
          if (features.length > 0) {
            message += ` [${features.join(', ')}]`;
          }
          if (cookie.domain) {
            message += ` (domain: ${cookie.domain})`;
          }
        } else {
          message += ` - Error: ${error}`;
        }
        message += '\n';
      });

      // Determine if this is an error result
      const isError = failureCount > 0;

      return {
        content: [{
          type: 'text',
          text: message,
        }],
        isError,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('set_cookies', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to set cookies after ${duration}ms\n`;
      errorMessage += `Page: ${currentTitle} (${currentUrl})\n`;
      
      if (error instanceof Error) {
        if (error.message.includes('Protocol error')) {
          errorMessage += 'Browser protocol error - the page may have navigated or closed';
        } else if (error.message.includes('Invalid cookie')) {
          errorMessage += 'Invalid cookie format or values provided';
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
   * Validate cookie parameters for security and correctness
   */
  private validateCookie(cookie: CookieParam): void {
    // Validate cookie name
    if (!cookie.name || typeof cookie.name !== 'string') {
      throw new CookieError('Cookie name is required and must be a string');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cookie.name)) {
      throw new CookieError(`Invalid cookie name: ${cookie.name}. Only alphanumeric characters, underscores, and hyphens are allowed`);
    }

    // Validate cookie value
    if (cookie.value === undefined || cookie.value === null) {
      throw new CookieError('Cookie value is required');
    }

    if (typeof cookie.value !== 'string') {
      throw new CookieError('Cookie value must be a string');
    }

    // Check for potentially dangerous characters in value
    if (cookie.value.includes('\n') || cookie.value.includes('\r')) {
      throw new CookieError('Cookie value cannot contain newline characters');
    }

    // Validate domain if provided
    if (cookie.domain) {
      if (typeof cookie.domain !== 'string') {
        throw new CookieError('Cookie domain must be a string');
      }
      
      // Basic domain validation
      if (!/^[a-zA-Z0-9.-]+$/.test(cookie.domain.replace(/^\./, ''))) {
        throw new CookieError(`Invalid cookie domain: ${cookie.domain}`);
      }
    }

    // Validate path if provided
    if (cookie.path && typeof cookie.path !== 'string') {
      throw new CookieError('Cookie path must be a string');
    }

    // Validate expires if provided
    if (cookie.expires !== undefined) {
      if (typeof cookie.expires !== 'number' || !Number.isFinite(cookie.expires)) {
        throw new CookieError('Cookie expires must be a valid timestamp number');
      }
      
      if (cookie.expires < 0) {
        throw new CookieError('Cookie expires timestamp cannot be negative');
      }
    }

    // Validate SameSite + Secure combination
    if (cookie.sameSite === 'None' && cookie.secure === false) {
      throw new CookieError('SameSite=None requires Secure=true for security reasons');
    }

    // Security recommendations for auth cookies
    if (this.isLikelyAuthCookie(cookie.name)) {
      if (cookie.secure === false) {
        logger.warn(`Security Warning: Auth cookie "${cookie.name}" should use Secure=true`, {
          cookieName: cookie.name,
        });
      }
      
      if (cookie.httpOnly === false) {
        logger.warn(`Security Warning: Auth cookie "${cookie.name}" should use HttpOnly=true to prevent XSS`, {
          cookieName: cookie.name,
        });
      }
    }
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
    ];

    return authPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Prepare cookie object for Puppeteer's setCookie method
   */
  private prepareCookieForPuppeteer(cookie: CookieParam, currentUrl: string): any {
    const puppeteerCookie: any = {
      name: cookie.name,
      value: cookie.value,
    };

    // Set URL or domain
    if (cookie.url) {
      puppeteerCookie.url = cookie.url;
    } else if (cookie.domain) {
      puppeteerCookie.domain = cookie.domain;
    } else {
      // Use current page URL
      puppeteerCookie.url = currentUrl;
    }

    // Set path
    puppeteerCookie.path = cookie.path || '/';

    // Set security flags with secure defaults for auth cookies
    const isAuthCookie = this.isLikelyAuthCookie(cookie.name);
    
    puppeteerCookie.secure = cookie.secure !== undefined ? cookie.secure : (isAuthCookie ? true : false);
    puppeteerCookie.httpOnly = cookie.httpOnly !== undefined ? cookie.httpOnly : (isAuthCookie ? true : false);
    
    // Set SameSite with secure default
    if (cookie.sameSite) {
      puppeteerCookie.sameSite = cookie.sameSite;
    } else {
      puppeteerCookie.sameSite = isAuthCookie ? 'Lax' : 'Lax';
    }

    // Set expiration
    if (cookie.expires) {
      puppeteerCookie.expires = cookie.expires;
    }

    // Set priority
    if (cookie.priority) {
      puppeteerCookie.priority = cookie.priority;
    }

    // Set additional Chrome-specific properties if provided
    if (cookie.sameParty !== undefined) {
      puppeteerCookie.sameParty = cookie.sameParty;
    }

    if (cookie.sourceScheme) {
      puppeteerCookie.sourceScheme = cookie.sourceScheme;
    }

    if (cookie.sourcePort) {
      puppeteerCookie.sourcePort = cookie.sourcePort;
    }

    return puppeteerCookie;
  }
}

// Create and export tool instance
export const setCookiesTool = new SetCookiesTool();
export default setCookiesTool;