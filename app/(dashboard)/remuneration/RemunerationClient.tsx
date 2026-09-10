"use client";

import React, { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { exportToExcel, exportToPDF } from "@/lib/remuneration-export";
import { PublishEstimateModal } from "@/components/remuneration/PublishEstimateModal";
import { RecallEstimateModal } from "@/components/remuneration/RecallEstimateModal";
import { SectionDiscussionDrawer } from "@/components/remuneration/SectionDiscussionDrawer";
import type { RemunerationPublishingInfo, RemunerationDiscussionThread } from "@/lib/types";
import {
  Code2,
  Server,
  Layers,
  Database,
  Rocket,
  SlidersHorizontal,
  Check,
  Calculator,
  Sparkles,
  Info,
  ExternalLink,
  TestTubes,
  Send,
  MessageSquare,
  Users,
  CheckCircle2,
  Undo2,
  Mail,
  Tag,
  Search,
  Filter,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";

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
  project_summary?: any;
};

interface RemunerationClientProps {
  projects?: Project[];
  savedEstimates?: EstimatePreview[];
  activeView?: "calculator" | "quotations";
  onViewChange?: (view: "calculator" | "quotations") => void;
}

export type WorkScope = "frontend" | "backend" | "both";
export type UnitTestIntensity = "lean" | "standard" | "comprehensive";

// Helper to ensure unit test hours are realistic and proportional (10-25% of dev hours)
export function getCalibratedUnitTestHours(
  effort: any,
  intensity: UnitTestIntensity = "lean"
): number {
  if (!effort) return 0;
  if (effort.customTestHours !== undefined && effort.customTestHours !== null) {
    return Math.max(0, Math.round(Number(effort.customTestHours) * 10) / 10);
  }
  const rawTest = effort.unitTestingHours ?? effort.testingHours ?? 0;
  if (rawTest <= 0) return 0;
  const fe = effort.frontendHours || 0;
  const be = effort.backendHours || 0;
  const devHours = fe + be;
  if (devHours <= 0) return Math.min(rawTest, 1.0);

  // Lean: ~12% of dev, Standard: ~18% of dev, Comprehensive: ~25% of dev
  const ratio = intensity === "comprehensive" ? 0.25 : intensity === "standard" ? 0.18 : 0.12;
  const maxAllowed = Math.max(0.5, Math.round(devHours * ratio * 10) / 10);
  return Math.min(rawTest, maxAllowed);
}

// Helper to compute in-scope hours for a given story based on active scope & options
export function computeStoryScopedHours(
  effort: any,
  scope: WorkScope,
  includeDb: boolean,
  includeUnitTesting: boolean = true,
  unitTestIntensity: UnitTestIntensity = "lean"
): number {
  if (!effort) return 0;
  const fe = effort.frontendHours || 0;
  const be = effort.backendHours || 0;
  const db = includeDb ? (effort.databaseHours || 0) : 0;
  
  // Baseline calibrated test hours before any manual override
  const rawCalibrated = getCalibratedUnitTestHours(
    { ...effort, customTestHours: undefined },
    unitTestIntensity
  );
  const integ = effort.integrationHours || 0;

  // Base scope calculation
  let baseScoped = 0;
  if (scope === "frontend") {
    baseScoped = fe + (rawCalibrated * 0.6) + (integ * 0.4);
  } else if (scope === "backend") {
    baseScoped = be + db + (rawCalibrated * 0.4) + (integ * 0.6);
  } else {
    baseScoped = fe + be + db + rawCalibrated + integ;
  }

  // If unit testing is enabled and user explicitly customized test hours, add exact difference
  if (includeUnitTesting && effort.customTestHours !== undefined && effort.customTestHours !== null) {
    const testDelta = Number(effort.customTestHours) - rawCalibrated;
    baseScoped += testDelta;
  } else if (!includeUnitTesting) {
    // If unit testing is disabled, remove test contribution
    if (scope === "frontend") baseScoped -= (rawCalibrated * 0.6);
    else if (scope === "backend") baseScoped -= (rawCalibrated * 0.4);
    else baseScoped -= rawCalibrated;
  }

  return Math.max(0, Math.round(baseScoped * 10) / 10);
}

// Helper to compute story cost based on discipline rates
export function computeStoryCost(
  story: any,
  scope: WorkScope,
  includeDb: boolean,
  includeUnitTesting: boolean,
  customRates: boolean,
  rates: {
    base: number;
    frontend: number;
    backend: number;
    dbDesign: number;
    unitTesting: number;
    deployment: number;
  },
  unitTestIntensity: UnitTestIntensity = "lean"
): number {
  const finalHours = story.final_hours || 0;
  if (finalHours <= 0) return 0;

  if (!customRates) {
    return finalHours * rates.base;
  }

  const fe = scope === "backend" ? 0 : (story.effort?.frontendHours || 0);
  const be = scope === "frontend" ? 0 : (story.effort?.backendHours || 0);
  const db = (includeDb && scope !== "frontend") ? (story.effort?.databaseHours || 0) : 0;
  const testHours = includeUnitTesting ? getCalibratedUnitTestHours(story.effort, unitTestIntensity) : 0;
  const integ = (story.effort?.integrationHours || 0) * (scope === "both" ? 1 : 0.5);

  const rawSum = fe + be + db + testHours + integ;
  if (rawSum <= 0) {
    return finalHours * rates.base;
  }

  const scale = finalHours / rawSum;
  const feCost = (fe * scale) * rates.frontend;
  const beCost = (be * scale) * rates.backend;
  const dbCost = (db * scale) * rates.dbDesign;
  const testCost = (testHours * scale) * (rates.unitTesting || rates.base);
  const blendedDevRate = (rates.frontend + rates.backend) / 2;
  const qaCost = (integ * scale) * blendedDevRate;

  return Math.round(feCost + beCost + dbCost + testCost + qaCost);
}

export type EstimateRecipient = {
  id: string;
  name: string;
  email?: string;
};

export function getEstimateRecipients(
  est: any,
  clientsList: Array<{ id: string; name: string; email?: string }>
): EstimateRecipient[] {
  if (!est) return [];
  const summary = est.project_summary || {};
  const pub = summary.publishing || {};

  // 1. Direct snapshot
  if (Array.isArray(pub.published_to_clients) && pub.published_to_clients.length > 0) {
    return pub.published_to_clients;
  }
  if (Array.isArray(pub.previous_clients) && pub.previous_clients.length > 0) {
    return pub.previous_clients;
  }

  // 2. Active or previous client IDs
  const clientIds: string[] = (Array.isArray(pub.published_to_client_ids) && pub.published_to_client_ids.length > 0)
    ? pub.published_to_client_ids
    : (Array.isArray(pub.previous_client_ids) ? pub.previous_client_ids : []);

  const clientEmails = pub.client_emails || {};

  if (clientIds.length > 0) {
    return clientIds.map((cid) => {
      const match = clientsList.find((c) => c.id === cid);
      return {
        id: cid,
        name: match?.name || "Client",
        email: clientEmails[cid] || match?.email || "",
      };
    });
  }

  // 3. Fallback to client_emails map
  const emailEntries = Object.entries(clientEmails);
  if (emailEntries.length > 0) {
    return emailEntries.map(([cid, email]) => {
      const match = clientsList.find((c) => c.id === cid);
      return {
        id: cid,
        name: match?.name || "Client",
        email: String(email),
      };
    });
  }

  return [];
}

export function RemunerationClient({
  projects: initialProjects,
  savedEstimates: initialSavedEstimates,
  activeView,
  onViewChange,
}: RemunerationClientProps) {
  const [internalView, setInternalView] = useState<"calculator" | "quotations">(activeView || "calculator");
  const currentView = activeView !== undefined ? activeView : internalView;

  const handleSwitchView = (view: "calculator" | "quotations") => {
    setInternalView(view);
    if (onViewChange) {
      onViewChange(view);
    }
  };

  const [quotationSearch, setQuotationSearch] = useState<string>("");
  const [quotationFilter, setQuotationFilter] = useState<"all" | "published" | "negotiating" | "approved" | "recalled" | "draft">("all");

  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [savedEstimates, setSavedEstimates] = useState<EstimatePreview[]>(initialSavedEstimates || []);
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; email?: string; login_id?: string; project_id?: string }>>([]);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(!initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [hourlyRate, setHourlyRate] = useState<number>(1000);
  const [currency, setCurrency] = useState<string>("INR");
  const [contingencyPercentage, setContingencyPercentage] = useState<number>(10);

  // New scope & services options
  const [workScope, setWorkScope] = useState<WorkScope>("both");
  const [includeDbDesign, setIncludeDbDesign] = useState<boolean>(true);
  const [includeUnitTesting, setIncludeUnitTesting] = useState<boolean>(true);
  const [unitTestIntensity, setUnitTestIntensity] = useState<UnitTestIntensity>("lean");
  const [includeDeployment, setIncludeDeployment] = useState<boolean>(false);
  const [deploymentHours, setDeploymentHours] = useState<number>(8);

  // Discipline rates dependency
  const [customRatesEnabled, setCustomRatesEnabled] = useState<boolean>(false);
  const [frontendRate, setFrontendRate] = useState<number>(1000);
  const [backendRate, setBackendRate] = useState<number>(1000);
  const [dbDesignRate, setDbDesignRate] = useState<number>(1000);
  const [unitTestingRate, setUnitTestingRate] = useState<number>(1000);
  const [deploymentRate, setDeploymentRate] = useState<number>(1000);
  const [estimateLabel, setEstimateLabel] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [estimateData, setEstimateData] = useState<any>(null);
  const [storyEstimates, setStoryEstimates] = useState<any[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [projectStoriesMap, setProjectStoriesMap] = useState<Record<string, { title: string; epic_id?: string | null }>>({});

  // Publishing & Section Discussion states
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [currentPublishing, setCurrentPublishing] = useState<RemunerationPublishingInfo | null>(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [isRecallModalOpen, setIsRecallModalOpen] = useState<boolean>(false);
  const [activeDiscussion, setActiveDiscussion] = useState<{ sectionKey: string; sectionTitle: string } | null>(null);
  const [isLoadingSavedEstimate, setIsLoadingSavedEstimate] = useState<boolean>(false);

  const handlePublishedSuccess = (pubInfo: RemunerationPublishingInfo, estId: string) => {
    setCurrentPublishing(pubInfo);
    setCurrentEstimateId(estId);
    setEstimateData((prev: any) => ({
      ...prev,
      project_summary: {
        ...(prev?.project_summary || {}),
        publishing: pubInfo,
      },
    }));
    fetchData();
  };

  const handleRecalledSuccess = (pubInfo: RemunerationPublishingInfo) => {
    setCurrentPublishing(pubInfo);
    setEstimateData((prev: any) => ({
      ...prev,
      project_summary: {
        ...(prev?.project_summary || {}),
        publishing: pubInfo,
      },
    }));
    fetchData();
  };

  const handleThreadUpdated = (updatedThread: RemunerationDiscussionThread, newPubStatus?: string) => {
    setCurrentPublishing((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: (newPubStatus as any) || prev.status,
        discussions: {
          ...(prev.discussions || {}),
          [updatedThread.section_key]: updatedThread,
        },
      };
    });
  };

  const handleLoadSavedEstimate = async (estId: string) => {
    setIsLoadingSavedEstimate(true);
    try {
      const res = await fetch(`/api/remuneration/estimates/${estId}`);
      const data = await res.json();
      if (!res.ok || !data.estimate) {
        throw new Error(data.error || "Failed to load saved estimate.");
      }

      const est = data.estimate;
      const sum = est.project_summary || {};
      setSelectedProjectId(est.project_id);
      setHourlyRate(est.hourly_rate);
      setCurrency(est.currency);
      setContingencyPercentage(est.contingency_percentage);
      setWorkScope(sum.scope || "both");
      setIncludeDbDesign(sum.includeDbDesign !== false);
      setIncludeUnitTesting(sum.includeUnitTesting !== false);
      setUnitTestIntensity(sum.unitTestIntensity || "lean");
      setIncludeDeployment(sum.includeDeployment === true);
      setDeploymentHours(sum.deploymentHours || 8);

      if (sum.rates) {
        setCustomRatesEnabled(true);
        if (sum.rates.frontend) setFrontendRate(sum.rates.frontend);
        if (sum.rates.backend) setBackendRate(sum.rates.backend);
        if (sum.rates.dbDesign) setDbDesignRate(sum.rates.dbDesign);
        if (sum.rates.unitTesting) setUnitTestingRate(sum.rates.unitTesting);
        if (sum.rates.deployment) setDeploymentRate(sum.rates.deployment);
      }

      setCurrentEstimateId(est.id);
      setCurrentPublishing(sum.publishing || null);
      setEstimateLabel(sum.estimate_label || sum.publishing?.estimate_label || "");
      setEstimateData(est);

      const mappedStories = (data.stories || []).map((s: any) => ({
        storyId: s.story_id,
        epicId: s.epic_id,
        title: s.story_title,
        epicName: s.epic_name,
        complexity: s.complexity,
        confidence: s.confidence,
        reasoning: s.reasoning,
        final_hours: s.final_hours,
        effort: {
          frontendHours: s.frontend_hours || 0,
          backendHours: s.backend_hours || 0,
          databaseHours: s.database_hours || 0,
          unitTestingHours: s.testing_hours || 0,
          testingHours: s.testing_hours || 0,
          customTestHours: s.testing_hours !== undefined && s.testing_hours !== null ? s.testing_hours : undefined,
          integrationHours: s.integration_hours || 0,
          totalHours: s.final_hours || 0,
        },
      }));

      setStoryEstimates(mappedStories);
      toast.success("Loaded saved quotation into editor.");
    } catch (err: any) {
      console.error("Load estimate error:", err);
      toast.error(err.message || "Unable to load estimate.");
    } finally {
      setIsLoadingSavedEstimate(false);
    }
  };

  React.useEffect(() => {
    if (!selectedProjectId) {
      setProjectStoriesMap({});
      return;
    }
    fetch(`/api/stories?projectId=${selectedProjectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.stories && Array.isArray(data.stories)) {
          const map: Record<string, { title: string; epic_id?: string | null }> = {};
          data.stories.forEach((s: any) => {
            map[s.id] = { title: s.title, epic_id: s.epic_id };
          });
          setProjectStoriesMap(map);

          // If stories are already displayed with missing titles, patch them immediately
          setStoryEstimates(prev => prev.map(item => {
            if (item.title && item.title !== "Story Title Unknown") return item;
            const match = map[item.storyId] || Object.entries(map).find(([id]) => id.startsWith(item.storyId) || (item.storyId && item.storyId.startsWith(id)))?.[1];
            return match ? { ...item, title: match.title } : item;
          }));
        }
      })
      .catch(() => {});
  }, [selectedProjectId]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/remuneration");
      if (res.ok) {
        const data = await res.json();
        if (data.projects) setProjects(data.projects);
        if (data.savedEstimates) setSavedEstimates(data.savedEstimates);
        if (data.clients) setClientsList(data.clients);
      }
    } catch (err) {
      console.error("Failed to load remuneration data", err);
    } finally {
      setIsLoadingData(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleBaseRateChange = (val: number) => {
    const rate = Math.max(0, val);
    setHourlyRate(rate);
    if (!customRatesEnabled) {
      setFrontendRate(rate);
      setBackendRate(rate);
      setDbDesignRate(rate);
      setUnitTestingRate(rate);
      setDeploymentRate(rate);
    }
  };

  const handleCustomRatesToggle = (enabled: boolean) => {
    setCustomRatesEnabled(enabled);
    if (!enabled) {
      setFrontendRate(hourlyRate);
      setBackendRate(hourlyRate);
      setDbDesignRate(hourlyRate);
      setUnitTestingRate(hourlyRate);
      setDeploymentRate(hourlyRate);
    } else {
      if (frontendRate <= 0) setFrontendRate(hourlyRate);
      if (backendRate <= 0) setBackendRate(hourlyRate);
      if (dbDesignRate <= 0) setDbDesignRate(hourlyRate);
      if (unitTestingRate <= 0) setUnitTestingRate(hourlyRate);
      if (deploymentRate <= 0) setDeploymentRate(hourlyRate);
    }
  };

  const handleScopeChange = (newScope: WorkScope) => {
    setWorkScope(newScope);
    if (storyEstimates.length > 0) {
      setStoryEstimates(prev =>
        prev.map(s => ({
          ...s,
          final_hours: computeStoryScopedHours(s.effort, newScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
        }))
      );
    }
  };

  const handleDbDesignToggle = (checked: boolean) => {
    setIncludeDbDesign(checked);
    if (storyEstimates.length > 0) {
      setStoryEstimates(prev =>
        prev.map(s => ({
          ...s,
          final_hours: computeStoryScopedHours(s.effort, workScope, checked, includeUnitTesting, unitTestIntensity),
        }))
      );
    }
  };

  const handleUnitTestingToggle = (checked: boolean) => {
    setIncludeUnitTesting(checked);
    if (storyEstimates.length > 0) {
      setStoryEstimates(prev =>
        prev.map(s => ({
          ...s,
          final_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, checked, unitTestIntensity),
        }))
      );
    }
  };

  const handleUnitTestIntensityChange = (level: UnitTestIntensity) => {
    setUnitTestIntensity(level);
    if (storyEstimates.length > 0) {
      setStoryEstimates(prev =>
        prev.map(s => ({
          ...s,
          final_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, level),
        }))
      );
    }
  };

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
        body: JSON.stringify({
          projectId: selectedProjectId,
          scope: workScope,
          includeDbDesign,
          includeUnitTesting,
          unitTestIntensity,
          includeDeployment,
          customPrompt,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze project");
      }

      const rawEstimate = data.estimate;
      
      if (rawEstimate.projectSummary?.deploymentHours) {
        setDeploymentHours(rawEstimate.projectSummary.deploymentHours);
      }

      const stories = rawEstimate.stories.map((s: any) => {
        const localMatch = projectStoriesMap[s.storyId] || Object.entries(projectStoriesMap).find(([id]) => id.startsWith(s.storyId) || (s.storyId && s.storyId.startsWith(id)))?.[1];
        return {
          ...s,
          title: s.title || localMatch?.title || "Story",
          final_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
        };
      });
      
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
    updated[index].final_hours = Math.max(0, newHours);
    setStoryEstimates(updated);
  };

  const handleUpdateStoryTestHours = (index: number, newTestHours: number) => {
    const clamped = Math.max(0, Math.round(newTestHours * 10) / 10);
    setStoryEstimates((prev) => {
      const updated = [...prev];
      const story = { ...updated[index] };
      const oldEffort = story.effort || {};

      // Calculate current calibrated test hours before update
      const oldTest = getCalibratedUnitTestHours(oldEffort, unitTestIntensity);
      const testDelta = Math.round((clamped - oldTest) * 10) / 10;

      const newEffort = {
        ...oldEffort,
        customTestHours: clamped,
        unitTestingHours: clamped,
        testingHours: clamped,
      };
      story.effort = newEffort;

      // Adjust final_hours by the exact delta so estimation amount updates instantly
      story.final_hours = Math.max(0, Math.round(((story.final_hours || 0) + testDelta) * 10) / 10);

      updated[index] = story;
      return updated;
    });
  };

  const handleUpdateStoryEffort = (index: number, field: string, newHours: number) => {
    const clamped = Math.max(0, Math.round(newHours * 10) / 10);
    setStoryEstimates((prev) => {
      const updated = [...prev];
      const story = { ...updated[index] };
      const oldEffort = story.effort || {};
      
      const newEffort = {
        ...oldEffort,
        [field]: clamped,
      };
      story.effort = newEffort;
      story.final_hours = computeStoryScopedHours(newEffort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity);
      
      updated[index] = story;
      return updated;
    });
  };

  // Calculations
  const activeDeploymentHours = includeDeployment ? Math.max(0, deploymentHours) : 0;
  const activeDeploymentRate = customRatesEnabled ? deploymentRate : hourlyRate;
  const deploymentAmount = activeDeploymentHours * activeDeploymentRate;

  const currentRates = {
    base: hourlyRate,
    frontend: frontendRate,
    backend: backendRate,
    dbDesign: dbDesignRate,
    unitTesting: unitTestingRate,
    deployment: deploymentRate,
  };

  const storiesBaseAmount = storyEstimates.reduce((sum, s) => {
    return sum + computeStoryCost(s, workScope, includeDbDesign, includeUnitTesting, customRatesEnabled, currentRates, unitTestIntensity);
  }, 0);

  const baseAmount = storiesBaseAmount + deploymentAmount;

  const totalStoryHours = storyEstimates.reduce((sum, s) => sum + s.final_hours, 0);
  const finalTotalHours = Math.round((totalStoryHours + activeDeploymentHours) * 10) / 10;
  
  const aiStoryHours = storyEstimates.reduce(
    (sum, s) => sum + computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
    0
  );
  const aiTotalHours = Math.round((aiStoryHours + activeDeploymentHours) * 10) / 10;

  const effectiveHourlyRate = finalTotalHours > 0 ? Math.round(baseAmount / finalTotalHours) : hourlyRate;

  const contingencyAmount = (baseAmount * contingencyPercentage) / 100;
  const finalAmount = baseAmount + contingencyAmount;

  // Breakdown metrics for summary visualization
  const totalFrontendHours = workScope === "backend" 
    ? 0 
    : Math.round(storyEstimates.reduce((sum, s) => sum + (s.effort?.frontendHours || 0), 0) * 10) / 10;
  const totalBackendHours = workScope === "frontend" 
    ? 0 
    : Math.round(storyEstimates.reduce((sum, s) => sum + (s.effort?.backendHours || 0), 0) * 10) / 10;
  const totalDbHours = (includeDbDesign && workScope !== "frontend")
    ? Math.round(storyEstimates.reduce((sum, s) => sum + (s.effort?.databaseHours || 0), 0) * 10) / 10
    : 0;
  const totalUnitTestingHours = includeUnitTesting
    ? Math.round(storyEstimates.reduce((sum, s) => sum + getCalibratedUnitTestHours(s.effort, unitTestIntensity), 0) * 10) / 10
    : 0;

  const selectedProjectObj = projects.find(p => p.id === selectedProjectId);

  const handleSaveEstimate = async () => {
    setIsSaving(true);
    try {
      const payload = {
        project_id: selectedProjectId,
        estimateData: {
          hourly_rate: effectiveHourlyRate,
          currency,
          contingency_percentage: contingencyPercentage,
          ai_total_hours: aiTotalHours,
          final_total_hours: finalTotalHours,
          base_amount: baseAmount,
          contingency_amount: contingencyAmount,
          final_amount: finalAmount,
          project_summary: {
            ...estimateData?.projectSummary,
            estimate_label: estimateLabel.trim() || undefined,
            scope: workScope,
            includeDbDesign,
            includeUnitTesting,
            unitTestIntensity,
            includeDeployment,
            deploymentHours: activeDeploymentHours,
            rates: {
              base: hourlyRate,
              frontend: frontendRate,
              backend: backendRate,
              dbDesign: dbDesignRate,
              unitTesting: unitTestingRate,
              deployment: deploymentRate,
              effectiveRate: effectiveHourlyRate,
            },
            publishing: currentPublishing || estimateData?.project_summary?.publishing || undefined,
          },
        },
        storyEstimates: storyEstimates.map(s => ({
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story",
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
          final_hours: s.final_hours,
          frontend_hours: workScope === "backend" ? 0 : (s.effort?.frontendHours || 0),
          backend_hours: workScope === "frontend" ? 0 : (s.effort?.backendHours || 0),
          database_hours: (includeDbDesign && workScope !== "frontend") ? (s.effort?.databaseHours || 0) : 0,
          integration_hours: s.effort?.integrationHours || 0,
          testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
          unit_testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
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

      if (data.estimate?.id) {
        setCurrentEstimateId(data.estimate.id);
      }
      toast.success("Estimate saved successfully.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Unable to save estimate.");
    } finally {
      setIsSaving(false);
    }
  };

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
          project_summary: {
            ...estimateData.projectSummary,
            estimate_label: estimateLabel.trim() || undefined,
            scope: workScope,
            includeDbDesign,
            includeUnitTesting,
            unitTestIntensity,
            includeDeployment,
            deploymentHours: activeDeploymentHours,
            rates: {
              base: hourlyRate,
              frontend: frontendRate,
              backend: backendRate,
              dbDesign: dbDesignRate,
              unitTesting: unitTestingRate,
              deployment: deploymentRate,
              effectiveRate: effectiveHourlyRate,
            },
          },
        },
        storyEstimates.map(s => ({
          id: "",
          remuneration_estimate_id: "",
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story",
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
          final_hours: s.final_hours,
          frontend_hours: workScope === "backend" ? 0 : (s.effort?.frontendHours || 0),
          backend_hours: workScope === "frontend" ? 0 : (s.effort?.backendHours || 0),
          database_hours: (includeDbDesign && workScope !== "frontend") ? (s.effort?.databaseHours || 0) : 0,
          integration_hours: s.effort?.integrationHours || 0,
          testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
          unit_testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
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
          project_summary: {
            ...estimateData.projectSummary,
            estimate_label: estimateLabel.trim() || undefined,
            scope: workScope,
            includeDbDesign,
            includeUnitTesting,
            unitTestIntensity,
            includeDeployment,
            deploymentHours: activeDeploymentHours,
            rates: {
              base: hourlyRate,
              frontend: frontendRate,
              backend: backendRate,
              dbDesign: dbDesignRate,
              unitTesting: unitTestingRate,
              deployment: deploymentRate,
              effectiveRate: effectiveHourlyRate,
            },
          },
        },
        storyEstimates.map(s => ({
          id: "",
          remuneration_estimate_id: "",
          epic_id: s.epicId,
          story_id: s.storyId,
          story_title: s.title || "Story",
          epic_name: s.epicName || "Epic",
          complexity: s.complexity,
          ai_estimated_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
          final_hours: s.final_hours,
          frontend_hours: workScope === "backend" ? 0 : (s.effort?.frontendHours || 0),
          backend_hours: workScope === "frontend" ? 0 : (s.effort?.backendHours || 0),
          database_hours: (includeDbDesign && workScope !== "frontend") ? (s.effort?.databaseHours || 0) : 0,
          integration_hours: s.effort?.integrationHours || 0,
          testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
          unit_testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
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

  // Helper to open quotation from Sent Quotations tab into editor and switch to calculator
  const handleOpenInCalculator = async (estId: string) => {
    await handleLoadSavedEstimate(estId);
    handleSwitchView("calculator");
  };

  // Filter and statistics for Sent Quotations
  const countAll = savedEstimates.length;
  const countPublished = savedEstimates.filter((e) => (e.project_summary?.publishing?.status || "draft") === "published").length;
  const countNegotiating = savedEstimates.filter((e) => (e.project_summary?.publishing?.status || "draft") === "negotiating").length;
  const countApproved = savedEstimates.filter((e) => (e.project_summary?.publishing?.status || "draft") === "approved").length;
  const countRecalled = savedEstimates.filter((e) => (e.project_summary?.publishing?.status || "draft") === "recalled").length;
  const countDraft = savedEstimates.filter((e) => {
    const st = e.project_summary?.publishing?.status || "draft";
    return st === "draft" || st === "pending";
  }).length;

  const filteredEstimates = savedEstimates.filter((est) => {
    const summary = est.project_summary || {};
    const pub = summary.publishing || {};
    const pubStatus = pub.status || "draft";
    const proj = projects.find((p) => p.id === est.project_id);
    const projName = proj?.name || "";
    const label = summary.estimate_label || pub.estimate_label || "";
    const recipients = getEstimateRecipients(est, clientsList);
    const recipientText = recipients.map((r) => `${r.name} ${r.email}`).join(" ");

    // Status filter
    if (quotationFilter === "published" && pubStatus !== "published") return false;
    if (quotationFilter === "negotiating" && pubStatus !== "negotiating") return false;
    if (quotationFilter === "approved" && pubStatus !== "approved") return false;
    if (quotationFilter === "recalled" && pubStatus !== "recalled") return false;
    if (quotationFilter === "draft" && pubStatus !== "draft" && pubStatus !== "pending") return false;

    // Search query
    if (quotationSearch.trim()) {
      const q = quotationSearch.toLowerCase().trim();
      const matchProject = projName.toLowerCase().includes(q);
      const matchLabel = label.toLowerCase().includes(q);
      const matchRecipient = recipientText.toLowerCase().includes(q);
      const matchNote = (pub.publish_note || "").toLowerCase().includes(q);
      const matchReason = (pub.recall_reason || "").toLowerCase().includes(q);
      return matchProject || matchLabel || matchRecipient || matchNote || matchReason;
    }

    return true;
  });

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
      {currentView === "quotations" ? (
        /* ==========================================================
           SENT QUOTATIONS & PROPOSALS HUB
           ========================================================== */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Filter & Search Header Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by project, phase label, or client email..."
                  value={quotationSearch}
                  onChange={(e) => setQuotationSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 pl-9 pr-8 py-2 text-xs sm:text-sm text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20"
                />
                {quotationSearch && (
                  <button
                    type="button"
                    onClick={() => setQuotationSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Action: Create New Quotation */}
              <Button
                variant="primary"
                onClick={() => handleSwitchView("calculator")}
                className="flex items-center gap-1.5 text-xs py-2 px-3.5 shrink-0"
              >
                <Calculator className="w-3.5 h-3.5" />
                New Estimate in Calculator
              </Button>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100">
              <span className="text-xs font-semibold text-zinc-500 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#B8944E]" />
                Filter:
              </span>
              {[
                { id: "all", label: "All", count: countAll },
                { id: "published", label: "Published", count: countPublished },
                { id: "negotiating", label: "Under Discussion", count: countNegotiating },
                { id: "approved", label: "Approved", count: countApproved },
                { id: "recalled", label: "Recalled", count: countRecalled },
                { id: "draft", label: "Drafts", count: countDraft },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setQuotationFilter(pill.id as any)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    quotationFilter === pill.id
                      ? "bg-[#111827] text-white shadow-xs"
                      : "bg-zinc-100/80 hover:bg-zinc-100 text-zinc-600 border border-zinc-200/60"
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      quotationFilter === pill.id
                        ? "bg-white/20 text-white"
                        : "bg-white text-zinc-500 border border-zinc-200"
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quotations List */}
          {isLoadingSavedEstimate && (
            <div className="p-3 bg-[#B8944E]/10 border border-[#B8944E]/20 rounded-xl text-center text-xs font-semibold text-[#80642F] animate-pulse">
              Loading quotation into editor...
            </div>
          )}

          {filteredEstimates.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.20)] text-[#80642F] flex items-center justify-center mx-auto">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900">
                {savedEstimates.length === 0 ? "No Sent Quotations Yet" : "No Matching Quotations Found"}
              </h3>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                {savedEstimates.length === 0
                  ? "Create and publish your first project estimation using the Remuneration Calculator."
                  : "Try clearing your search query or selecting another filter pill above."}
              </p>
              <div className="pt-2">
                {savedEstimates.length === 0 ? (
                  <Button
                    variant="primary"
                    onClick={() => handleSwitchView("calculator")}
                    className="text-xs"
                  >
                    Go to Remuneration Calculator →
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuotationSearch("");
                      setQuotationFilter("all");
                    }}
                    className="text-xs"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEstimates.map((est) => {
                const proj = projects.find((p) => p.id === est.project_id);
                const summary = est.project_summary || {};
                const estScope = summary.scope;
                const pub = summary.publishing || {};
                const pubStatus = pub.status || "draft";
                const discussionCount = Object.values(pub.discussions || {}).reduce(
                  (acc: number, t: any) => acc + (t.messages?.length || 0),
                  0
                );
                const isSelected = est.id === currentEstimateId;
                const recipients = getEstimateRecipients(est, clientsList);
                const label = summary.estimate_label || pub.estimate_label;

                const estFormatter = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: est.currency || "INR",
                  maximumFractionDigits: 0,
                });

                return (
                  <div
                    key={est.id}
                    className={`rounded-2xl border bg-white p-5 sm:p-6 transition-all duration-200 shadow-sm hover:shadow-md ${
                      isSelected
                        ? "border-[#B8944E] ring-2 ring-[#B8944E]/20"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* Top Row: Title, Phase, Badges & Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {proj?.name || "Unknown Project"}
                        </h3>
                        {label && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            <Tag className="w-3 h-3 text-amber-600" />
                            {label}
                          </span>
                        )}
                        {estScope && (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-[#B8944E]/10 text-[#80642F]">
                            {estScope === "frontend" ? "Frontend" : estScope === "backend" ? "Backend" : "Full Stack"}
                          </span>
                        )}
                        {summary.includeDbDesign && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                            DB
                          </span>
                        )}
                        {summary.includeUnitTesting && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                            Tests
                          </span>
                        )}
                        {summary.includeDeployment && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            DevOps
                          </span>
                        )}
                      </div>

                      {/* Status & Date */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-zinc-400">
                          {pub.published_at
                            ? `Published ${new Date(pub.published_at).toLocaleDateString()}`
                            : `Created ${new Date(est.created_at).toLocaleDateString()}`}
                        </span>

                        {pubStatus === "approved" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                          </span>
                        )}
                        {pubStatus === "negotiating" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Discussion Active
                          </span>
                        )}
                        {pubStatus === "published" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Users className="w-3.5 h-3.5" />
                            Published
                          </span>
                        )}
                        {pubStatus === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" />
                            Declined
                          </span>
                        )}
                        {pubStatus === "recalled" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-600 border border-zinc-300">
                            <Undo2 className="w-3.5 h-3.5" />
                            Recalled
                          </span>
                        )}
                        {(pubStatus === "draft" || pubStatus === "pending") && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200">
                            <Clock className="w-3.5 h-3.5" />
                            Draft
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Financial Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-b border-zinc-100">
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Proposal Fee
                        </span>
                        <p className="text-lg font-extrabold text-[#80642F] mt-0.5">
                          {estFormatter.format(est.final_amount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Total Effort
                        </span>
                        <p className="text-base font-bold text-zinc-800 mt-0.5">
                          {est.final_total_hours} hrs
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Hourly Rate
                        </span>
                        <p className="text-base font-bold text-zinc-800 mt-0.5">
                          {est.currency} {est.hourly_rate}/h
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Contingency
                        </span>
                        <p className="text-base font-bold text-zinc-800 mt-0.5">
                          {est.contingency_percentage}%
                        </p>
                      </div>
                    </div>

                    {/* Recipients & Notes */}
                    <div className="py-3 space-y-2">
                      {recipients.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-[#B8944E]" />
                            {pubStatus === "recalled" ? "Previously Sent to:" : "Sent to:"}
                          </span>
                          {recipients.map((rec, i) => (
                            <span
                              key={rec.id || i}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B8944E]/[0.08] border border-[#B8944E]/25 text-xs text-zinc-800"
                            >
                              <span className="font-semibold text-zinc-900">{rec.name}</span>
                              {rec.email ? (
                                <span className="text-zinc-600 font-medium text-[11px]">({rec.email})</span>
                              ) : (
                                <span className="text-zinc-400 italic text-[11px]">(no email recorded)</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {pub.publish_note && (
                        <div className="text-xs text-zinc-600 bg-zinc-50 rounded-lg p-2.5 border border-zinc-100">
                          <span className="font-semibold text-zinc-700">Note to Client: </span>
                          "{pub.publish_note}"
                        </div>
                      )}

                      {pub.recall_reason && (
                        <div className="text-xs text-rose-700 bg-rose-50/70 rounded-lg p-2.5 border border-rose-200/60">
                          <span className="font-semibold text-rose-800">Recall Reason: </span>
                          "{pub.recall_reason}"
                        </div>
                      )}

                      {/* Discussion Thread Alert */}
                      {discussionCount > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-purple-50 border border-purple-200">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-purple-600 shrink-0" />
                            <span className="text-xs font-semibold text-purple-900">
                              Client Bargaining Discussion: {discussionCount} {discussionCount === 1 ? "comment" : "comments"} posted by client.
                            </span>
                          </div>
                          {(() => {
                            const firstSection = Object.keys(pub.discussions || {})[0] || "project_summary";
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setCurrentEstimateId(est.id);
                                  setCurrentPublishing(pub);
                                  setActiveDiscussion({
                                    sectionKey: firstSection,
                                    sectionTitle: "Client Negotiation & Discussion",
                                  });
                                }}
                                className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100/70 hover:bg-purple-100 px-3 py-1 rounded-lg transition"
                              >
                                Open Discussion Drawer →
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="primary"
                          onClick={() => handleOpenInCalculator(est.id)}
                          className="flex items-center gap-1.5 text-xs py-1.5 px-3"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          Open in Calculator
                        </Button>

                        {(pubStatus === "published" || pubStatus === "negotiating") && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setCurrentEstimateId(est.id);
                                setCurrentPublishing(pub);
                                setSelectedProjectId(est.project_id);
                                setIsPublishModalOpen(true);
                              }}
                              className="flex items-center gap-1.5 text-xs py-1.5 px-3 border-[#B8944E]/40 text-[#80642F] hover:bg-[#B8944E]/10 font-semibold"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Manage Client Access
                            </Button>

                            <Button
                              variant="outline"
                              onClick={() => {
                                setCurrentEstimateId(est.id);
                                setCurrentPublishing(pub);
                                setSelectedProjectId(est.project_id);
                                setIsRecallModalOpen(true);
                              }}
                              className="flex items-center gap-1.5 text-xs py-1.5 px-3 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 font-semibold"
                            >
                              <Undo2 className="w-3.5 h-3.5 text-rose-600" />
                              Recall Quotation
                            </Button>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await handleLoadSavedEstimate(est.id);
                            handleExportPDF();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition"
                          title="Download PDF Quotation"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleLoadSavedEstimate(est.id);
                            handleExportExcel();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition"
                          title="Download Excel Sheet"
                        >
                          Excel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ==========================================================
           CALCULATOR VIEW
           ========================================================== */
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-6">
            {/* Top: Project, Base Rate, Currency */}
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
            <label className="text-xs font-semibold text-zinc-700">
              {customRatesEnabled ? "Base Rate" : "Hourly Rate"}
            </label>
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => handleBaseRateChange(parseFloat(e.target.value) || 0)}
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
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>
        </div>

        {/* Milestone / Phase Label */}
        <div className="pt-2 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#B8944E]" />
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Milestone / Phase Label
              </label>
              <span className="text-[10px] font-normal text-zinc-400">(Optional)</span>
            </div>
            <p className="text-xs text-zinc-500">
              Identify this estimate (e.g. Phase 1, Phase 2, MVP) for exports and client emails.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] max-w-xs">
              <input
                type="text"
                placeholder="e.g. Phase 1, MVP, Phase 2..."
                value={estimateLabel}
                onChange={(e) => setEstimateLabel(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20"
              />
              {estimateLabel && (
                <button
                  type="button"
                  onClick={() => setEstimateLabel("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs font-bold"
                  title="Clear label"
                >
                  ×
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2 sm:mt-0">
              {["Phase 1", "Phase 2", "Phase 3", "MVP", "Milestone 1"].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setEstimateLabel(chip)}
                  className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
                    estimateLabel === chip
                      ? "border-[#B8944E] bg-[#B8944E]/10 text-[#8c6b2d] font-semibold"
                      : "border-zinc-200 hover:border-zinc-300 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Custom AI Instructions */}
        <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-0.5 sm:max-w-[240px]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#B8944E]" />
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Custom AI Instructions
              </label>
              <span className="text-[10px] font-normal text-zinc-400">(Optional)</span>
            </div>
            <p className="text-xs text-zinc-500">
              Add specific instructions for the AI estimator (e.g. "Assume complex integrations", "Keep tests minimal").
            </p>
          </div>
          <div className="flex-1 w-full sm:max-w-md xl:max-w-lg">
            <textarea
              placeholder="Enter custom instructions to inject into the AI prompt..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-xs sm:text-sm text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20 min-h-[64px] resize-y"
            />
          </div>
        </div>

        {/* Work Scope Selector */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
              Work Scope
            </label>
            <span className="text-xs text-zinc-400">
              Choose the implementation domain for this engagement
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Frontend Only */}
            <button
              type="button"
              onClick={() => handleScopeChange("frontend")}
              className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                workScope === "frontend"
                  ? "border-[#B8944E] bg-[#B8944E]/[0.06] ring-1 ring-[#B8944E] shadow-sm"
                  : "border-zinc-200 hover:border-zinc-300 bg-white"
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  workScope === "frontend"
                    ? "bg-[#B8944E] text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Code2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">Frontend Only</p>
                  {workScope === "frontend" && (
                    <span className="h-2 w-2 rounded-full bg-[#B8944E]" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  UI, client state, interaction, responsiveness
                </p>
              </div>
            </button>

            {/* Backend Only */}
            <button
              type="button"
              onClick={() => handleScopeChange("backend")}
              className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                workScope === "backend"
                  ? "border-[#B8944E] bg-[#B8944E]/[0.06] ring-1 ring-[#B8944E] shadow-sm"
                  : "border-zinc-200 hover:border-zinc-300 bg-white"
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  workScope === "backend"
                    ? "bg-[#B8944E] text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">Backend Only</p>
                  {workScope === "backend" && (
                    <span className="h-2 w-2 rounded-full bg-[#B8944E]" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  APIs, business logic, authentication & services
                </p>
              </div>
            </button>

            {/* Full Stack (Both) */}
            <button
              type="button"
              onClick={() => handleScopeChange("both")}
              className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                workScope === "both"
                  ? "border-[#B8944E] bg-[#B8944E]/[0.06] ring-1 ring-[#B8944E] shadow-sm"
                  : "border-zinc-200 hover:border-zinc-300 bg-white"
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  workScope === "both"
                    ? "bg-[#B8944E] text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-900">Full Stack (Both)</p>
                  {workScope === "both" && (
                    <span className="h-2 w-2 rounded-full bg-[#B8944E]" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  End-to-end client UI and backend services
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Additional Architecture & Services: DB Design, Unit Testing, and Deployment */}
        <div className="space-y-2 pt-2 border-t border-zinc-100">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
            Architecture & Add-on Services
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Database Design */}
            <div
              onClick={() => handleDbDesignToggle(!includeDbDesign)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                includeDbDesign
                  ? "border-[#B8944E] bg-[#B8944E]/[0.04] ring-1 ring-[#B8944E]/40"
                  : "border-zinc-200 bg-white hover:border-zinc-300 opacity-80"
              }`}
            >
              <input
                type="checkbox"
                checked={includeDbDesign}
                onChange={(e) => handleDbDesignToggle(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-[#B8944E]" />
                  <p className="text-sm font-semibold text-zinc-900">Database Design</p>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  Schema modeling, migrations & index optimization
                </p>
              </div>
            </div>

            {/* Unit Testing */}
            <div
              onClick={() => handleUnitTestingToggle(!includeUnitTesting)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                includeUnitTesting
                  ? "border-[#B8944E] bg-[#B8944E]/[0.04] ring-1 ring-[#B8944E]/40"
                  : "border-zinc-200 bg-white hover:border-zinc-300 opacity-80"
              }`}
            >
              <input
                type="checkbox"
                checked={includeUnitTesting}
                onChange={(e) => handleUnitTestingToggle(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TestTubes className="w-4 h-4 text-[#B8944E]" />
                    <p className="text-sm font-semibold text-zinc-900">Unit Testing</p>
                  </div>
                  {includeUnitTesting && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={unitTestIntensity}
                        onChange={(e) => handleUnitTestIntensityChange(e.target.value as UnitTestIntensity)}
                        className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold text-zinc-800 focus:border-[#B8944E] focus:outline-none cursor-pointer"
                        title="Select test coverage intensity (Lean is recommended for realistic minimum hours)"
                      >
                        <option value="lean">Lean (12%)</option>
                        <option value="standard">Standard (18%)</option>
                        <option value="comprehensive">Full (25%)</option>
                      </select>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  {unitTestIntensity === "lean"
                    ? "Lean: essential happy paths & validations (0.5h–1.5h/story)"
                    : unitTestIntensity === "standard"
                    ? "Standard: core logic & boundary test cases"
                    : "Full: comprehensive test suites & edge cases"}
                </p>
              </div>
            </div>

            {/* Deployment & DevOps */}
            <div
              onClick={() => setIncludeDeployment(!includeDeployment)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                includeDeployment
                  ? "border-[#B8944E] bg-[#B8944E]/[0.04] ring-1 ring-[#B8944E]/40"
                  : "border-zinc-200 bg-white hover:border-zinc-300 opacity-80"
              }`}
            >
              <input
                type="checkbox"
                checked={includeDeployment}
                onChange={(e) => setIncludeDeployment(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-[#B8944E]" />
                    <p className="text-sm font-semibold text-zinc-900">Deployment & DevOps</p>
                  </div>
                  {includeDeployment && (
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={deploymentHours}
                        onChange={(e) => setDeploymentHours(parseFloat(e.target.value) || 0)}
                        className="w-14 rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-right font-semibold text-zinc-900 focus:border-[#B8944E]"
                      />
                      <span className="text-[11px] text-zinc-500 font-medium">hrs</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  Cloud provisioning, CI/CD pipeline & domain/SSL rollout
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Dependency / Customized Discipline Rates */}
        <div className="pt-2 border-t border-zinc-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="customRates"
                checked={customRatesEnabled}
                onChange={(e) => handleCustomRatesToggle(e.target.checked)}
                className="rounded border-zinc-300 text-[#B8944E] focus:ring-[#B8944E]"
              />
              <label htmlFor="customRates" className="text-xs font-semibold text-zinc-700 cursor-pointer flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#B8944E]" />
                Customize hourly rates per discipline
              </label>
            </div>

            {customRatesEnabled && (
              <span className="text-xs font-medium text-[#80642F] bg-[#B8944E]/10 px-2.5 py-0.5 rounded-full">
                Blended Effective Rate: {formatter.format(effectiveHourlyRate)}/hr
              </span>
            )}
          </div>

          {customRatesEnabled && (
            <div className="mt-3 p-4 bg-zinc-50/80 rounded-xl border border-zinc-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 animate-in fade-in duration-200">
              {/* Frontend Rate */}
              {workScope !== "backend" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-[#B8944E]" />
                    Frontend Rate ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={frontendRate}
                    onChange={(e) => setFrontendRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-semibold focus:border-[#B8944E]"
                  />
                </div>
              )}

              {/* Backend Rate */}
              {workScope !== "frontend" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <Server className="w-3 h-3 text-[#B8944E]" />
                    Backend Rate ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={backendRate}
                    onChange={(e) => setBackendRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-semibold focus:border-[#B8944E]"
                  />
                </div>
              )}

              {/* DB Design Rate */}
              {includeDbDesign && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <Database className="w-3 h-3 text-[#B8944E]" />
                    DB Design Rate ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={dbDesignRate}
                    onChange={(e) => setDbDesignRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-semibold focus:border-[#B8944E]"
                  />
                </div>
              )}

              {/* Unit Testing Rate */}
              {includeUnitTesting && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <TestTubes className="w-3 h-3 text-[#B8944E]" />
                    Unit Testing Rate ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={unitTestingRate}
                    onChange={(e) => setUnitTestingRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-semibold focus:border-[#B8944E]"
                  />
                </div>
              )}

              {/* Deployment Rate */}
              {includeDeployment && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-600 flex items-center gap-1">
                    <Rocket className="w-3 h-3 text-[#B8944E]" />
                    Deployment Rate ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deploymentRate}
                    onChange={(e) => setDeploymentRate(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-900 font-semibold focus:border-[#B8944E]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar: Contingency & Analyze Button */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100">
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
                className="w-16 rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-900 ml-2 font-semibold"
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
          <div className="rounded-2xl border border-[rgba(184,148,78,0.25)] bg-gradient-to-br from-[#FCFBFC] to-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Project Remuneration Summary</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Effort and rate calculation based on your selected technical scope and add-ons.
                </p>
              </div>

              {/* Scope & Services Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {estimateLabel && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                    <Tag className="w-3 h-3 text-amber-600" />
                    {estimateLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#B8944E]/10 text-[#80642F] border border-[#B8944E]/30">
                  {workScope === "frontend" && <Code2 className="w-3.5 h-3.5" />}
                  {workScope === "backend" && <Server className="w-3.5 h-3.5" />}
                  {workScope === "both" && <Layers className="w-3.5 h-3.5" />}
                  {workScope === "frontend" ? "Frontend Only" : workScope === "backend" ? "Backend Only" : "Full Stack (Both)"}
                </span>

                {includeDbDesign && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <Database className="w-3 h-3" />
                    DB Design
                  </span>
                )}

                {includeUnitTesting && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    <TestTubes className="w-3 h-3" />
                    Unit Testing ({unitTestIntensity === "lean" ? "Lean" : unitTestIntensity === "standard" ? "Standard" : "Full"})
                  </span>
                )}

                {includeDeployment && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Rocket className="w-3 h-3" />
                    DevOps ({activeDeploymentHours}h)
                  </span>
                )}

                {/* Publishing Status Badges */}
                {(() => {
                  const activeRecipients = getEstimateRecipients(
                    { project_summary: { publishing: currentPublishing } },
                    clientsList
                  );

                  return (
                    <>
                      {currentPublishing?.status === "approved" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Quotation Approved {activeRecipients.length > 0 ? `by ${activeRecipients[0].name}` : "by Client"}
                        </span>
                      )}
                      {currentPublishing?.status === "negotiating" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                          Discussion Active
                          {activeRecipients.length > 0 && (
                            <span className="font-medium text-amber-900 ml-1">
                              with {activeRecipients.map((r, i) => (
                                <span key={r.id || i}>
                                  <strong>{r.name}</strong>
                                  {r.email ? ` (${r.email})` : ""}
                                  {i < activeRecipients.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                      {currentPublishing?.status === "published" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          Published to:{" "}
                          {activeRecipients.length > 0 ? (
                            <span className="font-semibold text-blue-950">
                              {activeRecipients.map((r, i) => (
                                <span key={r.id || i}>
                                  {r.name}
                                  {r.email && <span className="font-normal text-blue-700"> ({r.email})</span>}
                                  {i < activeRecipients.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span>{currentPublishing.published_to_client_ids?.length || 1} Client(s)</span>
                          )}
                        </span>
                      )}
                      {currentPublishing?.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Quotation Declined
                        </span>
                      )}
                      {currentPublishing?.status === "recalled" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-300">
                          <Undo2 className="w-3.5 h-3.5 text-zinc-500" />
                          Quotation Recalled (Draft)
                          {activeRecipients.length > 0 && (
                            <span className="font-normal text-zinc-600 ml-1">
                              — Previously sent to:{" "}
                              <strong className="text-zinc-800">
                                {activeRecipients.map((r, i) => (
                                  <span key={r.id || i}>
                                    {r.name}
                                    {r.email && <span className="font-normal text-zinc-500"> ({r.email})</span>}
                                    {i < activeRecipients.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </strong>
                            </span>
                          )}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">In-Scope Stories</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{storyEstimates.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Effort</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {finalTotalHours}h <span className="text-xs font-normal text-slate-500">(Base: {aiTotalHours}h)</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  FE: {totalFrontendHours}h • BE: {totalBackendHours}h{includeDbDesign ? ` • DB: ${totalDbHours}h` : ""}{includeUnitTesting ? ` • Tests: ${totalUnitTestingHours}h` : ""}{includeDeployment ? ` • Deploy: ${activeDeploymentHours}h` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Effective Rate</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatter.format(effectiveHourlyRate)}/h</p>
                {customRatesEnabled && (
                  <p className="text-[11px] text-[#80642F] mt-0.5">Discipline-weighted</p>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Base Remuneration</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{formatter.format(baseAmount)}</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[rgba(184,148,78,0.06)] rounded-xl border border-[rgba(184,148,78,0.18)]">
              <div>
                <p className="text-sm font-semibold text-[#80642F]">Contingency Buffer ({contingencyPercentage}%)</p>
                <p className="text-lg font-bold text-[#80642F]">{formatter.format(contingencyAmount)}</p>
              </div>
              <div className="mt-4 md:mt-0 text-left md:text-right">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Final Expected Remuneration</p>
                <p className="text-3xl font-black text-slate-900 mt-0.5">{formatter.format(finalAmount)}</p>
              </div>
            </div>

            {/* Overall Package Discussion Trigger */}
            <div className="mt-3 pt-3 border-t border-[rgba(184,148,78,0.18)] flex items-center justify-between">
              <p className="text-xs text-zinc-500">
                {currentPublishing?.status ? `Publication Status: ${currentPublishing.status.toUpperCase()}` : "Quotation not yet published to client."}
              </p>
              <button
                type="button"
                onClick={() =>
                  setActiveDiscussion({
                    sectionKey: "summary",
                    sectionTitle: "Overall Package & Commercial Terms",
                  })
                }
                className="text-xs font-semibold text-[#80642F] hover:underline flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#B8944E]" />
                Discuss Commercial Terms
                {Number(currentPublishing?.discussions?.["summary"]?.messages?.length || 0) > 0 && (
                  <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {currentPublishing?.discussions?.["summary"]?.messages?.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Overview */}
          {estimateData.projectSummary?.summary && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm text-sm">
              <h3 className="font-bold text-slate-900 mb-2">Estimation Overview</h3>
              <p className="text-slate-600 leading-relaxed">{estimateData.projectSummary.summary}</p>
            </div>
          )}

          {/* Deliverables Breakdown */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">Scope Deliverables & Stories Breakdown</h3>
                <p className="text-xs text-slate-500">
                  Hours reflect {workScope === "frontend" ? "Frontend UI & client tests only" : workScope === "backend" ? "Backend APIs & server tests only" : "Full Stack implementation"}
                  {includeDbDesign ? " + Database Design" : ""}
                </p>
              </div>
              <p className="text-xs text-slate-500 italic">Adjust Final Hours below if needed</p>
            </div>

            {/* Deployment & DevOps Row if enabled */}
            {includeDeployment && (
              <div className="p-4 sm:p-6 bg-emerald-50/30 border-b border-emerald-100 hover:bg-emerald-50/50 transition">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wider border border-emerald-200">
                        <Rocket className="w-3 h-3" />
                        Infrastructure & DevOps
                      </span>
                      <span className="text-xs font-semibold text-slate-400">Add-on Service</span>
                    </div>
                    <h4 className="font-semibold text-slate-900">Cloud Provisioning, CI/CD Pipeline & Deployment</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Production hosting setup, CI/CD automated pipeline, environment configuration, secrets, SSL & domain certification, release verification.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Rate</span>
                      <span className="font-medium text-xs text-slate-700">{formatter.format(activeDeploymentRate)}/h</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 font-semibold">Final Hours</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={deploymentHours}
                        onChange={(e) => setDeploymentHours(parseFloat(e.target.value) || 0)}
                        className="w-20 rounded border border-zinc-300 px-2 py-1 text-right focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/20 font-bold"
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-emerald-200/60">
                      <span className="text-slate-500 font-medium">Deliverable Cost</span>
                      <span className="font-bold text-slate-900">{formatter.format(deploymentAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Story List */}
            <div className="divide-y divide-zinc-100">
              {storyEstimates.map((story, idx) => {
                const storyCost = computeStoryCost(story, workScope, includeDbDesign, includeUnitTesting, customRatesEnabled, currentRates, unitTestIntensity);
                const aiScoped = computeStoryScopedHours(story.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity);

                return (
                  <div key={idx} className="p-4 sm:p-6 hover:bg-zinc-50/50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider border border-slate-200">
                            {story.complexity}
                          </span>
                          {story.confidence?.toLowerCase() === "low" && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              ⚠ Low Confidence
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-400">ID: {story.storyId.slice(0,8)}</span>

                          {/* Hours Breakdown tags */}
                          <div className="flex items-center gap-1.5 ml-auto sm:ml-0 text-[11px] text-zinc-500">
                            {workScope !== "backend" && (
                              <span className="inline-flex items-center gap-1 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] border border-zinc-200">
                                <span className="font-semibold">FE:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={story.effort?.frontendHours || 0}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateStoryEffort(idx, "frontendHours", val === "" ? 0 : parseFloat(val) || 0);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 h-5 rounded border border-zinc-300 bg-white px-1 text-center font-bold text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/40 focus:outline-none transition"
                                />
                                <span>h</span>
                              </span>
                            )}
                            {workScope !== "frontend" && (
                              <span className="inline-flex items-center gap-1 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] border border-zinc-200">
                                <span className="font-semibold">BE:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={story.effort?.backendHours || 0}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateStoryEffort(idx, "backendHours", val === "" ? 0 : parseFloat(val) || 0);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 h-5 rounded border border-zinc-300 bg-white px-1 text-center font-bold text-zinc-900 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/40 focus:outline-none transition"
                                />
                                <span>h</span>
                              </span>
                            )}
                            {includeDbDesign && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] border border-blue-200">
                                <span className="font-semibold">DB:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={story.effort?.databaseHours || 0}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateStoryEffort(idx, "databaseHours", val === "" ? 0 : parseFloat(val) || 0);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-12 h-5 rounded border border-blue-200 bg-white px-1 text-center font-bold text-blue-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-300 focus:outline-none transition"
                                />
                                <span>h</span>
                              </span>
                            )}
                            {includeUnitTesting && (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-purple-200 shadow-2xs">
                                <TestTubes className="w-3 h-3 text-purple-600 shrink-0" />
                                <span>Tests:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={getCalibratedUnitTestHours(story.effort, unitTestIntensity)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateStoryTestHours(idx, val === "" ? 0 : parseFloat(val) || 0);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-13 h-5 rounded border border-purple-300 bg-white px-1 text-center font-bold text-purple-900 focus:border-purple-600 focus:ring-1 focus:ring-purple-400 focus:outline-none text-[11px] transition"
                                  title="Edit test hours for this story (estimation amount updates instantly)"
                                />
                                <span className="text-purple-600 font-normal">h</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-0.5">
                          <a
                            href={`/project/${selectedProjectId}?story=${story.storyId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/story inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-[#80642F] transition-colors"
                            title="Click to open and inspect this story in Project Workspace"
                          >
                            <span className="group-hover/story:underline underline-offset-2">
                              {story.title || projectStoriesMap[story.storyId]?.title || `Story ${story.storyId.slice(0, 8)}`}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/story:text-[#80642F] transition-colors shrink-0" />
                          </a>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{story.reasoning}</p>

                        <div className="mt-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveDiscussion({
                                sectionKey: `story_${story.storyId}`,
                                sectionTitle: story.title || projectStoriesMap[story.storyId]?.title || `Story ${story.storyId.slice(0, 8)}`,
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#80642F] hover:text-[#5e4922] bg-[#B8944E]/[0.08] hover:bg-[#B8944E]/[0.15] px-2.5 py-1 rounded-lg border border-[#B8944E]/20 transition"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Client Discussions
                            {Number(currentPublishing?.discussions?.[`story_${story.storyId}`]?.messages?.length || 0) > 0 && (
                              <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white">
                                {currentPublishing?.discussions?.[`story_${story.storyId}`]?.messages?.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Estimated</span>
                          <span className="font-medium text-slate-700">{aiScoped} h</span>
                        </div>

                        {includeUnitTesting && (
                          <div className="flex items-center justify-between text-xs py-0.5">
                            <span className="text-purple-700 font-semibold flex items-center gap-1">
                              <TestTubes className="w-3.5 h-3.5 text-purple-600" />
                              Test Hours
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={getCalibratedUnitTestHours(story.effort, unitTestIntensity)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  handleUpdateStoryTestHours(idx, val === "" ? 0 : parseFloat(val) || 0);
                                }}
                                className="w-16 rounded border border-purple-200 bg-purple-50/60 px-2 py-0.5 text-right font-bold text-purple-900 focus:border-purple-500 focus:bg-white focus:ring-1 focus:ring-purple-300 text-xs"
                                title="Adjust test hours for this story"
                              />
                              <span className="text-purple-600 font-semibold text-[11px]">h</span>
                            </div>
                          </div>
                        )}

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
                          <span className="font-semibold text-slate-900">{formatter.format(storyCost)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-200">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPublishModalOpen(true)}
                className="flex items-center gap-1.5 border-[#B8944E]/40 text-[#80642F] hover:bg-[#B8944E]/10 font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                {currentPublishing?.status === "published" || currentPublishing?.status === "negotiating" || currentPublishing?.status === "approved"
                  ? "Manage Client Access"
                  : "Publish to Client"}
              </Button>

              {(currentPublishing?.status === "published" || currentPublishing?.status === "negotiating") && (
                <Button
                  variant="outline"
                  onClick={() => setIsRecallModalOpen(true)}
                  className="flex items-center gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 font-semibold text-xs py-2 px-3"
                  title="Revoke client access immediately and notify clients"
                >
                  <Undo2 className="w-3.5 h-3.5 text-rose-600" />
                  Recall Quotation
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
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
        </div>
      )}

          {/* Quick link to Sent Quotations tab */}
          {savedEstimates.length > 0 && (
            <div className="rounded-2xl border border-[rgba(184,148,78,0.25)] bg-gradient-to-r from-[#FCFBFC] via-white to-[#FCFBFC] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#B8944E]/10 border border-[#B8944E]/20 flex items-center justify-center text-[#80642F] shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-zinc-900">
                    {savedEstimates.length} Saved & Sent {savedEstimates.length === 1 ? "Quotation" : "Quotations"} Available
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Track client status, responses, recipient emails, and negotiation threads in the dedicated Sent Quotations tab.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => handleSwitchView("quotations")}
                className="text-xs font-semibold text-[#80642F] border-[#B8944E]/40 hover:bg-[#B8944E]/10 shrink-0"
              >
                View Sent Quotations Tab →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <PublishEstimateModal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          projectId={selectedProjectId}
          projectName={selectedProjectObj?.name || "Project"}
          estimateId={currentEstimateId || undefined}
          initialEstimateLabel={estimateLabel}
          estimateData={{
            hourly_rate: effectiveHourlyRate,
            currency,
            contingency_percentage: contingencyPercentage,
            ai_total_hours: aiTotalHours,
            final_total_hours: finalTotalHours,
            base_amount: baseAmount,
            contingency_amount: contingencyAmount,
            final_amount: finalAmount,
            project_summary: {
              ...estimateData?.projectSummary,
              estimate_label: estimateLabel.trim() || undefined,
              scope: workScope,
              includeDbDesign,
              includeUnitTesting,
              unitTestIntensity,
              includeDeployment,
              deploymentHours: activeDeploymentHours,
              rates: {
                base: hourlyRate,
                frontend: frontendRate,
                backend: backendRate,
                dbDesign: dbDesignRate,
                unitTesting: unitTestingRate,
                deployment: deploymentRate,
                effectiveRate: effectiveHourlyRate,
              },
              publishing: currentPublishing || undefined,
            },
          }}
          storyEstimates={storyEstimates.map(s => ({
            epic_id: s.epicId,
            story_id: s.storyId,
            story_title: s.title || "Story",
            epic_name: s.epicName || "Epic",
            complexity: s.complexity,
            ai_estimated_hours: computeStoryScopedHours(s.effort, workScope, includeDbDesign, includeUnitTesting, unitTestIntensity),
            final_hours: s.final_hours,
            frontend_hours: workScope === "backend" ? 0 : (s.effort?.frontendHours || 0),
            backend_hours: workScope === "frontend" ? 0 : (s.effort?.backendHours || 0),
            database_hours: (includeDbDesign && workScope !== "frontend") ? (s.effort?.databaseHours || 0) : 0,
            integration_hours: s.effort?.integrationHours || 0,
            testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
            unit_testing_hours: includeUnitTesting ? getCalibratedUnitTestHours(s.effort, unitTestIntensity) : 0,
            confidence: s.confidence,
            reasoning: s.reasoning,
            assumptions: s.assumptions || [],
            risks: s.risks || [],
          }))}
          currentPublishing={currentPublishing || undefined}
          onPublished={handlePublishedSuccess}
          onRecallClick={() => setIsRecallModalOpen(true)}
        />
      )}

      {/* Recall Modal */}
      {isRecallModalOpen && currentEstimateId && (
        <RecallEstimateModal
          isOpen={isRecallModalOpen}
          onClose={() => setIsRecallModalOpen(false)}
          estimateId={currentEstimateId}
          projectName={selectedProjectObj?.name || "Project"}
          currentPublishing={currentPublishing || undefined}
          onRecalled={handleRecalledSuccess}
        />
      )}

      {/* Discussion Drawer */}
      {activeDiscussion && (
        <SectionDiscussionDrawer
          isOpen={true}
          onClose={() => setActiveDiscussion(null)}
          estimateId={currentEstimateId || ""}
          sectionKey={activeDiscussion.sectionKey}
          sectionTitle={activeDiscussion.sectionTitle}
          initialThread={currentPublishing?.discussions?.[activeDiscussion.sectionKey]}
          currency={currency}
          isClientViewer={false}
          onThreadUpdated={handleThreadUpdated}
        />
      )}
    </div>
  );
}
