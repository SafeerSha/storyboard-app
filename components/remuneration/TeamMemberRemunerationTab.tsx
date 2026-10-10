"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  Receipt,
  RefreshCcw,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/types/remuneration";
import { toast } from "@/lib/toast";

interface DisbursementItem {
  id: string;
  paymentId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNote?: string | null;
  installmentName: string;
  status: string;
  notes?: string | null;
}

interface MemberRemunerationData {
  hasAgreement: boolean;
  hasSplit: boolean;
  projectName: string;
  currency: string;
  member: {
    id: string;
    name: string;
    username: string;
    role: string;
    notes?: string | null;
  };
  allocatedAmount: number;
  allocatedPercentage: number | null;
  totalPaid: number;
  pendingBalance: number;
  progressPercent: number;
  status: "fully_paid" | "partially_paid" | "pending" | "not_allocated";
  disbursements: DisbursementItem[];
}

interface TeamMemberRemunerationTabProps {
  projectId: string;
  projectName: string;
  teamUser: {
    id: string;
    name: string;
    username: string;
    role?: string;
  };
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TeamMemberRemunerationTab({
  projectId,
  projectName,
  teamUser,
}: TeamMemberRemunerationTabProps) {
  const [data, setData] = useState<MemberRemunerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/team/projects/${projectId}/remuneration`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to load remuneration details.");
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load remuneration details.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-12 text-center shadow-xs">
        <Loader2 size={24} className="animate-spin text-[#B8944E] mx-auto mb-3" />
        <p className="text-xs font-semibold text-[#252331]">Loading your remuneration ledger...</p>
        <p className="text-[11px] text-[#706C7D] mt-0.5">Fetching your personal allocation and disbursement records</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-center space-y-3">
        <p className="text-sm font-bold text-rose-900">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          Try again
        </Button>
      </div>
    );
  }

  const currency = data?.currency || "INR";
  const allocatedAmount = data?.allocatedAmount || 0;
  const totalPaid = data?.totalPaid || 0;
  const pendingBalance = data?.pendingBalance || 0;
  const progressPercent = data?.progressPercent || 0;
  const hasSplit = Boolean(data?.hasSplit);
  const disbursements = data?.disbursements || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── Top Header Explainer ── */}
      <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/88 p-4 sm:p-5 shadow-2xs backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.2)]">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#252331] leading-tight">
              My Remuneration & Payouts
            </h3>
            <p className="text-xs text-[#706C7D]">
              Your personal fee agreement, payments received, and remaining pending balance for {projectName}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              fetchData();
              toast.success("Ledger refreshed");
            }}
            className="text-xs"
            leftIcon={<RefreshCcw size={12} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Financial KPI Metrics (Scoped strictly to logged in member) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. My Agreed Fee / Allocation */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
              My Agreed Fee
            </span>
            <div className="h-6 w-6 rounded-md bg-[rgba(184,148,78,0.10)] flex items-center justify-center text-[#80642F]">
              <BadgeDollarSign size={14} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-[#252331] tracking-tight">
            {formatCurrency(allocatedAmount, currency)}
          </p>
          <div className="mt-1 text-[11px] text-[#706C7D] font-medium flex items-center justify-between">
            <span>
              {hasSplit ? (
                data?.allocatedPercentage ? (
                  <span className="text-[#80642F] font-semibold">{data.allocatedPercentage}% Project Split</span>
                ) : (
                  <span className="text-[#80642F] font-semibold">Fixed Fee Allocation</span>
                )
              ) : (
                <span className="text-zinc-500 italic">Not set by admin</span>
              )}
            </span>
          </div>
        </div>

        {/* 2. Total Paid to Me */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Paid to Me
            </span>
            <div className="h-6 w-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight">
            {formatCurrency(totalPaid, currency)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-800 font-semibold">
            <TrendingUp size={12} />
            <span>{progressPercent}% received</span>
          </div>
        </div>

        {/* 3. Pending Balance */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Pending Balance
            </span>
            <div className="h-6 w-6 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock size={14} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-700 tracking-tight">
            {formatCurrency(pendingBalance, currency)}
          </p>
          <div className="mt-1 text-[11px] text-amber-800 font-semibold">
            {pendingBalance === 0 && allocatedAmount > 0
              ? "All Dues Cleared"
              : pendingBalance > 0
              ? "Awaiting Disbursement"
              : "No Dues Scheduled"}
          </div>
        </div>

        {/* 4. Settlement Status */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
              Settlement Status
            </span>
            <div className="h-6 w-6 rounded-md bg-[#FAF9FC] border border-[rgba(74,61,100,0.1)] flex items-center justify-center text-[#706C7D]">
              <Receipt size={14} />
            </div>
          </div>
          <div className="mt-1">
            {data?.status === "fully_paid" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-bold border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Fully Settled
              </span>
            ) : data?.status === "partially_paid" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-bold border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Partially Paid
              </span>
            ) : hasSplit ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 text-xs font-bold border border-blue-200">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Pending First Payout
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 text-zinc-700 px-2.5 py-1 text-xs font-semibold border border-zinc-200">
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                Not Configured
              </span>
            )}
          </div>
          <p className="mt-2 text-[10px] text-[#706C7D] truncate">
            Role: <strong className="text-[#252331] capitalize">{data?.member.role || "Team Member"}</strong>
          </p>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {allocatedAmount > 0 && (
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/90 p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#252331]">Payout Progress</span>
            <span className="font-bold text-[#80642F]">
              {formatCurrency(totalPaid, currency)} of {formatCurrency(allocatedAmount, currency)} ({progressPercent}%)
            </span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#B8944E] to-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Not Allocated Informational Notice ── */}
      {!hasSplit && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 flex items-start gap-3 text-xs text-blue-900">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">No remuneration split recorded yet</p>
            <p className="text-blue-800 leading-relaxed">
              Your workspace administrator has not configured a revenue share or fee allocation for your account in this project yet. When they record project milestones and team revenue splits, your agreed fee, paid disbursements, and pending dues will automatically display here.
            </p>
          </div>
        </div>
      )}

      {/* ── Disbursements Ledger Table ── */}
      <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] pb-3">
          <div>
            <h4 className="text-sm font-bold text-[#252331]">Payment Disbursements to Me</h4>
            <p className="text-xs text-[#706C7D]">
              Record of actual payouts made to your account against project milestones.
            </p>
          </div>
          <span className="rounded-full bg-[rgba(184,148,78,0.12)] px-2.5 py-0.5 text-xs font-bold text-[#80642F]">
            {disbursements.length} {disbursements.length === 1 ? "Disbursement" : "Disbursements"}
          </span>
        </div>

        {disbursements.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 mx-auto">
              <Receipt size={18} />
            </div>
            <p className="text-xs font-bold text-[#252331]">No payments disbursed yet</p>
            <p className="text-[11px] text-[#706C7D] max-w-sm mx-auto">
              Whenever the project administrator records a payment disbursement to your account, you will find date records, amounts, and reference notes here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-[rgba(74,61,100,0.08)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9FC] text-[10px] font-bold uppercase tracking-wider text-[#9994A5] border-b border-[rgba(74,61,100,0.08)]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Milestone / Scope</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Reference / Notes</th>
                    <th className="py-3 px-4 text-right">Amount Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(74,61,100,0.06)] font-medium text-[#252331]">
                  {disbursements.map((d) => (
                    <tr key={d.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-[#706C7D]">
                        {fmtDate(d.paymentDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[#252331]">{d.installmentName}</span>
                      </td>
                      <td className="py-3 px-4 capitalize text-[#706C7D]">
                        {d.paymentMethod.replace("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-[#706C7D] max-w-xs truncate">
                        {d.referenceNote || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                        +{formatCurrency(d.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< sm) */}
            <div className="block sm:hidden space-y-2">
              {disbursements.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC]/50 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#252331] truncate">
                      {d.installmentName}
                    </span>
                    <span className="text-sm font-extrabold text-emerald-700 shrink-0">
                      +{formatCurrency(d.amount, currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#706C7D] font-mono">
                    <span>{fmtDate(d.paymentDate)}</span>
                    <span className="capitalize">{d.paymentMethod.replace("_", " ")}</span>
                  </div>

                  {d.referenceNote && (
                    <p className="text-[11px] text-[#706C7D] italic border-t border-[rgba(74,61,100,0.06)] pt-1.5 mt-1">
                      Ref: {d.referenceNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
