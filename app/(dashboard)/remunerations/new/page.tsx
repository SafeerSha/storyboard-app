"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FolderKanban,
  Info,
  Lock,
  Loader2,
  Mail,
  Percent,
  Plus,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { formatCurrency, type RemunerationSplit } from "@/lib/types/remuneration";

interface ProjectOption { id: string; name: string; }
interface ClientInfo { id: string; name: string; email: string | null; }

interface InstallmentRow {
  key: string;
  installmentNumber: number;
  name: string;
  description: string;
  amount: string;
  dueDate: string;
  notes: string;
}

const CURRENCIES = [
  { value: "INR", label: "₹ INR" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
];

export default function NewRemunerationPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loadingClient, setLoadingClient] = useState(false);

  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentMethod, setPaymentMethod] = useState<"single" | "installments">("single");
  const [agreementDate, setAgreementDate] = useState("");
  const [notes, setNotes] = useState("");

  // Controller / Toggle for confirmation email upon payment receipt
  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);

  // Team Member Splits state
  const [projectTeamMembers, setProjectTeamMembers] = useState<{ id: string; name: string; username: string; role: string }[]>([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [enableSplits, setEnableSplits] = useState(false);
  const [splits, setSplits] = useState<RemunerationSplit[]>([]);

  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { key: Date.now().toString(), installmentNumber: 1, name: "", description: "", amount: "", dueDate: "", notes: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load projects
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  // Derive client when project changes (Optional)
  const fetchClient = useCallback(async (projectId: string) => {
    if (!projectId) { setClient(null); return; }
    setLoadingClient(true);
    setClient(null);
    try {
      const res = await fetch(`/api/remuneration/clients?projectId=${projectId}`);
      const data = await res.json();
      if (data.clients && data.clients.length > 0) {
        const active = data.clients.find((c: any) => c.status === "active") || data.clients[0];
        setClient({ id: active.id, name: active.name, email: active.email || null });
      } else {
        setClient(null);
      }
    } catch {
      setClient(null);
    } finally {
      setLoadingClient(false);
    }
  }, []);

  // Fetch project team members for splits
  const fetchTeamMembers = useCallback(async (projectId: string) => {
    if (!projectId) { setProjectTeamMembers([]); setSplits([]); return; }
    setLoadingTeamMembers(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/team-members`);
      const data = await res.json();
      const members = data.teamMembers || data.members || [];
      setProjectTeamMembers(members);
    } catch {
      setProjectTeamMembers([]);
    } finally {
      setLoadingTeamMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchClient(selectedProjectId);
    fetchTeamMembers(selectedProjectId);
  }, [selectedProjectId, fetchClient, fetchTeamMembers]);

  // Balance calculations
  const totalNum = parseFloat(totalAmount) || 0;
  const scheduledTotal = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
  const balance = totalNum - scheduledTotal;
  const isBalanced = Math.abs(balance) < 0.01;

  // Splits calculations
  const allocatedSplitTotal = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const allocatedSplitPercent = totalNum > 0 ? (allocatedSplitTotal / totalNum) * 100 : splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
  const remainingSplitAmount = Math.max(0, totalNum - allocatedSplitTotal);
  const isSplitBalanced = totalNum > 0 ? Math.abs(totalNum - allocatedSplitTotal) < 0.05 : Math.abs(100 - allocatedSplitPercent) < 0.1;

  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const num = parseFloat(val) || 0;
    if (paymentMethod === "single") {
      setInstallments((prev) =>
        prev.map((i, idx) => (idx === 0 ? { ...i, amount: val } : i))
      );
    }
    // Update split amounts if percentages were defined
    if (splits.length > 0 && num > 0) {
      setSplits((prev) =>
        prev.map((s) => ({
          ...s,
          amount: s.percentage ? Math.round(((num * s.percentage) / 100) * 100) / 100 : s.amount,
        }))
      );
    }
  };

  const addInstallment = () => {
    setInstallments((prev) => [
      ...prev,
      { key: Date.now().toString(), installmentNumber: prev.length + 1, name: "", description: "", amount: "", dueDate: "", notes: "" },
    ]);
  };

  const removeInstallment = (key: string) => {
    setInstallments((prev) =>
      prev
        .filter((i) => i.key !== key)
        .map((i, idx) => ({ ...i, installmentNumber: idx + 1 }))
    );
  };

  const updateInstallment = (key: string, field: keyof InstallmentRow, value: string) => {
    setInstallments((prev) =>
      prev.map((i) => (i.key === key ? { ...i, [field]: value } : i))
    );
  };

  // When switching to single payment, keep first installment only and sync amount
  const handleMethodChange = (method: "single" | "installments") => {
    setPaymentMethod(method);
    if (method === "single") {
      setInstallments((prev) => [
        { ...prev[0], installmentNumber: 1, amount: totalAmount || prev[0].amount },
      ]);
    }
  };

  // Team splits helpers
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

    if (!selectedProjectId) { setError("Please select a project."); return; }
    if (!totalAmount || totalNum <= 0) { setError("Total remuneration amount must be greater than 0."); return; }
    if (!isBalanced) { setError("The sum of installments must equal the total remuneration amount."); return; }

    const invalidInst = installments.find((i) => !i.amount || parseFloat(i.amount) <= 0);
    if (invalidInst) { setError("All installments must have a positive amount."); return; }

    // Validate splits if enabled
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
      const body = {
        projectId: selectedProjectId,
        totalAmount: totalNum,
        currency,
        paymentMethod,
        agreementDate: agreementDate ? new Date(agreementDate).toISOString() : null,
        notes: notes || null,
        sendReceiptEmail,
        splits: enableSplits ? splits : [],
        installments: installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          name: inst.name || null,
          description: inst.description || null,
          amount: parseFloat(inst.amount),
          dueDate: inst.dueDate ? inst.dueDate : null,
          notes: inst.notes || null,
        })),
      };

      const res = await fetch("/api/remunerations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create remuneration");
      router.push(`/remunerations/${data.remuneration.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create remuneration. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-[rgba(74,61,100,0.15)] bg-white px-3.5 py-2.5 text-sm text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-2 focus:ring-[rgba(184,148,78,0.25)] focus:border-[rgba(184,148,78,0.4)] transition-colors";
  const labelClass = "block text-xs font-semibold text-[#706C7D] uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-[#f8f7fc] pb-16">
      <DashboardHeader
        title="New Remuneration"
        backHref="/remunerations"
        backLabel="Remunerations"
        description="Define the payment agreement for a client project."
      />

      <div className="mx-auto max-w-[1720px] px-4 sm:px-8 py-6 sm:py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2.5 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Continuous Horizontal 2-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Project, Client & Remuneration Terms */}
            <div className="space-y-6">
              {/* Card 1: Project & Client */}
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-2 border-b border-[rgba(74,61,100,0.06)]">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F]">
                    <FolderKanban size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#252331]">Project & Client</h2>
                    <p className="text-xs text-[#9994A5]">Select target project (client assignment is optional)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className={inputClass}
                      disabled={loadingProjects}
                    >
                      <option value="">— Select a project —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Derived Client (Optional) */}
                  <div>
                    <label className={labelClass}>
                      <span>Client</span>
                      <span className="ml-1 text-[#9994A5] font-normal normal-case">(optional)</span>
                    </label>
                    <div className={`${inputClass} flex items-center gap-2 bg-[#faf9fc] min-h-[42px]`}>
                      <Lock size={14} className="shrink-0 text-[#9994A5]" />
                      {loadingClient ? (
                        <span className="text-[#9994A5] flex items-center gap-1.5 text-xs">
                          <Loader2 size={13} className="animate-spin" /> Checking client…
                        </span>
                      ) : client ? (
                        <div className="flex items-center justify-between w-full min-w-0">
                          <span className="font-medium text-[#252331] text-xs sm:text-sm truncate">
                            {client.name}
                            {client.email && <span className="text-[#9994A5] font-normal ml-1">({client.email})</span>}
                          </span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold shrink-0">
                            Linked
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#9994A5] text-xs">
                          {selectedProjectId ? "No client assigned (Optional)" : "Select project to link client"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedProjectId && !client && !loadingClient && (
                  <div className="flex items-start gap-2 rounded-lg border border-[rgba(74,61,100,0.1)] bg-[#faf9fc] p-3 text-xs text-[#706C7D]">
                    <Info size={14} className="shrink-0 mt-0.5 text-[#B8944E]" />
                    <span>
                      This project currently has no assigned client. You can still create and manage this remuneration agreement now, and link a client later.
                    </span>
                  </div>
                )}
              </div>

              {/* Card 2: Remuneration Details & Email Controller */}
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-2.5 pb-2 border-b border-[rgba(74,61,100,0.06)]">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F]">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#252331]">Remuneration Details</h2>
                    <p className="text-xs text-[#9994A5]">Specify currency, total remuneration value, and payment terms</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className={labelClass}>Currency</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Total Remuneration Amount</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="e.g. 50000"
                      value={totalAmount}
                      onChange={(e) => handleTotalAmountChange(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Payment Method</label>
                  <div className="grid grid-cols-2 rounded-xl border border-[rgba(74,61,100,0.15)] bg-[#faf9fc] p-1 gap-1">
                    {(["single", "installments"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMethodChange(m)}
                        className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                          paymentMethod === m
                            ? "bg-white text-[#252331] shadow-xs border border-[rgba(74,61,100,0.12)]"
                            : "text-[#706C7D] hover:text-[#252331]"
                        }`}
                      >
                        {m === "single" ? "Single Payment" : "Installments"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Agreement Date (optional)</label>
                  <input
                    type="date"
                    value={agreementDate}
                    onChange={(e) => setAgreementDate(e.target.value)}
                    className={inputClass}
                  />
                </div>

                {/* Controller / Toggle: Confirmation Email upon Receipt */}
                <div className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail size={15} className={sendReceiptEmail ? "text-[#B8944E]" : "text-[#9994A5]"} />
                      <span className="text-xs font-bold text-[#252331] uppercase tracking-wider">
                        Send Receipt Confirmation Email
                      </span>
                    </div>
                    <p className="text-xs text-[#706C7D] leading-relaxed">
                      {sendReceiptEmail
                        ? "Automatically send confirmation receipt email to client and project owner when a payment is marked as received."
                        : "Confirmation emails will be disabled when payments are marked as received."}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={sendReceiptEmail}
                      onChange={(e) => setSendReceiptEmail(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#B8944E]" />
                  </label>
                </div>

                <div>
                  <label className={labelClass}>Notes / Payment Instructions (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please transfer to account XXXX or use UPI @example"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>

              {/* Card 3: Team Member Splits */}
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(74,61,100,0.06)]">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F]">
                      <Users size={16} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#252331]">Team Member Splits</h2>
                      <p className="text-xs text-[#9994A5]">Allocate remuneration shares among project collaborators</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={enableSplits}
                      onChange={(e) => {
                        setEnableSplits(e.target.checked);
                        if (e.target.checked && splits.length === 0 && projectTeamMembers.length > 0) {
                          handleAutoSplitEqually();
                        }
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
                        <span className="text-xs text-[#706C7D]">
                          {splits.length} {splits.length === 1 ? "member split" : "member splits"} configured
                        </span>
                        <button
                          type="button"
                          onClick={handleAutoSplitEqually}
                          className="text-xs font-semibold text-[#80642F] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Percent size={12} /> Auto Split Equally
                        </button>
                      </div>
                    )}

                    {/* Split Rows */}
                    <div className="space-y-3">
                      {splits.map((split, idx) => (
                        <div key={idx} className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#9994A5] flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#B8944E]" />
                              Member Split #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSplit(idx)}
                              className="p-1 rounded text-[#9994A5] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove split"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Member Dropdown */}
                            <div className="sm:col-span-5">
                              <label className={labelClass}>Team Member</label>
                              <select
                                value={split.teamMemberId}
                                onChange={(e) => updateSplit(idx, "teamMemberId", e.target.value)}
                                className={inputClass}
                              >
                                <option value="">— Select member —</option>
                                {projectTeamMembers.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} ({m.role})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Percentage */}
                            <div className="sm:col-span-3">
                              <label className={labelClass}>Share (%)</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="0"
                                  value={split.percentage || ""}
                                  onChange={(e) => updateSplit(idx, "percentage", e.target.value)}
                                  className={`${inputClass} pr-6`}
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9994A5] pointer-events-none">
                                  %
                                </span>
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="sm:col-span-4">
                              <label className={labelClass}>
                                Amount ({CURRENCIES.find((c) => c.value === currency)?.label.split(" ")[0]})
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={split.amount || ""}
                                onChange={(e) => updateSplit(idx, "amount", e.target.value)}
                                className={inputClass}
                              />
                            </div>

                            {/* Notes / Role Description */}
                            <div className="sm:col-span-12">
                              <input
                                type="text"
                                placeholder="Milestone / task allocation note (optional)"
                                value={split.notes || ""}
                                onChange={(e) => updateSplit(idx, "notes", e.target.value)}
                                className={`${inputClass} text-xs py-1.5`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Button type="button" variant="secondary" size="sm" onClick={addSplit}>
                        <Plus size={13} className="mr-1" /> Add Team Split
                      </Button>
                    </div>

                    {/* Split Balance Status Banner */}
                    <div className={`rounded-xl border p-3 flex items-center justify-between text-xs ${
                      isSplitBalanced
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}>
                      <div className="flex items-center gap-1.5">
                        {isSplitBalanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span className="font-semibold">
                          {isSplitBalanced
                            ? "✓ Splits match 100% of remuneration"
                            : remainingSplitAmount > 0
                            ? `${formatCurrency(remainingSplitAmount, currency)} unallocated (${(100 - allocatedSplitPercent).toFixed(1)}%)`
                            : `${formatCurrency(Math.abs(remainingSplitAmount), currency)} over-allocated`}
                        </span>
                      </div>
                      <span className="font-mono font-bold">
                        {formatCurrency(allocatedSplitTotal, currency)} / {formatCurrency(totalNum, currency)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-4 text-center">
                    <p className="text-xs text-[#706C7D]">
                      Team member splits are disabled. Turn on the toggle to allocate shares among project team members.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Payment Schedule & Submit Action */}
            <div className="space-y-6">
              {/* Card 4: Payment & Installment Schedule */}
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[rgba(74,61,100,0.06)]">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F]">
                      <CalendarClock size={16} />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#252331]">
                        {paymentMethod === "single" ? "Payment Details" : "Installment Schedule"}
                      </h2>
                      <p className="text-xs text-[#9994A5]">
                        {paymentMethod === "single"
                          ? "Set the payment due date and amount"
                          : "The total of all installments must exactly equal the remuneration amount."}
                      </p>
                    </div>
                  </div>
                  {paymentMethod === "installments" && (
                    <Button type="button" variant="secondary" size="sm" onClick={addInstallment} id="add-installment-btn">
                      <Plus size={13} className="mr-1" /> Add Installment
                    </Button>
                  )}
                </div>

                {/* Installments List */}
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                  {installments.map((inst, idx) => (
                    <div key={inst.key} className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#9994A5] flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#B8944E]" />
                          {paymentMethod === "single" ? "Full Payment" : `Installment #${inst.installmentNumber}`}
                        </span>
                        {paymentMethod === "installments" && installments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInstallment(inst.key)}
                            className="p-1 rounded text-[#9994A5] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove installment"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {paymentMethod === "installments" && (
                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Milestone Name (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g. Initial Deposit"
                                value={inst.name}
                                onChange={(e) => updateInstallment(inst.key, "name", e.target.value)}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Description (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g. Due upon signing"
                                value={inst.description}
                                onChange={(e) => updateInstallment(inst.key, "description", e.target.value)}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className={labelClass}>
                            Amount ({CURRENCIES.find((c) => c.value === currency)?.label.split(" ")[0]})
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                            value={inst.amount}
                            onChange={(e) => updateInstallment(inst.key, "amount", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Due Date (Optional)</label>
                          <input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => updateInstallment(inst.key, "dueDate", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        {paymentMethod === "installments" && (
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Internal Notes (optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. 50% upon project kickoff or milestone approval"
                              value={inst.notes}
                              onChange={(e) => updateInstallment(inst.key, "notes", e.target.value)}
                              className={inputClass}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live Balance Banner */}
                {paymentMethod === "installments" && totalNum > 0 && (
                  <div className={`rounded-xl border p-3.5 flex items-center justify-between text-xs sm:text-sm ${
                    isBalanced
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}>
                    <div className="flex items-center gap-2">
                      {isBalanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span className="font-medium">
                        {isBalanced
                          ? "✓ Installments balance perfectly"
                          : balance > 0
                          ? `${formatCurrency(balance, currency)} still to schedule`
                          : `${formatCurrency(Math.abs(balance), currency)} over-scheduled`}
                      </span>
                    </div>
                    <span className="font-semibold font-mono text-xs">
                      {formatCurrency(scheduledTotal, currency)} / {formatCurrency(totalNum, currency)}
                    </span>
                  </div>
                )}
              </div>

              {/* Card 5: Agreement Summary & Action Buttons */}
              <div className="rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-[#706C7D]">
                  {totalNum > 0 ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#252331]">Total Agreement:</span>
                        <span className="font-bold text-[#80642F] font-mono text-sm">
                          {formatCurrency(totalNum, currency)}
                        </span>
                        <span className="text-[#9994A5]">•</span>
                        <span>{paymentMethod === "single" ? "1 Single Payment" : `${installments.length} Installments`}</span>
                      </div>
                      <div className="text-[11px] text-[#9994A5] flex items-center gap-2">
                        <span>Client: {client ? client.name : "None assigned (Optional)"}</span>
                        <span>•</span>
                        <span>Receipt Email: {sendReceiptEmail ? "Enabled" : "Disabled"}</span>
                        {enableSplits && splits.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{splits.length} Team Splits</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span>Select a project and enter remuneration details to create agreement.</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 justify-end">
                  <Button type="button" variant="secondary" onClick={() => router.back()} id="cancel-create-rem">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !selectedProjectId || !totalAmount}
                    id="submit-create-rem-btn"
                  >
                    {submitting ? (
                      <><Loader2 size={14} className="mr-1.5 animate-spin" /> Creating…</>
                    ) : (
                      "Create Remuneration"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
