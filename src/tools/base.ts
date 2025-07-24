/**
 * Base tool interface and utilities
 */

import { ToolImplementation, ToolContext, CallToolResult } from '@/types/mcp';
import { browserManager } from '@/services/browser';
import { logger } from '@/utils/logger';
import { BrowserError, TimeoutError } from '@/utils/errors';

/**
 * Base tool class that all Puppeteer tools extend
 */
export abstract class BaseTool implements ToolImplementation {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: ToolImplementation['inputSchema'];

  /**
   * Execute the tool with error handling and logging
   */
  async execute(params: any, context: ToolContext): Promise<CallToolResult> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing tool: ${this.name}`, {
        sessionId: context.sessionId,
        requestId: context.requestId,
        params,
      });

      // Get page for this session
      const page = await browserManager.getPage(context.sessionId);
      
      // Execute the tool-specific logic
      const result = await this.executeImpl(params, context, page);
      
      const duration = Date.now() - startTime;
      logger.info(`Tool executed successfully: ${this.name}`, {
        sessionId: context.sessionId,
        requestId: context.requestId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Tool execution failed: ${this.name}`, {
        sessionId: context.sessionId,
        requestId: context.requestId,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Return error result
      return {
        content: [{
          type: 'text',
          text: `Error executing ${this.name}: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  }

  /**
   * Tool-specific implementation (to be overridden by subclasses)
   */
  protected abstract executeImpl(
    params: any, 
    context: ToolContext, 
    page: any
  ): Promise<CallToolResult>;

  /**
   * Create success result
   */
  protected createSuccessResult(message: string, data?: any): CallToolResult {
    return {
      content: [{
        type: 'text',
        text: message,
      }],
      isError: false,
    };
  }

  /**
   * Create error result
   */
  protected createErrorResult(message: string, error?: any): CallToolResult {
    return {
      content: [{
        type: 'text',
        text: message,
      }],
      isError: true,
    };
  }

  /**
   * Create result with image content
   */
  protected createImageResult(message: string, imageData: string, mimeType: string): CallToolResult {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
        {
          type: 'image',
          data: imageData,
          mimeType,
        }
      ],
      isError: false,
    };
  }

  /**
   * Wait for element with timeout
   */
  protected async waitForElement(page: any, selector: string, timeout = 5000): Promise<void> {
    try {
      await page.waitForSelector(selector, { timeout });
    } catch (error) {
      throw new BrowserError(`Element not found: ${selector}`, { selector, timeout });
    }
  }

  /**
   * Safe element interaction with retry
   */
  protected async safeElementInteraction<T>(
    page: any,
    selector: string,
    action: (element: any) => Promise<T>,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        await this.waitForElement(page, selector);
        const element = await page.$(selector);
        
        if (!element) {
          throw new BrowserError(`Element not found: ${selector}`);
        }

        return await action(element);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < retries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          logger.debug(`Retrying element interaction (${i + 1}/${retries})`, {
            selector,
            error: lastError.message,
          });
        }
      }
    }

    throw lastError || new BrowserError(`Failed to interact with element: ${selector}`);
  }

  /**
   * Navigate with retry and error handling
   */
  protected async safeNavigate(page: any, url: string, options?: any): Promise<void> {
    try {
      const response = await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
        ...options,
      });

      if (!response) {
        throw new BrowserError(`Failed to navigate to ${url}: No response`);
      }

      if (!response.ok()) {
        throw new BrowserError(
          `Failed to navigate to ${url}: ${response.status()} ${response.statusText()}`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new TimeoutError(`Navigation timeout for ${url}`);
      }
      throw error;
    }
  }

  /**
   * Take screenshot with error handling
   */
  protected async safeScreenshot(
    page: any, 
    options: any = {}
  ): Promise<Buffer | string> {
    try {
      return await page.screenshot({
        type: 'png',
        fullPage: false,
        ...options,
      });
    } catch (error) {
      throw new BrowserError('Failed to take screenshot', { originalError: error });
    }
  }

  /**
   * Evaluate script safely
   */
  protected async safeEvaluate<T>(
    page: any,
    script: string | Function,
    ...args: any[]
  ): Promise<T> {
    try {
      return await page.evaluate(script, ...args);
    } catch (error) {
      throw new BrowserError('Script evaluation failed', { 
        script: typeof script === 'string' ? script : script.toString(),
        originalError: error 
      });
    }
  }

  /**
   * Get page title safely
   */
  protected async getPageTitle(page: any): Promise<string> {
    try {
      return await page.title() || 'Untitled';
    } catch (error) {
      return 'Untitled';
    }
  }

  /**
   * Get page URL safely
   */
  protected async getPageUrl(page: any): Promise<string> {
    try {
      return page.url() || 'about:blank';
    } catch (error) {
      return 'about:blank';
    }
  }
}

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  private tools = new Map<string, ToolImplementation>();

  /**
   * Register a tool
   */
  register(tool: ToolImplementation): void {
    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolImplementation | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  getAll(): ToolImplementation[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions(): any[] {
    return this.getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool
   */
  async execute(name: string, params: any, context: ToolContext): Promise<CallToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        content: [{
          type: 'text',
          text: `Tool not found: ${name}`,
        }],
        isError: true,
      };
    }

    return await tool.execute(params, context);
  }
}

// Create global tool registry
export const toolRegistry = new ToolRegistry();

export default BaseTool;