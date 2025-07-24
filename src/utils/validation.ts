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
  allowDangerous: Joi.boolean().optional(),
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
      'puppeteer_evaluate'
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
};

export default validate;