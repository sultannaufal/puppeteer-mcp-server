/**
 * Puppeteer-specific type definitions for the MCP server
 */

import type { Page, Browser, LaunchOptions } from 'puppeteer';

// Puppeteer Tool Parameters
export interface NavigateParams {
  url: string;
  launchOptions?: LaunchOptions;
  allowDangerous?: boolean;
}

export interface ScreenshotParams {
  name: string;
  selector?: string;
  width?: number;
  height?: number;
  encoded?: boolean;
  useBinaryUrl?: boolean;
}

export interface ClickParams {
  selector: string;
}

export interface FillParams {
  selector: string;
  value: string;
}

export interface SelectParams {
  selector: string;
  value: string;
}

export interface HoverParams {
  selector: string;
}

export interface EvaluateParams {
  script: string;
}

// Advanced Mouse Tool Parameters
export interface MouseMoveParams {
  x: number;
  y: number;
  steps?: number;
}

export interface MouseClickParams {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'back' | 'forward';
  clickCount?: number;
  delay?: number;
}

export interface MouseDownParams {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'back' | 'forward';
}

export interface MouseUpParams {
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'back' | 'forward';
}

export interface MouseWheelParams {
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
}

export interface MouseDragParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  steps?: number;
  delay?: number;
}

// Cookie Management Parameters
export interface GetCookiesParams {
  urls?: string[];
  names?: string[];
  domain?: string;
}

export interface SetCookiesParams {
  cookies: CookieParam[];
}

export interface DeleteCookiesParams {
  cookies: DeleteCookieParam[];
}

// Cookie Data Structures
export interface CookieParam {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  expires?: number;
  priority?: 'Low' | 'Medium' | 'High';
  sameParty?: boolean;
  sourceScheme?: 'Unset' | 'NonSecure' | 'Secure';
  sourcePort?: number;
}

export interface DeleteCookieParam {
  name: string;
  url?: string;
  domain?: string;
  path?: string;
}

export interface CookieInfo {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  size: number;
  httpOnly: boolean;
  secure: boolean;
  session: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  priority?: 'Low' | 'Medium' | 'High';
  sameParty?: boolean;
  sourceScheme?: 'Unset' | 'NonSecure' | 'Secure';
  sourcePort?: number;
}

// Mouse Button Types
export type MouseButton = 'left' | 'right' | 'middle' | 'back' | 'forward';

// Coordinate validation types
export interface Coordinates {
  x: number;
  y: number;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

// Browser Management Types
export interface BrowserInstance {
  browser: Browser;
  createdAt: Date;
  lastUsed: Date;
  pageCount: number;
  isHealthy: boolean;
}

export interface PageSession {
  page: Page;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  url?: string;
}

export interface BrowserManagerConfig {
  launchOptions: LaunchOptions;
  maxPages: number;
  pageTimeout: number;
  sessionTimeout: number;
  restartThreshold: number;
}

// Screenshot Storage
export interface ScreenshotMetadata {
  name: string;
  sessionId: string;
  timestamp: Date;
  width: number;
  height: number;
  selector?: string;
  url?: string;
  size: number;
}

export interface StoredScreenshot {
  metadata: ScreenshotMetadata;
  data: string | Uint8Array;
  mimeType: string;
}

// Browser Launch Configuration
export interface SafeLaunchOptions extends Omit<LaunchOptions, 'args'> {
  args?: string[];
  allowDangerousArgs?: boolean;
}

// Dangerous arguments that should be filtered
export const DANGEROUS_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--allow-running-insecure-content',
  '--disable-site-isolation-trials',
  '--allow-running-insecure-content'
] as const;

// Safe default arguments for containerized environments
export const SAFE_DEFAULT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--single-process',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding'
] as const;

// Browser Health Check
export interface BrowserHealthStatus {
  isHealthy: boolean;
  uptime: number;
  pageCount: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
  lastError?: string;
  lastErrorTime?: Date;
}

// Page Navigation Options
export interface NavigationOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

// Element Interaction Options
export interface ElementOptions {
  timeout?: number;
  visible?: boolean;
}

// Screenshot Options
export interface ScreenshotOptions {
  type?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  omitBackground?: boolean;
  encoding?: 'base64' | 'binary';
}

// Console Log Entry
export interface ConsoleLogEntry {
  type: 'log' | 'debug' | 'info' | 'error' | 'warning' | 'dir' | 'dirxml' | 'table' | 'trace' | 'clear' | 'startGroup' | 'startGroupCollapsed' | 'endGroup' | 'assert' | 'profile' | 'profileEnd' | 'count' | 'timeEnd';
  text: string;
  timestamp: Date;
  location?: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

// Page Performance Metrics
export interface PageMetrics {
  timestamp: Date;
  documents: number;
  frames: number;
  jsEventListeners: number;
  nodes: number;
  layoutCount: number;
  recalcStyleCount: number;
  layoutDuration: number;
  recalcStyleDuration: number;
  scriptDuration: number;
  taskDuration: number;
  jsHeapUsedSize: number;
  jsHeapTotalSize: number;
}

// Error Types
export class PuppeteerMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PuppeteerMCPError';
  }
}

export class BrowserError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'BROWSER_ERROR', details);
  }
}

export class NavigationError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'NAVIGATION_ERROR', details);
  }
}

export class ElementError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'ELEMENT_ERROR', details);
  }
}

export class ScreenshotError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'SCREENSHOT_ERROR', details);
  }
}

export class EvaluationError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'EVALUATION_ERROR', details);
  }
}

export class MouseError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'MOUSE_ERROR', details);
  }
}

export class CoordinateError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'COORDINATE_ERROR', details);
  }
}

export class CookieError extends PuppeteerMCPError {
  constructor(message: string, details?: any) {
    super(message, 'COOKIE_ERROR', details);
  }
}

// Type guards
export function isValidSelector(selector: string): boolean {
  try {
    // Basic CSS selector validation
    if (!selector || typeof selector !== 'string') return false;
    // Simple validation - check for basic CSS selector patterns
    return /^[a-zA-Z0-9\-_#.\[\]:(),\s>+~*="']+$/.test(selector);
  } catch {
    return false;
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:', 'file:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

export function isValidCoordinates(x: number, y: number, bounds?: ViewportBounds): boolean {
  // Check if coordinates are numbers
  if (typeof x !== 'number' || typeof y !== 'number') return false;
  
  // Check if coordinates are finite
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  
  // Check if coordinates are non-negative
  if (x < 0 || y < 0) return false;
  
  // Check bounds if provided
  if (bounds) {
    if (x > bounds.width || y > bounds.height) return false;
  }
  
  return true;
}

export function isValidMouseButton(button: string): button is MouseButton {
  return ['left', 'right', 'middle', 'back', 'forward'].includes(button);
}

export function isValidWheelDelta(deltaX?: number, deltaY?: number): boolean {
  if (deltaX !== undefined && (!Number.isFinite(deltaX) || Math.abs(deltaX) > 1000)) return false;
  if (deltaY !== undefined && (!Number.isFinite(deltaY) || Math.abs(deltaY) > 1000)) return false;
  return true;
}

// Utility types
export type PuppeteerToolName =
  | 'puppeteer_navigate'
  | 'puppeteer_screenshot'
  | 'puppeteer_click'
  | 'puppeteer_fill'
  | 'puppeteer_select'
  | 'puppeteer_hover'
  | 'puppeteer_evaluate'
  | 'puppeteer_mouse_move'
  | 'puppeteer_mouse_click'
  | 'puppeteer_mouse_down'
  | 'puppeteer_mouse_up'
  | 'puppeteer_mouse_wheel'
  | 'puppeteer_mouse_drag'
  | 'puppeteer_get_cookies'
  | 'puppeteer_set_cookies'
  | 'puppeteer_delete_cookies';

export interface ToolParams {
  puppeteer_navigate: NavigateParams;
  puppeteer_screenshot: ScreenshotParams;
  puppeteer_click: ClickParams;
  puppeteer_fill: FillParams;
  puppeteer_select: SelectParams;
  puppeteer_hover: HoverParams;
  puppeteer_evaluate: EvaluateParams;
  puppeteer_mouse_move: MouseMoveParams;
  puppeteer_mouse_click: MouseClickParams;
  puppeteer_mouse_down: MouseDownParams;
  puppeteer_mouse_up: MouseUpParams;
  puppeteer_mouse_wheel: MouseWheelParams;
  puppeteer_mouse_drag: MouseDragParams;
  puppeteer_get_cookies: GetCookiesParams;
  puppeteer_set_cookies: SetCookiesParams;
  puppeteer_delete_cookies: DeleteCookiesParams;
}