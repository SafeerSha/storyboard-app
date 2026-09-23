"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp, Info, Lock, Loader2, Plus, Trash2 } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/types/remuneration";

interface ProjectOption { id: string; name: string; }
interface ClientInfo { id: string; name: string; email: string | null; }

interface InstallmentRow {
  key: string;
  installmentNumber: number;
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
  const [clientError, setClientError] = useState("");

  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentMethod, setPaymentMethod] = useState<"single" | "installments">("single");
  const [notes, setNotes] = useState("");

  const [installments, setInstallments] = useState<InstallmentRow[]>([
    { key: Date.now().toString(), installmentNumber: 1, amount: "", dueDate: "", notes: "" },
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

  // Derive client when project changes
  const fetchClient = useCallback(async (projectId: string) => {
    if (!projectId) { setClient(null); setClientError(""); return; }
    setLoadingClient(true);
    setClientError("");
    setClient(null);
    try {
      const res = await fetch(`/api/remuneration/clients?projectId=${projectId}`);
      const data = await res.json();
      if (data.clients && data.clients.length > 0) {
        const active = data.clients.find((c: any) => c.status === "active") || data.clients[0];
        setClient({ id: active.id, name: active.name, email: active.email || null });
      } else {
        setClientError("This project has no client assigned. Please create a client for this project first.");
      }
    } catch {
      setClientError("Failed to fetch client information.");
    } finally {
      setLoadingClient(false);
    }
  }, []);

  useEffect(() => {
    fetchClient(selectedProjectId);
  }, [selectedProjectId, fetchClient]);

  // Balance calculation
  const totalNum = parseFloat(totalAmount) || 0;
  const scheduledTotal = installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
  const balance = totalNum - scheduledTotal;
  const isBalanced = Math.abs(balance) < 0.01;

  const addInstallment = () => {
    setInstallments((prev) => [
      ...prev,
      { key: Date.now().toString(), installmentNumber: prev.length + 1, amount: "", dueDate: "", notes: "" },
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

  // When switching to single payment, keep first installment only
  const handleMethodChange = (method: "single" | "installments") => {
    setPaymentMethod(method);
    if (method === "single") {
      setInstallments((prev) => [{ ...prev[0], installmentNumber: 1 }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedProjectId) { setError("Please select a project."); return; }
    if (clientError || !client) { setError("Please select a project with an assigned client."); return; }
    if (!totalAmount || totalNum <= 0) { setError("Total remuneration amount must be greater than 0."); return; }
    if (!isBalanced) { setError("The sum of installments must equal the total remuneration amount."); return; }

    const invalidInst = installments.find((i) => !i.dueDate || !i.amount || parseFloat(i.amount) <= 0);
    if (invalidInst) { setError("All installments must have a due date and a positive amount."); return; }

    setSubmitting(true);
    try {
      const body = {
        projectId: selectedProjectId,
        totalAmount: totalNum,
        currency,
        paymentMethod,
        notes: notes || null,
        installments: installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          amount: parseFloat(inst.amount),
          dueDate: inst.dueDate,
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
    <div className="min-h-screen bg-[#f8f7fc]">
      <DashboardHeader
        title="New Remuneration"
        backHref="/remunerations"
        backLabel="Remunerations"
        description="Define the payment agreement for a client project."
      />

      <div className="mx-auto max-w-3xl px-4 sm:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2.5 text-red-700 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Selection */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-[#252331]">Project & Client</h2>

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

            {/* Derived Client (read-only) */}
            <div>
              <label className={labelClass}>
                <span>Client</span>
                <span className="ml-2 text-[#9994A5] font-normal normal-case">(derived from project)</span>
              </label>
              <div className={`${inputClass} flex items-center gap-2 bg-[#faf9fc]`}>
                <Lock size={14} className="shrink-0 text-[#9994A5]" />
                {loadingClient ? (
                  <span className="text-[#9994A5] flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Loading client…</span>
                ) : clientError ? (
                  <span className="text-amber-600 text-xs font-medium">{clientError}</span>
                ) : client ? (
                  <span className="font-medium text-[#252331]">
                    {client.name}
                    {client.email && <span className="text-[#9994A5] font-normal ml-1">— {client.email}</span>}
                  </span>
                ) : (
                  <span className="text-[#9994A5]">Select a project to see the assigned client</span>
                )}
              </div>
              {clientError && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Go to{" "}
                    <a href="/clients" className="font-semibold underline">Clients</a>
                    {" "}to create a client for this project, then come back.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Remuneration Amount */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-base font-semibold text-[#252331]">Remuneration Details</h2>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className={labelClass}>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Total Remuneration Amount</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Payment Method</label>
              <div className="flex rounded-lg border border-[rgba(74,61,100,0.15)] bg-[#faf9fc] overflow-hidden">
                {(["single", "installments"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleMethodChange(m)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      paymentMethod === m
                        ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] border-r-0"
                        : "text-[#706C7D] hover:text-[#252331]"
                    }`}
                  >
                    {m === "single" ? "Single Payment" : "Installments"}
                  </button>
                ))}
              </div>
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

          {/* Installments */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#252331]">
                  {paymentMethod === "single" ? "Payment Details" : "Installment Schedule"}
                </h2>
                {paymentMethod === "installments" && (
                  <p className="text-xs text-[#9994A5] mt-0.5">The total of all installments must exactly equal the remuneration amount.</p>
                )}
              </div>
              {paymentMethod === "installments" && (
                <Button type="button" variant="secondary" onClick={addInstallment} id="add-installment-btn">
                  <Plus size={13} className="mr-1" /> Add
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {installments.map((inst, idx) => (
                <div key={inst.key} className="rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#9994A5]">
                      {paymentMethod === "single" ? "Payment" : `Installment #${inst.installmentNumber}`}
                    </span>
                    {paymentMethod === "installments" && installments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstallment(inst.key)}
                        className="text-[#9994A5] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Amount ({CURRENCIES.find((c) => c.value === currency)?.label.split(" ")[0]})</label>
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
                      <label className={labelClass}>Due Date</label>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => updateInstallment(inst.key, "dueDate", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    {paymentMethod === "installments" && (
                      <div className="col-span-2">
                        <label className={labelClass}>Notes (optional)</label>
                        <input
                          type="text"
                          placeholder="Notes for this installment"
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

            {/* Live Balance */}
            {paymentMethod === "installments" && totalNum > 0 && (
              <div className={`rounded-lg border p-3.5 flex items-center justify-between text-sm ${
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
                <span className="font-semibold text-xs">
                  {formatCurrency(scheduledTotal, currency)} / {formatCurrency(totalNum, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="secondary" onClick={() => router.back()} id="cancel-create-rem">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !!clientError || !client}
              id="submit-create-rem-btn"
            >
              {submitting ? (
                <><Loader2 size={14} className="mr-1.5 animate-spin" /> Creating…</>
              ) : (
                "Create Remuneration"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
