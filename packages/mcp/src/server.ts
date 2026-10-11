import { McpServer } from "@modelcontextprotocol/server";
import { ActorContext } from "./types/context.js";
import { registerAllTools } from "./tools/index.js";
import { loadEnvConfig } from "./config/env.js";

/**
 * Creates and initializes a Reqly MCP Server instance scoped to the authenticated actor.
 */
export function createReqlyMcpServer(actor: ActorContext): McpServer {
  const config = loadEnvConfig();
  const server = new McpServer({
    name: "reqly",
    version: "0.1.0",
  });

  registerAllTools(server, actor, config.REQUEST_TIMEOUT_MS);

  return server;
}
