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
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import {
  RemunerationRecord,
  RemunerationInstallment,
  RemunerationTimelineEvent,
  RemunerationNotificationPreferences,
  PaymentTeamSplit,
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

function isOverdue(inst: RemunerationInstallment) {
  if (inst.status === "completed" || inst.status === "paid") return false;
  if (!inst.due_date) return false;
  return inst.due_date < new Date().toISOString().split("T")[0];
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
// MODAL: Request Payment from Client
// ==============================================================================
interface RequestModalProps {
  installment: RemunerationInstallment;
  remId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}
function RequestPaymentModal({ installment, remId, currency, onClose, onSuccess }: RequestModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const handleSend = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/remunerations/${remId}/installments/${installment.id}/request`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      toast.success("Payment request email sent to client!");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <Mail size={18} className="text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#252331]">Request Payment</h2>
            <p className="text-xs text-[#9994A5]">Installment #{installment.installment_number}</p>
          </div>
        </div>
        <p className="text-sm text-[#706C7D]">
          An email will be sent to the client requesting{" "}
          <strong className="text-[#252331]">{formatCurrency(installment.amount, currency)}</strong> due on{" "}
          <strong className="text-[#252331]">{fmt(installment.due_date)}</strong>.
        </p>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>
        )}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSend} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <SendHorizontal size={14} className="mr-1.5" />}
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: Receive Payment with Inline Team Split
// ==============================================================================
interface ReceiveModalProps {
  installment: RemunerationInstallment;
  remId: string;
  currency: string;
  teamMembers: any[];
  defaultSendEmail?: boolean;
  initialSplits?: any[];
  onClose: () => void;
  onSuccess: () => void;
}
function ReceivePaymentModal({
  installment,
  remId,
  currency,
  teamMembers,
  defaultSendEmail = true,
  initialSplits = [],
  onClose,
  onSuccess,
}: ReceiveModalProps) {
  const remainingBal = Math.max(0, Number(installment.amount) - (Number(installment.received_amount) || 0));
  const [amount, setAmount] = useState(String(remainingBal > 0 ? remainingBal : installment.amount));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [sendEmail, setSendEmail] = useState(defaultSendEmail);
  const [notifyTeam, setNotifyTeam] = useState(true);

  const [enableSplit, setEnableSplit] = useState(false);
  const [splits, setSplits] = useState<Array<{ teamMemberId: string; name: string; role?: string; amount: number; percentage?: number }>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const numAmount = parseFloat(amount) || 0;
  const totalAllocated = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const remainingMargin = Math.max(0, numAmount - totalAllocated);
  const isOverAllocated = totalAllocated > numAmount + 0.01;

  const handleToggleSplit = (checked: boolean) => {
    setEnableSplit(checked);
    if (checked && splits.length === 0 && teamMembers.length > 0) {
      const hasInitialSplits = initialSplits.length > 0;

      setSplits(
        teamMembers.map((m) => {
          const init = hasInitialSplits ? initialSplits.find((s: any) => s.teamMemberId === m.id) : null;
          const percentage = init?.percentage || 0;
          const amt = percentage > 0 ? Math.round(((numAmount * percentage) / 100) * 100) / 100 : 0;
          return {
            teamMemberId: m.id,
            name: m.name,
            role: m.role || "Developer",
            amount: amt,
            percentage: percentage,
          };
        })
      );
    }
  };

  const handleUpdateSplitAmount = (index: number, val: number) => {
    const updated = [...splits];
    updated[index].amount = val;
    updated[index].percentage = numAmount > 0 ? Number(((val / numAmount) * 100).toFixed(1)) : 0;
    setSplits(updated);
  };

  const handleSubmit = async () => {
    if (!amount || numAmount <= 0) { setError("Enter a valid amount."); return; }
    if (!date) { setError("Select a received date."); return; }
    if (enableSplit && isOverAllocated) {
      setError(`Total team split (${formatCurrency(totalAllocated, currency)}) cannot exceed payment amount (${formatCurrency(numAmount, currency)}).`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("receivedAmount", amount);
      formData.append("receivedDate", date);
      formData.append("paymentMethod", method);
      formData.append("sendEmail", String(sendEmail));
      formData.append("notifyTeam", String(notifyTeam));
      if (reference) formData.append("paymentReference", reference);
      if (notes) formData.append("notes", notes);
      if (proof) formData.append("proof", proof);

      if (enableSplit) {
        const validSplits = splits.filter((s) => s.amount > 0);
        formData.append("teamSplits", JSON.stringify(validSplits));
      }

      const res = await fetch(`/api/remunerations/${remId}/installments/${installment.id}/receive`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      toast.success("Payment and team allocations recorded successfully!");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#252331]">Record Payment Received</h2>
            <p className="text-xs text-[#9994A5]">Installment #{installment.installment_number} — Remaining: {formatCurrency(remainingBal > 0 ? remainingBal : installment.amount, currency)}</p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount Received ({currency})</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Received Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                {["Bank Transfer", "UPI", "Cash", "Card", "Cheque", "Other"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Reference / UTR (optional)</label>
              <input type="text" placeholder="e.g. UTR123456789" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} placeholder="Transaction remarks..." />
          </div>

          <div>
            <label className={labelClass}>Proof Document / Receipt (optional)</label>
            <div
              className="flex items-center gap-3 rounded-lg border border-dashed border-[rgba(74,61,100,0.20)] bg-[#faf9fc] px-4 py-2.5 cursor-pointer hover:border-[#B8944E] transition"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={15} className="text-[#9994A5]" />
              <span className="text-xs text-[#706C7D]">
                {proof ? proof.name : "Attach invoice screenshot or PDF"}
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] || null)} />
          </div>

          {/* Team Member Splits */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#faf9fc] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-[#80642F]" />
                <span className="text-xs font-bold text-[#252331]">Team Member Payment Split</span>
              </div>
              <input
                type="checkbox"
                checked={enableSplit}
                onChange={(e) => handleToggleSplit(e.target.checked)}
                className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
              />
            </div>

            {enableSplit && (
              <div className="space-y-2 pt-2 border-t border-[rgba(74,61,100,0.08)]">
                <div className="grid grid-cols-3 gap-2 bg-white rounded-lg p-2 border border-[rgba(74,61,100,0.08)] text-center text-[11px]">
                  <div>
                    <span className="text-[#9994A5] font-bold block">Payment</span>
                    <span className="font-bold text-[#252331]">{formatCurrency(numAmount, currency)}</span>
                  </div>
                  <div>
                    <span className="text-[#9994A5] font-bold block">Allocated</span>
                    <span className={`font-bold ${isOverAllocated ? "text-rose-600" : "text-[#80642F]"}`}>
                      {formatCurrency(totalAllocated, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#9994A5] font-bold block">Remaining</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(remainingMargin, currency)}</span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {splits.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-[rgba(74,61,100,0.06)] text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-[#252331] truncate">{s.name}</p>
                        <p className="text-[10px] text-[#9994A5]">{s.role || "Member"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={s.amount || ""}
                          onChange={(e) => handleUpdateSplitAmount(idx, parseFloat(e.target.value) || 0)}
                          placeholder="Amount"
                          className="w-24 text-xs p-1 border rounded bg-white"
                        />
                        <span className="text-[11px] text-[#706C7D] w-10 text-right">{s.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-xs">
            <span className="font-semibold text-[#252331]">Send Client Receipt Email</span>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || (enableSplit && isOverAllocated)}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MODAL: Installment Milestone Create / Edit
// ==============================================================================
interface MilestoneModalProps {
  remId: string;
  currency: string;
  existingInstallment?: RemunerationInstallment | null;
  onClose: () => void;
  onSuccess: () => void;
}
function MilestoneModal({ remId, currency, existingInstallment, onClose, onSuccess }: MilestoneModalProps) {
  const isEditing = Boolean(existingInstallment);
  const [name, setName] = useState(existingInstallment?.name || "");
  const [amount, setAmount] = useState(existingInstallment ? String(existingInstallment.amount) : "");
  const [dueDate, setDueDate] = useState(existingInstallment?.due_date || "");
  const [description, setDescription] = useState(existingInstallment?.description || "");
  const [notes, setNotes] = useState(existingInstallment?.notes || "");
  const [status, setStatus] = useState<string>(existingInstallment?.status || "planned");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Specify a positive amount."); return; }

    setSubmitting(true);
    setError("");
    try {
      const payload: any = {};
      if (isEditing && existingInstallment) {
        payload.updateInstallment = {
          id: existingInstallment.id,
          installmentNumber: existingInstallment.installment_number,
          name: name.trim() || `Milestone #${existingInstallment.installment_number}`,
          amount: amt,
          dueDate: dueDate ? dueDate : null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          status,
        };
      } else {
        payload.newInstallment = {
          name: name.trim() || null,
          amount: amt,
          dueDate: dueDate ? dueDate : null,
          description: description.trim() || null,
          notes: notes.trim() || null,
        };
        payload.autoAdjustTotal = true;
      }

      const res = await fetch(`/api/remunerations/${remId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save milestone");
      toast.success(isEditing ? "Milestone updated!" : "New milestone added!");
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-[#252331]">{isEditing ? "Edit Milestone" : "Add Payment Milestone"}</h2>
        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Milestone Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Design Approval" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount ({currency})</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Due Date (Optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          {isEditing && (
            <div>
              <label className={labelClass}>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                <option value="planned">Planned</option>
                <option value="due">Due</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
          <div>
            <label className={labelClass}>Description / Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// MAIN DETAIL PAGE
// ==============================================================================
export default function RemunerationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const remId = params.id;

  const [rem, setRem] = useState<RemunerationRecord | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<RemunerationTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [requestModal, setRequestModal] = useState<RemunerationInstallment | null>(null);
  const [receiveModal, setReceiveModal] = useState<RemunerationInstallment | null>(null);
  const [milestoneModal, setMilestoneModal] = useState<{ open: boolean; installment?: RemunerationInstallment | null }>({ open: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/remunerations/${remId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load remuneration");
      setRem(data.remuneration);
      setTeamMembers(data.teamMembers || []);
      setTimeline(data.timeline || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [remId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#B8944E]" />
      </div>
    );
  }

  if (error || !rem) {
    return (
      <div className="min-h-screen bg-[#f8f7fc]">
        <DashboardHeader title="Remuneration" backHref="/remunerations" backLabel="Remunerations" />
        <div className="mx-auto max-w-3xl px-8 py-16 text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-[#706C7D]">{error || "Remuneration not found."}</p>
          <Button onClick={() => router.push("/remunerations")} className="mt-4">Back to list</Button>
        </div>
      </div>
    );
  }

  const cfg = getStatusBadgeConfig(rem.agreement_status || rem.status);
  const totalAgreed = rem.total_amount || 0;
  const plannedInstallments = rem.planned_installments_total ?? (rem.installments?.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) || totalAgreed);
  const totalReceived = rem.received_amount || 0;
  const totalPending = rem.remaining_amount ?? Math.max(0, totalAgreed - totalReceived);
  const totalDistributed = rem.total_distributed_to_team || 0;
  const totalUndistributed = rem.total_undistributed ?? Math.max(0, totalReceived - totalDistributed);
  const progressPct = totalAgreed > 0 ? Math.min(100, Math.round((totalReceived / totalAgreed) * 100)) : 0;

  const isOverPlanned = plannedInstallments > totalAgreed + 0.01;
  const isOverPaid = totalReceived > totalAgreed + 0.01;
  const allPayments = rem.payments || [];
  const notifLogs = rem.notification_logs || [];

  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      {requestModal && (
        <RequestPaymentModal
          installment={requestModal}
          remId={remId}
          currency={rem.currency}
          onClose={() => setRequestModal(null)}
          onSuccess={load}
        />
      )}
      {receiveModal && (
        <ReceivePaymentModal
          installment={receiveModal}
          remId={remId}
          currency={rem.currency}
          teamMembers={teamMembers}
          defaultSendEmail={rem.send_receipt_email ?? true}
          initialSplits={rem.splits || []}
          onClose={() => setReceiveModal(null)}
          onSuccess={load}
        />
      )}
      {milestoneModal.open && (
        <MilestoneModal
          remId={remId}
          currency={rem.currency}
          existingInstallment={milestoneModal.installment}
          onClose={() => setMilestoneModal({ open: false })}
          onSuccess={load}
        />
      )}

      <DashboardHeader
        category="Remunerations"
        title={rem.project?.name || "Remuneration Ledger"}
        backHref="/remunerations"
        backLabel="Remunerations"
        badge={
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.indicator}`} />
            {cfg.label}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push(`/remunerations/${rem.id}/edit`)}
              leftIcon={<Edit3 size={14} />}
            >
              Edit Agreement
            </Button>
            <Button
              variant="secondary"
              className="!text-red-600 hover:!bg-red-50 hover:!border-red-200"
              onClick={() => {
                if (confirm("Are you sure you want to delete this remuneration record? This action cannot be undone.")) {
                  fetch(`/api/remunerations/${rem.id}`, { method: 'DELETE' })
                    .then(res => {
                      if (!res.ok) throw new Error("Failed to delete");
                      toast.success("Remuneration record deleted");
                      router.push('/remunerations');
                    })
                    .catch(e => toast.error("Failed to delete record"));
                }
              }}
              leftIcon={<Trash2 size={14} />}
            >
              Delete
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1720px] px-4 sm:px-8 py-8 space-y-6">
        {/* Warnings */}
        {isOverPlanned && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-center gap-2 text-amber-900 text-xs">
            <AlertTriangle size={15} className="text-amber-600 shrink-0" />
            <span>Planned milestones ({formatCurrency(plannedInstallments, rem.currency)}) exceed agreed contract ({formatCurrency(totalAgreed, rem.currency)}).</span>
          </div>
        )}

        {isOverPaid && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-center gap-2 text-rose-900 text-xs">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>Overpayment: Total payments received exceed agreed contract value.</span>
          </div>
        )}

        {/* ── 6-Way Financial KPI Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] block mb-1">Agreed Total</span>
            <p className="text-lg font-bold text-[#252331]">{formatCurrency(totalAgreed, rem.currency)}</p>
            <p className="text-[10px] text-[#706C7D] mt-0.5 capitalize">{rem.agreement_status || "Active"}</p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">Planned Milestones</span>
            <p className="text-lg font-bold text-blue-800">{formatCurrency(plannedInstallments, rem.currency)}</p>
            <p className="text-[10px] text-blue-700 mt-0.5">{rem.installments?.length || 0} milestones</p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">Total Received</span>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalReceived, rem.currency)}</p>
            <p className="text-[10px] text-emerald-800 mt-0.5">{progressPct}% collected</p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">Pending Balance</span>
            <p className="text-lg font-bold text-amber-700">{formatCurrency(totalPending, rem.currency)}</p>
            <p className="text-[10px] text-amber-800 mt-0.5">Awaiting payment</p>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">Team Distributed</span>
            <p className="text-lg font-bold text-purple-800">{formatCurrency(totalDistributed, rem.currency)}</p>
            <p className="text-[10px] text-purple-700 mt-0.5">Across payments</p>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block mb-1">Undistributed Margin</span>
            <p className="text-lg font-bold text-indigo-800">{formatCurrency(totalUndistributed, rem.currency)}</p>
            <p className="text-[10px] text-indigo-700 mt-0.5">Retained buffer</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Milestones & Payments */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Schedule */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#252331]">Payment Milestones Schedule</h2>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs px-2.5 py-1"
                  leftIcon={<Plus size={11} />}
                  onClick={() => setMilestoneModal({ open: true, installment: null })}
                >
                  Add Milestone
                </Button>
              </div>

              <div className="space-y-3">
                {(rem.installments || []).map((inst) => {
                  const instCfg = getStatusBadgeConfig(inst.status);
                  const overdue = isOverdue(inst);
                  const instPaid = Number(inst.received_amount) || 0;
                  return (
                    <div
                      key={inst.id}
                      className={`rounded-xl border bg-white shadow-2xs overflow-hidden ${
                        overdue ? "border-red-200" : "border-[rgba(74,61,100,0.10)]"
                      }`}
                    >
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                            inst.status === "completed" || inst.status === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : overdue
                              ? "bg-red-100 text-red-700"
                              : "bg-[rgba(184,148,78,0.1)] text-[#80642F]"
                          }`}>
                            #{inst.installment_number}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#252331]">{inst.name || `Milestone #${inst.installment_number}`}</span>
                              <span className="font-extrabold text-[#252331]">{formatCurrency(inst.amount, rem.currency)}</span>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] font-semibold ${instCfg.bg}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${instCfg.indicator}`} />
                                {instCfg.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#706C7D] mt-0.5">
                              <Calendar size={11} className="text-[#9994A5]" />
                              <span className={overdue ? "text-red-600 font-bold" : ""}>
                                {overdue
                                  ? `⚠ Overdue — was due ${fmt(inst.due_date)}`
                                  : inst.due_date
                                  ? `Due ${fmt(inst.due_date)}`
                                  : "No due date scheduled"}
                              </span>
                              {instPaid > 0 && <span className="text-emerald-700 font-semibold">• Rec: {formatCurrency(instPaid, rem.currency)}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMilestoneModal({ open: true, installment: inst })}
                            className="p-1 text-zinc-400 hover:text-[#80642F]"
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          {(inst.status === "new" || inst.status === "planned" || inst.status === "due") && (
                            <Button variant="secondary" size="sm" className="text-xs" onClick={() => setRequestModal(inst)}>
                              <Mail size={12} className="mr-1" /> Request
                            </Button>
                          )}
                          {inst.status !== "completed" && inst.status !== "paid" && (
                            <Button size="sm" className="text-xs" onClick={() => setReceiveModal(inst)}>
                              <CheckCircle2 size={12} className="mr-1" /> Receive
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actual Payment Transactions Ledger */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#252331] border-b border-[rgba(74,61,100,0.06)] pb-3">
                Actual Transaction Records
              </h2>

              {allPayments.length === 0 ? (
                <p className="text-xs text-[#9994A5] py-4 text-center">No payment transactions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {allPayments.map((pm: any) => {
                    const sps = pm.team_splits || [];
                    const spTotal = sps.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0);
                    return (
                      <div key={pm.id} className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-800">{formatCurrency(pm.amount, rem.currency)}</span>
                            <span className="text-[#706C7D]">on {fmt(pm.payment_date)}</span>
                            <span className="rounded bg-white border px-1.5 py-0.2 text-[10px] font-semibold">{pm.payment_method}</span>
                          </div>
                          {pm.payment_reference && (
                            <span className="font-mono text-[10px] text-[#252331] bg-white px-1.5 py-0.2 rounded border">
                              UTR: {pm.payment_reference}
                            </span>
                          )}
                        </div>

                        {sps.length > 0 && (
                          <div className="bg-white rounded p-2 border border-[rgba(74,61,100,0.06)] text-[11px] space-y-1">
                            <span className="font-bold text-[#80642F]">Team Split Allocation:</span>
                            <div className="flex flex-wrap gap-2">
                              {sps.map((s: any, idx: number) => (
                                <span key={idx} className="bg-zinc-50 border px-1.5 py-0.5 rounded text-[#252331]">
                                  {s.member_name}: {formatCurrency(s.amount, rem.currency)}
                                </span>
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

          {/* Right Column: Project Client Info, Team Splits, Audit Log */}
          <div className="space-y-6">
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-3 text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Client & Agreement Info</h3>
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
            </div>

            {/* Notification Audit Log */}
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Notification Delivery Audit</h3>
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
              <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm">
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
    </div>
  );
}
