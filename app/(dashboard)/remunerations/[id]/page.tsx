"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  History,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Percent,
  Plus,
  Receipt,
  ReceiptText,
  RefreshCcw,
  SendHorizontal,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  RemunerationRecord,
  RemunerationInstallment,
  RemunerationTimelineEvent,
  NotificationLog,
  formatCurrency,
  getStatusBadgeConfig,
} from "@/lib/types/remuneration";

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDatetime(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({ received, total }: { received: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  return (
    <div className="relative h-2.5 rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#B8944E] to-emerald-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ==============================================================================
// MODAL: Request Payment
// ==============================================================================
interface RequestModalProps {
  remId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RequestPaymentModal({ remId, currency, onClose, onSuccess }: RequestModalProps) {
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    if (!dueDate) { setError("Select a due date."); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/remunerations/${remId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, dueDate, sendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment request");
      toast.success(sendEmail ? "Payment request created and email sent!" : "Payment request logged.");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Mail size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#252331]">Request Payment</h2>
            <p className="text-xs text-[#9994A5]">Create and send a payment request to the client</p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">{error}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount ({currency})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-xs">
            <span className="font-semibold text-[#252331]">Send Payment Request Email</span>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded text-[#B8944E]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" onClick={handleSend} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <SendHorizontal size={14} className="mr-1.5" />}
            Submit Request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: Record / Complete Payment
// ==============================================================================
interface ReceiveModalProps {
  remId: string;
  currency: string;
  installments: RemunerationInstallment[];
  preSelectedInstallmentId?: string;
  defaultSplits?: any[];
  onClose: () => void;
  onSuccess: () => void;
}

function RecordPaymentModal({
  remId,
  currency,
  installments,
  preSelectedInstallmentId,
  defaultSplits = [],
  onClose,
  onSuccess,
}: ReceiveModalProps) {
  const [selectedInstId, setSelectedInstId] = useState(preSelectedInstallmentId || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Bank Transfer");
  const [ref, setRef] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Initialize splits based on default splits
  const [splits, setSplits] = useState<any[]>(() => {
    return defaultSplits.map((s) => ({
      teamMemberId: s.teamMemberId || s.team_user_id || "",
      name: s.name || s.member_name || "",
      role: s.role || "",
      percentage: s.percentage || 0,
      amount: 0,
    }));
  });

  // Autofill amount if installment selected
  useEffect(() => {
    if (selectedInstId) {
      const inst = installments.find((i) => i.id === selectedInstId);
      if (inst) {
        const remaining = Math.max(0, (Number(inst.amount) || 0) - (Number(inst.received_amount) || 0));
        setAmount(remaining.toString());
        recalcSplits(remaining);
      }
    }
  }, [selectedInstId, installments]);

  const recalcSplits = (totalAmt: number) => {
    setSplits((prev) =>
      prev.map((s) => ({
        ...s,
        amount: s.percentage ? Math.round(((totalAmt * s.percentage) / 100) * 100) / 100 : 0,
      }))
    );
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    recalcSplits(num);
  };

  const handleSplitAmountChange = (idx: number, val: string) => {
    const num = parseFloat(val) || 0;
    setSplits((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], amount: num };
      return copy;
    });
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid received amount."); return; }
    if (!date) { setError("Select payment date."); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/remunerations/${remId}/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: selectedInstId || null,
          receivedAmount: amt,
          receivedDate: date,
          paymentMethod: method,
          paymentReference: ref || null,
          sendEmail,
          teamSplits: splits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      toast.success("Payment recorded successfully!");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to record payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-lg p-6 space-y-4 my-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h2 className="font-semibold text-[#252331]">Record Received Payment</h2>
            <p className="text-xs text-[#9994A5]">Log an incoming transaction and distribute team shares</p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">{error}</div>}

        <div className="space-y-3.5 text-xs">
          {installments.length > 0 && (
            <div>
              <label className={labelClass}>Apply To Payment Request (Optional)</label>
              <select
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className={inputClass}
              >
                <option value="">— Standalone / Direct Payment —</option>
                {installments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name || `Installment #${inst.installment_number}`} ({formatCurrency(inst.amount, currency)}) — Status: {inst.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Received Amount ({currency}) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Payment Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Reference / UTR (Optional)</label>
              <input
                type="text"
                placeholder="e.g. UTR12345678"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Team Member Splits for this payment */}
          {splits.length > 0 && (
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#252331] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users size={13} className="text-[#80642F]" />
                  Team Remuneration Allocation
                </span>
                <span className="text-[10px] text-[#706C7D]">Auto-calculated from agreement</span>
              </div>

              <div className="space-y-2">
                {splits.map((split, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-white p-2 rounded-lg border border-[rgba(74,61,100,0.06)]">
                    <div>
                      <p className="font-semibold text-[#252331]">{split.name}</p>
                      <p className="text-[10px] text-[#9994A5]">{split.percentage ? `${split.percentage}% share` : split.role || "Member"}</p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={split.amount || ""}
                        onChange={(e) => handleSplitAmountChange(idx, e.target.value)}
                        className={`${inputClass} text-right py-1`}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-xs">
            <span className="font-semibold text-[#252331]">Send Payment Receipt Email to Client</span>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded text-[#B8944E]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="inline-flex items-center justify-center font-medium rounded-xl h-10 px-4 py-2 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-xs"
          >
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: Send Agreement Email
// ==============================================================================
function SendAgreementModal({
  remId,
  clientName,
  clientEmail,
  onClose,
  onSuccess,
}: {
  remId: string;
  clientName?: string | null;
  clientEmail?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState(clientEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/remunerations/${remId}/send-agreement-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientEmail: email, clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send agreement email");
      toast.success(data.message || `Agreement confirmation email dispatched to ${email}!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to send email.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[rgba(74,61,100,0.1)] space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F]">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-[#252331] text-sm sm:text-base">Send Agreement Email</h2>
              <p className="text-[11px] text-[#706C7D]">Send official payment agreement confirmation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9994A5] hover:text-[#252331] p-1 rounded-md">✕</button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className={labelClass}>Client Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className={inputClass}
          />
          <p className="text-[10px] text-[#9994A5] mt-1.5">
            The client will receive an agreement confirmation detailing total agreed amount, terms, and Client Portal access link.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(74,61,100,0.06)]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSend} disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <SendHorizontal size={13} />
                Send Agreement Email
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: Send Team Allocation Email
// ==============================================================================
interface SendTeamPaymentModalProps {
  remId: string;
  currency: string;
  projectName: string;
  payment: any;
  split: any;
  teamMembers: any[];
  onClose: () => void;
  onSuccess: () => void;
}

function SendTeamPaymentModal({
  remId,
  currency,
  projectName,
  payment,
  split,
  teamMembers = [],
  onClose,
  onSuccess,
}: SendTeamPaymentModalProps) {
  const existingMember = teamMembers.find(
    (tm) => tm.id === split.team_user_id || tm.name?.toLowerCase() === split.member_name?.toLowerCase()
  );
  const defaultEmail = existingMember?.email || (existingMember?.username?.includes("@") ? existingMember.username : "");

  const [email, setEmail] = useState(defaultEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email || !email.includes("@")) {
      setError("Please provide a valid email address for the team member.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/remunerations/${remId}/send-team-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment?.id,
          teamMemberId: split?.team_user_id || existingMember?.id,
          memberName: split?.member_name,
          recipientEmail: email,
          amount: split?.amount,
          role: split?.role,
          percentage: split?.percentage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send allocation email");
      toast.success(data.message || `Allocation email sent to ${split.member_name} (${email})!`);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to send email.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-[rgba(74,61,100,0.1)] space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F]">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-[#252331] text-sm sm:text-base">Send Allocation Email</h2>
              <p className="text-[11px] text-[#706C7D]">Notify team member of their received payout</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9994A5] hover:text-[#252331] p-1 rounded-md cursor-pointer">✕</button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Member & Split Info Summary */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#706C7D]">Team Member:</span>
            <span className="font-bold text-[#252331]">{split.member_name}</span>
          </div>
          {split.role && (
            <div className="flex items-center justify-between">
              <span className="text-[#706C7D]">Role:</span>
              <span className="text-[#252331] capitalize">{split.role}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[#706C7D]">Allocated Share:</span>
            <span className="font-bold text-emerald-700 text-sm">
              {formatCurrency(split.amount, currency)}
              {split.percentage ? ` (${split.percentage}%)` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-[rgba(74,61,100,0.06)] pt-2">
            <span className="text-[#706C7D]">Payment Recorded:</span>
            <span className="text-[#252331]">{fmt(payment.payment_date)}</span>
          </div>
        </div>

        <div>
          <label className={labelClass}>Recipient Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="member@example.com"
            className={inputClass}
            autoFocus={!defaultEmail}
          />
          {!defaultEmail ? (
            <p className="text-[11px] text-amber-700 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0 text-amber-600" />
              <span>No email on file for {split.member_name}. Please enter their email address to send the allocation.</span>
            </p>
          ) : (
            <p className="text-[10px] text-[#9994A5] mt-1.5">
              Verified email address from team member records. You can modify if needed.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(74,61,100,0.06)]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSend} disabled={submitting}>
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={13} className="animate-spin" />
                Sending...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <SendHorizontal size={13} />
                Send Allocation Email
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================
export default function RemunerationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const remId = params?.id as string;

  const [rem, setRem] = useState<RemunerationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [sendAgreementModalOpen, setSendAgreementModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preSelectedInstId, setPreSelectedInstId] = useState<string | undefined>(undefined);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [installmentToDelete, setInstallmentToDelete] = useState<RemunerationInstallment | null>(null);
  const [deletingInstallment, setDeletingInstallment] = useState(false);

  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const [teamEmailTarget, setTeamEmailTarget] = useState<{ payment: any; split: any } | null>(null);

  const handleDeleteRemuneration = async () => {
    if (!rem?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/remunerations/${rem.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete remuneration");
      toast.success("Remuneration agreement deleted successfully");
      router.push("/remunerations");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete remuneration");
      setDeleting(false);
    }
  };

  const handleDeleteInstallment = async () => {
    if (!rem?.id || !installmentToDelete) return;
    setDeletingInstallment(true);
    try {
      const res = await fetch(`/api/remunerations/${rem.id}/installments/${installmentToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete milestone");
      toast.success("Payment request / milestone removed successfully");
      setInstallmentToDelete(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete milestone");
    } finally {
      setDeletingInstallment(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!rem?.id || !paymentToDelete) return;
    setDeletingPayment(true);
    try {
      const res = await fetch(`/api/remunerations/${rem.id}/payments/${paymentToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete transaction record");
      toast.success("Transaction record deleted successfully");
      setPaymentToDelete(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete transaction record");
    } finally {
      setDeletingPayment(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    if (!remId) return;
    try {
      const res = await fetch(`/api/remunerations/${remId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Remuneration not found");
        throw new Error("Failed to load remuneration details");
      }
      const data = await res.json();
      setRem(data.remuneration);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [remId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B8944E]" />
      </div>
    );
  }

  if (error || !rem) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] p-8">
        <div className="max-w-md mx-auto rounded-2xl bg-white p-6 shadow-sm border border-red-200 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-[#252331]">Error</h2>
          <p className="text-sm text-[#706C7D]">{error || "Remuneration record not found"}</p>
          <Button onClick={() => router.push("/remunerations")}>Return to Remunerations</Button>
        </div>
      </div>
    );
  }

  const badge = getStatusBadgeConfig(rem.status);
  const installments = rem.installments || [];
  const allPayments = rem.payments || [];
  const splits = rem.splits || [];
  const notifLogs = rem.notification_logs || [];
  const timeline = rem.timeline || [];

  const totalAmount = Number(rem.total_amount) || 0;
  const receivedAmount = Number(rem.received_amount) || 0;
  const remainingAmount = Math.max(0, totalAmount - receivedAmount);
  const overdueAmount = Number(rem.overdue_amount) || 0;

  return (
    <div className="min-h-screen bg-[#f8f7fc] pb-16">
      <DashboardHeader
        title={rem.project?.name ? `${rem.project.name} Remuneration` : "Remuneration Details"}
        backHref="/remunerations"
        backLabel="Remunerations"
        description={`Payment ledger and tracking for ${rem.project?.name || "Project"}`}
      />

      <div className="mx-auto max-w-[1720px] px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Top Header Card */}
        <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#252331]">{rem.project?.name || "Project Remuneration"}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${badge.indicator}`} />
                {badge.label}
              </span>
            </div>
            <p className="text-xs text-[#706C7D]">
              Payment Method: <span className="font-semibold text-[#252331] capitalize">{rem.payment_method}</span>
              {rem.client?.name && ` • Client: ${rem.client.name}`}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              size="md"
              onClick={() => setSendAgreementModalOpen(true)}
              className="text-[#80642F] border-[rgba(184,148,78,0.3)] hover:bg-[rgba(184,148,78,0.06)]"
              leftIcon={<Mail size={15} />}
            >
              Send Agreement Email
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => setDeleteModalOpen(true)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              leftIcon={<Trash2 size={15} />}
            >
              Delete Agreement
            </Button>

            <div className="relative" ref={menuRef}>
              <Button
                variant="primary"
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={16} />
                <span>Add Payment Details</span>
                <ChevronDown size={14} className="opacity-80" />
              </Button>

              {showAddMenu && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-1.5 shadow-xl z-30 space-y-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      setSendAgreementModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[#252331] hover:bg-[#faf9fc] hover:text-[#80642F] font-medium transition-colors cursor-pointer"
                  >
                    <Mail size={15} className="text-[#B8944E] shrink-0" />
                    <div>
                      <p className="font-semibold">Send Agreement Email</p>
                      <p className="text-[10px] text-[#9994A5]">Send terms & portal link to client</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      setRequestModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[#252331] hover:bg-[#faf9fc] hover:text-[#80642F] font-medium transition-colors cursor-pointer"
                  >
                    <ReceiptText size={15} className="text-amber-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Request Payment</p>
                      <p className="text-[10px] text-[#9994A5]">Send payment demand / email</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMenu(false);
                      setPreSelectedInstId(undefined);
                      setRecordModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[#252331] hover:bg-[#faf9fc] hover:text-emerald-700 font-medium transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-semibold">Record Payment</p>
                      <p className="text-[10px] text-[#9994A5]">Log received amount & splits</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Total Agreement</span>
            <p className="text-2xl font-bold text-[#252331]">{formatCurrency(totalAmount, rem.currency)}</p>
            <ProgressBar received={receivedAmount} total={totalAmount} />
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total Received</span>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(receivedAmount, rem.currency)}</p>
            <span className="text-xs text-emerald-600 font-medium">
              {totalAmount > 0 ? `${Math.round((receivedAmount / totalAmount) * 100)}% collected` : "0%"}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5 shadow-sm space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Balance</span>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(remainingAmount, rem.currency)}</p>
            <span className="text-xs text-amber-600 font-medium">Remaining balance</span>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 shadow-sm space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Overdue Amount</span>
            <p className="text-2xl font-bold text-rose-700">{formatCurrency(overdueAmount, rem.currency)}</p>
            <span className="text-xs text-rose-600 font-medium">{overdueAmount > 0 ? "Action required" : "No overdue items"}</span>
          </div>
        </div>

        {/* 2-Column Ledger & Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Columns (2 span): Payment Requests & Transaction Records */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Requests & Installments Schedule */}
            <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#252331]">Payment Requests & Milestones</h2>
                  <p className="text-xs text-[#9994A5]">Invoiced or scheduled installments</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setRequestModalOpen(true)}
                  className="text-xs"
                >
                  <Plus size={14} className="mr-1" /> New Request
                </Button>
              </div>

              {installments.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Receipt className="mx-auto h-8 w-8 text-[#9994A5] opacity-50" />
                  <p className="text-xs text-[#706C7D]">No payment requests created yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRequestModalOpen(true)}
                    className="text-xs text-[#80642F] border-[#B8944E]"
                  >
                    Request First Payment
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {installments.map((inst) => {
                    const instStatusBadge = getStatusBadgeConfig(inst.status);
                    const instRemaining = Math.max(0, (Number(inst.amount) || 0) - (Number(inst.received_amount) || 0));
                    const isFullyPaid = inst.status === "paid" || inst.status === "completed" || instRemaining <= 0;

                    return (
                      <div
                        key={inst.id}
                        className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#252331] text-sm">
                              {inst.name || `Payment Request #${inst.installment_number}`}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${instStatusBadge.bg}`}>
                              {instStatusBadge.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#706C7D]">
                            <span>Due: <strong className="text-[#252331]">{fmt(inst.due_date)}</strong></span>
                            {inst.requested_date && (
                              <span>Requested: {fmt(inst.requested_date)}</span>
                            )}
                            {Number(inst.received_amount) > 0 && (
                              <span className="text-emerald-700">Received: {formatCurrency(inst.received_amount, rem.currency)}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                          <div className="text-right">
                            <p className="text-base font-bold text-[#252331]">{formatCurrency(inst.amount, rem.currency)}</p>
                            {!isFullyPaid && (
                              <p className="text-[10px] text-amber-700 font-medium">Bal: {formatCurrency(instRemaining, rem.currency)}</p>
                            )}
                          </div>

                          {!isFullyPaid && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreSelectedInstId(inst.id);
                                setRecordModalOpen(true);
                              }}
                              className="inline-flex items-center justify-center font-medium rounded-xl h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                            >
                              <CheckCircle2 size={13} className="mr-1" /> Receive
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setInstallmentToDelete(inst)}
                            title="Delete payment request / milestone"
                            className="inline-flex items-center justify-center rounded-xl h-8 w-8 text-[#9994A5] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actual Payment Transactions Ledger */}
            <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#252331]">Actual Transaction Records</h2>
                  <p className="text-xs text-[#9994A5]">Completed incoming payments and distributions</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPreSelectedInstId(undefined);
                    setRecordModalOpen(true);
                  }}
                  className="text-xs"
                >
                  <Plus size={14} className="mr-1" /> Record Payment
                </Button>
              </div>

              {allPayments.length === 0 ? (
                <p className="text-xs text-[#9994A5] py-6 text-center">No payment transactions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {allPayments.map((pm: any) => {
                    const sps = pm.team_splits || [];
                    return (
                      <div key={pm.id} className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-sm text-emerald-800">{formatCurrency(pm.amount, rem.currency)}</span>
                            <span className="text-[#706C7D]">on {fmt(pm.payment_date)}</span>
                            <span className="rounded bg-white border border-[rgba(74,61,100,0.10)] px-2 py-0.5 text-[10px] font-semibold text-[#252331]">
                              {pm.payment_method}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {pm.payment_reference && (
                              <span className="font-mono text-[11px] text-[#252331] bg-white px-2 py-0.5 rounded border border-[rgba(74,61,100,0.10)]">
                                Ref: {pm.payment_reference}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setPaymentToDelete(pm)}
                              title="Delete transaction record"
                              className="inline-flex items-center justify-center rounded-lg h-7 w-7 text-[#9994A5] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {sps.length > 0 && (
                          <div className="bg-white rounded-lg p-2.5 border border-[rgba(74,61,100,0.06)] space-y-2">
                            <span className="font-bold text-[11px] text-[#80642F]">Team Allocation Breakdown:</span>
                            <div className="flex flex-wrap gap-2">
                              {sps.map((s: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 px-2.5 py-1 rounded-lg text-[11px] text-[#252331] transition-colors shadow-2xs"
                                >
                                  <span>
                                    <strong>{s.member_name}</strong>: {formatCurrency(s.amount, rem.currency)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setTeamEmailTarget({ payment: pm, split: s })}
                                    title={`Send allocation email to ${s.member_name}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#80642F] bg-[rgba(184,148,78,0.12)] hover:bg-[rgba(184,148,78,0.24)] transition-colors cursor-pointer"
                                  >
                                    <Mail size={11} />
                                    <span>Send Mail</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Project Client Info, Team Remuneration, Audit Log */}
          <div className="space-y-6">
            {/* Client & Agreement Info */}
            <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Client & Agreement Info</h3>
                <button
                  type="button"
                  onClick={() => setSendAgreementModalOpen(true)}
                  className="text-[11px] font-semibold text-[#80642F] hover:underline flex items-center gap-1"
                >
                  <Mail size={12} />
                  <span>Send Email</span>
                </button>
              </div>
              <p className="font-bold text-[#252331] text-sm">{rem.client?.name || "Direct / In-House Project"}</p>
              <p className="text-[#706C7D]">{rem.client?.email || "No email assigned"}</p>
              <div className="border-t border-[rgba(74,61,100,0.06)] pt-2.5 space-y-1.5 text-[#706C7D]">
                <div className="flex justify-between">
                  <span>Agreement Date:</span>
                  <strong className="text-[#252331]">{fmt(rem.agreement_date)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Receipt Emails:</span>
                  <strong className="text-emerald-700">{rem.send_receipt_email !== false ? "Enabled" : "Disabled"}</strong>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSendAgreementModalOpen(true)}
                className="w-full text-xs font-semibold text-[#80642F] border-[rgba(184,148,78,0.25)] hover:bg-[rgba(184,148,78,0.05)] justify-center mt-1"
                leftIcon={<Mail size={13} />}
              >
                {rem.client?.email ? "Resend Agreement Email" : "Send Agreement Email"}
              </Button>
            </div>

            {/* Team Remuneration Agreed Splits */}
            {splits.length > 0 && (
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Team Remuneration</h3>
                  <span className="text-[10px] text-[#706C7D]">{splits.length} members</span>
                </div>
                <div className="space-y-2">
                  {splits.map((split: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#faf9fc] border border-[rgba(74,61,100,0.06)]">
                      <div>
                        <p className="font-semibold text-[#252331]">{split.name || split.member_name}</p>
                        <p className="text-[10px] text-[#9994A5]">{split.percentage ? `${split.percentage}% share` : split.role || "Member"}</p>
                      </div>
                      <span className="font-bold text-[#252331]">{formatCurrency(split.amount, rem.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notification Audit Log */}
            <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Notification Audit</h3>
                <span className="text-[10px] text-[#9994A5]">{notifLogs.length} events</span>
              </div>

              {notifLogs.length === 0 ? (
                <p className="text-xs text-[#9994A5] py-2 text-center">No notifications logged yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 text-xs">
                  {notifLogs.map((log) => (
                    <div key={log.id} className="border-b border-[rgba(74,61,100,0.04)] pb-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-[#252331] truncate max-w-[140px]">{log.recipient}</span>
                        <span className={`text-[10px] px-1.5 rounded ${log.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                          {log.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#9994A5]">{log.notification_type} • {fmtDatetime(log.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline */}
            {timeline.length > 0 && (
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5] mb-3">Activity History</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {timeline.map((event, i) => (
                    <div key={event.id || i} className="flex gap-2 text-xs">
                      <Clock size={12} className="text-[#80642F] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#252331]">{event.title}</p>
                        <p className="text-[10px] text-[#9994A5]">{fmtDatetime(event.created_at)} · {event.actor_name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {sendAgreementModalOpen && (
        <SendAgreementModal
          remId={rem.id}
          clientName={rem.client?.name}
          clientEmail={rem.client?.email}
          onClose={() => setSendAgreementModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {requestModalOpen && (
        <RequestPaymentModal
          remId={rem.id}
          currency={rem.currency}
          onClose={() => setRequestModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {recordModalOpen && (
        <RecordPaymentModal
          remId={rem.id}
          currency={rem.currency}
          installments={installments}
          preSelectedInstallmentId={preSelectedInstId}
          defaultSplits={splits}
          onClose={() => setRecordModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {/* Team Member Payment Allocation Email Modal */}
      {teamEmailTarget && (
        <SendTeamPaymentModal
          remId={rem.id}
          currency={rem.currency}
          projectName={rem.project?.name || "Project"}
          payment={teamEmailTarget.payment}
          split={teamEmailTarget.split}
          teamMembers={rem.teamMembers || []}
          onClose={() => setTeamEmailTarget(null)}
          onSuccess={loadData}
        />
      )}

      {/* Delete Installment / Payment Request Modal */}
      {installmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-[#252331] text-base">Delete Payment Request / Milestone?</h2>
                <p className="text-xs text-[#9994A5]">Remove from schedule and ledger</p>
              </div>
            </div>

            <div className="text-xs text-[#706C7D] space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <strong className="text-[#252331]">
                  {installmentToDelete.name || `Payment Request #${installmentToDelete.installment_number}`}
                </strong>{" "}
                ({formatCurrency(installmentToDelete.amount, rem.currency)})?
              </p>

              {Number(installmentToDelete.received_amount) > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-[11px] flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    This milestone has <strong>{formatCurrency(installmentToDelete.received_amount, rem.currency)}</strong> in recorded payments. Deleting it will also remove linked transaction records and reverse team allocations.
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setInstallmentToDelete(null)}
                disabled={deletingInstallment}
              >
                Cancel
              </Button>
              <Button
                variant="danger-solid"
                onClick={handleDeleteInstallment}
                disabled={deletingInstallment}
                isLoading={deletingInstallment}
              >
                Delete Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Actual Transaction Record Modal */}
      {paymentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-[#252331] text-base">Delete Transaction Record?</h2>
                <p className="text-xs text-[#9994A5]">Remove completed transaction</p>
              </div>
            </div>

            <div className="text-xs text-[#706C7D] space-y-2">
              <p>
                Are you sure you want to delete the transaction record of{" "}
                <strong className="text-emerald-700">
                  {formatCurrency(paymentToDelete.amount, rem.currency)}
                </strong>{" "}
                received on <strong>{fmt(paymentToDelete.payment_date)}</strong>?
              </p>

              <div className="rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-[11px] text-[#706C7D] space-y-1">
                <p>• Deducts {formatCurrency(paymentToDelete.amount, rem.currency)} from the collected total balance.</p>
                <p>• Automatically reverts and recalculates milestone payment progress.</p>
                <p>• Removes team split payouts associated with this transaction.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setPaymentToDelete(null)}
                disabled={deletingPayment}
              >
                Cancel
              </Button>
              <Button
                variant="danger-solid"
                onClick={handleDeletePayment}
                disabled={deletingPayment}
                isLoading={deletingPayment}
              >
                Delete Transaction
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-[#252331] text-base">Delete Remuneration Agreement?</h2>
                <p className="text-xs text-[#9994A5]">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-[#706C7D] leading-relaxed">
              Are you sure you want to permanently delete the remuneration agreement for{" "}
              <strong className="text-[#252331]">{rem.project?.name || "this project"}</strong>? This will remove all associated payment requests, logged transactions, team allocations, and audit history.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger-solid"
                onClick={handleDeleteRemuneration}
                disabled={deleting}
                isLoading={deleting}
              >
                Delete Agreement
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
