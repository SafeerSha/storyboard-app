"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

type Step = "CURRENT_PASSWORD" | "VERIFY_OTP" | "NEW_PASSWORD" | "SUCCESS";

export function ChangePasswordModal({
  isOpen,
  onClose,
  userEmail,
}: ChangePasswordModalProps) {
  const [step, setStep] = useState<Step>("CURRENT_PASSWORD");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Reset state when modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep("CURRENT_PASSWORD");
      setCurrentPassword("");
      setShowCurrentPassword(false);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setShowNewPassword(false);
      setError("");
      setResetToken("");
      setCountdown(0);
    }
  }, [isOpen]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Step 1: Verify Current Password & Send OTP
  async function handleVerifyCurrentPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/change-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify current password.");
      }

      toast.success("Password verified", "A 6-digit code has been sent to your email.");
      setStep("VERIFY_OTP");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "Failed to verify current password.");
      toast.error("Verification failed", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Resend code handler in Step 2
  async function handleResendCode() {
    if (countdown > 0 || !currentPassword) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/change-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code.");
      }

      toast.success("Code resent", "A new 6-digit code was sent to your email.");
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || "Failed to resend code.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp: cleanOtp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code.");
      }

      setResetToken(data.resetToken);
      setStep("NEW_PASSWORD");
      toast.success("Code verified", "Now set your new password.");
    } catch (err: any) {
      setError(err.message || "Verification failed.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Update Password
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
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
          email: userEmail,
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      setStep("SUCCESS");
      toast.success("Password changed", "Your password has been updated successfully.");
    } catch (err: any) {
      setError(err.message || "Unable to update password.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === "CURRENT_PASSWORD"
          ? "Change Password"
          : step === "VERIFY_OTP"
          ? "Verify Email Code"
          : step === "NEW_PASSWORD"
          ? "Set New Password"
          : "Password Changed"
      }
      description={
        step === "CURRENT_PASSWORD"
          ? "Enter your current password to receive a verification code on your email."
          : step === "VERIFY_OTP"
          ? `Enter the 6-digit code sent from REQly to ${userEmail}`
          : step === "NEW_PASSWORD"
          ? "Enter your new password below."
          : "Your account security credentials have been updated."
      }
      maxWidth="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-3 text-xs text-[#C25D72] animate-in fade-in duration-150">
            {error}
          </div>
        )}

        {/* STEP 1: CURRENT PASSWORD */}
        {step === "CURRENT_PASSWORD" && (
          <form onSubmit={handleVerifyCurrentPassword} className="space-y-4">
            <div className="rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] p-3.5 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F] shrink-0">
                <Mail size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
                  Registered Account Email
                </span>
                <span className="block text-sm font-semibold text-[#252331] truncate">
                  {userEmail || "No email available"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  autoFocus
                  disabled={loading}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-10 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9994A5] hover:text-[#252331]"
                >
                  {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="rounded-xl bg-[#F8F6FA] border border-[rgba(74,61,100,0.06)] p-3 text-xs text-[#706C7D] flex items-start gap-2">
              <ShieldCheck size={16} className="text-[#B8944E] shrink-0 mt-0.5" />
              <span>
                After verifying your current password, REQly will send a 6-digit confirmation code to your email.
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={loading || !currentPassword}
              rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
            >
              Verify &amp; Send Code
            </Button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {step === "VERIFY_OTP" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                  6-Digit Verification Code
                </label>
                <span className="text-[11px] text-[#9994A5]">From: REQly</span>
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
              <span>Didn't receive the code?</span>
              {countdown > 0 ? (
                <span className="text-[#9994A5]">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResendCode}
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

        {/* STEP 3: NEW PASSWORD */}
        {step === "NEW_PASSWORD" && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
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
                  type={showNewPassword ? "text" : "password"}
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
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9994A5] hover:text-[#252331]"
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
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
                  type={showNewPassword ? "text" : "password"}
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
              Save New Password
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
                Your password has been changed successfully. You can use your new password the next time you sign in.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onClose}
              className="w-full"
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
