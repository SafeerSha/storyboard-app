"use client";

import React, { useState, useEffect } from "react";
import {
  Calculator,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MessageSquare,
  Clock,
  Database,
  TestTubes,
  Rocket,
  Code2,
  Server,
  Layers,
  Check,
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SectionDiscussionDrawer } from "@/components/remuneration/SectionDiscussionDrawer";
import { toast } from "@/lib/toast";
import type { RemunerationDiscussionThread } from "@/lib/types";

interface ClientEstimateViewProps {
  clientName: string;
}

export function ClientEstimateView({ clientName }: ClientEstimateViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [estimate, setEstimate] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);

  // Approval / Action modal state
  const [actionModalType, setActionModalType] = useState<"approve" | "request_changes" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Discussion Drawer state
  const [activeDiscussion, setActiveDiscussion] = useState<{
    sectionKey: string;
    sectionTitle: string;
  } | null>(null);

  const fetchEstimate = () => {
    setIsLoading(true);
    fetch("/api/client/remuneration")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.estimate) {
          setEstimate(data.estimate);
          setStories(data.stories || []);
        } else {
          setEstimate(null);
          setStories([]);
        }
      })
      .catch((err) => {
        console.error("Failed to load client estimate:", err);
        toast.error("Failed to load project quotation.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchEstimate();
  }, []);

  const handleActionSubmit = async () => {
    if (!actionModalType || !estimate) return;

    setIsSubmittingAction(true);
    try {
      const res = await fetch("/api/client/remuneration/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId: estimate.id,
          action: actionModalType,
          notes: actionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      toast.success(data.message);
      setActionModalType(null);
      setActionNotes("");
      fetchEstimate();
    } catch (err: any) {
      console.error("Failed to submit client action:", err);
      toast.error(err.message || "Failed to submit response.");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="h-48 rounded-2xl border border-zinc-200 bg-white p-8 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#B8944E] border-t-transparent animate-spin mb-3" />
          <p className="text-sm font-semibold text-zinc-800">Loading your project quotation...</p>
          <p className="text-xs text-zinc-400 mt-0.5">Retrieving scope deliverables and fee structure</p>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#B8944E]/10 text-[#80642F] flex items-center justify-center mx-auto mb-4">
            <Calculator className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-zinc-900">No Quotation Published Yet</h2>
          <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1.5 leading-relaxed">
            The project team has not yet published an estimation proposal for your account. Once ready, you will be able to review the deliverables scope, discuss individual sections, and approve the quotation here.
          </p>
        </div>
      </div>
    );
  }

  const summary = estimate.project_summary || {};
  const publishing = summary.publishing || {};
  const discussions = publishing.discussions || {};
  const publishingStatus = publishing.status || "published";
  const clientAction = publishing.client_action || {};

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: estimate.currency || "INR",
  });

  const getDiscussionCount = (key: string) => {
    return discussions[key]?.messages?.length || 0;
  };

  const handleThreadUpdated = (updatedThread: RemunerationDiscussionThread, newStatus?: string) => {
    setEstimate((prev: any) => {
      if (!prev) return prev;
      const prevSummary = prev.project_summary || {};
      const prevPub = prevSummary.publishing || {};
      return {
        ...prev,
        project_summary: {
          ...prevSummary,
          publishing: {
            ...prevPub,
            status: newStatus || prevPub.status,
            discussions: {
              ...(prevPub.discussions || {}),
              [updatedThread.section_key]: updatedThread,
            },
          },
        },
      };
    });
  };

  const workScope = summary.scope || "both";
  const includeDb = summary.includeDbDesign !== false;
  const includeTesting = summary.includeUnitTesting !== false;
  const includeDeploy = summary.includeDeployment === true;
  const deploymentHours = summary.deploymentHours || 0;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-[rgba(184,148,78,0.25)] bg-gradient-to-br from-[#FCFBFC] to-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#80642F] bg-[#B8944E]/10 px-2.5 py-0.5 rounded-full border border-[#B8944E]/20">
                Official Project Quotation
              </span>
              {(summary.estimate_label || publishing.estimate_label) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-300">
                  <Tag className="w-3 h-3 text-amber-600" />
                  {summary.estimate_label || publishing.estimate_label}
                </span>
              )}
              <span className="text-xs text-zinc-400">
                Updated {new Date(estimate.updated_at || estimate.created_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight">
              Scope of Work & Fee Proposal
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Prepared for <span className="font-semibold text-zinc-700">{clientName}</span>. Review deliverables, ask questions, or negotiate terms.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {publishingStatus === "approved" ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Quotation Approved
              </span>
            ) : publishingStatus === "rejected" ? (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <XCircle className="w-4 h-4" />
                Quotation Declined
              </span>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setActionModalType("request_changes")}
                  className="text-xs flex items-center gap-1.5 border-zinc-300 hover:bg-zinc-50"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                  Request Changes
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setActionModalType("approve")}
                  className="text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Quotation
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Callout Banner */}
        <div className="mt-4">
          {publishingStatus === "approved" ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Approved by {clientAction.decided_by_client_name || clientName} on{" "}
                {clientAction.decided_at ? new Date(clientAction.decided_at).toLocaleString() : "recently"}.
                {clientAction.notes && ` Notes: "${clientAction.notes}"`}
              </span>
            </div>
          ) : publishingStatus === "negotiating" ? (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Discussion in progress. You have requested revisions or posted bargaining notes on specific sections below.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#B8944E]/[0.07] border border-[#B8944E]/20 text-zinc-700 text-xs">
              <ShieldCheck className="w-4 h-4 text-[#80642F] shrink-0" />
              <span>
                Please inspect the scope of deliverables and fee structure below. You can click <strong>"Discuss / Bargain"</strong> on any section to ask questions or suggest adjusted hours.
              </span>
            </div>
          )}
        </div>

        {/* Scope Disciplines Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-zinc-100">
          <span className="text-xs font-semibold text-zinc-500 mr-1">Disciplines:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#B8944E]/10 text-[#80642F] border border-[#B8944E]/30">
            {workScope === "frontend" && <Code2 className="w-3.5 h-3.5" />}
            {workScope === "backend" && <Server className="w-3.5 h-3.5" />}
            {workScope === "both" && <Layers className="w-3.5 h-3.5" />}
            {workScope === "frontend" ? "Frontend Only" : workScope === "backend" ? "Backend Only" : "Full Stack (Both)"}
          </span>
          {includeDb && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Database className="w-3 h-3" /> Database Design
            </span>
          )}
          {includeTesting && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <TestTubes className="w-3 h-3" /> Unit Testing Included
            </span>
          )}
          {includeDeploy && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Rocket className="w-3 h-3" /> DevOps & Deployment ({deploymentHours}h)
            </span>
          )}
        </div>
      </div>

      {/* Financial Overview Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Total Billable Effort</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{estimate.final_total_hours} hrs</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Scope deliverables</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Hourly Rate</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">
            {formatter.format(summary.rates?.effectiveRate || estimate.hourly_rate)}/h
          </p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Professional engineering rate</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Contingency Buffer</p>
          <p className="text-2xl font-bold text-[#80642F] mt-1">{formatter.format(estimate.contingency_amount)}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">{estimate.contingency_percentage}% unforeseen margin</p>
        </div>

        <div className="rounded-2xl border border-[rgba(184,148,78,0.3)] bg-[#B8944E]/[0.05] p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#80642F]">Total Quotation</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{formatter.format(estimate.final_amount)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Base + Contingency</p>
        </div>
      </div>

      {/* Section 1: Overall Scope & Rates Discussion */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Overall Package & Commercial Terms</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Covers the overall project structure, hourly pricing model, and contingency percentage.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setActiveDiscussion({
                sectionKey: "summary",
                sectionTitle: "Overall Package & Commercial Terms",
              })
            }
            className="text-xs flex items-center gap-1.5 self-start sm:self-auto border-zinc-200 hover:border-[#B8944E]"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#B8944E]" />
            Discuss / Bargain
            {getDiscussionCount("summary") > 0 && (
              <span className="ml-1 rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[10px] font-bold text-white">
                {getDiscussionCount("summary")}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Section 2: Architecture & Specialized Services */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-base font-bold text-zinc-900">Architecture & Technical Services</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Database Design */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-[#B8944E]" />
                <p className="text-sm font-semibold text-zinc-900">Database Design</p>
              </div>
              <p className="text-xs text-zinc-500 mt-1 leading-snug">
                {includeDb
                  ? "Schema modeling, migrations, relationship integrity & indexing"
                  : "Excluded from engagement scope"}
              </p>
            </div>
            {includeDb && (
              <button
                type="button"
                onClick={() =>
                  setActiveDiscussion({
                    sectionKey: "database_design",
                    sectionTitle: "Database Design & Architecture",
                  })
                }
                className="text-[11px] font-semibold text-[#80642F] hover:underline flex items-center gap-1 self-start"
              >
                <MessageSquare className="w-3 h-3" />
                Discuss Database Scope
                {getDiscussionCount("database_design") > 0 && (
                  <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {getDiscussionCount("database_design")}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Unit Testing */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <TestTubes className="w-4 h-4 text-[#B8944E]" />
                <p className="text-sm font-semibold text-zinc-900">Unit Testing</p>
              </div>
              <p className="text-xs text-zinc-500 mt-1 leading-snug">
                {includeTesting
                  ? "Automated unit tests, input validation & business logic verification"
                  : "Excluded from engagement scope"}
              </p>
            </div>
            {includeTesting && (
              <button
                type="button"
                onClick={() =>
                  setActiveDiscussion({
                    sectionKey: "unit_testing",
                    sectionTitle: "Unit Testing & Code Verification",
                  })
                }
                className="text-[11px] font-semibold text-[#80642F] hover:underline flex items-center gap-1 self-start"
              >
                <MessageSquare className="w-3 h-3" />
                Discuss Testing Hours
                {getDiscussionCount("unit_testing") > 0 && (
                  <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {getDiscussionCount("unit_testing")}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* DevOps & Deployment */}
          <div className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Rocket className="w-4 h-4 text-[#B8944E]" />
                  <p className="text-sm font-semibold text-zinc-900">Deployment & DevOps</p>
                </div>
                {includeDeploy && (
                  <span className="text-xs font-bold text-zinc-700">{deploymentHours}h</span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1 leading-snug">
                {includeDeploy
                  ? "Cloud hosting setup, CI/CD pipeline, SSL & domain provisioning"
                  : "Excluded from engagement scope"}
              </p>
            </div>
            {includeDeploy && (
              <button
                type="button"
                onClick={() =>
                  setActiveDiscussion({
                    sectionKey: "deployment",
                    sectionTitle: "Deployment & DevOps Deliverable",
                  })
                }
                className="text-[11px] font-semibold text-[#80642F] hover:underline flex items-center gap-1 self-start"
              >
                <MessageSquare className="w-3 h-3" />
                Discuss DevOps Scope
                {getDiscussionCount("deployment") > 0 && (
                  <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {getDiscussionCount("deployment")}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Feature Stories & Deliverables List */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-zinc-900">Feature Deliverables ({stories.length} Stories)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Granular breakdown of features, implementation hours, and estimated cost per story.
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100">
          {stories.map((story) => {
            const storyKey = `story_${story.story_id || story.id}`;
            const effectiveRate = summary.rates?.effectiveRate || estimate.hourly_rate;
            const storyCost = (story.final_hours || 0) * effectiveRate;
            const commentsCount = getDiscussionCount(storyKey);

            return (
              <div key={story.id || story.story_id} className="p-5 hover:bg-zinc-50/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 uppercase tracking-wider border border-zinc-200">
                        {story.complexity || "Medium"}
                      </span>
                      {story.epic_name && (
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-[#80642F] border border-amber-200">
                          {story.epic_name}
                        </span>
                      )}

                      {/* Discipline Hours Badges */}
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                        {workScope !== "backend" && (
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                            FE: {story.frontend_hours || 0}h
                          </span>
                        )}
                        {workScope !== "frontend" && (
                          <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                            BE: {story.backend_hours || 0}h
                          </span>
                        )}
                        {includeDb && (
                          <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">
                            DB: {story.database_hours || 0}h
                          </span>
                        )}
                        {includeTesting && (
                          <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">
                            Tests: {story.testing_hours || 0}h
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-zinc-900">
                      {story.story_title || story.title || "Feature Story"}
                    </h4>
                    {story.reasoning && (
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{story.reasoning}</p>
                    )}

                    {/* Bargaining / Discuss Button */}
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDiscussion({
                            sectionKey: storyKey,
                            sectionTitle: story.story_title || story.title || "Story Deliverable",
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#80642F] hover:text-[#5e4922] bg-[#B8944E]/[0.08] hover:bg-[#B8944E]/[0.15] px-2.5 py-1 rounded-lg border border-[#B8944E]/20 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss / Bargain this Story
                        {commentsCount > 0 && (
                          <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                            {commentsCount}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Story Hours and Amount */}
                  <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-1 shrink-0 sm:w-36 text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                    <div>
                      <span className="text-xs text-zinc-400 sm:block">Effort: </span>
                      <span className="text-sm font-bold text-zinc-800">{story.final_hours} hrs</span>
                    </div>
                    <div className="sm:mt-1">
                      <span className="text-xs text-zinc-400 sm:block">Amount: </span>
                      <span className="text-sm font-black text-zinc-900">{formatter.format(storyCost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approve / Request Changes Confirmation Modal */}
      {actionModalType && (
        <Modal
          isOpen={true}
          onClose={() => setActionModalType(null)}
          title={
            actionModalType === "approve"
              ? "Approve Project Quotation"
              : "Request Changes / Negotiate"
          }
          description={
            actionModalType === "approve"
              ? `Confirm your approval of the quotation totaling ${formatter.format(estimate.final_amount)} (${estimate.final_total_hours} billable hours).`
              : "Let the project team know what changes, budget targets, or scope adjustments you need."
          }
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="ghost"
                onClick={() => setActionModalType(null)}
                disabled={isSubmittingAction}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleActionSubmit}
                isLoading={isSubmittingAction}
                className={
                  actionModalType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-[#B8944E] hover:bg-[#a3803d] text-white"
                }
              >
                {actionModalType === "approve" ? "Confirm Approval" : "Submit Request"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 block">
              {actionModalType === "approve" ? "Sign-off Note (Optional)" : "Reason / Requested Adjustments"}
            </label>
            <textarea
              rows={3}
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder={
                actionModalType === "approve"
                  ? "e.g. Approved. Looking forward to kicking off development!"
                  : "e.g. We would like to adjust the testing scope and target a budget of $5,000..."
              }
              className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:outline-none resize-none"
            />
          </div>
        </Modal>
      )}

      {/* Discussion Drawer */}
      {activeDiscussion && (
        <SectionDiscussionDrawer
          isOpen={true}
          onClose={() => setActiveDiscussion(null)}
          estimateId={estimate.id}
          sectionKey={activeDiscussion.sectionKey}
          sectionTitle={activeDiscussion.sectionTitle}
          initialThread={discussions[activeDiscussion.sectionKey]}
          currency={estimate.currency}
          isClientViewer={true}
          onThreadUpdated={handleThreadUpdated}
        />
      )}
    </div>
  );
}
