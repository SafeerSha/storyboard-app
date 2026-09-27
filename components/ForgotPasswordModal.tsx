"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, KeyRound, Lock, Mail, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string) => void;
  initialEmail?: string;
}

type Step = "REQUEST_OTP" | "VERIFY_OTP" | "RESET_PASSWORD" | "SUCCESS";

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  initialEmail = "",
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<Step>("REQUEST_OTP");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Sync initial email when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail.trim());
      setStep("REQUEST_OTP");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setResetToken("");
    }
  }, [isOpen, initialEmail]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 1. Request OTP
  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      toast.success("Verification code sent", "Please check your inbox for your 6-digit code.");
      setStep("VERIFY_OTP");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "Unable to send verification code. Please try again.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  // 2. Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: cleanOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code.");
      }

      setResetToken(data.resetToken);
      setStep("RESET_PASSWORD");
      toast.success("Code verified", "Please set your new password.");
    } catch (err: any) {
      setError(err.message || "Failed to verify code.");
      toast.error("Verification failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  // 3. Reset Password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setStep("SUCCESS");
      toast.success("Password reset successfully", "You can now sign in with your new password.");
    } catch (err: any) {
      setError(err.message || "Unable to reset password.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleComplete() {
    onSuccess?.(email);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === "REQUEST_OTP"
          ? "Reset Password"
          : step === "VERIFY_OTP"
          ? "Verify Email"
          : step === "RESET_PASSWORD"
          ? "Set New Password"
          : "Password Reset"
      }
      description={
        step === "REQUEST_OTP"
          ? "Enter your account email to receive a 6-digit verification code."
          : step === "VERIFY_OTP"
          ? `We sent a 6-digit code to ${email}`
          : step === "RESET_PASSWORD"
          ? "Create a new, secure password for your REQly account."
          : "Your account is secure and ready to use."
      }
      maxWidth="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-3 text-xs text-[#C25D72] animate-in fade-in duration-150">
            {error}
          </div>
        )}

        {/* STEP 1: REQUEST OTP */}
        {step === "REQUEST_OTP" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  type="email"
                  required
                  autoFocus
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={loading || !email}
              rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
            >
              Send Verification Code
            </Button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === "VERIFY_OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                  6-Digit Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep("REQUEST_OTP");
                    setOtp("");
                    setError("");
                  }}
                  className="text-xs text-[#B8944E] hover:underline"
                >
                  Change email
                </button>
              </div>

              <div className="relative">
                <KeyRound
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={6}
                  disabled={loading}
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                  }}
                  placeholder="123456"
                  className="h-11 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-3.5 text-center font-mono text-lg tracking-[6px] text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#706C7D]">
              <span>Didn't receive a code?</span>
              {countdown > 0 ? (
                <span className="text-[#9994A5]">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleRequestOtp()}
                  className="inline-flex items-center gap-1 font-medium text-[#B8944E] hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  Resend code
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={loading || otp.trim().length !== 6}
              rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
            >
              Verify Code
            </Button>
          </form>
        )}

        {/* STEP 3: RESET PASSWORD */}
        {step === "RESET_PASSWORD" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  minLength={6}
                  disabled={loading}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-10 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9994A5] hover:text-[#252331]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={loading || !newPassword || newPassword !== confirmPassword}
              rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
            >
              Update Password
            </Button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === "SUCCESS" && (
          <div className="flex flex-col items-center text-center py-4 space-y-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-[#252331]">
                Password Updated!
              </h3>
              <p className="text-xs text-[#706C7D]">
                Your password has been changed successfully. You can now log into your account with your new credentials.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleComplete}
              className="w-full"
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
