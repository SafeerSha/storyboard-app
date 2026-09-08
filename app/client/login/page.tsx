"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";

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
      toast.success("Login successful");
      const targetPath = d.redirectTo || (d.isPasswordChanged === false ? "/client/set-password" : "/client");
      router.push(targetPath);
      router.refresh();
    } catch {
      const userMessage = "Unable to sign in. Please verify your PIN and password.";
      setError(userMessage);
      toast.error("Unable to sign in", "Please check your PIN and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main 
      className="grid min-h-screen place-items-center px-4 py-8 sm:px-6"
      style={{
        backgroundColor: "#F5F2F7",
        backgroundImage: `
          radial-gradient(circle at 15% 15%, rgba(210, 193, 235, 0.35), transparent 40%),
          radial-gradient(circle at 85% 20%, rgba(239, 207, 222, 0.30), transparent 35%),
          radial-gradient(circle at 80% 80%, rgba(202, 220, 240, 0.30), transparent 40%),
          radial-gradient(circle at 20% 85%, rgba(243, 232, 215, 0.30), transparent 35%)
        `,
      }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 sm:mb-8 text-center flex flex-col items-center">
          <StoryBoardLogo size="lg" variant="stacked" badge="Client Review" />
          <p className="mt-2 text-xs sm:text-sm text-[#706C7D]">
            Review project requirements, acceptance criteria, and approve for development.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/90 backdrop-blur-[20px] p-6 sm:p-8 shadow-[0_20px_60px_rgba(70,55,95,0.08)] space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              6-Digit Login PIN
            </label>
            <div className="relative">
              <KeyRound
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
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
                className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 pl-10 pr-3.5 font-mono text-sm tracking-wider text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter client password"
                className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-3 text-xs text-[#C25D72]">
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
