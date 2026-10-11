import { ServiceError } from "../types/context.js";
import { logger } from "./logger.js";

export interface McpSuccessResponse<T> {
  success: true;
  data: T;
}

export interface McpErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function formatToolSuccess<T>(data: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ success: true, data }, null, 2),
      },
    ],
  };
}

export function formatToolError(error: unknown) {
  if (error instanceof ServiceError) {
    logger.warn(`MCP Tool ServiceError [${error.code}]: ${error.message}`);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: false,
              error: {
                code: error.code,
                message: error.message,
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const errMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
  logger.error("Unhandled tool execution error", error);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: errMessage,
            },
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

/**
 * Wraps an async operation with a timeout guard to prevent hung agent loops.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = "Operation"
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ServiceError(`${operationName} timed out after ${timeoutMs}ms`, "TIMEOUT", 504));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}
