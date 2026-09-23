"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  ReceiptText,
  RefreshCcw,
  SendHorizontal,
  User,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import {
  RemunerationRecord,
  RemunerationInstallment,
  RemunerationTimelineEvent,
  formatCurrency,
  getStatusBadgeConfig,
} from "@/lib/types/remuneration";

// ── helpers ────────────────────────────────────────────────────────────────────

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
  if (inst.status === "completed") return false;
  return inst.due_date < new Date().toISOString().split("T")[0];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProgressBar({ received, total }: { received: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (received / total) * 100) : 0;
  return (
    <div className="relative h-2.5 rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

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
          <Button variant="secondary" onClick={onClose} disabled={submitting} id="modal-cancel-request">Cancel</Button>
          <Button onClick={handleSend} disabled={submitting} id="modal-send-request-btn">
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <SendHorizontal size={14} className="mr-1.5" />}
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ReceiveModalProps {
  installment: RemunerationInstallment;
  remId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}
function ReceivePaymentModal({ installment, remId, currency, onClose, onSuccess }: ReceiveModalProps) {
  const [amount, setAmount] = useState(String(installment.amount));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3.5 py-2.5 text-sm text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-2 focus:ring-[rgba(184,148,78,0.25)] focus:border-[rgba(184,148,78,0.4)] transition-colors bg-white";
  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5";

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!date) { setError("Select a received date."); return; }
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("receivedAmount", amount);
      formData.append("receivedDate", date);
      formData.append("paymentMethod", method);
      if (reference) formData.append("paymentReference", reference);
      if (notes) formData.append("notes", notes);
      if (proof) formData.append("proof", proof);

      const res = await fetch(`/api/remunerations/${remId}/installments/${installment.id}/receive`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
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
      <div className="rounded-2xl bg-white shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#252331]">Record Payment Received</h2>
            <p className="text-xs text-[#9994A5]">Installment #{installment.installment_number} — Expected: {formatCurrency(installment.amount, currency)}</p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">{error}</div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount Received</label>
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Received Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Payment Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
              {["UPI", "Bank Transfer", "Cash", "Card", "Other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reference / UTR (optional)</label>
            <input type="text" placeholder="e.g. UTR123456789" value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
          </div>
          <div>
            <label className={labelClass}>Proof of Payment (optional)</label>
            <div
              className="flex items-center gap-3 rounded-lg border border-dashed border-[rgba(74,61,100,0.20)] bg-[#faf9fc] px-4 py-3 cursor-pointer hover:border-[rgba(184,148,78,0.4)] transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={15} className="text-[#9994A5]" />
              <span className="text-sm text-[#9994A5]">
                {proof ? proof.name : "Click to attach screenshot or PDF"}
              </span>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={submitting} id="modal-cancel-receive">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} id="modal-record-payment-btn">
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RemunerationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const remId = params.id;

  const [rem, setRem] = useState<RemunerationRecord | null>(null);
  const [timeline, setTimeline] = useState<RemunerationTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [requestModal, setRequestModal] = useState<RemunerationInstallment | null>(null);
  const [receiveModal, setReceiveModal] = useState<RemunerationInstallment | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/remunerations/${remId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load remuneration");
      setRem(data.remuneration);
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
          <Button onClick={() => router.push("/remunerations")} className="mt-4" id="back-to-rem-list">Back to list</Button>
        </div>
      </div>
    );
  }

  const cfg = getStatusBadgeConfig(rem.status);
  const received = rem.received_amount || 0;
  const total = rem.total_amount || 0;
  const remaining = rem.remaining_amount || 0;

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
          onClose={() => setReceiveModal(null)}
          onSuccess={load}
        />
      )}

      <DashboardHeader
        category="Remunerations"
        title={rem.project?.name || "Remuneration Details"}
        backHref="/remunerations"
        backLabel="Remunerations"
        badge={
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.indicator}`} />
            {cfg.label}
          </span>
        }
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: installments ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary card */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9994A5]">Total Remuneration</p>
                <p className="text-3xl font-bold text-[#252331] tracking-tight mt-1">
                  {formatCurrency(total, rem.currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9994A5]">Payment Type</p>
                <p className="text-sm font-medium text-[#252331] mt-1 capitalize">{rem.payment_method === "single" ? "Single Payment" : "Installments"}</p>
              </div>
            </div>

            <ProgressBar received={received} total={total} />

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Received</p>
                <p className="text-base font-bold text-emerald-700 mt-0.5">{formatCurrency(received, rem.currency)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Remaining</p>
                <p className="text-base font-bold text-amber-700 mt-0.5">{formatCurrency(remaining, rem.currency)}</p>
              </div>
              <div className="rounded-lg bg-[rgba(74,61,100,0.05)] border border-[rgba(74,61,100,0.08)] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">Installments</p>
                <p className="text-base font-bold text-[#252331] mt-0.5">{rem.installments?.length || 0}</p>
              </div>
            </div>

            {rem.notes && (
              <div className="rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3 text-sm text-[#706C7D]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] mb-1">Notes</p>
                {rem.notes}
              </div>
            )}
          </div>

          {/* Installments */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#9994A5]">Payment Schedule</h2>
            {(rem.installments || []).map((inst) => {
              const instCfg = getStatusBadgeConfig(inst.status);
              const overdue = isOverdue(inst);
              return (
                <div
                  key={inst.id}
                  className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
                    overdue ? "border-red-200" : "border-[rgba(74,61,100,0.10)]"
                  }`}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        inst.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : overdue
                          ? "bg-red-100 text-red-700"
                          : "bg-[rgba(184,148,78,0.1)] text-[#80642F]"
                      }`}>
                        {inst.installment_number}
                      </div>
                      <div>
                        <p className="font-semibold text-[#252331]">
                          {formatCurrency(inst.amount, rem.currency)}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar size={11} className="text-[#9994A5]" />
                          <p className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-[#9994A5]"}`}>
                            {overdue ? `⚠ Overdue — was due ${fmt(inst.due_date)}` : `Due ${fmt(inst.due_date)}`}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${instCfg.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${instCfg.indicator}`} />
                        {instCfg.label}
                      </span>
                      {inst.status === "new" && (
                        <Button
                          variant="secondary"
                          onClick={() => setRequestModal(inst)}
                          id={`request-inst-${inst.id}`}
                        >
                          <Mail size={13} className="mr-1" /> Request
                        </Button>
                      )}
                      {(inst.status === "requested" || inst.status === "new") && (
                        <Button
                          onClick={() => setReceiveModal(inst)}
                          id={`receive-inst-${inst.id}`}
                        >
                          <CheckCircle2 size={13} className="mr-1" /> Receive
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Received details */}
                  {inst.status === "completed" && (
                    <div className="border-t border-[rgba(74,61,100,0.06)] bg-emerald-50/60 px-5 py-3 flex items-center gap-4 flex-wrap text-xs text-emerald-700">
                      <span className="font-semibold">Received: {formatCurrency(inst.received_amount || inst.amount, rem.currency)}</span>
                      {inst.received_date && <span>on {fmt(inst.received_date)}</span>}
                      {inst.payment_method && <span className="rounded-full bg-emerald-100 px-2 py-0.5">{inst.payment_method}</span>}
                      {inst.payment_reference && <span className="font-mono text-[#706C7D]">Ref: {inst.payment_reference}</span>}
                    </div>
                  )}

                  {/* Proofs */}
                  {inst.proofs && inst.proofs.length > 0 && (
                    <div className="border-t border-[rgba(74,61,100,0.06)] px-5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] mb-2">Payment Proof</p>
                      <div className="flex flex-wrap gap-2">
                        {inst.proofs.map((proof) => (
                          <a
                            key={proof.id}
                            href={`/api/remunerations/${rem.id}/installments/${inst.id}/proof?proofId=${proof.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(74,61,100,0.10)] bg-white px-2.5 py-1.5 text-xs text-[#706C7D] hover:text-[#252331] hover:border-[rgba(184,148,78,0.4)] transition-colors"
                          >
                            <Paperclip size={11} />
                            {proof.file_name}
                            <Download size={11} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right column: info + timeline ── */}
        <div className="space-y-6">
          {/* Project & Client info */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">Project</h3>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-[rgba(184,148,78,0.10)] flex items-center justify-center">
                <ReceiptText size={15} className="text-[#B8944E]" />
              </div>
              <div>
                <p className="font-semibold text-[#252331] text-sm">{rem.project?.name || "—"}</p>
                <a
                  href={`/projects/${rem.project_id}`}
                  className="text-xs text-[#80642F] hover:underline inline-flex items-center gap-1"
                >
                  Open project <ExternalLink size={10} />
                </a>
              </div>
            </div>

            <div className="border-t border-[rgba(74,61,100,0.06)] pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5] mb-3">Client</h3>
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[rgba(74,61,100,0.08)] flex items-center justify-center">
                  <User size={14} className="text-[#706C7D]" />
                </div>
                <div>
                  <p className="font-medium text-[#252331] text-sm">{rem.client?.name || "No client"}</p>
                  {rem.client?.email && (
                    <p className="text-xs text-[#9994A5]">{rem.client.email}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-[rgba(74,61,100,0.06)] pt-4 text-xs text-[#9994A5] space-y-1">
              <div className="flex justify-between"><span>Created</span><span className="text-[#706C7D] font-medium">{fmt(rem.created_at)}</span></div>
              {rem.next_due_date && rem.status !== "completed" && (
                <div className="flex justify-between"><span>Next Due</span><span className="text-amber-600 font-medium">{fmt(rem.next_due_date)}</span></div>
              )}
            </div>
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9994A5] mb-4">Activity</h3>
              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-7 w-7 rounded-full bg-[rgba(184,148,78,0.10)] flex items-center justify-center shrink-0">
                        <Clock size={12} className="text-[#B8944E]" />
                      </div>
                      {i < timeline.length - 1 && <div className="flex-1 w-px bg-[rgba(74,61,100,0.08)] mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-semibold text-[#252331]">{event.title}</p>
                      {event.description && <p className="text-xs text-[#9994A5] mt-0.5">{event.description}</p>}
                      <p className="text-[10px] text-[#9994A5] mt-1">{fmtDatetime(event.created_at)} · {event.actor_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
