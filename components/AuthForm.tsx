
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

import { toast } from "@/lib/toast";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";

export function AuthForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    let success = false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (data.action === "SUPABASE_AUTH") {
        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });

        if (authError) throw authError;

        success = true;
        setIsRedirecting(true);
        toast.success("Login successful");
        router.push("/");
        router.refresh();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to sign in");
      }

      success = true;
      setIsRedirecting(true);
      toast.success("Login successful");
      router.push(data.redirectTo || "/");
      router.refresh();
    } catch (err: any) {
      const userMessage = err?.message || "Unable to sign in. Please check your credentials and try again.";
      setError(userMessage);
      toast.error("Unable to sign in", "Please check your credentials and try again.");
    } finally {
      if (!success) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Brand lockup */}
      <div className="mb-8 sm:mb-10 flex flex-col items-center text-center gap-3">
        <StoryBoardLogo size="lg" variant="icon" />

        <div className="flex flex-col items-center gap-1.5">
          <span
            style={{
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              color: "#252331",
            }}
          >
            REQ<span style={{ color: "#B8944E" }}>ly</span>
          </span>

          {/* Thin gold divider */}
          <span
            style={{
              display: "block",
              width: "28px",
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, rgba(184,148,78,0.5), transparent)",
            }}
          />

          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#252331", // Default to black/dark for the base text
            }}
          >
            From <span style={{ color: "#B8944E" }}>requirements</span> to <span style={{ color: "#B8944E" }}>delivery</span>
          </span>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/90 backdrop-blur-[20px] p-6 sm:p-8 shadow-[0_20px_60px_rgba(70,55,95,0.08)] space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
            Login ID
          </label>
          <div className="relative">
            <UserCircle
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="text"
              required
              autoFocus
              disabled={loading || isRedirecting}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Login Id"
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-xs font-medium text-[#B8944E] hover:underline transition"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="password"
              required
              minLength={6}
              disabled={loading || isRedirecting}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60 disabled:cursor-not-allowed"
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
          isLoading={loading || isRedirecting}
          disabled={loading || isRedirecting}
          rightIcon={!loading && !isRedirecting ? <ArrowRight size={15} /> : undefined}
        >
          {isRedirecting ? "Redirecting..." : loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={identifier.includes("@") ? identifier : ""}
        onSuccess={(resetEmail) => {
          setIdentifier(resetEmail);
          setPassword("");
        }}
      />
    </div>
  );
}
