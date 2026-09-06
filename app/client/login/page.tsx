"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ClientLogin() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to sign in");
      router.push("/client");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in. Please verify your PIN and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 py-8 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-card">
            <span className="text-base font-bold">◆</span>
          </div>
          <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Client Review Portal
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-zinc-500">
            Review project requirements, acceptance criteria, and approve for development.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-card space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              6-Digit Login PIN
            </label>
            <div className="relative">
              <KeyRound
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 842190"
                className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3.5 font-mono text-sm tracking-wider text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter client password"
                className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loading}
            disabled={loginId.length < 6 || !password}
            rightIcon={<ArrowRight size={15} />}
          >
            Access client portal
          </Button>

          <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
            <ShieldCheck size={14} className="text-zinc-400 shrink-0" />
            <span>Project-scoped secure client access.</span>
          </div>
        </form>
      </div>
    </main>
  );
}
