"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (email: string) => void;
  initialEmail?: string;
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  initialEmail = "",
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // AC-2.4 & state hygiene: Reset all state securely whenever modal is opened or closed
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail.trim());
      setError("");
      setSubmitted(false);
      setLoading(false);
      setCountdown(0);
    } else {
      // Clear inputs when closed
      setEmail("");
      setError("");
      setSubmitted(false);
      setLoading(false);
      setCountdown(0);
    }
  }, [isOpen, initialEmail]);

  // Resend cooldown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Handle password reset link request (AC-1.1, AC-1.2, AC-1.3)
  async function handleSendResetLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process request.");
      }

      // AC-1.3: Show generic confirmation message
      setSubmitted(true);
      setCountdown(60);
      toast.success("Instructions sent", "If an account exists, a reset link has been dispatched.");
      onSuccess?.(cleanEmail);
    } catch (err: any) {
      setError(err.message || "Unable to send password reset link. Please try again.");
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setEmail("");
    setError("");
    setSubmitted(false);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={submitted ? "Check Your Email" : "Reset Your Password"}
      description={
        submitted
          ? "We've dispatched recovery instructions to your email."
          : "Enter your registered email address and we'll send you a secure link to reset your password."
      }
      maxWidth="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-3 text-xs text-[#C25D72] animate-in fade-in duration-150">
            {error}
          </div>
        )}

        {!submitted ? (
          /* AC-1.1: Initiate password recovery request */
          <form onSubmit={handleSendResetLink} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-pwd-email"
                className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5"
              >
                Registered Email Address
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
                />
                <input
                  id="forgot-pwd-email"
                  type="email"
                  required
                  autoFocus
                  disabled={loading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="name@company.com"
                  className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white pl-10 pr-3.5 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60"
                />
              </div>
            </div>

            <p className="text-xs text-[#706C7D] leading-relaxed">
              If an account is associated with this email, you will receive a secure reset link valid for 60 minutes.
            </p>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
              disabled={loading || !email.trim()}
              rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
            >
              Send Reset Link
            </Button>
          </form>
        ) : (
          /* AC-1.3: Generic confirmation state */
          <div className="flex flex-col items-center text-center py-2 space-y-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.25)]">
              <CheckCircle2 size={30} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-semibold text-[#252331]">
                Check Your Inbox
              </h3>
              <p className="text-xs text-[#585365] leading-relaxed max-w-xs mx-auto">
                If an account exists for <strong className="text-[#252331]">{email}</strong>, a secure password reset link has been sent. Please check your inbox and spam folder.
              </p>
            </div>

            <div className="w-full rounded-xl bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)] p-3 text-xs text-[#706C7D] text-left">
              <span className="font-semibold text-[#252331] block mb-0.5">Didn't receive an email?</span>
              Verify that the address is registered to an active account, or wait a minute before requesting another link.
            </div>

            <div className="flex items-center justify-between w-full pt-1 text-xs">
              {countdown > 0 ? (
                <span className="text-[#9994A5]">Resend link in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendResetLink()}
                  className="inline-flex items-center gap-1 font-medium text-[#B8944E] hover:underline disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  Resend reset link
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setError("");
                }}
                className="font-medium text-[#706C7D] hover:text-[#252331] hover:underline"
              >
                Change email
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleClose}
              className="w-full mt-2"
            >
              Back to Sign In
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
