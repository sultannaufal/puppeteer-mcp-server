/**
 * Custom error classes and error handling utilities
 */

import { ErrorCodes } from '@/types/mcp';
import { JSONRPCError } from '@/types/mcp';

/**
 * Base MCP Error class
 */
export class MCPError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'MCPError';
    Error.captureStackTrace(this, MCPError);
  }

  toJSONRPCError(): JSONRPCError {
    return {
      code: this.code,
      message: this.message,
      data: this.data,
    };
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends MCPError {
  constructor(message = 'Authentication failed', data?: any) {
    super(ErrorCodes.AUTHENTICATION_ERROR, message, data);
    this.name = 'AuthenticationError';
  }
}

/**
 * Browser Error
 */
export class BrowserError extends MCPError {
  constructor(message: string, data?: any) {
    super(ErrorCodes.BROWSER_ERROR, message, data);
    this.name = 'BrowserError';
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends MCPError {
  constructor(message: string, data?: any) {
    super(ErrorCodes.TIMEOUT_ERROR, message, data);
    this.name = 'TimeoutError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends MCPError {
  constructor(message: string, data?: any) {
    super(ErrorCodes.VALIDATION_ERROR, message, data);
    this.name = 'ValidationError';
  }
}

/**
 * Resource Not Found Error
 */
export class ResourceNotFoundError extends MCPError {
  constructor(message: string, data?: any) {
    super(ErrorCodes.RESOURCE_NOT_FOUND, message, data);
    this.name = 'ResourceNotFoundError';
  }
}

/**
 * Rate Limit Exceeded Error
 */
export class RateLimitExceededError extends MCPError {
  constructor(message = 'Rate limit exceeded', data?: any) {
    super(ErrorCodes.RATE_LIMIT_EXCEEDED, message, data);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Parse Error
 */
export class ParseError extends MCPError {
  constructor(message = 'Parse error', data?: any) {
    super(ErrorCodes.PARSE_ERROR, message, data);
    this.name = 'ParseError';
  }
}

/**
 * Invalid Request Error
 */
export class InvalidRequestError extends MCPError {
  constructor(message = 'Invalid request', data?: any) {
    super(ErrorCodes.INVALID_REQUEST, message, data);
    this.name = 'InvalidRequestError';
  }
}

/**
 * Method Not Found Error
 */
export class MethodNotFoundError extends MCPError {
  constructor(method: string, data?: any) {
    super(ErrorCodes.METHOD_NOT_FOUND, `Method not found: ${method}`, data);
    this.name = 'MethodNotFoundError';
  }
}

/**
 * Invalid Params Error
 */
export class InvalidParamsError extends MCPError {
  constructor(message = 'Invalid params', data?: any) {
    super(ErrorCodes.INVALID_PARAMS, message, data);
    this.name = 'InvalidParamsError';
  }
}

/**
 * Internal Error
 */
export class InternalError extends MCPError {
  constructor(message = 'Internal error', data?: any) {
    super(ErrorCodes.INTERNAL_ERROR, message, data);
    this.name = 'InternalError';
  }
}

/**
 * Error factory for creating appropriate error types
 */
export class ErrorFactory {
  static fromCode(code: number, message: string, data?: any): MCPError {
    switch (code) {
      case ErrorCodes.AUTHENTICATION_ERROR:
        return new AuthenticationError(message, data);
      case ErrorCodes.BROWSER_ERROR:
        return new BrowserError(message, data);
      case ErrorCodes.TIMEOUT_ERROR:
        return new TimeoutError(message, data);
      case ErrorCodes.VALIDATION_ERROR:
        return new ValidationError(message, data);
      case ErrorCodes.RESOURCE_NOT_FOUND:
        return new ResourceNotFoundError(message, data);
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        return new RateLimitExceededError(message, data);
      case ErrorCodes.PARSE_ERROR:
        return new ParseError(message, data);
      case ErrorCodes.INVALID_REQUEST:
        return new InvalidRequestError(message, data);
      case ErrorCodes.METHOD_NOT_FOUND:
        return new MethodNotFoundError(message, data);
      case ErrorCodes.INVALID_PARAMS:
        return new InvalidParamsError(message, data);
      case ErrorCodes.INTERNAL_ERROR:
        return new InternalError(message, data);
      default:
        return new MCPError(code, message, data);
    }
  }

  static fromError(error: Error): MCPError {
    if (error instanceof MCPError) {
      return error;
    }

    // Map common Node.js errors
    if (error.name === 'TimeoutError') {
      return new TimeoutError(error.message);
    }

    if (error.name === 'ValidationError') {
      return new ValidationError(error.message);
    }

    // Default to internal error
    return new InternalError(error.message, { originalError: error.name });
  }
}

/**
 * Error handler utility functions
 */
export class ErrorHandler {
  /**
   * Handle and format errors for JSON-RPC response
   */
  static handleError(error: unknown, requestId: string | number | null = null): {
    error: JSONRPCError;
    statusCode: number;
  } {
    let mcpError: MCPError;

    if (error instanceof MCPError) {
      mcpError = error;
    } else if (error instanceof Error) {
      mcpError = ErrorFactory.fromError(error);
    } else {
      mcpError = new InternalError('Unknown error occurred');
    }

    // Determine HTTP status code
    let statusCode = 500;
    switch (mcpError.code) {
      case ErrorCodes.AUTHENTICATION_ERROR:
        statusCode = 401;
        break;
      case ErrorCodes.VALIDATION_ERROR:
      case ErrorCodes.INVALID_REQUEST:
      case ErrorCodes.INVALID_PARAMS:
      case ErrorCodes.PARSE_ERROR:
        statusCode = 400;
        break;
      case ErrorCodes.RESOURCE_NOT_FOUND:
      case ErrorCodes.METHOD_NOT_FOUND:
        statusCode = 404;
        break;
      case ErrorCodes.RATE_LIMIT_EXCEEDED:
        statusCode = 429;
        break;
      case ErrorCodes.TIMEOUT_ERROR:
        statusCode = 504;
        break;
      default:
        statusCode = 500;
    }

    return {
      error: mcpError.toJSONRPCError(),
      statusCode,
    };
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    error: unknown,
    requestId: string | number | null = null
  ): {
    jsonrpc: '2.0';
    id: string | number | null;
    error: JSONRPCError;
  } {
    const { error: jsonRpcError } = ErrorHandler.handleError(error, requestId);

    return {
      jsonrpc: '2.0',
      id: requestId,
      error: jsonRpcError,
    };
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: unknown): boolean {
    if (error instanceof MCPError) {
      const retryableCodes = [
        ErrorCodes.TIMEOUT_ERROR,
        ErrorCodes.INTERNAL_ERROR,
        ErrorCodes.BROWSER_ERROR,
      ];
      return retryableCodes.includes(error.code as typeof retryableCodes[number]);
    }
    return false;
  }

  /**
   * Get error severity level
   */
  static getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
    if (error instanceof MCPError) {
      switch (error.code) {
        case ErrorCodes.VALIDATION_ERROR:
        case ErrorCodes.INVALID_PARAMS:
        case ErrorCodes.RESOURCE_NOT_FOUND:
          return 'low';
        case ErrorCodes.AUTHENTICATION_ERROR:
        case ErrorCodes.RATE_LIMIT_EXCEEDED:
        case ErrorCodes.METHOD_NOT_FOUND:
          return 'medium';
        case ErrorCodes.BROWSER_ERROR:
        case ErrorCodes.TIMEOUT_ERROR:
          return 'high';
        case ErrorCodes.INTERNAL_ERROR:
          return 'critical';
        default:
          return 'medium';
      }
    }
    return 'high';
  }
}

/**
 * Async error wrapper for handling promises
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw ErrorFactory.fromError(error instanceof Error ? error : new Error(String(error)));
    }
  };
}

/**
 * Validation helper functions
 */
export class ValidationHelper {
  static validateRequired(value: any, fieldName: string): void {
    if (value === undefined || value === null) {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  static validateString(value: any, fieldName: string, minLength = 0, maxLength = Infinity): void {
    ValidationHelper.validateRequired(value, fieldName);
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
    }
    if (value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be at most ${maxLength} characters long`);
    }
  }

  static validateNumber(value: any, fieldName: string, min = -Infinity, max = Infinity): void {
    ValidationHelper.validateRequired(value, fieldName);
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }
    if (value < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }
    if (value > max) {
      throw new ValidationError(`${fieldName} must be at most ${max}`);
    }
  }

  static validateBoolean(value: any, fieldName: string): void {
    ValidationHelper.validateRequired(value, fieldName);
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`);
    }
  }

  static validateUrl(value: any, fieldName: string): void {
    ValidationHelper.validateString(value, fieldName);
    try {
      new URL(value);
    } catch {
      throw new ValidationError(`${fieldName} must be a valid URL`);
    }
  }

  static validateSelector(value: any, fieldName: string): void {
    ValidationHelper.validateString(value, fieldName, 1);
    // Basic CSS selector validation
    if (!/^[a-zA-Z0-9\-_#.\[\]:(),\s>+~*="']+$/.test(value)) {
      throw new ValidationError(`${fieldName} must be a valid CSS selector`);
    }
  }
}

/**
 * Export all error types for easy importing
 */
export {
  ErrorCodes,
  MCPError as default,
};