import { McpServer } from "@modelcontextprotocol/server";
import { ActorContext } from "../types/context.js";
import { registerReadOnlyTools } from "./read-only-tools.js";
import { registerWriteTools } from "./write-tools.js";

/**
 * Registers all active MCP tools for the Reqly server:
 * - 6 Read-only inspection tools
 * - 4 Authoritative write tools
 */
export function registerAllTools(server: McpServer, actor: ActorContext, timeoutMs: number = 15000) {
  registerReadOnlyTools(server, actor, timeoutMs);
  registerWriteTools(server, actor, timeoutMs);
}

export { registerReadOnlyTools, registerWriteTools };

