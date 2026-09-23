"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface SetPasswordFormProps {
  clientName: string;
}

export function SetPasswordForm({ clientName }: SetPasswordFormProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!newPassword.trim()) {
      setError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!confirmPassword.trim()) {
      setError("Please confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please ensure both fields match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/client/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to set password. Please try again.");
      }

      toast.flash("success", "Password created successfully");
      toast.success("Password created successfully");

      // Seamlessly redirect to client home without re-prompting for login
      router.push(data.redirectTo || "/client");
      router.refresh();
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to set password.";
      setError(msg);
      toast.error("Unable to set password", "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200/80 bg-white p-6 sm:p-8 shadow-card space-y-4"
    >
      <div className="border-b border-zinc-100 pb-3 mb-1">
        <p className="text-xs text-zinc-500 font-medium">
          Welcome, <span className="font-semibold text-slate-900">{clientName}</span>
        </p>
      </div>

      {/* New Password */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
            New password <span className="text-rose-500">*</span>
          </label>
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          >
            {showPassword ? (
              <>
                <EyeOff size={13} />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye size={13} />
                <span>Show</span>
              </>
            )}
          </button>
        </div>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="Enter your new password"
            className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          Confirm password <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="Confirm your new password"
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
        disabled={!newPassword || !confirmPassword}
        rightIcon={<ArrowRight size={15} />}
      >
        Set password & continue
      </Button>

      <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
        <ShieldCheck size={14} className="text-zinc-400 shrink-0" />
        <span>Your password will be encrypted securely with bcrypt.</span>
      </div>
    </form>
  );
}
