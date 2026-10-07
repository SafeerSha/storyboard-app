"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  FolderKanban,
  Lock,
  Loader2,
  Mail,
  Percent,
  Plus,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { formatCurrency, type RemunerationSplit, type RemunerationRecord } from "@/lib/types/remuneration";

export default function EditRemunerationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const remId = params.id;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [rem, setRem] = useState<RemunerationRecord | null>(null);
  const [projectTeamMembers, setProjectTeamMembers] = useState<{ id: string; name: string; role: string }[]>([]);

  // Form State
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [agreementDate, setAgreementDate] = useState("");
  const [agreementStatus, setAgreementStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);

  // Splits State
  const [enableSplits, setEnableSplits] = useState(false);
  const [splits, setSplits] = useState<RemunerationSplit[]>([]);

  const fetchRemuneration = useCallback(async () => {
    try {
      const res = await fetch(`/api/remunerations/${remId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load remuneration");
      
      const r = data.remuneration;
      setRem(r);
      setTotalAmount(String(r.total_amount || ""));
      setCurrency(r.currency || "INR");
      setAgreementDate(r.agreement_date ? r.agreement_date.split("T")[0] : "");
      setAgreementStatus(r.agreement_status || r.status || "active");
      setNotes(r.notes || "");
      setSendReceiptEmail(r.send_receipt_email ?? true);
      
      if (r.splits && r.splits.length > 0) {
        setEnableSplits(true);
        setSplits(r.splits);
      }

      // Fetch team members for the project
      if (r.project_id) {
        const tmRes = await fetch(`/api/projects/${r.project_id}/team-members`);
        const tmData = await tmRes.json();
        setProjectTeamMembers(tmData.teamMembers || tmData.members || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [remId]);

  useEffect(() => {
    fetchRemuneration();
  }, [fetchRemuneration]);

  const totalNum = parseFloat(totalAmount) || 0;
  const allocatedSplitTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const allocatedSplitPercent = totalNum > 0 ? (allocatedSplitTotal / totalNum) * 100 : splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
  const remainingSplitAmount = Math.max(0, totalNum - allocatedSplitTotal);
  const isSplitBalanced = totalNum > 0 ? Math.abs(totalNum - allocatedSplitTotal) < 0.05 : Math.abs(100 - allocatedSplitPercent) < 0.1;

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const num = parseFloat(val) || 0;
    if (splits.length > 0 && num > 0) {
      setSplits((prev) =>
        prev.map((s) => ({
          ...s,
          amount: s.percentage ? Math.round(((num * s.percentage) / 100) * 100) / 100 : s.amount,
        }))
      );
    }
  };

  const addSplit = () => {
    const unassignedMember = projectTeamMembers.find((m) => !splits.some((s) => s.teamMemberId === m.id)) || projectTeamMembers[0];
    const newSplit: RemunerationSplit = {
      teamMemberId: unassignedMember ? unassignedMember.id : "",
      name: unassignedMember ? unassignedMember.name : "",
      role: unassignedMember ? unassignedMember.role : "",
      percentage: 0,
      amount: 0,
      notes: "",
    };
    setSplits((prev) => [...prev, newSplit]);
    setEnableSplits(true);
  };

  const removeSplit = (idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSplit = (idx: number, field: keyof RemunerationSplit, val: any) => {
    setSplits((prev) => {
      const copy = [...prev];
      const current = { ...copy[idx] };

      if (field === "teamMemberId") {
        const member = projectTeamMembers.find((m) => m.id === val);
        current.teamMemberId = val;
        if (member) {
          current.name = member.name;
          current.role = member.role;
        }
      } else if (field === "percentage") {
        const pct = parseFloat(val) || 0;
        current.percentage = pct;
        current.amount = totalNum > 0 ? Math.round(((totalNum * pct) / 100) * 100) / 100 : 0;
      } else if (field === "amount") {
        const amt = parseFloat(val) || 0;
        current.amount = amt;
        current.percentage = totalNum > 0 ? Math.round(((amt / totalNum) * 100) * 10) / 10 : 0;
      } else {
        (current as any)[field] = val;
      }

      copy[idx] = current;
      return copy;
    });
  };

  const handleAutoSplitEqually = () => {
    if (projectTeamMembers.length === 0) return;
    const count = projectTeamMembers.length;
    const basePct = Math.floor((100 / count) * 10) / 10;
    const baseAmt = totalNum > 0 ? Math.round((totalNum / count) * 100) / 100 : 0;

    const newSplits: RemunerationSplit[] = projectTeamMembers.map((m, i) => {
      const pct = i === count - 1 ? Math.round((100 - basePct * (count - 1)) * 10) / 10 : basePct;
      const amt = i === count - 1 ? (totalNum > 0 ? Math.round((totalNum - baseAmt * (count - 1)) * 100) / 100 : 0) : baseAmt;
      return {
        teamMemberId: m.id,
        name: m.name,
        role: m.role,
        percentage: pct,
        amount: amt,
        notes: "",
      };
    });
    setSplits(newSplits);
    setEnableSplits(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!totalAmount || totalNum <= 0) { setError("Total remuneration amount must be greater than 0."); return; }

    if (enableSplits && splits.length > 0) {
      const invalidSplit = splits.find((s) => !s.teamMemberId || s.amount < 0);
      if (invalidSplit) {
        setError("All configured team splits must have a member selected and a valid amount.");
        return;
      }
      if (allocatedSplitTotal > totalNum + 0.05) {
        setError(`Team splits total (${formatCurrency(allocatedSplitTotal, currency)}) exceeds the total remuneration amount.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        totalAmount: totalNum,
        agreementDate: agreementDate ? new Date(agreementDate).toISOString() : null,
        agreementStatus,
        notes: notes || null,
        sendReceiptEmail,
        splits: enableSplits ? splits : [],
      };

      const res = await fetch(`/api/remunerations/${remId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update agreement");
      router.push(`/remunerations/${remId}`);
    } catch (err: any) {
      setError(err.message || "Failed to update agreement.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#B8944E]" />
      </div>
    );
  }

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] bg-white px-3.5 py-2.5 text-sm text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-2 focus:ring-[rgba(184,148,78,0.25)] focus:border-[rgba(184,148,78,0.4)] transition-colors";
  const labelClass = "block text-xs font-semibold text-[#706C7D] uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-[#f8f7fc] pb-16">
      <DashboardHeader
        title="Edit Agreement"
        backHref={`/remunerations/${remId}`}
        backLabel="Remuneration Ledger"
        description="Update contract terms, total amount, and team splits."
      />

      <div className="mx-auto max-w-[1720px] px-4 sm:px-8 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2.5 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project & Client (Read-Only) */}
          <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-[#252331]">Project Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Project</label>
                <div className={`${inputClass} bg-slate-50 text-[#706C7D]`}>{rem?.project?.name}</div>
              </div>
              <div>
                <label className={labelClass}>Client</label>
                <div className={`${inputClass} bg-slate-50 text-[#706C7D]`}>{rem?.client ? rem.client.name : "None assigned"}</div>
              </div>
            </div>
          </div>

          {/* Agreement Terms */}
          <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-[#252331]">Agreement Terms</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Total Remuneration Amount ({currency})</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => handleTotalAmountChange(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Agreement Date</label>
                <input
                  type="date"
                  value={agreementDate}
                  onChange={(e) => setAgreementDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className={inputClass}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-4 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail size={15} className={sendReceiptEmail ? "text-[#B8944E]" : "text-[#9994A5]"} />
                  <span className="text-xs font-bold text-[#252331] uppercase tracking-wider">Send Receipt Confirmation Email</span>
                </div>
                <p className="text-xs text-[#706C7D] leading-relaxed">
                  Automatically send confirmation receipt email to client when a payment is marked as received.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input type="checkbox" checked={sendReceiptEmail} onChange={(e) => setSendReceiptEmail(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B8944E]" />
              </label>
            </div>

            <div>
              <label className={labelClass}>Notes / Payment Instructions (optional)</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} />
            </div>
          </div>

          {/* Team Member Splits */}
          <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-[rgba(74,61,100,0.06)]">
              <h2 className="text-base font-semibold text-[#252331]">Team Member Splits</h2>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={enableSplits}
                  onChange={(e) => {
                    setEnableSplits(e.target.checked);
                    if (e.target.checked && splits.length === 0 && projectTeamMembers.length > 0) handleAutoSplitEqually();
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B8944E]" />
              </label>
            </div>

            {enableSplits ? (
              <div className="space-y-4">
                {projectTeamMembers.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#706C7D]">{splits.length} {splits.length === 1 ? "member split" : "member splits"} configured</span>
                    <button type="button" onClick={handleAutoSplitEqually} className="text-xs font-semibold text-[#80642F] hover:underline inline-flex items-center gap-1 cursor-pointer">
                      <Percent size={12} /> Auto Split Equally
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {splits.map((split, idx) => (
                    <div key={idx} className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#9994A5] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#B8944E]" /> Member Split #{idx + 1}
                        </span>
                        <button type="button" onClick={() => removeSplit(idx)} className="p-1 rounded text-[#9994A5] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"><Trash2 size={13} /></button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-5">
                          <label className={labelClass}>Team Member</label>
                          <select value={split.teamMemberId} onChange={(e) => updateSplit(idx, "teamMemberId", e.target.value)} className={inputClass}>
                            <option value="">— Select member —</option>
                            {projectTeamMembers.map((m) => (
                              <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className={labelClass}>Share (%)</label>
                          <div className="relative">
                            <input type="number" min="0" max="100" step="0.1" value={split.percentage || ""} onChange={(e) => updateSplit(idx, "percentage", e.target.value)} className={`${inputClass} pr-6`} />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9994A5] pointer-events-none">%</span>
                          </div>
                        </div>
                        <div className="sm:col-span-4">
                          <label className={labelClass}>Amount ({currency})</label>
                          <input type="number" min="0" step="0.01" value={split.amount || ""} onChange={(e) => updateSplit(idx, "amount", e.target.value)} className={inputClass} />
                        </div>
                        <div className="sm:col-span-12">
                          <input type="text" placeholder="Milestone / task allocation note (optional)" value={split.notes || ""} onChange={(e) => updateSplit(idx, "notes", e.target.value)} className={`${inputClass} text-xs py-1.5`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={addSplit}><Plus size={13} className="mr-1" /> Add Team Split</Button>
                </div>

                <div className={`rounded-xl border p-3 flex items-center justify-between text-xs ${isSplitBalanced ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                  <div className="flex items-center gap-1.5">
                    {isSplitBalanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    <span className="font-semibold">
                      {isSplitBalanced ? "✓ Splits match 100% of remuneration" : remainingSplitAmount > 0 ? `${formatCurrency(remainingSplitAmount, currency)} unallocated (${(100 - allocatedSplitPercent).toFixed(1)}%)` : `${formatCurrency(Math.abs(remainingSplitAmount), currency)} over-allocated`}
                    </span>
                  </div>
                  <span className="font-mono font-bold">{formatCurrency(allocatedSplitTotal, currency)} / {formatCurrency(totalNum, currency)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-4 text-center">
                <p className="text-xs text-[#706C7D]">Team member splits are disabled. Turn on the toggle to allocate shares among project team members.</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
