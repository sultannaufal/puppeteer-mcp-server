/**
 * Puppeteer get cookies tool implementation
 */

import { Page } from 'puppeteer';
import { BaseTool } from './base';
import { ToolContext, CallToolResult } from '@/types/mcp';
import { GetCookiesParams, CookieInfo, CookieError } from '@/types/puppeteer';
import { validate } from '@/utils/validation';
import { browserLogger, logger } from '@/utils/logger';

/**
 * Get Cookies tool - retrieves cookies from the current page
 * Optimized for reading authentication state and session information
 */
export class GetCookiesTool extends BaseTool {
  name = 'puppeteer_get_cookies';
  description = 'Get cookies from the current page. Useful for reading authentication state, session tokens, and other cookie-based data.';
  
  inputSchema = {
    type: 'object' as const,
    properties: {
      urls: {
        type: 'array',
        description: 'Array of URLs to get cookies for (optional, gets cookies for current page if not provided)',
        items: {
          type: 'string',
        },
      },
      names: {
        type: 'array',
        description: 'Array of specific cookie names to retrieve (optional, gets all cookies if not provided)',
        items: {
          type: 'string',
        },
      },
      domain: {
        type: 'string',
        description: 'Filter cookies by domain (optional, e.g., ".example.com")',
      },
    },
    required: [],
  };

  protected async executeImpl(
    params: any,
    context: ToolContext,
    page: Page
  ): Promise<CallToolResult> {
    // Validate parameters
    const validatedParams = validate.toolParams(this.name, params) as GetCookiesParams;
    
    // Validate URLs if provided
    if (validatedParams.urls) {
      for (const url of validatedParams.urls) {
        validate.urlSafety(url);
      }
    }

    // Validate cookie names if provided
    if (validatedParams.names) {
      for (const name of validatedParams.names) {
        this.validateCookieName(name);
      }
    }

    // Validate domain if provided
    if (validatedParams.domain) {
      this.validateDomain(validatedParams.domain);
    }

    const startTime = Date.now();
    const currentUrl = await this.getPageUrl(page);
    const currentTitle = await this.getPageTitle(page);
    
    try {
      // Get cookies from the page
      let cookies: any[];
      
      if (validatedParams.urls && validatedParams.urls.length > 0) {
        // Get cookies for specific URLs
        cookies = await page.cookies(...validatedParams.urls);
      } else {
        // Get all cookies for current page
        cookies = await page.cookies();
      }

      // Filter cookies based on parameters
      let filteredCookies = cookies;

      // Filter by domain if specified
      if (validatedParams.domain) {
        const domain = validatedParams.domain;
        filteredCookies = filteredCookies.filter(cookie =>
          cookie.domain === domain ||
          cookie.domain === `.${domain}` ||
          (domain.startsWith('.') && cookie.domain === domain)
        );
      }

      // Filter by names if specified
      if (validatedParams.names && validatedParams.names.length > 0) {
        filteredCookies = filteredCookies.filter(cookie => 
          validatedParams.names!.includes(cookie.name)
        );
      }

      const duration = Date.now() - startTime;

      // Log cookie retrieval
      logger.info(`Retrieved ${filteredCookies.length} cookies`, {
        sessionId: context.sessionId,
        totalCookies: cookies.length,
        filteredCookies: filteredCookies.length,
        domain: validatedParams.domain,
        names: validatedParams.names,
      });

      // Analyze cookies for authentication patterns
      const authCookies = filteredCookies.filter(cookie => this.isLikelyAuthCookie(cookie.name));
      const sessionCookies = filteredCookies.filter(cookie => cookie.session);
      const secureCookies = filteredCookies.filter(cookie => cookie.secure);
      const httpOnlyCookies = filteredCookies.filter(cookie => cookie.httpOnly);

      // Create detailed response
      let message = `Retrieved ${filteredCookies.length} cookies in ${duration}ms\n`;
      message += `Page: ${currentTitle} (${currentUrl})\n\n`;

      if (filteredCookies.length === 0) {
        message += 'No cookies found matching the specified criteria.\n';
        
        if (validatedParams.names) {
          message += `Searched for: ${validatedParams.names.join(', ')}\n`;
        }
        if (validatedParams.domain) {
          message += `Domain filter: ${validatedParams.domain}\n`;
        }
      } else {
        // Add summary statistics
        message += 'Cookie Summary:\n';
        message += `• Total cookies: ${filteredCookies.length}\n`;
        message += `• Authentication cookies: ${authCookies.length}\n`;
        message += `• Session cookies: ${sessionCookies.length}\n`;
        message += `• Secure cookies: ${secureCookies.length}\n`;
        message += `• HttpOnly cookies: ${httpOnlyCookies.length}\n\n`;

        // Add detailed cookie information
        message += 'Cookie Details:\n';
        filteredCookies.forEach((cookie, index) => {
          message += `${index + 1}. ${cookie.name}\n`;
          message += `   Value: ${this.truncateValue(cookie.value)}\n`;
          message += `   Domain: ${cookie.domain}\n`;
          message += `   Path: ${cookie.path}\n`;
          
          const attributes = [];
          if (cookie.secure) attributes.push('Secure');
          if (cookie.httpOnly) attributes.push('HttpOnly');
          if (cookie.session) attributes.push('Session');
          if (cookie.sameSite) attributes.push(`SameSite=${cookie.sameSite}`);
          
          if (attributes.length > 0) {
            message += `   Attributes: ${attributes.join(', ')}\n`;
          }
          
          if (!cookie.session && cookie.expires) {
            const expiryDate = new Date(cookie.expires * 1000);
            message += `   Expires: ${expiryDate.toISOString()}\n`;
          }
          
          if (this.isLikelyAuthCookie(cookie.name)) {
            message += `   🔐 Authentication cookie detected\n`;
          }
          
          message += '\n';
        });

        // Add security recommendations
        const securityIssues = this.analyzeSecurityIssues(filteredCookies);
        if (securityIssues.length > 0) {
          message += 'Security Recommendations:\n';
          securityIssues.forEach(issue => {
            message += `⚠️  ${issue}\n`;
          });
        }
      }

      // Convert cookies to our CookieInfo format for structured data
      const cookieInfos: CookieInfo[] = filteredCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires || -1,
        size: cookie.size || (cookie.name.length + cookie.value.length),
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        session: cookie.session || false,
        sameSite: cookie.sameSite,
        priority: cookie.priority,
        sameParty: cookie.sameParty,
        sourceScheme: cookie.sourceScheme,
        sourcePort: cookie.sourcePort,
      }));

      return this.createSuccessResult(message, {
        cookies: cookieInfos,
        summary: {
          total: filteredCookies.length,
          authCookies: authCookies.length,
          sessionCookies: sessionCookies.length,
          secureCookies: secureCookies.length,
          httpOnlyCookies: httpOnlyCookies.length,
        },
        filters: {
          domain: validatedParams.domain,
          names: validatedParams.names,
          urls: validatedParams.urls,
        },
        duration,
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      browserLogger.error('get_cookies', error instanceof Error ? error : new Error(String(error)), context.sessionId);

      let errorMessage = `Failed to get cookies after ${duration}ms\n`;
      errorMessage += `Page: ${currentTitle} (${currentUrl})\n`;
      
      if (error instanceof Error) {
        if (error.message.includes('Protocol error')) {
          errorMessage += 'Browser protocol error - the page may have navigated or closed';
        } else if (error.message.includes('Invalid URL')) {
          errorMessage += 'Invalid URL provided in the request';
        } else {
          errorMessage += `Error: ${error.message}`;
        }
      }

      return this.createErrorResult(errorMessage, {
        filters: {
          domain: validatedParams.domain,
          names: validatedParams.names,
          urls: validatedParams.urls,
        },
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate cookie name
   */
  private validateCookieName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new CookieError('Cookie name must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new CookieError(`Invalid cookie name: ${name}. Only alphanumeric characters, underscores, and hyphens are allowed`);
    }
  }

  /**
   * Validate domain
   */
  private validateDomain(domain: string): void {
    if (!domain || typeof domain !== 'string') {
      throw new CookieError('Domain must be a non-empty string');
    }

    // Basic domain validation
    if (!/^\.?[a-zA-Z0-9.-]+$/.test(domain)) {
      throw new CookieError(`Invalid domain: ${domain}`);
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
      /bearer/i,
      /api[_-]?key/i,
    ];

    return authPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Truncate cookie value for display (security)
   */
  private truncateValue(value: string): string {
    if (value.length <= 50) {
      return value;
    }
    
    // For JWT tokens, show structure
    if (value.includes('.') && value.split('.').length === 3) {
      return `${value.substring(0, 20)}...[JWT]...${value.substring(value.length - 10)}`;
    }
    
    // For other long values, truncate
    return `${value.substring(0, 30)}...[${value.length} chars total]`;
  }

  /**
   * Analyze cookies for security issues
   */
  private analyzeSecurityIssues(cookies: any[]): string[] {
    const issues: string[] = [];
    
    const authCookies = cookies.filter(cookie => this.isLikelyAuthCookie(cookie.name));
    
    // Check for insecure auth cookies
    authCookies.forEach(cookie => {
      if (!cookie.secure) {
        issues.push(`Auth cookie "${cookie.name}" should use Secure flag for HTTPS-only transmission`);
      }
      
      if (!cookie.httpOnly) {
        issues.push(`Auth cookie "${cookie.name}" should use HttpOnly flag to prevent XSS attacks`);
      }
      
      if (!cookie.sameSite || cookie.sameSite === 'None') {
        issues.push(`Auth cookie "${cookie.name}" should use SameSite=Lax or Strict for CSRF protection`);
      }
    });

    // Check for session cookies without expiration
    const sessionAuthCookies = authCookies.filter(cookie => cookie.session);
    if (sessionAuthCookies.length > 0) {
      issues.push(`${sessionAuthCookies.length} auth cookies are session-only (no expiration). Consider setting explicit expiration for better security.`);
    }

    return issues;
  }
}

// Create and export tool instance
export const getCookiesTool = new GetCookiesTool();
export default getCookiesTool;