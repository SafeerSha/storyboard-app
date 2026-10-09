"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Mail,
  RotateCw,
  Share2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  buildClientPortalShareMessage,
  buildClientCopyDetailsText,
  buildWhatsAppShareUrl,
  type ClientShareData,
} from "@/lib/client-credentials";

interface ClientPortalShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    email?: string | null;
    login_id: string;
    status?: string;
  };
  projectName: string;
  portalUrl?: string;
  initialPassword?: string;
  onResetPassword?: () => void;
}

export function ClientPortalShareModal({
  isOpen,
  onClose,
  client,
  projectName,
  portalUrl: customPortalUrl,
  initialPassword,
  onResetPassword,
}: ClientPortalShareModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Compute portal URL from configured environment variable or current browser origin
  const portalUrl =
    customPortalUrl ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/login`
      : process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/login`
      : typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : "/login");

  const initials = client.name
    ? client.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CL";

  const shareData: ClientShareData = {
    clientName: client.name,
    projectName,
    portalUrl,
    loginPin: client.login_id,
    initialPassword: initialPassword || undefined,
  };

  function triggerCopy(text: string, sectionKey: string, msg: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedSection(sectionKey);
    toast.success(msg);
    setTimeout(() => {
      setCopiedSection((prev) => (prev === sectionKey ? null : prev));
    }, 1500);
  }

  function handleCopyPortalUrl() {
    triggerCopy(portalUrl, "portal", "Portal link copied");
  }

  function handleCopyLoginPin() {
    triggerCopy(client.login_id, "pin", "Login PIN copied");
  }

  function handleCopyPassword() {
    if (!initialPassword) return;
    triggerCopy(initialPassword, "password", "Password copied");
  }

  function handleCopyAllDetails() {
    const text = buildClientCopyDetailsText(shareData);
    triggerCopy(text, "all", "Client access details copied");
  }

  function handleWhatsAppShare() {
    const url = buildWhatsAppShareUrl(shareData);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleEmailShare() {
    const subject = encodeURIComponent(`${projectName} - Client Portal Access Credentials`);
    const body = encodeURIComponent(buildClientPortalShareMessage(shareData));
    const to = client.email ? encodeURIComponent(client.email) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function handleWebShare() {
    const message = buildClientPortalShareMessage(shareData);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${projectName} Client Portal`,
          text: message,
        });
        return;
      } catch (err: any) {
        // Fallback to copy if user cancelled or failed
        if (err.name !== "AbortError") {
          handleCopyAllDetails();
        }
      }
    } else {
      handleCopyAllDetails();
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Share client portal"
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleWebShare}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-indigo-600 transition cursor-pointer"
              title="Share via device applications"
            >
              <Share2 size={13} />
              <span>More sharing options</span>
            </button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Client Information Compact Header */}
          <div className="flex items-center justify-between border-b border-[#EBE7F2] pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-xs font-bold text-[#80642F] shadow-xs">
                {initials}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#252331] truncate">
                  {client.name}
                </h3>
                <p className="text-xs font-medium text-[#706C7D] truncate">
                  {projectName} {client.email ? `• ${client.email}` : ""}
                </p>
              </div>
            </div>

            <span className="text-xs text-[#9994A5] hidden sm:inline">
              Client Portal Access
            </span>
          </div>

          <p className="text-xs text-[#706C7D] font-medium">
            Share these details with the client.
          </p>

          {/* Unified Credential Area with Subtle Separators */}
          <div className="overflow-hidden rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] divide-y divide-[#EBE7F2]">
            {/* 1. Client Portal URL */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mb-0.5">
                  Client portal
                </span>
                <div className="flex items-center gap-1.5 font-mono text-xs text-[#80642F] font-medium truncate">
                  <span className="truncate">{portalUrl}</span>
                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#9994A5] hover:text-[#80642F] p-0.5 transition shrink-0"
                    title="Open portal in new tab"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyPortalUrl}
                className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-lg border border-[#EBE7F2] bg-white text-[11px] font-semibold text-[#353140] hover:bg-[#FAF9FC] hover:text-[#80642F] transition shrink-0 self-end sm:self-center shadow-xs"
              >
                {copiedSection === "portal" ? (
                  <>
                    <Check size={11} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="text-[#9994A5]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. Login PIN */}
            <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mb-0.5">
                  Login PIN
                </span>
                <span className="font-mono text-sm font-bold tracking-widest text-[#252331]">
                  {client.login_id}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyLoginPin}
                className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-lg border border-[#EBE7F2] bg-white text-[11px] font-semibold text-[#353140] hover:bg-[#FAF9FC] hover:text-[#80642F] transition shrink-0 shadow-xs"
              >
                {copiedSection === "pin" ? (
                  <>
                    <Check size={11} className="text-emerald-600" />
                    <span className="text-emerald-600">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} className="text-[#9994A5]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* 3. Initial Password */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mb-0.5">
                  Initial password
                </span>
                {initialPassword ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tracking-wider text-[#252331]">
                      {showPassword ? initialPassword : "••••••••••"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#80642F] hover:underline p-0.5"
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
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[#9994A5] italic">
                      Not available (encrypted in database)
                    </span>
                    {onResetPassword && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onResetPassword();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#80642F] hover:text-[#9F7D3E] hover:underline"
                      >
                        <RotateCw size={11} />
                        <span>Reset password & share</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {initialPassword && (
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-lg border border-[#EBE7F2] bg-white text-[11px] font-semibold text-[#353140] hover:bg-[#FAF9FC] hover:text-[#80642F] transition shrink-0 self-end sm:self-center shadow-xs"
                >
                  {copiedSection === "password" ? (
                    <>
                      <Check size={11} className="text-emerald-600" />
                      <span className="text-emerald-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} className="text-[#9994A5]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* First-login Notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-[#E4DDF7] bg-[#EDE7F8]/50 p-3 text-xs leading-relaxed text-[#252331]">
            <Info size={15} className="text-[#B8944E] shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-[#252331] block mb-0.5">
                Important
              </strong>
              The client will be asked to create a new password after signing in for
              the first time.
            </div>
          </div>

          {/* Action Hierarchy: 1. WhatsApp & Email, 2. Copy All Details */}
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <WhatsAppIcon className="h-5 w-5 fill-current" />
                <span>Share on WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleEmailShare}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#4A3D64] hover:bg-[#3B3050] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Mail size={16} />
                <span>Email Client</span>
              </button>
            </div>

            <Button
              variant="secondary"
              size="md"
              leftIcon={
                copiedSection === "all" ? (
                  <Check size={14} className="text-emerald-600" />
                ) : (
                  <Copy size={14} />
                )
              }
              onClick={handleCopyAllDetails}
              className="w-full justify-center h-10"
            >
              {copiedSection === "all" ? "Details copied" : "Copy all details"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.477-.15-.678.15-.2.3-.778.98-.954 1.181-.176.201-.351.226-.653.075s-1.272-.469-2.423-1.496c-.896-.798-1.501-1.784-1.677-2.085-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.176.201-.301.301-.502.101-.201.05-.376-.025-.527s-.678-1.633-.929-2.235c-.244-.587-.493-.507-.678-.517-.176-.008-.376-.01-.577-.01s-.527.075-.803.376c-.276.301-1.054 1.03-1.054 2.511s1.079 2.912 1.23 3.113c.15.201 2.124 3.243 5.145 4.548.719.311 1.28.497 1.718.636.722.23 1.379.198 1.9-.12.58-.354 1.78-1.455 2.032-2.008.251-.553.251-1.03.176-1.181-.076-.151-.277-.226-.578-.376zM12.04 2C6.518 2 2.03 6.485 2.03 12.004c0 1.956.564 3.784 1.542 5.334L2 22l4.821-1.528c1.488.895 3.23 1.411 5.093 1.411 5.521 0 10.01-4.485 10.01-10.005 0-5.52-4.489-10.004-10.01-10.004zm0 18.28c-1.666 0-3.21-.497-4.509-1.353l-.323-.213-3.339 1.059 1.077-3.254-.233-.352c-.93-1.407-1.426-3.064-1.426-4.796 0-4.57 3.719-8.286 8.289-8.286 4.569 0 8.289 3.716 8.289 8.286 0 4.571-3.72 8.287-8.289 8.287z" />
    </svg>
  );
}
