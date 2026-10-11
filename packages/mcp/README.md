# @reqly/mcp

Standalone Model Context Protocol (MCP) server for Reqly (formerly StoryBoard), built using the official `@modelcontextprotocol/server` TypeScript SDK v2 line.

## Capabilities

Exposes safe, structured tools to manage Reqly workspaces directly from **Antigravity IDE** or any compatible MCP client:
- **Projects**: `reqly_list_projects`, `reqly_get_project`, `reqly_create_project`, `reqly_update_project`
- **Epics**: `reqly_list_epics`, `reqly_get_epic`, `reqly_create_epic`, `reqly_update_epic` (with priority normalization and fallback)
- **Stories**: `reqly_list_stories`, `reqly_get_story`, `reqly_create_story`, `reqly_update_story`, `reqly_update_story_status` (with automatic `story_revisions` auditing)

## Architecture & Transports

- **stdio Transport**: Communicates over `process.stdin` / `process.stdout`. Used by local IDEs like Antigravity. All internal logging routes safely to `process.stderr` with automatic secret redaction.
- **Streamable HTTP Transport**: Single-endpoint HTTP/SSE interface (`POST /mcp`) using `@modelcontextprotocol/node`, with public health monitoring (`GET /health`).

## Configuration

Set the following in `.env` or `.env.local` in the project root:

```env
# Required Supabase Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: Local IDE Actor Identification
REQLY_ACTOR_EMAIL=your-user-email@example.com

# Optional: HTTP Transport Settings
PORT=3001
HOST=127.0.0.1
REQUEST_TIMEOUT_MS=15000
```

## Running the Server

### 1. Local stdio (Antigravity IDE)
From the project root:
```bash
npm run mcp
```
Or directly in `packages/mcp`:
```bash
npm start
```

### 2. Streamable HTTP Server
From the project root:
```bash
npm run mcp:http
```
Verify the health check:
```bash
curl http://127.0.0.1:3001/health
```

### 3. Antigravity IDE Integration
Add to your Antigravity MCP settings:
```json
{
  "mcpServers": {
    "reqly": {
      "command": "node",
      "args": ["packages/mcp/dist/stdio.js"],
      "env": {
        "REQLY_ACTOR_EMAIL": "your-email@example.com"
      }
    }
  }
}
```

## Testing & Verification

Run the test suite:
```bash
npm run mcp:test
```
Build the TypeScript distribution:
```bash
cd packages/mcp && npm run build
```
