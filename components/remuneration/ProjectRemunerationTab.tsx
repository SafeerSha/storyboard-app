"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  FileCheck,
  FileText,
  History,
  Info,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Percent,
  Plus,
  Receipt,
  RefreshCcw,
  SendHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import {
  formatCurrency,
  getStatusBadgeConfig,
  type RemunerationRecord,
  type RemunerationInstallment,
  type RemunerationPayment,
  type RemunerationSplit,
  type PaymentTeamSplit,
  type RemunerationTimelineEvent,
  type RemunerationNotificationPreferences,
  type NotificationLog,
} from "@/lib/types/remuneration";

interface ProjectRemunerationTabProps {
  projectId: string;
  projectName: string;
  projectTeamMembers?: Array<{ id: string; name: string; username: string; role?: string }>;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SPLIT_COLORS = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

const CURRENCIES = [
  { value: "INR", label: "₹ INR" },
  { value: "USD", label: "$ USD" },
  { value: "EUR", label: "€ EUR" },
  { value: "GBP", label: "£ GBP" },
];

export function ProjectRemunerationTab({
  projectId,
  projectName,
  projectTeamMembers: initialTeam = [],
}: ProjectRemunerationTabProps) {
  const [rem, setRem] = useState<RemunerationRecord | null>(null);
  const [client, setClient] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>(initialTeam);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Sub-view Tab: "milestones" | "payments" | "splits" | "notifications"
  const [activeTab, setActiveTab] = useState<"milestones" | "payments" | "splits" | "notifications">("milestones");

  // Modals state
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [editAgreementModalOpen, setEditAgreementModalOpen] = useState(false);
  const [installmentModalOpen, setInstallmentModalOpen] = useState(false);
  const [installmentToEdit, setInstallmentToEdit] = useState<RemunerationInstallment | null>(null);
  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [selectedInstallmentForPayment, setSelectedInstallmentForPayment] = useState<RemunerationInstallment | null>(null);
  const [requestPaymentModalOpen, setRequestPaymentModalOpen] = useState(false);
  const [selectedInstallmentForRequest, setSelectedInstallmentForRequest] = useState<RemunerationInstallment | null>(null);
  const [splitsModalOpen, setSplitsModalOpen] = useState(false);
  const [notifSettingsModalOpen, setNotifSettingsModalOpen] = useState(false);

  // Installment filter
  const [installmentFilter, setInstallmentFilter] = useState<"all" | "pending" | "completed" | "overdue">("all");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load project remuneration.");

      setRem(data.remuneration || null);
      if (data.client) setClient(data.client);
      if (data.teamMembers && Array.isArray(data.teamMembers)) {
        setTeamMembers((prev) => (prev.length === 0 ? data.teamMembers : prev));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load remuneration details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    if (teamMembers.length === 0) {
      try {
        const teamRes = await fetch(`/api/projects/${projectId}/team-members?forReviewers=false`);
        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.teamMembers) setTeamMembers(teamData.teamMembers);
        }
      } catch {}
    }
  }, [projectId, teamMembers.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Delete Milestone
  const handleDeleteInstallment = async (inst: RemunerationInstallment) => {
    if (!confirm(`Are you sure you want to remove Milestone #${inst.installment_number}${inst.name ? ` (${inst.name})` : ""}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteInstallmentId: inst.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete installment.");
      toast.success("Installment milestone removed.");
      loadData(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Filtered installments
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const filteredInstallments = useMemo(() => {
    if (!rem?.installments) return [];
    return rem.installments.filter((inst) => {
      const isOverdue = inst.status !== "paid" && inst.status !== "completed" && Boolean(inst.due_date && inst.due_date < todayStr);
      if (installmentFilter === "completed") return inst.status === "paid" || inst.status === "completed";
      if (installmentFilter === "overdue") return isOverdue;
      if (installmentFilter === "pending") return inst.status !== "paid" && inst.status !== "completed";
      return true;
    });
  }, [rem?.installments, installmentFilter, todayStr]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/70 p-12 text-center shadow-sm backdrop-blur-md">
        <Loader2 size={32} className="animate-spin text-[#B8944E] mx-auto mb-3" />
        <p className="text-sm font-semibold text-[#252331]">Loading Financial & Remuneration Ledger…</p>
        <p className="text-xs text-[#9994A5] mt-1">Retrieving planned milestones, payment records, team splits, and notification logs</p>
      </div>
    );
  }

  // ==============================================================================
  // EMPTY STATE: No Remuneration Configured Yet
  // ==============================================================================
  if (!rem) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-dashed border-[rgba(184,148,78,0.30)] bg-white/80 p-8 sm:p-12 text-center shadow-sm backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(184,148,78,0.12)] text-[#80642F] shadow-sm mb-4">
            <BadgeDollarSign size={28} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#252331]">
            No Remuneration Agreement Configured for {projectName}
          </h2>
          <p className="mx-auto mt-1.5 max-w-lg text-xs sm:text-sm text-[#706C7D] leading-relaxed">
            Configure the agreed project contract value, setup installment milestones, record client payments, distribute collaborator splits, and manage email notification preferences.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              className="px-5 py-2.5 font-semibold shadow-sm"
              leftIcon={<Plus size={15} />}
              onClick={() => setSetupModalOpen(true)}
            >
              Configure Remuneration Agreement
            </Button>
            <Link href={`/remunerations/new?projectId=${projectId}`}>
              <Button variant="secondary" className="px-4 py-2.5">
                Advanced Setup Wizard <ArrowUpRight size={14} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {setupModalOpen && (
          <SetupRemunerationModal
            isOpen={setupModalOpen}
            onClose={() => setSetupModalOpen(false)}
            projectId={projectId}
            projectName={projectName}
            teamMembers={teamMembers}
            client={client}
            onSuccess={() => {
              setSetupModalOpen(false);
              loadData(true);
            }}
          />
        )}
      </div>
    );
  }

  // Financial Ledger Metrics
  const totalAgreed = rem.total_amount || 0;
  const plannedInstallments = rem.planned_installments_total ?? (rem.installments?.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) || totalAgreed);
  const totalPaid = rem.received_amount || 0;
  const totalPending = rem.remaining_amount ?? Math.max(0, totalAgreed - totalPaid);
  const totalOverdue = rem.overdue_amount || 0;
  const totalDistributed = rem.total_distributed_to_team || 0;
  const totalUndistributed = rem.total_undistributed ?? Math.max(0, totalPaid - totalDistributed);
  const progressPct = totalAgreed > 0 ? Math.min(100, Math.round((totalPaid / totalAgreed) * 100)) : 0;

  // Validation Warnings
  const isOverPlanned = plannedInstallments > totalAgreed + 0.01;
  const isOverPaid = totalPaid > totalAgreed + 0.01;

  const statusCfg = getStatusBadgeConfig(rem.agreement_status || rem.status);
  const allPayments = rem.payments || [];
  const allInstallments = rem.installments || [];
  const splits = rem.splits || [];
  const notifLogs = rem.notification_logs || [];

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-[rgba(74,61,100,0.08)] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[rgba(184,148,78,0.12)] flex items-center justify-center text-[#80642F] shrink-0">
            <Receipt size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#252331]">Project Remuneration & Financial Ledger</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusCfg.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.indicator}`} />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-[#706C7D] mt-0.5">
              Production-ready ledger separating agreed contract fees, planned milestones, actual payments, and team splits.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Notification settings controller */}
          <button
            type="button"
            onClick={() => setNotifSettingsModalOpen(true)}
            title="Configure client emails and team member notifications"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white text-xs font-semibold text-[#252331] hover:bg-zinc-50 transition cursor-pointer"
          >
            <Bell size={13} className="text-[#80642F]" />
            <span>Notification Settings</span>
          </button>

          {/* Manage splits */}
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            leftIcon={<Users size={13} className="text-[#80642F]" />}
            onClick={() => setSplitsModalOpen(true)}
          >
            Team Splits
          </Button>

          {/* Add Milestone */}
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            leftIcon={<Plus size={13} />}
            onClick={() => {
              setInstallmentToEdit(null);
              setInstallmentModalOpen(true);
            }}
          >
            Add Milestone
          </Button>

          {/* Record Payment */}
          <Button
            variant="primary"
            size="sm"
            className="rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-2xs"
            leftIcon={<CheckCircle2 size={13} />}
            onClick={() => {
              const pendingInst = allInstallments.find((i) => i.status !== "paid" && i.status !== "completed") || allInstallments[0];
              setSelectedInstallmentForPayment(pendingInst || null);
              setRecordPaymentModalOpen(true);
            }}
          >
            Record Payment
          </Button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="grid h-8 w-8 place-items-center rounded-xl border border-[rgba(74,61,100,0.12)] bg-white text-[#706C7D] hover:text-[#252331] hover:bg-zinc-50 transition cursor-pointer"
            title="Refresh transactions"
          >
            <RefreshCcw size={13} className={refreshing ? "animate-spin text-[#B8944E]" : ""} />
          </button>
        </div>
      </div>

      {/* ── Validation Alerts ── */}
      {isOverPlanned && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Planned Installments Exceed Agreed Remuneration:</span> Total planned installments (
            {formatCurrency(plannedInstallments, rem.currency)}) exceed the agreed project remuneration (
            {formatCurrency(totalAgreed, rem.currency)}) by{" "}
            <span className="font-bold">{formatCurrency(plannedInstallments - totalAgreed, rem.currency)}</span>.
            Please adjust milestone amounts or increase the agreed project fee.
          </div>
          <button
            type="button"
            onClick={() => setEditAgreementModalOpen(true)}
            className="text-amber-800 underline font-semibold shrink-0 cursor-pointer hover:text-amber-950"
          >
            Adjust Agreement
          </button>
        </div>
      )}

      {isOverPaid && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 flex items-start gap-3 text-rose-900 text-xs">
          <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Overpayment Detected:</span> Total payments received (
            {formatCurrency(totalPaid, rem.currency)}) exceed the agreed remuneration contract (
            {formatCurrency(totalAgreed, rem.currency)}).
          </div>
        </div>
      )}

      {/* ── Financial Ledger KPI Metrics (Requirement 1 & 12) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Agreed Remuneration */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/90 p-3.5 shadow-2xs relative group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">Agreed Remuneration</span>
            <div className="h-5 w-5 rounded-md bg-[rgba(184,148,78,0.10)] flex items-center justify-center text-[#80642F]">
              <BadgeDollarSign size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-[#252331] tracking-tight">
            {formatCurrency(totalAgreed, rem.currency)}
          </p>
          <div className="mt-1 flex items-center justify-between text-[10px] text-[#706C7D]">
            <span>Status: <strong className="capitalize text-[#80642F]">{rem.agreement_status || "Active"}</strong></span>
            <button
              type="button"
              onClick={() => setEditAgreementModalOpen(true)}
              className="text-[#80642F] hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
            >
              <Edit3 size={10} /> Edit
            </button>
          </div>
        </div>

        {/* Planned Installments */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Planned Installments</span>
            <div className="h-5 w-5 rounded-md bg-blue-100 flex items-center justify-center text-blue-700">
              <Calendar size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-blue-800 tracking-tight">
            {formatCurrency(plannedInstallments, rem.currency)}
          </p>
          <div className="mt-1 text-[10px] text-blue-700 font-semibold">
            {allInstallments.length} {allInstallments.length === 1 ? "Milestone" : "Milestones"} scheduled
          </div>
        </div>

        {/* Total Paid / Received */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Total Paid</span>
            <div className="h-5 w-5 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-700 tracking-tight">
            {formatCurrency(totalPaid, rem.currency)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-800 font-semibold">
            <TrendingUp size={11} />
            <span>{progressPct}% collected</span>
          </div>
        </div>

        {/* Pending Amount */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pending Balance</span>
            <div className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-amber-700 tracking-tight">
            {formatCurrency(totalPending, rem.currency)}
          </p>
          <div className="mt-1 text-[10px] text-amber-800 font-semibold">
            {totalPending === 0 ? "Fully Settled" : "Awaiting Client Payment"}
          </div>
        </div>

        {/* Distributed to Team */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Distributed to Team</span>
            <div className="h-5 w-5 rounded-md bg-purple-100 flex items-center justify-center text-purple-700">
              <Users size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-purple-800 tracking-tight">
            {formatCurrency(totalDistributed, rem.currency)}
          </p>
          <div className="mt-1 text-[10px] text-purple-700 font-semibold">
            Across actual payments
          </div>
        </div>

        {/* Undistributed Margin */}
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Undistributed Margin</span>
            <div className="h-5 w-5 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Percent size={13} />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-indigo-800 tracking-tight">
            {formatCurrency(totalUndistributed, rem.currency)}
          </p>
          <div className="mt-1 text-[10px] text-indigo-700 font-semibold">
            Retained / Buffer margin
          </div>
        </div>
      </div>

      {/* ── Collection Progress Bar ── */}
      <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/90 p-4 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#252331]">Project Collection & Settlement</span>
          <span className="font-bold text-[#80642F]">
            {formatCurrency(totalPaid, rem.currency)} of {formatCurrency(totalAgreed, rem.currency)} ({progressPct}%)
          </span>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#B8944E] to-emerald-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Agreement Details Banner (Requirement 1) ── */}
      <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[#706C7D]">
          <div>
            <span className="text-[#9994A5] font-medium mr-1.5">Agreement Date:</span>
            <strong className="text-[#252331]">{fmtDate(rem.agreement_date)}</strong>
          </div>
          <div>
            <span className="text-[#9994A5] font-medium mr-1.5">Currency:</span>
            <strong className="text-[#252331]">{rem.currency}</strong>
          </div>
          <div>
            <span className="text-[#9994A5] font-medium mr-1.5">Payment Method:</span>
            <strong className="capitalize text-[#252331]">{rem.payment_method === "single" ? "Single Payment" : "Milestone Installments"}</strong>
          </div>
          <div>
            <span className="text-[#9994A5] font-medium mr-1.5">Client Billing:</span>
            <strong className="text-[#252331]">{rem.client?.name || client?.name || "Direct / In-House"}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rem.notes && (
            <span className="italic text-[#706C7D] max-w-xs truncate" title={rem.notes}>
              "{rem.notes}"
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            className="text-xs px-2.5 py-1"
            leftIcon={<Edit3 size={11} />}
            onClick={() => setEditAgreementModalOpen(true)}
          >
            Edit Agreement
          </Button>
        </div>
      </div>

      {/* ── Sub-view Segmented Tabs ── */}
      <div className="flex border-b border-[rgba(74,61,100,0.10)] gap-1 overflow-x-auto no-scrollbar pb-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setActiveTab("milestones")}
          className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === "milestones"
              ? "border-[#B8944E] text-[#80642F]"
              : "border-transparent text-[#706C7D] hover:text-[#252331]"
          }`}
        >
          <Calendar size={14} />
          <span>Planned Milestones ({allInstallments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === "payments"
              ? "border-[#B8944E] text-[#80642F]"
              : "border-transparent text-[#706C7D] hover:text-[#252331]"
          }`}
        >
          <Receipt size={14} />
          <span>Actual Payments Ledger ({allPayments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("splits")}
          className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === "splits"
              ? "border-[#B8944E] text-[#80642F]"
              : "border-transparent text-[#706C7D] hover:text-[#252331]"
          }`}
        >
          <Users size={14} />
          <span>Team Revenue Splits ({splits.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`pb-2.5 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 cursor-pointer whitespace-nowrap shrink-0 ${
            activeTab === "notifications"
              ? "border-[#B8944E] text-[#80642F]"
              : "border-transparent text-[#706C7D] hover:text-[#252331]"
          }`}
        >
          <History size={14} />
          <span>Notification Settings & Audit ({notifLogs.length})</span>
        </button>
      </div>

      {/* ======================================================================== */}
      {/* SUB-VIEW 1: Planned Milestones / Installments (Requirement 2)            */}
      {/* ======================================================================== */}
      {activeTab === "milestones" && (
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(74,61,100,0.08)] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#252331]">Planned Payment Milestones</h3>
              <p className="text-xs text-[#706C7D]">
                Independent installment milestones. Expected dates, planned amounts, and collection progress.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[rgba(74,61,100,0.12)] bg-white overflow-hidden text-xs font-semibold">
                {(["all", "pending", "completed", "overdue"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setInstallmentFilter(filter)}
                    className={`px-2.5 py-1 capitalize transition ${
                      installmentFilter === filter
                        ? "bg-[#B8944E] text-white"
                        : "text-[#706C7D] hover:bg-zinc-50"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="text-xs font-semibold px-2.5 py-1"
                leftIcon={<Plus size={12} />}
                onClick={() => {
                  setInstallmentToEdit(null);
                  setInstallmentModalOpen(true);
                }}
              >
                Add Milestone
              </Button>
            </div>
          </div>

          {filteredInstallments.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#706C7D]">
              No installment milestones match the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInstallments.map((inst) => {
                const instCfg = getStatusBadgeConfig(inst.status);
                const isPastDue = inst.status !== "paid" && inst.status !== "completed" && Boolean(inst.due_date && inst.due_date < todayStr);
                const instPaid = Number(inst.received_amount) || 0;
                const instBalance = Math.max(0, Number(inst.amount) - instPaid);

                return (
                  <div
                    key={inst.id}
                    className={`rounded-xl border bg-white shadow-2xs overflow-hidden transition-all ${
                      isPastDue ? "border-rose-200 ring-1 ring-rose-100" : "border-[rgba(74,61,100,0.10)]"
                    }`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                            inst.status === "paid" || inst.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : isPastDue
                              ? "bg-rose-100 text-rose-800"
                              : "bg-[rgba(184,148,78,0.12)] text-[#80642F]"
                          }`}
                        >
                          #{inst.installment_number}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#252331]">
                              {inst.name || `Milestone #${inst.installment_number}`}
                            </span>
                            <span className="text-base font-extrabold text-[#252331]">
                              {formatCurrency(inst.amount, rem.currency)}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] font-semibold ${instCfg.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${instCfg.indicator}`} />
                              {instCfg.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                            <div className="flex items-center gap-1 text-[#706C7D]">
                              <Calendar size={12} className="text-[#9994A5]" />
                              <span className={isPastDue ? "text-rose-600 font-bold" : ""}>
                                {inst.due_date
                                  ? isPastDue
                                    ? `⚠ Overdue — was due ${fmtDate(inst.due_date)}`
                                    : `Due ${fmtDate(inst.due_date)}`
                                  : "No due date scheduled"}
                              </span>
                            </div>

                            {instPaid > 0 && (
                              <span className="text-emerald-700 font-semibold">
                                Received: {formatCurrency(instPaid, rem.currency)} (Bal: {formatCurrency(instBalance, rem.currency)})
                              </span>
                            )}

                            {inst.description && (
                              <span className="text-[#9994A5] truncate max-w-xs font-normal">
                                • {inst.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs px-2 py-1"
                          onClick={() => {
                            setInstallmentToEdit(inst);
                            setInstallmentModalOpen(true);
                          }}
                          title="Edit milestone details"
                        >
                          <Edit3 size={11} className="mr-1" /> Edit
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleDeleteInstallment(inst)}
                          className="text-zinc-400 hover:text-rose-600 transition p-1.5 rounded-lg border border-[rgba(74,61,100,0.10)]"
                          title="Remove milestone"
                        >
                          <Trash2 size={12} />
                        </button>

                        {(inst.status === "planned" || inst.status === "new" || inst.status === "due") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="text-xs px-2.5 py-1"
                            leftIcon={<Mail size={11} />}
                            onClick={() => {
                              setSelectedInstallmentForRequest(inst);
                              setRequestPaymentModalOpen(true);
                            }}
                          >
                            Request
                          </Button>
                        )}

                        {inst.status !== "paid" && inst.status !== "completed" && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs shadow-2xs font-semibold px-3 py-1"
                            leftIcon={<CheckCircle2 size={12} />}
                            onClick={() => {
                              setSelectedInstallmentForPayment(inst);
                              setRecordPaymentModalOpen(true);
                            }}
                          >
                            Receive Payment
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Proofs list if attached */}
                    {inst.proofs && inst.proofs.length > 0 && (
                      <div className="border-t border-[rgba(74,61,100,0.06)] bg-[#faf9fc] px-4 py-2 flex items-center gap-2 text-xs">
                        <span className="text-[11px] font-semibold text-[#706C7D]">Proof Documents:</span>
                        {inst.proofs.map((p) => (
                          <a
                            key={p.id}
                            href={`/api/remunerations/${rem.id}/installments/${inst.id}/proof?proofId=${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#80642F] bg-white px-2 py-0.5 rounded-md border border-[rgba(184,148,78,0.20)] hover:bg-[#FAF5EC] transition"
                          >
                            <Paperclip size={10} />
                            <span className="truncate max-w-[120px]">{p.file_name}</span>
                            <Download size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================================== */}
      {/* SUB-VIEW 2: Actual Payment Records (Ledger) (Requirement 3 & 4)         */}
      {/* ======================================================================== */}
      {activeTab === "payments" && (
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[rgba(74,61,100,0.08)] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#252331]">Actual Payment Transactions</h3>
              <p className="text-xs text-[#706C7D]">
                Audit ledger of actual received client transactions, payment references (UTR), and team distributions.
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="text-xs font-semibold px-3 py-1.5 shadow-2xs"
              leftIcon={<Plus size={12} />}
              onClick={() => {
                const pendingInst = allInstallments.find((i) => i.status !== "paid" && i.status !== "completed") || allInstallments[0];
                setSelectedInstallmentForPayment(pendingInst || null);
                setRecordPaymentModalOpen(true);
              }}
            >
              Record Payment
            </Button>
          </div>

          {allPayments.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Receipt size={28} className="mx-auto text-zinc-300" />
              <p className="text-xs font-semibold text-[#706C7D]">No actual payments recorded for this project yet.</p>
              <p className="text-[11px] text-[#9994A5]">
                When client funds are received for an installment, click "Record Payment" to log the transaction and distribute team member shares.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPayments.map((pm: any) => {
                const splitsList: PaymentTeamSplit[] = pm.team_splits || [];
                const splitTotal = splitsList.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
                const remainingMargin = Math.max(0, pm.amount - splitTotal);

                return (
                  <div
                    key={pm.id}
                    className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(74,61,100,0.06)] pb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-extrabold text-emerald-800">
                              {formatCurrency(pm.amount, rem.currency)}
                            </span>
                            <span className="text-xs font-semibold text-[#706C7D]">
                              on {fmtDate(pm.payment_date)}
                            </span>
                            <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.2 text-[10px] font-bold text-zinc-700">
                              {pm.payment_method || "Bank Transfer"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#706C7D] mt-0.5">
                            {pm.installment && (
                              <span>For Milestone #{pm.installment.installment_number} ({pm.installment.name || "Installment"})</span>
                            )}
                            {pm.payment_reference && (
                              <span className="font-mono text-[11px] bg-zinc-50 border border-zinc-200 px-1.5 py-0.2 rounded text-[#252331]">
                                UTR: {pm.payment_reference}
                              </span>
                            )}
                            {pm.notes && <span>• {pm.notes}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs">
                        <span className="text-[10px] uppercase font-bold text-[#9994A5] block">Team Allocation</span>
                        <span className="font-bold text-[#80642F]">
                          {formatCurrency(splitTotal, rem.currency)} / {formatCurrency(pm.amount, rem.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Team Member Splits for this exact payment */}
                    <div className="bg-[#faf9fc] rounded-lg p-3 space-y-2 border border-[rgba(74,61,100,0.06)]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#252331] flex items-center gap-1.5">
                          <Users size={12} className="text-[#80642F]" /> Team Distribution for this Payment
                        </span>
                        <span className="text-[11px] text-[#706C7D]">
                          Remaining Undistributed: <strong className="text-[#252331]">{formatCurrency(remainingMargin, rem.currency)}</strong>
                        </span>
                      </div>

                      {splitsList.length === 0 ? (
                        <p className="text-[11px] text-[#9994A5] italic">
                          No team splits were allocated for this payment transaction (100% project margin).
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {splitsList.map((s, idx) => (
                            <div
                              key={s.id || idx}
                              className="rounded-lg bg-white border border-[rgba(74,61,100,0.08)] p-2 text-xs flex items-center justify-between"
                            >
                              <div>
                                <p className="font-bold text-[#252331] truncate">{s.member_name}</p>
                                <p className="text-[10px] text-[#9994A5]">{s.role || "Collaborator"}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-extrabold text-[#80642F]">{formatCurrency(s.amount, rem.currency)}</p>
                                {s.percentage && <p className="text-[10px] text-[#706C7D]">{s.percentage}%</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================================== */}
      {/* SUB-VIEW 3: Team-Wise Revenue Splits (Project Margin) (Requirement 4)   */}
      {/* ======================================================================== */}
      {activeTab === "splits" && (
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(74,61,100,0.08)] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[rgba(184,148,78,0.12)] flex items-center justify-center text-[#80642F]">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#252331]">Project Team Revenue Share</h3>
                <p className="text-xs text-[#706C7D]">
                  Target fee allocation, member percentage shares, and proportional payout progress.
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              className="text-xs font-semibold px-3 py-1.5"
              onClick={() => setSplitsModalOpen(true)}
            >
              {splits.length === 0 ? "Configure Splits" : "Edit Target Splits"}
            </Button>
          </div>

          {splits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[rgba(74,61,100,0.15)] bg-[#faf9fc] p-6 text-center">
              <p className="text-xs font-semibold text-[#706C7D]">No team splits configured for this project yet.</p>
              <p className="text-[11px] text-[#9994A5] mt-0.5">
                Allocate percentages and payout amounts to team members working on this project.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 text-xs"
                onClick={() => setSplitsModalOpen(true)}
              >
                <Plus size={13} className="mr-1" /> Add Team Member Splits
              </Button>
            </div>
          ) : (
            <>
              {/* Visual Multi-Color Allocation Stack Bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden flex">
                  {splits.map((s, idx) => {
                    const pct = s.percentage || (totalAgreed > 0 ? (s.amount / totalAgreed) * 100 : 0);
                    const color = SPLIT_COLORS[idx % SPLIT_COLORS.length];
                    return (
                      <div
                        key={s.id || s.teamMemberId || idx}
                        className={`h-full ${color} transition-all duration-300`}
                        style={{ width: `${pct}%` }}
                        title={`${s.name}: ${pct}% (${formatCurrency(s.amount, rem.currency)})`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Split Members Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {splits.map((s, idx) => {
                  const color = SPLIT_COLORS[idx % SPLIT_COLORS.length];
                  const memberAllocated = s.amount;
                  const memberCollectedSoFar = Math.round(memberAllocated * (progressPct / 100));
                  const memberPending = Math.max(0, memberAllocated - memberCollectedSoFar);

                  return (
                    <div
                      key={s.id || s.teamMemberId || idx}
                      className="flex flex-col justify-between rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-3.5 space-y-2 hover:bg-white transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-8 w-8 rounded-full ${color} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#252331] truncate">{s.name}</p>
                            <p className="text-[11px] text-[#706C7D] truncate font-medium">
                              {s.role || "Collaborator"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-extrabold text-[#252331]">
                            {formatCurrency(s.amount, rem.currency)}
                          </p>
                          <span className="rounded-md bg-white border border-[rgba(74,61,100,0.10)] px-1.5 py-0.2 text-[10px] font-bold text-[#80642F]">
                            {s.percentage !== null && s.percentage !== undefined ? `${s.percentage}%` : ""}
                          </span>
                        </div>
                      </div>

                      {s.notes && (
                        <p className="text-[11px] text-[#706C7D] italic bg-white/70 rounded-lg px-2 py-1 border border-[rgba(74,61,100,0.06)]">
                          {s.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] font-semibold border-t border-[rgba(74,61,100,0.06)] pt-1.5 text-[#706C7D]">
                        <span className="text-emerald-700">Collected: {formatCurrency(memberCollectedSoFar, rem.currency)}</span>
                        <span className="text-amber-700">Pending: {formatCurrency(memberPending, rem.currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================================== */}
      {/* SUB-VIEW 4: Notification Settings & Audit Log (Requirement 5, 6, 8)       */}
      {/* ======================================================================== */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          {/* Notification Preferences Overview Card */}
          <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[rgba(74,61,100,0.08)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[rgba(184,148,78,0.12)] flex items-center justify-center text-[#80642F]">
                  <Bell size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#252331]">Notification Triggers & Channels</h3>
                  <p className="text-xs text-[#706C7D]">
                    Configurable rules for client emails, team email notifications, and in-app alerts.
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="text-xs font-semibold px-3 py-1.5"
                leftIcon={<SlidersHorizontal size={12} />}
                onClick={() => setNotifSettingsModalOpen(true)}
              >
                Configure Notification Preferences
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-4 space-y-2">
                <span className="font-bold text-[#252331] uppercase tracking-wider text-[11px] block">
                  Client Email Triggers
                </span>
                <div className="space-y-1.5 text-[#706C7D]">
                  <div className="flex justify-between">
                    <span>Payment Received Receipts:</span>
                    <strong className="text-emerald-700">Enabled (ON)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Milestone Installment Created:</span>
                    <strong className="text-emerald-700">Enabled (ON)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Installment Overdue Notices:</span>
                    <strong className="text-emerald-700">Enabled (ON)</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#faf9fc] p-4 space-y-2">
                <span className="font-bold text-[#252331] uppercase tracking-wider text-[11px] block">
                  Team Member Notifications
                </span>
                <div className="space-y-1.5 text-[#706C7D]">
                  <div className="flex justify-between">
                    <span>In-App Notifications:</span>
                    <strong className="text-emerald-700">Active</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Split Allocation Emails:</span>
                    <strong className="text-emerald-700">Active</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Full Distribution Policy:</span>
                    <strong className="text-zinc-600">Optional</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Delivery Audit Trail (Requirement 8) */}
          <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/95 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] pb-3">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[#80642F]" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#252331]">
                  Notification Delivery History / Audit Log
                </h3>
              </div>
              <span className="text-xs text-[#9994A5]">
                {notifLogs.length} logged events
              </span>
            </div>

            {notifLogs.length === 0 ? (
              <p className="text-xs text-[#9994A5] py-8 text-center">
                No notification attempts logged yet. Delivery events will appear here when client receipts or team split notifications are dispatched.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(74,61,100,0.08)] text-[10px] uppercase font-bold text-[#9994A5]">
                      <th className="pb-2">Recipient</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Event</th>
                      <th className="pb-2">Channel</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(74,61,100,0.06)] text-[#706C7D]">
                    {notifLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/50 transition">
                        <td className="py-2.5 font-medium text-[#252331]">
                          {log.recipient}
                        </td>
                        <td className="py-2.5 capitalize">
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                            {log.recipient_type}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-[11px] text-[#252331]">
                          {log.notification_type}
                        </td>
                        <td className="py-2.5 capitalize">
                          {log.channel === "email" ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 font-semibold">
                              <Mail size={11} /> Email
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-purple-600 font-semibold">
                              <Bell size={11} /> In-App
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              log.status === "sent"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "skipped"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-[11px]">
                          {fmtDateTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* MODALS                                                                   */}
      {/* ======================================================================== */}

      {/* 1. Edit Agreement Modal */}
      {editAgreementModalOpen && (
        <EditAgreementModal
          isOpen={editAgreementModalOpen}
          onClose={() => setEditAgreementModalOpen(false)}
          rem={rem}
          projectId={projectId}
          onSuccess={() => {
            setEditAgreementModalOpen(false);
            loadData(true);
          }}
        />
      )}

      {/* 2. Add / Edit Milestone Installment Modal */}
      {installmentModalOpen && (
        <InstallmentModal
          isOpen={installmentModalOpen}
          onClose={() => {
            setInstallmentModalOpen(false);
            setInstallmentToEdit(null);
          }}
          projectId={projectId}
          currency={rem.currency}
          existingInstallment={installmentToEdit}
          onSuccess={() => {
            setInstallmentModalOpen(false);
            setInstallmentToEdit(null);
            loadData(true);
          }}
        />
      )}

      {/* 3. Record Payment Received Modal (with inline Team Split!) */}
      {recordPaymentModalOpen && selectedInstallmentForPayment && (
        <RecordPaymentModal
          isOpen={recordPaymentModalOpen}
          onClose={() => {
            setRecordPaymentModalOpen(false);
            setSelectedInstallmentForPayment(null);
          }}
          installment={selectedInstallmentForPayment}
          remId={rem.id}
          currency={rem.currency}
          teamMembers={teamMembers}
          defaultSendEmail={rem.send_receipt_email ?? true}
          onSuccess={() => {
            setRecordPaymentModalOpen(false);
            setSelectedInstallmentForPayment(null);
            loadData(true);
          }}
        />
      )}

      {/* 4. Request Payment Modal */}
      {requestPaymentModalOpen && selectedInstallmentForRequest && (
        <RequestPaymentModal
          isOpen={requestPaymentModalOpen}
          onClose={() => {
            setRequestPaymentModalOpen(false);
            setSelectedInstallmentForRequest(null);
          }}
          installment={selectedInstallmentForRequest}
          remId={rem.id}
          currency={rem.currency}
          onSuccess={() => {
            setRequestPaymentModalOpen(false);
            setSelectedInstallmentForRequest(null);
            loadData(true);
          }}
        />
      )}

      {/* 5. Manage Project Team Splits Modal */}
      {splitsModalOpen && (
        <ManageTeamSplitsModal
          isOpen={splitsModalOpen}
          onClose={() => setSplitsModalOpen(false)}
          projectId={projectId}
          totalAmount={totalAgreed}
          currency={rem.currency}
          currentSplits={splits}
          teamMembers={teamMembers}
          onSuccess={() => {
            setSplitsModalOpen(false);
            loadData(true);
          }}
        />
      )}

      {/* 6. Notification Preferences Modal */}
      {notifSettingsModalOpen && (
        <NotificationSettingsModal
          isOpen={notifSettingsModalOpen}
          onClose={() => setNotifSettingsModalOpen(false)}
          projectId={projectId}
          initialPreferences={rem.notification_preferences}
          onSuccess={() => {
            setNotifSettingsModalOpen(false);
            loadData(true);
          }}
        />
      )}
    </div>
  );
}

// ==============================================================================
// MODAL: Edit Total Agreed Remuneration (Requirement 1)
// ==============================================================================
interface EditAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  rem: RemunerationRecord;
  projectId: string;
  onSuccess: () => void;
}

function EditAgreementModal({ isOpen, onClose, rem, projectId, onSuccess }: EditAgreementModalProps) {
  const [totalAmount, setTotalAmount] = useState(String(rem.total_amount));
  const [currency, setCurrency] = useState(rem.currency || "INR");
  const [agreementDate, setAgreementDate] = useState(rem.agreement_date || rem.created_at.split("T")[0]);
  const [agreementStatus, setAgreementStatus] = useState(rem.agreement_status || rem.status || "active");
  const [notes, setNotes] = useState(rem.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const amt = parseFloat(totalAmount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid positive agreed remuneration amount.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: amt,
          currency,
          agreementDate,
          agreementStatus,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update remuneration agreement.");

      toast.success("Remuneration agreement details updated!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Remuneration Agreement"
      description="Configure total contract fee, agreement date, currency, and contract status."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Total Agreed Remuneration</label>
            <input
              type="number"
              min="1"
              step="100"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <label className={labelClass}>Agreement Status</label>
            <select value={agreementStatus} onChange={(e) => setAgreementStatus(e.target.value)} className={inputClass}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft / Renegotiating</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Agreement Notes / Remarks (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Contract terms, billing instructions, client remarks..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Installment Milestone Create / Edit (Requirement 2)
// ==============================================================================
interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currency: string;
  existingInstallment?: RemunerationInstallment | null;
  onSuccess: () => void;
}

function InstallmentModal({
  isOpen,
  onClose,
  projectId,
  currency,
  existingInstallment,
  onSuccess,
}: InstallmentModalProps) {
  const isEditing = Boolean(existingInstallment);
  const [name, setName] = useState(existingInstallment?.name || "");
  const [amount, setAmount] = useState(existingInstallment ? String(existingInstallment.amount) : "");
  const [dueDate, setDueDate] = useState(existingInstallment?.due_date || "");
  const [description, setDescription] = useState(existingInstallment?.description || "");
  const [notes, setNotes] = useState(existingInstallment?.notes || "");
  const [status, setStatus] = useState<string>(existingInstallment?.status || "planned");
  const [autoAdjustTotal, setAutoAdjustTotal] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Please specify a valid positive milestone amount.");
      return;
    }

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
        payload.autoAdjustTotal = autoAdjustTotal;
      }

      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save milestone.");

      toast.success(isEditing ? "Milestone updated!" : "New installment milestone added!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Milestone #${existingInstallment?.installment_number}` : "Add Installment Milestone"}
      description="Independent payment milestone record for tracking scheduled project revenue."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            {isEditing ? "Update Milestone" : "Save Milestone"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass}>Milestone Name / Title</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Design Approval, Beta Release, Final Signoff"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Planned Amount ({currency})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 30000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Scheduled Due Date (Optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {isEditing && (
          <div>
            <label className={labelClass}>Milestone Status</label>
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
          <label className={labelClass}>Deliverables / Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deliverables tied to this installment release..."
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Internal Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional milestone instructions..."
            className={`${inputClass} resize-none`}
          />
        </div>

        {!isEditing && (
          <div className="flex items-center justify-between rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3">
            <div>
              <span className="text-xs font-semibold text-[#252331]">Auto-Adjust Total Agreed Fee</span>
              <p className="text-[11px] text-[#9994A5]">Increment agreed remuneration by this milestone amount</p>
            </div>
            <input
              type="checkbox"
              checked={autoAdjustTotal}
              onChange={(e) => setAutoAdjustTotal(e.target.checked)}
              className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Record Payment Received (with Inline Team Split!) (Requirements 3 & 4)
// ==============================================================================
interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  installment: RemunerationInstallment;
  remId: string;
  currency: string;
  teamMembers: any[];
  defaultSendEmail: boolean;
  onSuccess: () => void;
}

function RecordPaymentModal({
  isOpen,
  onClose,
  installment,
  remId,
  currency,
  teamMembers,
  defaultSendEmail,
  onSuccess,
}: RecordPaymentModalProps) {
  const remainingInstallment = Math.max(0, Number(installment.amount) - (Number(installment.received_amount) || 0));
  const [amount, setAmount] = useState(String(remainingInstallment > 0 ? remainingInstallment : installment.amount));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [sendEmail, setSendEmail] = useState(defaultSendEmail);
  const [notifyTeam, setNotifyTeam] = useState(true);

  // Team splits for this payment
  const [enableTeamSplit, setEnableTeamSplit] = useState(false);
  const [splits, setSplits] = useState<Array<{ teamMemberId: string; name: string; role?: string; amount: number; percentage?: number }>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const numAmount = parseFloat(amount) || 0;
  const totalAllocatedToTeam = splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  const remainingUndistributed = Math.max(0, numAmount - totalAllocatedToTeam);
  const isOverAllocated = totalAllocatedToTeam > numAmount + 0.01;

  // Prepopulate team members if split enabled
  const handleToggleSplit = (checked: boolean) => {
    setEnableTeamSplit(checked);
    if (checked && splits.length === 0 && teamMembers.length > 0) {
      setSplits(
        teamMembers.map((m) => ({
          teamMemberId: m.id,
          name: m.name,
          role: m.role || "Developer",
          amount: 0,
          percentage: 0,
        }))
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
    if (!amount || numAmount <= 0) {
      setError("Please enter a valid positive payment amount.");
      return;
    }
    if (!date) {
      setError("Please select the payment date.");
      return;
    }
    if (enableTeamSplit && isOverAllocated) {
      setError(`Total team split (${formatCurrency(totalAllocatedToTeam, currency)}) cannot exceed payment amount (${formatCurrency(numAmount, currency)}).`);
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

      if (enableTeamSplit) {
        const validSplits = splits.filter((s) => s.amount > 0);
        formData.append("teamSplits", JSON.stringify(validSplits));
      }

      const res = await fetch(`/api/remunerations/${remId}/installments/${installment.id}/receive`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment.");

      toast.success("Actual payment and team distributions recorded!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment Received"
      description={`Installment #${installment.installment_number}${installment.name ? ` (${installment.name})` : ""} — Balance: ${formatCurrency(remainingInstallment > 0 ? remainingInstallment : installment.amount, currency)}`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || (enableTeamSplit && isOverAllocated)}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <CheckCircle2 size={14} className="mr-1.5" />}
            Confirm & Save Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Payment Amount Received ({currency})</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Payment Received Date</label>
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
              {["Bank Transfer", "UPI", "Cash", "Card", "Cheque", "Other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reference / UTR Number (optional)</label>
            <input
              type="text"
              placeholder="e.g. UTR-9876543210"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Transaction Notes (optional)</label>
          <textarea
            rows={2}
            placeholder="Deposit notes or bank remarks..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>Payment Proof Document / Receipt (optional)</label>
          <div
            className="flex items-center gap-3 rounded-lg border border-dashed border-[rgba(74,61,100,0.20)] bg-[#faf9fc] px-4 py-2.5 cursor-pointer hover:border-[#B8944E] transition"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={15} className="text-[#9994A5]" />
            <span className="text-xs text-[#706C7D]">
              {proof ? proof.name : "Attach invoice, screenshot, or PDF receipt"}
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => setProof(e.target.files?.[0] || null)}
          />
        </div>

        {/* ── Team Member Payment Split Section (Requirement 4) ── */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#faf9fc] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#80642F]" />
              <div>
                <span className="text-xs font-bold text-[#252331]">Team Member Payment Split</span>
                <p className="text-[11px] text-[#706C7D]">Distribute this actual received payment among collaborators</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableTeamSplit}
                onChange={(e) => handleToggleSplit(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#B8944E]" />
            </label>
          </div>

          {enableTeamSplit && (
            <div className="space-y-3 pt-2 border-t border-[rgba(74,61,100,0.08)]">
              {/* Allocation Summary Card */}
              <div className="grid grid-cols-3 gap-2 bg-white rounded-lg p-2.5 border border-[rgba(74,61,100,0.08)] text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9994A5] block">Payment Amount</span>
                  <span className="font-extrabold text-[#252331]">{formatCurrency(numAmount, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9994A5] block">Allocated to Team</span>
                  <span className={`font-extrabold ${isOverAllocated ? "text-rose-600" : "text-[#80642F]"}`}>
                    {formatCurrency(totalAllocatedToTeam, currency)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#9994A5] block">Remaining Margin</span>
                  <span className="font-extrabold text-emerald-700">{formatCurrency(remainingUndistributed, currency)}</span>
                </div>
              </div>

              {isOverAllocated && (
                <p className="text-[11px] font-bold text-rose-600">
                  ⚠ Total allocated exceeds payment amount! Please decrease member shares.
                </p>
              )}

              {/* Members rows */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {splits.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-[rgba(74,61,100,0.06)] text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-[#252331] truncate">{s.name}</p>
                      <p className="text-[10px] text-[#9994A5]">{s.role || "Member"}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={s.amount || ""}
                          onChange={(e) => handleUpdateSplitAmount(idx, parseFloat(e.target.value) || 0)}
                          placeholder="Amount"
                          className="w-full text-xs p-1.5 border rounded bg-white"
                        />
                      </div>
                      <span className="text-[11px] text-[#706C7D] w-12 text-right font-medium">
                        {s.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Notification Toggles (Requirements 5 & 6) ── */}
        <div className="space-y-2 bg-[#faf9fc] p-3 rounded-lg border border-[rgba(74,61,100,0.08)]">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-[#252331]">Send Client Payment Confirmation Email</span>
              <p className="text-[11px] text-[#9994A5]">Sends payment receipt email to client</p>
            </div>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
            />
          </div>

          {enableTeamSplit && (
            <div className="flex items-center justify-between text-xs border-t border-[rgba(74,61,100,0.06)] pt-2">
              <div>
                <span className="font-semibold text-[#252331]">Notify Team Members</span>
                <p className="text-[11px] text-[#9994A5]">Send payout allocation notices to team collaborators</p>
              </div>
              <input
                type="checkbox"
                checked={notifyTeam}
                onChange={(e) => setNotifyTeam(e.target.checked)}
                className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Notification Preferences Configuration (Requirements 5 & 6)
// ==============================================================================
interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  initialPreferences?: RemunerationNotificationPreferences | null;
  onSuccess: () => void;
}

function NotificationSettingsModal({
  isOpen,
  onClose,
  projectId,
  initialPreferences,
  onSuccess,
}: NotificationSettingsModalProps) {
  const [clientEmails, setClientEmails] = useState(
    initialPreferences?.client_emails ||
    initialPreferences?.client_email_settings || {
      agreement_created: true,
      installment_created: true,
      installment_updated: false,
      payment_received: true,
      receipt_generated: true,
      payment_reminder: true,
      installment_overdue: true,
    }
  );

  const [teamNotifs, setTeamNotifs] = useState<any>(
    initialPreferences?.team_notifications ||
    initialPreferences?.team_notification_settings || {
      channels: { email: true, in_app: true },
      events: {
        payment_received: true,
        payment_allocated: true,
        split_updated: true,
        allocation_removed: true,
        status_changed: true,
      },
    }
  );

  const [requireFullSplit, setRequireFullSplit] = useState(initialPreferences?.require_full_split || false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationPreferences: {
            client_emails: clientEmails,
            team_notifications: teamNotifs,
            require_full_split: requireFullSplit,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save notification preferences.");

      toast.success("Notification preferences saved successfully!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notification Preferences & Controls"
      description="Configure automated email dispatches to client and payout notices to project team members."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Save Notification Preferences
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {/* ── Client Email Notification Controller (Requirement 6) ── */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-[#80642F]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#252331]">
              Client Email Notification Triggers
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-[rgba(74,61,100,0.06)] pt-1">
            {[
              { key: "payment_received", label: "Payment Received Confirmation", desc: "Dispatch email when client payment is recorded" },
              { key: "receipt_generated", label: "Payment Receipt Attachment", desc: "Attach transaction receipt summary" },
              { key: "installment_created", label: "Installment Milestone Created", desc: "Notify client when new milestone is added" },
              { key: "installment_overdue", label: "Installment Overdue Notice", desc: "Notify client if milestone passes due date" },
              { key: "payment_reminder", label: "Payment Due Reminders", desc: "Scheduled reminders before milestone date" },
              { key: "agreement_created", label: "Contract Agreement Created", desc: "Send initial contract confirmation" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between pt-2">
                <div>
                  <p className="font-semibold text-[#252331]">{item.label}</p>
                  <p className="text-[11px] text-[#9994A5]">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean((clientEmails as any)[item.key])}
                  onChange={(e) =>
                    setClientEmails((prev: any) => ({ ...prev, [item.key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Team Member Notification Configuration (Requirement 5) ── */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-[#80642F]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#252331]">
              Team Member Notification Channels & Triggers
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-[rgba(74,61,100,0.06)] pt-1">
            <div className="flex items-center justify-between pb-1">
              <div>
                <p className="font-semibold text-[#252331]">Send Email Notifications</p>
                <p className="text-[11px] text-[#9994A5]">Deliver payout share details to collaborator emails</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean((teamNotifs as any)?.channels?.email)}
                onChange={(e) =>
                  setTeamNotifs((prev: any) => ({
                    ...prev,
                    channels: { ...prev?.channels, email: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-[#252331]">Send In-App Notifications</p>
                <p className="text-[11px] text-[#9994A5]">Deliver in-app notification center alerts</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean((teamNotifs as any)?.channels?.in_app)}
                onChange={(e) =>
                  setTeamNotifs((prev: any) => ({
                    ...prev,
                    channels: { ...prev?.channels, in_app: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="font-semibold text-[#252331]">Require Full Split Before Processing</p>
                <p className="text-[11px] text-[#9994A5]">Mandate 100% of received payment to be distributed</p>
              </div>
              <input
                type="checkbox"
                checked={requireFullSplit}
                onChange={(e) => setRequireFullSplit(e.target.checked)}
                className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Request Payment from Client
// ==============================================================================
interface RequestPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  installment: RemunerationInstallment;
  remId: string;
  currency: string;
  onSuccess: () => void;
}

function RequestPaymentModal({
  isOpen,
  onClose,
  installment,
  remId,
  currency,
  onSuccess,
}: RequestPaymentModalProps) {
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
      if (!res.ok) throw new Error(data.error || "Failed to dispatch payment request email.");
      toast.success("Payment request email sent to client!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Client Payment"
      description={`Installment #${installment.installment_number}${installment.name ? ` (${installment.name})` : ""}`}
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSend} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <SendHorizontal size={14} className="mr-1.5" />}
            Send Request Email
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}
        <p className="text-xs sm:text-sm text-[#706C7D] leading-relaxed">
          An automated payment notification email will be sent to the assigned client requesting{" "}
          <strong className="text-[#252331] font-bold">{formatCurrency(installment.amount, currency)}</strong> due on{" "}
          <strong className="text-[#252331] font-bold">{fmtDate(installment.due_date)}</strong>.
        </p>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Manage Target Team Splits
// ==============================================================================
interface ManageTeamSplitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  totalAmount: number;
  currency: string;
  currentSplits: RemunerationSplit[];
  teamMembers: any[];
  onSuccess: () => void;
}

function ManageTeamSplitsModal({
  isOpen,
  onClose,
  projectId,
  totalAmount,
  currency,
  currentSplits,
  teamMembers,
  onSuccess,
}: ManageTeamSplitsModalProps) {
  const [splits, setSplits] = useState<RemunerationSplit[]>(() => {
    if (currentSplits.length > 0) return currentSplits;
    return teamMembers.map((m) => ({
      teamMemberId: m.id,
      name: m.name,
      role: m.role || "Developer",
      percentage: null,
      amount: 0,
      notes: "",
    }));
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalAllocated = useMemo(() => {
    return splits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  }, [splits]);

  const totalAllocatedPct = useMemo(() => {
    return splits.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
  }, [splits]);

  const unallocatedAmount = Math.max(0, totalAmount - totalAllocated);

  const handleUpdatePercentage = (index: number, pct: number) => {
    const updated = [...splits];
    const item = { ...updated[index] };
    item.percentage = pct;
    item.amount = Math.round((pct / 100) * totalAmount);
    updated[index] = item;
    setSplits(updated);
  };

  const handleUpdateAmount = (index: number, amt: number) => {
    const updated = [...splits];
    const item = { ...updated[index] };
    item.amount = amt;
    item.percentage = totalAmount > 0 ? Number(((amt / totalAmount) * 100).toFixed(1)) : 0;
    updated[index] = item;
    setSplits(updated);
  };

  const handleAddMember = (member: any) => {
    if (splits.some((s) => s.teamMemberId === member.id)) return;
    setSplits((prev) => [
      ...prev,
      {
        teamMemberId: member.id,
        name: member.name,
        role: member.role || "Collaborator",
        percentage: 0,
        amount: 0,
        notes: "",
      },
    ]);
  };

  const handleRemoveSplit = (index: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splits }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save team splits.");

      toast.success("Team splits updated successfully!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-2.5 py-1.5 text-xs text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Project Remuneration Splits"
      description={`Distribute project fees across team members. Total Project Fee: ${formatCurrency(totalAmount, currency)}`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Save Splits
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-[#faf9fc] border border-[rgba(74,61,100,0.08)] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Total Split Allocation:</span>
            <span className={totalAllocated > totalAmount ? "text-rose-600 font-bold" : "text-[#80642F] font-bold"}>
              {formatCurrency(totalAllocated, currency)} ({totalAllocatedPct}%)
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[rgba(74,61,100,0.08)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalAllocated > totalAmount ? "bg-rose-500" : "bg-[#B8944E]"
              }`}
              style={{ width: `${Math.min(100, (totalAllocated / (totalAmount || 1)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-[#706C7D]">
            <span>Remaining Unallocated:</span>
            <span className="font-semibold">{formatCurrency(unallocatedAmount, currency)}</span>
          </div>
        </div>

        {teamMembers.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
              Quick Add Project Team Member:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map((m) => {
                const isAdded = splits.some((s) => s.teamMemberId === m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isAdded}
                    onClick={() => handleAddMember(m)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isAdded
                        ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                        : "bg-white border border-[rgba(74,61,100,0.12)] text-[#252331] hover:border-[#B8944E] hover:text-[#80642F]"
                    }`}
                  >
                    <Plus size={11} />
                    <span>{m.name}</span>
                    <span className="text-[10px] text-[#9994A5]">({m.role || "Member"})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {splits.map((s, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white p-3 space-y-2 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-full bg-[rgba(184,148,78,0.15)] text-[#80642F] font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => {
                      const updated = [...splits];
                      updated[idx].name = e.target.value;
                      setSplits(updated);
                    }}
                    placeholder="Member Name"
                    className="font-bold text-xs text-[#252331] border-b border-transparent hover:border-zinc-300 focus:border-[#B8944E] outline-none"
                  />
                  <input
                    type="text"
                    value={s.role || ""}
                    onChange={(e) => {
                      const updated = [...splits];
                      updated[idx].role = e.target.value;
                      setSplits(updated);
                    }}
                    placeholder="Role"
                    className="text-[11px] text-[#706C7D] border-b border-transparent hover:border-zinc-300 focus:border-[#B8944E] outline-none max-w-[120px]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveSplit(idx)}
                  className="text-zinc-400 hover:text-rose-600 transition p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#9994A5]">Percentage (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={s.percentage ?? ""}
                    onChange={(e) => handleUpdatePercentage(idx, parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 40"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#9994A5]">Amount ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={s.amount || ""}
                    onChange={(e) => handleUpdateAmount(idx, parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 20000"
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] uppercase font-bold text-[#9994A5]">Notes / Deliverable</label>
                  <input
                    type="text"
                    value={s.notes || ""}
                    onChange={(e) => {
                      const updated = [...splits];
                      updated[idx].notes = e.target.value;
                      setSplits(updated);
                    }}
                    placeholder="e.g. Frontend UI"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="w-full text-xs"
          leftIcon={<Plus size={12} />}
          onClick={() => {
            setSplits((prev) => [
              ...prev,
              {
                teamMemberId: `custom-${Date.now()}`,
                name: "New Collaborator",
                role: "Developer",
                percentage: 0,
                amount: 0,
                notes: "",
              },
            ]);
          }}
        >
          Add Custom Split Row
        </Button>
      </div>
    </Modal>
  );
}

// ==============================================================================
// MODAL: Set Up Initial Remuneration Agreement
// ==============================================================================
interface SetupRemunerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  teamMembers: any[];
  client: any;
  onSuccess: () => void;
}

function SetupRemunerationModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  teamMembers,
  client,
  onSuccess,
}: SetupRemunerationModalProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [paymentMethod, setPaymentMethod] = useState<"single" | "installments">("single");
  const [dueDate, setDueDate] = useState("");
  const [agreementDate, setAgreementDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [sendReceiptEmail, setSendReceiptEmail] = useState(true);

  const [installments, setInstallments] = useState<Array<{ number: number; name: string; amount: string; dueDate: string; notes: string }>>([
    { number: 1, name: "Initial Milestone", amount: "", dueDate: "", notes: "" },
    { number: 2, name: "Final Release", amount: "", dueDate: "", notes: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const total = parseFloat(totalAmount);
    if (!total || total <= 0) {
      setError("Please specify a valid positive agreed remuneration amount.");
      return;
    }

    let finalInstallments: any[] = [];
    if (paymentMethod === "single") {
      finalInstallments = [
        {
          installmentNumber: 1,
          name: "Full Contract Payment",
          amount: total,
          dueDate: dueDate ? dueDate : null,
          notes: "Full Project Remuneration",
        },
      ];
    } else {
      const sum = installments.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      if (Math.abs(sum - total) > 0.01) {
        setError(`Sum of planned installments (${formatCurrency(sum, currency)}) must equal agreed total remuneration (${formatCurrency(total, currency)}).`);
        return;
      }
      finalInstallments = installments.map((i) => ({
        installmentNumber: i.number,
        name: i.name || `Milestone #${i.number}`,
        amount: parseFloat(i.amount),
        dueDate: i.dueDate ? i.dueDate : null,
        notes: i.notes || null,
      }));
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/remuneration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: total,
          currency,
          paymentMethod,
          agreementDate,
          notes,
          sendReceiptEmail,
          installments: finalInstallments,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set up remuneration.");

      toast.success("Remuneration configured successfully!");
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[rgba(74,61,100,0.15)] px-3 py-2 text-xs sm:text-sm text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E] bg-white";
  const labelClass = "block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Remuneration for ${projectName}`}
      description="Define the agreed total contract value, currency, agreement date, and milestone installment plan."
      maxWidth="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Check size={14} className="mr-1.5" />}
            Confirm & Save Remuneration
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Total Agreed Remuneration</label>
            <input
              type="number"
              min="1"
              step="100"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="e.g. 100000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            <label className={labelClass}>Payment Structure</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className={inputClass}
            >
              <option value="single">Single Full Payment</option>
              <option value="installments">Milestone Installments</option>
            </select>
          </div>
        </div>

        {paymentMethod === "single" ? (
          <div>
            <label className={labelClass}>Payment Due Date (Optional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#706C7D]">
              <span>Milestone Installment Schedule</span>
              <button
                type="button"
                onClick={() =>
                  setInstallments((prev) => [
                    ...prev,
                    { number: prev.length + 1, name: `Milestone #${prev.length + 1}`, amount: "", dueDate: "", notes: "" },
                  ])
                }
                className="text-[#80642F] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={11} /> Add Milestone
              </button>
            </div>

            {installments.map((inst, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 bg-[#faf9fc] p-2.5 rounded-lg border border-[rgba(74,61,100,0.08)]">
                <div>
                  <label className="text-[10px] text-[#9994A5] font-bold">#{inst.number} Name</label>
                  <input
                    type="text"
                    value={inst.name}
                    onChange={(e) => {
                      const updated = [...installments];
                      updated[idx].name = e.target.value;
                      setInstallments(updated);
                    }}
                    placeholder="Milestone Title"
                    className="w-full text-xs p-1.5 border rounded bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9994A5] font-bold">Amount ({currency})</label>
                  <input
                    type="number"
                    value={inst.amount}
                    onChange={(e) => {
                      const updated = [...installments];
                      updated[idx].amount = e.target.value;
                      setInstallments(updated);
                    }}
                    placeholder="Amount"
                    className="w-full text-xs p-1.5 border rounded bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9994A5] font-bold">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={inst.dueDate}
                    onChange={(e) => {
                      const updated = [...installments];
                      updated[idx].dueDate = e.target.value;
                      setInstallments(updated);
                    }}
                    className="w-full text-xs p-1.5 border rounded bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className={labelClass}>Contract Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, bank details, or deliverables notes..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-[rgba(74,61,100,0.10)] bg-[#faf9fc] p-3">
          <div>
            <span className="text-xs font-semibold text-[#252331]">Send Client Receipt Emails</span>
            <p className="text-[11px] text-[#9994A5]">Automated receipts dispatched whenever payments are logged</p>
          </div>
          <input
            type="checkbox"
            checked={sendReceiptEmail}
            onChange={(e) => setSendReceiptEmail(e.target.checked)}
            className="h-4 w-4 rounded text-[#B8944E] focus:ring-[#B8944E]"
          />
        </div>
      </div>
    </Modal>
  );
}
