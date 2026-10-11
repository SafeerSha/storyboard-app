#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { loadEnvConfig } from "./config/env.js";
import { resolveStdioActor } from "./auth/identity.js";
import { createReqlyMcpServer } from "./server.js";
import { logger } from "./utils/logger.js";

async function main() {
  try {
    // 1. Validate environment configuration at startup
    loadEnvConfig();

    // 2. Establish authenticated actor context for local execution
    logger.info("Resolving local actor identity...");
    const actor = await resolveStdioActor();
    logger.info(`Actor established: ${actor.email} (${actor.role})`);

    // 3. Initialize McpServer instance
    const server = createReqlyMcpServer(actor);

    // 4. Connect over StdioServerTransport
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info("Reqly MCP Server successfully listening on stdio.");

    // Handle clean termination
    const shutdown = async () => {
      logger.info("Shutting down Reqly MCP Server (stdio)...");
      await server.close();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Reqly MCP Server on stdio", error);
    process.exit(1);
  }
}

main();
