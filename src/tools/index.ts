/**
 * Tools index - registers and exports all Puppeteer tools
 */

import { toolRegistry } from './base';
import { navigateTool } from './navigate';
import { screenshotTool } from './screenshot';
import { clickTool } from './click';
import { fillTool } from './fill';
import { selectTool } from './select';
import { hoverTool } from './hover';
import { evaluateTool } from './evaluate';
import { mouseMoveTool } from './mouse-move';
import { mouseClickTool } from './mouse-click';
import { mouseDownTool } from './mouse-down';
import { mouseUpTool } from './mouse-up';
import { mouseWheelTool } from './mouse-wheel';
import { mouseDragTool } from './mouse-drag';

// Register all tools
toolRegistry.register(navigateTool);
toolRegistry.register(screenshotTool);
toolRegistry.register(clickTool);
toolRegistry.register(fillTool);
toolRegistry.register(selectTool);
toolRegistry.register(hoverTool);
toolRegistry.register(evaluateTool);
toolRegistry.register(mouseMoveTool);
toolRegistry.register(mouseClickTool);
toolRegistry.register(mouseDownTool);
toolRegistry.register(mouseUpTool);
toolRegistry.register(mouseWheelTool);
toolRegistry.register(mouseDragTool);

// Export tools for direct access
export {
  navigateTool,
  screenshotTool,
  clickTool,
  fillTool,
  selectTool,
  hoverTool,
  evaluateTool,
  mouseMoveTool,
  mouseClickTool,
  mouseDownTool,
  mouseUpTool,
  mouseWheelTool,
  mouseDragTool,
};

// Export tool registry
export { toolRegistry, BaseTool, ToolRegistry } from './base';

// Export tool definitions for MCP
export const getToolDefinitions = () => toolRegistry.getToolDefinitions();

// Export tool execution function
export const executeTool = (name: string, params: any, context: any) => 
  toolRegistry.execute(name, params, context);

// Export available tool names
export const getAvailableToolNames = () => 
  toolRegistry.getAll().map(tool => tool.name);

export default toolRegistry;