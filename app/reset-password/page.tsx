"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  ShieldAlert,
} from "lucide-react";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { toast } from "@/lib/toast";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const queryEmail = searchParams.get("email") || "";

  const [verifiedEmail, setVerifiedEmail] = useState(queryEmail);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // 1. Verify the reset token on mount
  useEffect(() => {
    let isMounted = true;

    async function verify() {
      if (!token) {
        if (isMounted) {
          setIsVerifying(false);
          setTokenValid(false);
          setTokenError("No password reset token was provided. Please use the link sent to your email.");
        }
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/reset-password/verify-token?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.valid) {
          setTokenValid(true);
          if (data.email) {
            setVerifiedEmail(data.email);
          }
        } else {
          setTokenValid(false);
          setTokenError(
            data.error || "This password reset link is invalid, expired, or has already been used."
          );
        }
      } catch {
        if (!isMounted) return;
        setTokenValid(false);
        setTokenError("Unable to verify password reset link. Please check your connection and try again.");
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle password submission (AC-1.4)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (newPassword.length < 6) {
      setSubmitError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setIsSuccess(true);
      // Securely clear inputs
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password reset complete", "You can now sign in with your new password.");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to reset password. Please try again.");
      toast.error("Error", err.message);
    } finally {
      setSubmitting(false);
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
                color: "#252331",
              }}
            >
              From <span style={{ color: "#B8944E" }}>requirements</span> to{" "}
              <span style={{ color: "#B8944E" }}>delivery</span>
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/90 backdrop-blur-[20px] p-6 sm:p-8 shadow-[0_20px_60px_rgba(70,55,95,0.08)] space-y-6">
          {/* STATE 1: VERIFYING TOKEN */}
          {isVerifying && (
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B8944E] border-t-transparent" />
              <p className="text-sm font-medium text-[#252331]">
                Verifying your reset link...
              </p>
              <p className="text-xs text-[#9994A5]">
                Please wait a moment while we validate your security token.
              </p>
            </div>
          )}

          {/* STATE 2: TOKEN INVALID OR EXPIRED */}
          {!isVerifying && !tokenValid && !isSuccess && (
            <div className="flex flex-col items-center text-center py-2 space-y-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                <ShieldAlert size={30} />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[#252331]">
                  Link Invalid or Expired
                </h2>
                <p className="text-xs text-[#585365] leading-relaxed max-w-xs mx-auto">
                  {tokenError ||
                    "This password reset link is invalid, has expired, or has already been used."}
                </p>
              </div>

              <div className="w-full rounded-xl bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)] p-3.5 text-xs text-[#706C7D] text-left space-y-1">
                <span className="font-semibold text-[#252331] block">Why did this happen?</span>
                <p>• Password reset links expire after 60 minutes for your security.</p>
                <p>• Each link can only be used once to set a new password.</p>
                <p>• A newer reset link may have been requested.</p>
              </div>

              <div className="w-full space-y-2 pt-2">
                <Link href="/login" className="block w-full">
                  <Button variant="primary" size="lg" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* STATE 3: SET NEW PASSWORD FORM (AC-1.4, Story 2) */}
          {!isVerifying && tokenValid && !isSuccess && (
            <div>
              <div className="mb-5 space-y-1 text-center sm:text-left">
                <h2 className="text-lg font-bold text-[#252331]">
                  Set New Password
                </h2>
                <p className="text-xs text-[#706C7D]">
                  Create a new, secure password for your REQly account.
                </p>
                {verifiedEmail && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)] px-2.5 py-1 text-[11px] font-medium text-[#585365]">
                    <Mail size={12} className="text-[#9994A5]" />
                    <span>{verifiedEmail}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Field 1: New Password with visibility toggle (Story 2) */}
                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5"
                  >
                    New Password
                  </label>
                  <PasswordInput
                    id="reset-new-password"
                    required
                    autoFocus
                    minLength={6}
                    disabled={submitting}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#9994A5]">
                    <span>Must be at least 6 characters</span>
                    {newPassword.length >= 6 && (
                      <span className="text-emerald-600 font-medium">✓ Length met</span>
                    )}
                  </div>
                </div>

                {/* Field 2: Confirm New Password with visibility toggle (Story 2) */}
                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5"
                  >
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="reset-confirm-password"
                    required
                    minLength={6}
                    disabled={submitting}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (submitError) setSubmitError("");
                    }}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                  />
                  {confirmPassword && (
                    <div className="mt-1 text-[11px]">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-600 font-medium">✓ Passwords match</span>
                      ) : (
                        <span className="text-[#C25D72] font-medium">✗ Passwords do not match</span>
                      )}
                    </div>
                  )}
                </div>

                {submitError && (
                  <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-3 text-xs text-[#C25D72] flex items-start gap-2">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  isLoading={submitting}
                  disabled={
                    submitting ||
                    !newPassword ||
                    newPassword.length < 6 ||
                    newPassword !== confirmPassword
                  }
                  rightIcon={!submitting ? <ArrowRight size={15} /> : undefined}
                >
                  {submitting ? "Updating Password..." : "Update Password"}
                </Button>
              </form>
            </div>
          )}

          {/* STATE 4: SUCCESS (AC-1.4) */}
          {isSuccess && (
            <div className="flex flex-col items-center text-center py-2 space-y-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[#252331]">
                  Password Reset Complete!
                </h2>
                <p className="text-xs text-[#585365] leading-relaxed max-w-xs mx-auto">
                  Your password has been securely updated and previous sessions have been invalidated. You can now sign in with your new credentials.
                </p>
              </div>

              <div className="w-full pt-2">
                <Link href="/login" className="block w-full">
                  <Button variant="primary" size="lg" className="w-full">
                    Proceed to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main
          className="grid min-h-screen place-items-center px-4 py-8"
          style={{ backgroundColor: "#F5F2F7" }}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B8944E] border-t-transparent" />
        </main>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
