"use client";

import React, { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { exportToExcel, exportToPDF } from "@/lib/remuneration-export";

type Project = {
  id: string;
  name: string;
};

type EstimatePreview = {
  id: string;
  project_id: string;
  hourly_rate: number;
  currency: string;
  final_amount: number;
  created_at: string;
  ai_total_hours: number;
  final_total_hours: number;
  contingency_percentage: number;
};

interface RemunerationClientProps {
  projects?: Project[];
  savedEstimates?: EstimatePreview[];
}

export function RemunerationClient({
  projects: initialProjects,
  savedEstimates: initialSavedEstimates,
}: RemunerationClientProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [savedEstimates, setSavedEstimates] = useState<EstimatePreview[]>(initialSavedEstimates || []);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(!initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [hourlyRate, setHourlyRate] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>("INR");
  const [contingencyPercentage, setContingencyPercentage] = useState<number>(10);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [estimateData, setEstimateData] = useState<any>(null);
  const [storyEstimates, setStoryEstimates] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/remuneration");
      if (res.ok) {
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
        if (data.savedEstimates) setSavedEstimates(data.savedEstimates);
      }
    } catch (err) {
      console.error("Failed to load remuneration data", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  React.useEffect(() => {
    if (!initialProjects) {
      fetchData();
    } else {
      setProjects(initialProjects);
      if (initialSavedEstimates) setSavedEstimates(initialSavedEstimates);
      setIsLoadingData(false);
    }
  }, [initialProjects, initialSavedEstimates]);
  
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  });

  const handleAnalyze = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project first.");
      return;
    }
    if (hourlyRate <= 0) {
      toast.error("Enter a valid hourly rate greater than 0.");
      return;
    }

    setIsAnalyzing(true);
    setEstimateData(null);
    setStoryEstimates([]);

    try {
      const res = await fetch("/api/remuneration/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze project");
      }

      const rawEstimate = data.estimate;
      
      const stories = rawEstimate.stories.map((s: any) => ({
        ...s,
        final_hours: s.effort.totalHours,
      }));
      
      setStoryEstimates(stories);
      
      setEstimateData({
        projectSummary: rawEstimate.projectSummary,
      });

      toast.success("Project analysis completed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate estimate.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateStoryHours = (index: number, newHours: number) => {
    const updated = [...storyEstimates];
    updated[index].final_hours = newHours;
    setStoryEstimates(updated);
  };

  // Calculations
  const aiTotalHours = storyEstimates.reduce((sum, s) => sum + s.effort.totalHours, 0);
  const finalTotalHours = storyEstimates.reduce((sum, s) => sum + s.final_hours, 0);
  
  const baseAmount = finalTotalHours * hourlyRate;
  const contingencyAmount = (baseAmount * contingencyPercentage) / 100;
  const finalAmount = baseAmount + contingencyAmount;

  const handleSaveEstimate = async () => {
    setIsSaving(true);
    try {
      const payload = {
        project_id: selectedProjectId,
        estimateData: {
          hourly_rate: hourlyRate,
          currency,
          contingency_percentage: contingencyPercentage,
          ai_total_hours: aiTotalHours,
          final_total_hours: finalTotalHours,
          base_amount: baseAmount,
          contingency_amount: contingencyAmount,
          final_amount: finalAmount,
          project_summary: estimateData?.projectSummary,
        },
        storyEstimates: storyEstimates.map(s => ({
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story", // Assuming AI returns title or we need to join it
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: s.effort.totalHours,
          final_hours: s.final_hours,
          frontend_hours: s.effort.frontendHours,
          backend_hours: s.effort.backendHours,
          database_hours: s.effort.databaseHours,
          integration_hours: s.effort.integrationHours,
          testing_hours: s.effort.testingHours,
          confidence: s.confidence,
          reasoning: s.reasoning,
          assumptions: s.assumptions || [],
          risks: s.risks || [],
        })),
      };

      const res = await fetch("/api/remuneration/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Estimate saved successfully.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(err.message || "Unable to save estimate.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);

  const handleExportExcel = async () => {
    if (!estimateData) return;
    try {
      await exportToExcel(
        selectedProjectObj?.name || "Project", 
        {
          id: "",
          project_id: selectedProjectId,
          created_by: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hourly_rate: hourlyRate,
          currency,
          contingency_percentage: contingencyPercentage,
          ai_total_hours: aiTotalHours,
          final_total_hours: finalTotalHours,
          base_amount: baseAmount,
          contingency_amount: contingencyAmount,
          final_amount: finalAmount,
          project_summary: estimateData.projectSummary,
        },
        storyEstimates.map(s => ({
          id: "",
          remuneration_estimate_id: "",
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story",
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: s.effort.totalHours,
          final_hours: s.final_hours,
          frontend_hours: s.effort.frontendHours,
          backend_hours: s.effort.backendHours,
          database_hours: s.effort.databaseHours,
          integration_hours: s.effort.integrationHours,
          testing_hours: s.effort.testingHours,
          confidence: s.confidence,
          reasoning: s.reasoning,
          assumptions: s.assumptions || [],
          risks: s.risks || [],
          created_at: "",
          updated_at: "",
        }))
      );
      toast.success("Excel report generated.");
    } catch (err) {
      console.error("Failed to export Excel:", err);
      toast.error("Failed to generate Excel report.");
    }
  };

  const handleExportPDF = async () => {
    if (!estimateData) return;
    try {
      await exportToPDF(
        selectedProjectObj?.name || "Project", 
        {
          id: "",
          project_id: selectedProjectId,
          created_by: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hourly_rate: hourlyRate,
          currency,
          contingency_percentage: contingencyPercentage,
          ai_total_hours: aiTotalHours,
          final_total_hours: finalTotalHours,
          base_amount: baseAmount,
          contingency_amount: contingencyAmount,
          final_amount: finalAmount,
          project_summary: estimateData.projectSummary,
        },
        storyEstimates.map(s => ({
          id: "",
          remuneration_estimate_id: "",
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story",
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: s.effort.totalHours,
          final_hours: s.final_hours,
          frontend_hours: s.effort.frontendHours,
          backend_hours: s.effort.backendHours,
          database_hours: s.effort.databaseHours,
          integration_hours: s.effort.integrationHours,
          testing_hours: s.effort.testingHours,
          confidence: s.confidence,
          reasoning: s.reasoning,
          assumptions: s.assumptions || [],
          risks: s.risks || [],
          created_at: "",
          updated_at: "",
        }))
      );
      toast.success("PDF report generated.");
    } catch (err) {
      console.error("Failed to export PDF:", err);
      toast.error("Failed to generate PDF report.");
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-zinc-500 rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#B8944E] border-t-transparent" />
          <span className="text-sm font-medium text-[#706C7D]">Loading projects & remuneration history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="col-span-1 md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20"
            >
              <option value="">Select Project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">Hourly Rate</label>
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="contingency" 
              checked={contingencyPercentage > 0}
              onChange={(e) => setContingencyPercentage(e.target.checked ? 10 : 0)}
              className="rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
            />
            <label htmlFor="contingency" className="text-sm text-zinc-700">Include contingency</label>
            {contingencyPercentage > 0 && (
              <input
                type="number"
                min="0"
                max="100"
                value={contingencyPercentage}
                onChange={(e) => setContingencyPercentage(parseFloat(e.target.value) || 0)}
                className="w-16 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 ml-2"
              />
            )}
            <span className="text-sm text-zinc-500">%</span>
          </div>

          <Button
            variant="primary"
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
          >
            {isAnalyzing ? "Analyzing Project..." : "Estimate Remuneration"}
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {estimateData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Summary Card */}
          <div className="rounded-2xl border border-[rgba(184,148,78,0.2)] bg-gradient-to-br from-[#FCFBFC] to-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Project Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Stories</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{storyEstimates.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Estimated Hours</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{finalTotalHours} <span className="text-sm font-normal text-slate-500">(AI: {aiTotalHours})</span></p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Base Amount</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatter.format(baseAmount)}</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[rgba(184,148,78,0.06)] rounded-xl border border-[rgba(184,148,78,0.15)]">
              <div>
                <p className="text-sm font-semibold text-[#80642F]">Contingency ({contingencyPercentage}%)</p>
                <p className="text-lg font-bold text-[#80642F]">{formatter.format(contingencyAmount)}</p>
              </div>
              <div className="mt-4 md:mt-0 text-left md:text-right">
                <p className="text-sm font-semibold text-slate-900">Final Expected Remuneration</p>
                <p className="text-3xl font-black text-slate-900">{formatter.format(finalAmount)}</p>
              </div>
            </div>
          </div>

          {/* AI Notes */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm text-sm">
            <h3 className="font-bold text-slate-900 mb-2">Estimation Notes</h3>
            <p className="text-slate-600 mb-4">{estimateData.projectSummary.summary}</p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              {estimateData.projectSummary.risks?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-rose-800 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Risks
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                    {estimateData.projectSummary.risks.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {estimateData.projectSummary.assumptions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Assumptions
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs">
                    {estimateData.projectSummary.assumptions.map((a: string, i: number) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Story Breakdown */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Epic / Story Breakdown</h3>
              <p className="text-xs text-slate-500">AI-generated estimates are suggestions. Review them before finalizing remuneration.</p>
            </div>
            <div className="divide-y divide-zinc-100">
              {storyEstimates.map((story, idx) => (
                <div key={idx} className="p-4 sm:p-6 hover:bg-zinc-50/50 transition">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider border border-slate-200">
                          {story.complexity}
                        </span>
                        {story.confidence?.toLowerCase() === "low" && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            ⚠ Low Confidence
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-400">ID: {story.storyId.slice(0,8)}</span>
                      </div>
                      <h4 className="font-semibold text-slate-900">{story.title || "Story Title Unknown"}</h4>
                      <p className="text-xs text-slate-500 mt-1">{story.reasoning}</p>
                    </div>
                    
                    <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">AI Estimate</span>
                        <span className="font-medium">{story.effort.totalHours} h</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700 font-semibold">Final Hours</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={story.final_hours}
                          onChange={(e) => handleUpdateStoryHours(idx, parseFloat(e.target.value) || 0)}
                          className="w-20 rounded border border-zinc-300 px-2 py-1 text-right focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20 font-bold"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-zinc-100">
                        <span className="text-slate-500">Amount</span>
                        <span className="font-semibold text-slate-900">{formatter.format(story.final_hours * hourlyRate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-zinc-200">
            <Button
              variant="outline"
              onClick={handleSaveEstimate}
              isLoading={isSaving}
            >
              Save Estimate
            </Button>
            <Button
              variant="primary"
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button
              variant="primary"
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {!estimateData && savedEstimates.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Saved Estimates</h2>
          <div className="divide-y divide-zinc-100">
            {savedEstimates.map(est => {
              const proj = projects.find(p => p.id === est.project_id);
              return (
                <div key={est.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{proj?.name || "Unknown Project"}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(est.created_at).toLocaleDateString()} • {est.final_total_hours} h • Rate: {est.currency} {est.hourly_rate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#80642F]">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: est.currency }).format(est.final_amount)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
