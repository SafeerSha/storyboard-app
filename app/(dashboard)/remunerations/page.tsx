"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { toast } from "@/lib/toast";
import {
  RemunerationRecord,
  RemunerationStats,
  formatCurrency,
  getStatusBadgeConfig,
} from "@/lib/types/remuneration";

export default function RemunerationsPage() {
  const router = useRouter();
  const [remunerations, setRemunerations] = useState<RemunerationRecord[]>([]);
  const [stats, setStats] = useState<RemunerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "requested" | "completed">("all");
  const [needsMigration, setNeedsMigration] = useState(false);
  const [deletingRem, setDeletingRem] = useState<RemunerationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deletingRem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/remunerations/${deletingRem.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete remuneration");
      setRemunerations((prev) => prev.filter((r) => r.id !== deletingRem.id));
      setDeletingRem(null);
      toast.success("Remuneration agreement deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete remuneration");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/remunerations");
        if (!res.ok) throw new Error((await res.json()).error || "Failed to load remunerations");
        const data = await res.json();
        setRemunerations(data.remunerations || []);
        setStats(data.stats || null);
        if (data.needsMigration) setNeedsMigration(true);
      } catch (e: any) {
        setError(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return remunerations.filter((r) => {
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        r.project?.name?.toLowerCase().includes(q) ||
        r.client?.name?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [remunerations, searchQuery, statusFilter]);

  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getOverdueLabel = (r: RemunerationRecord) => {
    if (r.status === "completed") return null;
    if (!r.next_due_date) return null;
    const today = new Date().toISOString().split("T")[0];
    if (r.next_due_date < today) return "Overdue";
    const diff = Math.ceil((new Date(r.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 3) return `Due in ${diff}d`;
    return null;
  };

  const statCards = [
    {
      label: "Total Remuneration",
      value: formatCurrency(stats?.totalRemuneration || 0),
      icon: BadgeDollarSign,
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-100",
    },
    {
      label: "Total Received",
      value: formatCurrency(stats?.totalReceived || 0),
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-100",
    },
    {
      label: "Pending",
      value: formatCurrency(stats?.totalPending || 0),
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-100",
    },
    {
      label: "Overdue",
      value: formatCurrency(stats?.totalOverdue || 0),
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50 border-red-100",
    },
  ];

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "new", label: "New" },
    { value: "requested", label: "Requested" },
    { value: "completed", label: "Completed" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      <DashboardHeader
        category="Finance"
        title="Remunerations"
        description="Track client payment schedules, received installments, and proof of payment."
        actions={
          <Button onClick={() => router.push("/remunerations/new")} id="create-remuneration-btn">
            <Plus size={15} className="mr-1.5" />
            New Remuneration
          </Button>
        }
      />

      <div className="mx-auto max-w-[1720px] px-4 sm:px-8 py-8 space-y-8">
        {needsMigration && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-amber-800">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">Database setup required</p>
              <p className="text-xs mt-0.5">
                Please run <code className="bg-amber-100 px-1 rounded">supabase/remuneration_tracking.sql</code> in the Supabase SQL Editor to enable Remuneration Tracking.
              </p>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9994A5]">{card.label}</span>
                <card.icon size={16} className={card.color} />
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${card.color} tracking-tight`}>{loading ? "—" : card.value}</p>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]" />
            <input
              type="text"
              placeholder="Search by project or client…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[rgba(74,61,100,0.12)] bg-white pl-9 pr-4 py-2 text-sm text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-2 focus:ring-[rgba(184,148,78,0.25)]"
            />
          </div>
          <div className="flex rounded-lg border border-[rgba(74,61,100,0.12)] bg-white overflow-hidden shrink-0">
            {statusFilters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-[rgba(184,148,78,0.09)] text-[#80642F]"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Remunerations Table */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.10)] bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No remunerations found"
              description={
                remunerations.length === 0
                  ? "Create your first remuneration to start tracking client payments."
                  : "Try adjusting your search or filter."
              }
              action={
                remunerations.length === 0 ? (
                  <Button onClick={() => router.push("/remunerations/new")} id="empty-create-rem-btn">
                    <Plus size={14} className="mr-1.5" />
                    Create First Remuneration
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(74,61,100,0.08)] bg-[#faf9fc]">
                    {["Project", "Client", "Total", "Received", "Remaining", "Type", "Next Due", "Status", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(74,61,100,0.06)]">
                  {filtered.map((r) => {
                    const cfg = getStatusBadgeConfig(r.status);
                    const overdueLabel = getOverdueLabel(r);
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-[rgba(184,148,78,0.02)] transition-colors cursor-pointer"
                        onClick={() => router.push(`/remunerations/${r.id}`)}
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[#252331] truncate max-w-[140px]">{r.project?.name || "—"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-[#706C7D] truncate max-w-[120px]">{r.client?.name || <span className="text-[#9994A5] italic">No client</span>}</p>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#252331]">
                          {formatCurrency(r.total_amount || 0, r.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-emerald-700 font-medium">
                          {formatCurrency(r.received_amount || 0, r.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-[#706C7D]">
                          {formatCurrency(r.remaining_amount || 0, r.currency)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded-full bg-[rgba(74,61,100,0.07)] px-2 py-0.5 text-[11px] font-medium text-[#706C7D] capitalize">
                            {r.payment_method === "single" ? "Single" : "Installments"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {overdueLabel ? (
                            <div className="flex items-center gap-1">
                              <Calendar size={13} className="text-red-500" />
                              <span className="text-xs font-medium text-red-600">{overdueLabel}</span>
                            </div>
                          ) : (
                            <span className="text-[#706C7D] text-xs">{formatDate(r.next_due_date)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.indicator}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/remunerations/${r.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#80642F] hover:underline"
                            >
                              View <ArrowUpRight size={12} />
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingRem(r);
                              }}
                              className="p-1 rounded text-[#9994A5] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete remuneration"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingRem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="rounded-2xl bg-white shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-[#252331] text-base">Delete Remuneration?</h2>
                <p className="text-xs text-[#9994A5]">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-xs text-[#706C7D] leading-relaxed">
              Are you sure you want to permanently delete the remuneration agreement for{" "}
              <strong className="text-[#252331]">{deletingRem.project?.name || "this project"}</strong>? All associated payment requests, logs, and splits will be deleted.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="secondary" onClick={() => setDeletingRem(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger-solid"
                onClick={handleDelete}
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
