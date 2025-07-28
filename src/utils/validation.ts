/**
 * Parameter validation utilities for MCP tools
 */

import Joi from 'joi';
import { ValidationError } from './errors';

// Common validation schemas
export const commonSchemas = {
  url: Joi.string().uri({ scheme: ['http', 'https', 'file'] }).required(),
  selector: Joi.string().min(1).max(1000).pattern(/^[a-zA-Z0-9\-_#.\[\]:(),\s>+~*="']+$/).required(),
  optionalSelector: Joi.string().min(1).max(1000).pattern(/^[a-zA-Z0-9\-_#.\[\]:(),\s>+~*="']+$/).optional(),
  sessionId: Joi.string().uuid().required(),
  name: Joi.string().min(1).max(255).required(),
  value: Joi.string().max(10000).required(),
  script: Joi.string().min(1).max(50000).required(),
  width: Joi.number().integer().min(100).max(4096).optional(),
  height: Joi.number().integer().min(100).max(4096).optional(),
  encoded: Joi.boolean().optional(),
  useBinaryUrl: Joi.boolean().optional(),
  allowDangerous: Joi.boolean().optional(),
};

// Mouse-specific validation schemas
export const mouseSchemas = {
  coordinates: Joi.object({
    x: Joi.number().integer().min(0).max(4096).required(),
    y: Joi.number().integer().min(0).max(4096).required(),
  }),
  mouseButton: Joi.string().valid('left', 'right', 'middle', 'back', 'forward').default('left'),
  steps: Joi.number().integer().min(1).max(100).default(1),
  clickCount: Joi.number().integer().min(1).max(3).default(1),
  delay: Joi.number().integer().min(0).max(5000).default(0),
  wheelDelta: Joi.number().integer().min(-1000).max(1000).default(0),
};

// Tool-specific validation schemas
export const toolSchemas = {
  puppeteer_navigate: Joi.object({
    url: commonSchemas.url,
    launchOptions: Joi.object().optional(),
    allowDangerous: commonSchemas.allowDangerous,
  }),

  puppeteer_screenshot: Joi.object({
    name: commonSchemas.name,
    selector: commonSchemas.optionalSelector,
    width: commonSchemas.width.default(800),
    height: commonSchemas.height.default(600),
    encoded: commonSchemas.encoded.default(false),
    useBinaryUrl: commonSchemas.useBinaryUrl.default(false),
  }),

  puppeteer_click: Joi.object({
    selector: commonSchemas.selector,
  }),

  puppeteer_fill: Joi.object({
    selector: commonSchemas.selector,
    value: commonSchemas.value,
  }),

  puppeteer_select: Joi.object({
    selector: commonSchemas.selector,
    value: commonSchemas.value,
  }),

  puppeteer_hover: Joi.object({
    selector: commonSchemas.selector,
  }),

  puppeteer_evaluate: Joi.object({
    script: commonSchemas.script,
  }),

  // Advanced Mouse Tools
  puppeteer_mouse_move: Joi.object({
    x: mouseSchemas.coordinates.extract('x'),
    y: mouseSchemas.coordinates.extract('y'),
    steps: mouseSchemas.steps.optional(),
  }),

  puppeteer_mouse_click: Joi.object({
    x: mouseSchemas.coordinates.extract('x'),
    y: mouseSchemas.coordinates.extract('y'),
    button: mouseSchemas.mouseButton.optional(),
    clickCount: mouseSchemas.clickCount.optional(),
    delay: mouseSchemas.delay.optional(),
  }),

  puppeteer_mouse_down: Joi.object({
    x: mouseSchemas.coordinates.extract('x'),
    y: mouseSchemas.coordinates.extract('y'),
    button: mouseSchemas.mouseButton.optional(),
  }),

  puppeteer_mouse_up: Joi.object({
    x: mouseSchemas.coordinates.extract('x'),
    y: mouseSchemas.coordinates.extract('y'),
    button: mouseSchemas.mouseButton.optional(),
  }),

  puppeteer_mouse_wheel: Joi.object({
    x: mouseSchemas.coordinates.extract('x'),
    y: mouseSchemas.coordinates.extract('y'),
    deltaX: mouseSchemas.wheelDelta.optional(),
    deltaY: mouseSchemas.wheelDelta.optional(),
  }),

  puppeteer_mouse_drag: Joi.object({
    startX: mouseSchemas.coordinates.extract('x'),
    startY: mouseSchemas.coordinates.extract('y'),
    endX: mouseSchemas.coordinates.extract('x'),
    endY: mouseSchemas.coordinates.extract('y'),
    steps: mouseSchemas.steps.optional(),
    delay: mouseSchemas.delay.optional(),
  }),

  // Cookie Management Tools
  puppeteer_get_cookies: Joi.object({
    urls: Joi.array().items(commonSchemas.url).optional(),
    names: Joi.array().items(Joi.string().min(1).max(255).pattern(/^[a-zA-Z0-9_-]+$/)).optional(),
    domain: Joi.string().min(1).max(255).pattern(/^\.?[a-zA-Z0-9.-]+$/).optional(),
  }),

  puppeteer_set_cookies: Joi.object({
    cookies: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(255).pattern(/^[a-zA-Z0-9_-]+$/).required(),
        value: Joi.string().max(10000).required(),
        url: commonSchemas.url.optional(),
        domain: Joi.string().min(1).max(255).pattern(/^\.?[a-zA-Z0-9.-]+$/).optional(),
        path: Joi.string().min(1).max(1000).default('/').optional(),
        secure: Joi.boolean().optional(),
        httpOnly: Joi.boolean().optional(),
        sameSite: Joi.string().valid('Strict', 'Lax', 'None').optional(),
        expires: Joi.number().integer().min(0).optional(),
        priority: Joi.string().valid('Low', 'Medium', 'High').optional(),
        sameParty: Joi.boolean().optional(),
        sourceScheme: Joi.string().valid('Unset', 'NonSecure', 'Secure').optional(),
        sourcePort: Joi.number().integer().min(1).max(65535).optional(),
      })
    ).min(1).required(),
  }),

  puppeteer_delete_cookies: Joi.object({
    cookies: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(255).pattern(/^(\*|[a-zA-Z0-9_-]+)$/).required(),
        url: commonSchemas.url.optional(),
        domain: Joi.string().min(1).max(255).pattern(/^\.?[a-zA-Z0-9.-]+$/).optional(),
        path: Joi.string().min(1).max(1000).default('/').optional(),
      })
    ).min(1).required(),
  }),
};

// MCP protocol validation schemas
export const mcpSchemas = {
  jsonrpcRequest: Joi.object({
    jsonrpc: Joi.string().valid('2.0').required(),
    id: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.valid(null)).optional(),
    method: Joi.string().required(),
    params: Joi.object().optional(),
  }),

  initialize: Joi.object({
    protocolVersion: Joi.string().required(),
    capabilities: Joi.object().required(),
    clientInfo: Joi.object({
      name: Joi.string().required(),
      version: Joi.string().required(),
    }).required(),
  }),

  toolsCall: Joi.object({
    name: Joi.string().valid(
      'puppeteer_navigate',
      'puppeteer_screenshot',
      'puppeteer_click',
      'puppeteer_fill',
      'puppeteer_select',
      'puppeteer_hover',
      'puppeteer_evaluate',
      'puppeteer_mouse_move',
      'puppeteer_mouse_click',
      'puppeteer_mouse_down',
      'puppeteer_mouse_up',
      'puppeteer_mouse_wheel',
      'puppeteer_mouse_drag',
      'puppeteer_get_cookies',
      'puppeteer_set_cookies',
      'puppeteer_delete_cookies'
    ).required(),
    arguments: Joi.object().optional(),
  }),
};

/**
 * Validate tool parameters
 */
export function validateToolParams(toolName: string, params: any): any {
  const schema = toolSchemas[toolName as keyof typeof toolSchemas];
  if (!schema) {
    throw new ValidationError(`Unknown tool: ${toolName}`);
  }

  const { error, value } = schema.validate(params, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const details = error.details.map(detail => detail.message).join(', ');
    throw new ValidationError(`Invalid parameters for ${toolName}: ${details}`, {
      tool: toolName,
      errors: error.details,
    });
  }

  return value;
}

/**
 * Validate MCP request
 */
export function validateMCPRequest(request: any): any {
  const { error, value } = mcpSchemas.jsonrpcRequest.validate(request, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map(detail => detail.message).join(', ');
    throw new ValidationError(`Invalid MCP request: ${details}`, {
      errors: error.details,
    });
  }

  return value;
}

/**
 * Validate initialize request parameters
 */
export function validateInitializeParams(params: any): any {
  const { error, value } = mcpSchemas.initialize.validate(params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map(detail => detail.message).join(', ');
    throw new ValidationError(`Invalid initialize parameters: ${details}`, {
      errors: error.details,
    });
  }

  return value;
}

/**
 * Validate tools/call request parameters
 */
export function validateToolsCallParams(params: any): any {
  const { error, value } = mcpSchemas.toolsCall.validate(params, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map(detail => detail.message).join(', ');
    throw new ValidationError(`Invalid tools/call parameters: ${details}`, {
      errors: error.details,
    });
  }

  // Validate tool-specific arguments
  if (value.arguments) {
    value.arguments = validateToolParams(value.name, value.arguments);
  }

  return value;
}

/**
 * Validate URL safety
 */
export function validateUrlSafety(url: string): void {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:', 'file:'].includes(urlObj.protocol)) {
      throw new ValidationError(`Unsupported protocol: ${urlObj.protocol}`);
    }
    
    // Check for localhost/private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = urlObj.hostname.toLowerCase();
      
      // Block localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        throw new ValidationError('Localhost URLs are not allowed in production');
      }
      
      // Block private IP ranges
      const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
      if (privateIPRegex.test(hostname)) {
        throw new ValidationError('Private IP addresses are not allowed in production');
      }
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /about:/i,
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        throw new ValidationError(`Potentially unsafe URL pattern detected: ${url}`);
      }
    }
    
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Invalid URL format: ${url}`);
  }
}

/**
 * Validate CSS selector safety
 */
export function validateSelectorSafety(selector: string): void {
  // Check for potentially dangerous selectors
  const dangerousPatterns = [
    /javascript:/i,
    /expression\(/i,
    /url\(/i,
    /@import/i,
    /behavior:/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(selector)) {
      throw new ValidationError(`Potentially unsafe selector pattern detected: ${selector}`);
    }
  }
  
  // Check selector length
  if (selector.length > 1000) {
    throw new ValidationError('Selector is too long (max 1000 characters)');
  }
  
  // Basic syntax validation
  try {
    // This is a simple check - in a real browser environment,
    // we would use document.querySelector to validate
    if (!selector.trim()) {
      throw new ValidationError('Selector cannot be empty');
    }
  } catch (error) {
    throw new ValidationError(`Invalid selector syntax: ${selector}`);
  }
}

/**
 * Validate script safety for evaluation
 */
export function validateScriptSafety(script: string): void {
  // Check script length
  if (script.length > 50000) {
    throw new ValidationError('Script is too long (max 50000 characters)');
  }
  
  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /eval\(/i,
    /Function\(/i,
    /setTimeout\(/i,
    /setInterval\(/i,
    /XMLHttpRequest/i,
    /fetch\(/i,
    /import\(/i,
    /require\(/i,
    /process\./i,
    /global\./i,
    /window\.location/i,
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(script)) {
      throw new ValidationError(`Potentially unsafe script pattern detected: ${pattern.source}`);
    }
  }
}

/**
 * Validate launch options safety
 */
export function validateLaunchOptionsSafety(launchOptions: any, allowDangerous = false): void {
  if (!launchOptions || typeof launchOptions !== 'object') {
    return;
  }
  
  // Dangerous arguments that should be filtered
  const dangerousArgs = [
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--disable-site-isolation-trials',
    '--disable-features=VizDisplayCompositor',
    '--remote-debugging-port',
    '--remote-debugging-address',
  ];
  
  if (launchOptions.args && Array.isArray(launchOptions.args)) {
    for (const arg of launchOptions.args) {
      if (typeof arg === 'string') {
        for (const dangerousArg of dangerousArgs) {
          if (arg.includes(dangerousArg) && !allowDangerous) {
            throw new ValidationError(
              `Dangerous launch argument not allowed: ${dangerousArg}. Use allowDangerous: true to override.`
            );
          }
        }
      }
    }
  }
  
  // Check for dangerous options
  const dangerousOptions = ['executablePath', 'userDataDir'];
  for (const option of dangerousOptions) {
    if (launchOptions[option] && !allowDangerous) {
      throw new ValidationError(
        `Dangerous launch option not allowed: ${option}. Use allowDangerous: true to override.`
      );
    }
  }
}

/**
 * Sanitize and validate file name
 */
export function validateFileName(name: string): string {
  // Remove potentially dangerous characters
  const sanitized = name.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
  
  // Ensure it's not empty after sanitization
  if (!sanitized || sanitized.length === 0) {
    throw new ValidationError('Invalid file name after sanitization');
  }
  
  // Check length
  if (sanitized.length > 255) {
    throw new ValidationError('File name is too long (max 255 characters)');
  }
  
  // Prevent directory traversal
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new ValidationError('File name contains invalid path characters');
  }
  
  return sanitized;
}

/**
 * Validate coordinate safety and bounds
 */
export function validateCoordinateSafety(x: number, y: number, bounds?: { width: number; height: number }): void {
  // Check if coordinates are valid numbers
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new ValidationError('Coordinates must be numbers');
  }
  
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new ValidationError('Coordinates must be finite numbers');
  }
  
  // Check if coordinates are non-negative
  if (x < 0 || y < 0) {
    throw new ValidationError('Coordinates must be non-negative');
  }
  
  // Check maximum bounds (reasonable viewport limits)
  if (x > 4096 || y > 4096) {
    throw new ValidationError('Coordinates exceed maximum allowed values (4096x4096)');
  }
  
  // Check against specific viewport bounds if provided
  if (bounds) {
    if (x > bounds.width || y > bounds.height) {
      throw new ValidationError(`Coordinates (${x}, ${y}) exceed viewport bounds (${bounds.width}x${bounds.height})`);
    }
  }
}

/**
 * Validate mouse button safety
 */
export function validateMouseButtonSafety(button: string): void {
  const validButtons = ['left', 'right', 'middle', 'back', 'forward'];
  if (!validButtons.includes(button)) {
    throw new ValidationError(`Invalid mouse button: ${button}. Valid buttons: ${validButtons.join(', ')}`);
  }
}

/**
 * Validate wheel delta values
 */
export function validateWheelDeltaSafety(deltaX?: number, deltaY?: number): void {
  if (deltaX !== undefined) {
    if (typeof deltaX !== 'number' || !Number.isFinite(deltaX)) {
      throw new ValidationError('deltaX must be a finite number');
    }
    if (Math.abs(deltaX) > 1000) {
      throw new ValidationError('deltaX must be between -1000 and 1000');
    }
  }
  
  if (deltaY !== undefined) {
    if (typeof deltaY !== 'number' || !Number.isFinite(deltaY)) {
      throw new ValidationError('deltaY must be a finite number');
    }
    if (Math.abs(deltaY) > 1000) {
      throw new ValidationError('deltaY must be between -1000 and 1000');
    }
  }
}

/**
 * Export validation functions for easy access
 */
export const validate = {
  toolParams: validateToolParams,
  mcpRequest: validateMCPRequest,
  initializeParams: validateInitializeParams,
  toolsCallParams: validateToolsCallParams,
  urlSafety: validateUrlSafety,
  selectorSafety: validateSelectorSafety,
  scriptSafety: validateScriptSafety,
  launchOptionsSafety: validateLaunchOptionsSafety,
  fileName: validateFileName,
  coordinateSafety: validateCoordinateSafety,
  mouseButtonSafety: validateMouseButtonSafety,
  wheelDeltaSafety: validateWheelDeltaSafety,
};

export default validate;