"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#121118] text-white flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1A1824] border border-[#B8944E]/30 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-[#B8944E]/20 text-[#D6BD88] flex items-center justify-center mx-auto mb-4 text-2xl">
            ⚡
          </div>
          <h2 className="text-xl font-bold mb-2 text-white">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-6">
            A critical error occurred. Please try refreshing the application.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-500 font-mono mb-4">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => reset()}
            className="rounded-xl bg-[#B8944E] hover:bg-[#A3813E] text-white px-5 py-2.5 text-sm font-semibold transition active:scale-95"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
