"use client";

import React, { useState, useEffect } from "react";
import {
  AgentStageId,
  AnalysisRequestInput,
  CompleteAnalysisResult,
  LLMProviderType,
  OptionalContext,
  PIPELINE_STAGES,
  QualitySpeedMode,
  PriorityTier,
  TechnicalNeedTier,
  AcceptanceCategory,
} from "@/lib/types";
import { EXAMPLE_PROMPTS, buildLeadChatbotBaseline } from "@/lib/demo/demoData";
import {
  ConfidenceBadge,
  ProvenanceBadge,
  SeverityBadge,
  PriorityBadge,
  TechnicalTierBadge,
  SectionRegenerateBar,
} from "@/components/GuardrailBadges";
import { InteractiveWorkflowDiagram } from "@/components/InteractiveWorkflowDiagram";
import { ApiExplorer } from "@/components/ApiExplorer";
import { DataModelExplorer } from "@/components/DataModelExplorer";
import { AmbiguityReviewHub } from "@/components/AmbiguityReviewHub";
import { PrdViewerAndExport } from "@/components/PrdViewerAndExport";
import {
  Plus,
  History,
  LayoutTemplate,
  Settings,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  GitBranch,
  Cpu,
  Server,
  Database,
  BookOpen,
  ListChecks,
  Bug,
  AlertTriangle,
  HelpCircle,
  Award,
  Play,
  Trash2,
} from "lucide-react";

type ActiveTabId =
  | "Overview"
  | "Requirements"
  | "Workflow"
  | "Technical"
  | "APIs"
  | "Data Model"
  | "User Stories"
  | "Acceptance Criteria"
  | "QA & Edge Cases"
  | "Risks"
  | "Open Questions"
  | "PRD";

const TABS: { id: ActiveTabId; label: string; icon: React.ReactNode }[] = [
  { id: "Overview", label: "Overview", icon: <Award className="w-3.5 h-3.5" /> },
  { id: "Requirements", label: "Requirements", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "Workflow", label: "Workflow", icon: <GitBranch className="w-3.5 h-3.5" /> },
  { id: "Technical", label: "Technical", icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: "APIs", label: "APIs", icon: <Server className="w-3.5 h-3.5" /> },
  { id: "Data Model", label: "Data Model", icon: <Database className="w-3.5 h-3.5" /> },
  { id: "User Stories", label: "User Stories", icon: <BookOpen className="w-3.5 h-3.5" /> },
  {
    id: "Acceptance Criteria",
    label: "Acceptance Criteria",
    icon: <ListChecks className="w-3.5 h-3.5" />,
  },
  { id: "QA & Edge Cases", label: "QA & Edge Cases", icon: <Bug className="w-3.5 h-3.5" /> },
  { id: "Risks", label: "Risks", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { id: "Open Questions", label: "Open Questions", icon: <HelpCircle className="w-3.5 h-3.5" /> },
  { id: "PRD", label: "PRD", icon: <FileText className="w-3.5 h-3.5" /> },
];

const EMPTY_CONTEXT: OptionalContext = {
  businessProduct: "",
  targetUsers: "",
  existingSystems: "",
  knownConstraints: "",
  timeline: "",
  budget: "",
  additionalNotes: "",
};

const STORAGE_KEY = "ai_technical_ba_saved_analyses_v1";

export default function HomePage() {
  // Input state
  const [requirement, setRequirement] = useState<string>(EXAMPLE_PROMPTS[0].prompt);
  const [context, setContext] = useState<OptionalContext>(EXAMPLE_PROMPTS[0].context);
  const [showOptionalContext, setShowOptionalContext] = useState<boolean>(false);

  // Provider & Quality settings
  const [provider, setProvider] = useState<LLMProviderType>("demo");
  const [qualityMode, setQualityMode] = useState<QualitySpeedMode>("balanced");
  const [apiKey, setApiKey] = useState<string>("");
  const [modelOverride, setModelOverride] = useState<string>("");
  const [ollamaUrl, setOllamaUrl] = useState<string>("http://localhost:11434");

  // Navigation / Modals
  const [activeModal, setActiveModal] = useState<"recent" | "templates" | "settings" | null>(
    null
  );
  const [showInputPanel, setShowInputPanel] = useState<boolean>(true);

  // Pipeline Execution State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1);
  const [regeneratingStage, setRegeneratingStage] = useState<AgentStageId | null>(null);
  const [isResolvingAmbiguity, setIsResolvingAmbiguity] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Results State (Preloaded with the Flagship Demo per Section #25)
  const [analysis, setAnalysis] = useState<CompleteAnalysisResult | null>(() =>
    buildLeadChatbotBaseline({
      requirement: EXAMPLE_PROMPTS[0].prompt,
      context: EXAMPLE_PROMPTS[0].context,
      provider: "demo",
      qualityMode: "balanced",
    })
  );
  const [savedAnalyses, setSavedAnalyses] = useState<CompleteAnalysisResult[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTabId>("Overview");

  // Filters within tabs
  const [techTierFilter, setTechTierFilter] = useState<TechnicalNeedTier | "ALL">("ALL");
  const [storyPriorityFilter, setStoryPriorityFilter] = useState<PriorityTier | "ALL">("ALL");
  const [acCategoryFilter, setAcCategoryFilter] = useState<AcceptanceCategory | "ALL">("ALL");

  // Load saved analyses from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CompleteAnalysisResult[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedAnalyses(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistAnalysisToHistory = (item: CompleteAnalysisResult) => {
    setSavedAnalyses((prev) => {
      const filtered = prev.filter((p) => p.id !== item.id);
      const updated = [item, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // ignore quota errors
      }
      return updated;
    });
  };

  const executePipeline = async (overrideInput?: Partial<AnalysisRequestInput>) => {
    const reqText = (overrideInput?.requirement ?? requirement).trim();
    if (!reqText) {
      setErrorBanner("Please enter a business requirement in plain English before analyzing.");
      return;
    }

    setErrorBanner(null);
    setIsAnalyzing(true);
    setCurrentStageIndex(0);

    // Step through the 8 visual stages so the user clearly observes the multi-agent orchestration
    const stepInterval = setInterval(() => {
      setCurrentStageIndex((prev) => (prev < 7 ? prev + 1 : prev));
    }, 340);

    try {
      const payload: AnalysisRequestInput = {
        requirement: reqText,
        context: overrideInput?.context ?? context,
        provider: overrideInput?.provider ?? provider,
        qualityMode: overrideInput?.qualityMode ?? qualityMode,
        apiKey: apiKey || undefined,
        modelOverride: modelOverride || undefined,
        ollamaUrl: ollamaUrl || undefined,
      };

      const [res] = await Promise.all([
        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        new Promise((resolve) => setTimeout(resolve, 2600)),
      ]);

      clearInterval(stepInterval);
      setCurrentStageIndex(7);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute orchestration pipeline.");
      }

      setAnalysis(data as CompleteAnalysisResult);
      persistAnalysisToHistory(data as CompleteAnalysisResult);
      setShowInputPanel(false);
      setActiveTab("Overview");
    } catch (err) {
      clearInterval(stepInterval);
      setErrorBanner(
        err instanceof Error ? err.message : "Pipeline execution failed."
      );
    } finally {
      setIsAnalyzing(false);
      setCurrentStageIndex(-1);
    }
  };

  const handleTryDemo = () => {
    const demoPreset = EXAMPLE_PROMPTS[0];
    setRequirement(demoPreset.prompt);
    setContext(demoPreset.context);
    setProvider("demo");
    executePipeline({
      requirement: demoPreset.prompt,
      context: demoPreset.context,
      provider: "demo",
      qualityMode: "balanced",
    });
  };

  const handleNewAnalysis = () => {
    setShowInputPanel(true);
    setRequirement("");
    setContext(EMPTY_CONTEXT);
    setShowOptionalContext(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRegenerateStage = async (
    stageId: AgentStageId,
    customInstruction?: string
  ) => {
    if (!analysis) return;
    setRegeneratingStage(stageId);
    setErrorBanner(null);

    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentAnalysis: analysis,
          stageId,
          customInstruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate section.");
      }
      setAnalysis(data as CompleteAnalysisResult);
      persistAnalysisToHistory(data as CompleteAnalysisResult);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegeneratingStage(null);
    }
  };

  const handleResolveAmbiguities = async (
    resolutions: { ambiguityId: string; answer: string }[]
  ) => {
    if (!analysis) return;
    setIsResolvingAmbiguity(true);
    setErrorBanner(null);

    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentAnalysis: analysis,
          resolutions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to resolve ambiguities.");
      }
      setAnalysis(data as CompleteAnalysisResult);
      persistAnalysisToHistory(data as CompleteAnalysisResult);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Failed to re-run downstream analysis."
      );
    } finally {
      setIsResolvingAmbiguity(false);
    }
  };

  // Compute Summary KPI Counts from active analysis
  const totalReqsCount = analysis
    ? analysis.stages.requirements_analyst.explicit_requirements.length +
      analysis.stages.requirements_analyst.implied_requirements.length +
      analysis.stages.requirements_analyst.capabilities.length
    : 0;
  const openAmbiguitiesCount = analysis
    ? analysis.stages.ambiguity_detector.ambiguities.filter((a) => a.status === "Open")
        .length
    : 0;
  const totalAmbiguitiesCount = analysis
    ? analysis.stages.ambiguity_detector.ambiguities.length
    : 0;
  const criticalRisksCount = analysis
    ? analysis.stages.prd_generator.sections.risks.filter(
        (r) => r.severity === "Critical"
      ).length
    : 0;
  const apisCount = analysis ? analysis.stages.api_data_analyst.apis.length : 0;
  const entitiesCount = analysis ? analysis.stages.api_data_analyst.entities.length : 0;
  const storiesCount = analysis
    ? analysis.stages.acceptance_criteria.user_stories.length
    : 0;
  const edgeCasesCount = analysis ? analysis.stages.qa_reviewer.edge_cases.length : 0;
  const mvpFeaturesCount = analysis
    ? analysis.stages.prd_generator.mvp_prioritization.filter(
        (m) => m.priority === "P0"
      ).length
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* =========================================================
          1. ENTERPRISE HEADER
         ========================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm shadow-sm">
              BA
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  AI Technical BA Agent
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  8-Agent Orchestrator
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Turn ambiguous business requirements into engineering-ready specifications.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTryDemo}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 transition"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-700 text-emerald-700" />
              Try Demo
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveModal((prev) => (prev === "recent" ? null : "recent"))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              Recent Analyses
              {savedAnalyses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px]">
                  {savedAnalyses.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveModal((prev) => (prev === "templates" ? null : "templates"))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />
              Templates
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveModal((prev) => (prev === "settings" ? null : "settings"))
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              Settings
            </button>

            <button
              type="button"
              onClick={handleNewAnalysis}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Analysis
            </button>
          </div>
        </div>

        {/* Secondary Modal Drawers (Recent Analyses / Templates / Settings) */}
        {activeModal && (
          <div className="border-t border-slate-200 bg-slate-50/95 backdrop-blur px-4 sm:px-6 lg:px-8 py-4">
            <div className="max-w-7xl mx-auto">
              {activeModal === "recent" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Recent Saved Analyses ({savedAnalyses.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Close ✕
                    </button>
                  </div>
                  {savedAnalyses.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">
                      No saved analyses yet. Run an analysis or click &ldquo;Try Demo&rdquo; to populate history.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {savedAnalyses.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 flex flex-col justify-between gap-2 shadow-sm"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {item.title}
                              </span>
                              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">
                                {item.stages.prd_generator.quality_score.overall_score}/100
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                              {item.input.requirement}
                            </p>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                            <span className="text-slate-400">
                              {new Date(item.updatedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = savedAnalyses.filter((s) => s.id !== item.id);
                                  setSavedAnalyses(next);
                                  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                                }}
                                className="text-slate-400 hover:text-rose-600"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAnalysis(item);
                                  setRequirement(item.input.requirement);
                                  setContext(item.input.context);
                                  setActiveModal(null);
                                  setShowInputPanel(false);
                                }}
                                className="font-semibold text-slate-900 hover:underline"
                              >
                                Open Specification →
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeModal === "templates" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Enterprise Requirement Templates
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Close ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {EXAMPLE_PROMPTS.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setRequirement(tpl.prompt);
                          setContext(tpl.context);
                          setShowInputPanel(true);
                          setShowOptionalContext(true);
                          setActiveModal(null);
                        }}
                        className="text-left p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-900 transition shadow-sm space-y-1.5"
                      >
                        <div className="text-xs font-bold text-slate-900">{tpl.label}</div>
                        <p className="text-xs text-slate-600 line-clamp-2">“{tpl.prompt}”</p>
                        <div className="text-[11px] font-medium text-blue-700 pt-1">
                          Load Template + Context →
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === "settings" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      AI Orchestration & Provider Settings
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Close ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        LLM Provider Abstraction
                      </label>
                      <select
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as LLMProviderType)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                      >
                        <option value="demo">
                          Demo Mode (Deterministic Reference Engine - Free)
                        </option>
                        <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                        <option value="anthropic">Anthropic (Claude 3.7 Sonnet / Haiku)</option>
                        <option value="gemini">Google Gemini (Gemini 2.5 Pro / Flash)</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Local / Ollama</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Cost / Quality Tier
                      </label>
                      <select
                        value={qualityMode}
                        onChange={(e) =>
                          setQualityMode(e.target.value as QualitySpeedMode)
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                      >
                        <option value="fast">Fast (Lightweight classification models)</option>
                        <option value="balanced">
                          Balanced (Fast extraction + Strong PRD synthesis)
                        </option>
                        <option value="high_quality">
                          High Quality (Flagship reasoning across all 8 stages)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        API Key (Optional if set in .env)
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          provider === "demo"
                            ? "No API key needed in Demo Mode"
                            : "sk-... / AIza..."
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Model Override / Ollama URL
                      </label>
                      <input
                        type="text"
                        value={provider === "ollama" ? ollamaUrl : modelOverride}
                        onChange={(e) =>
                          provider === "ollama"
                            ? setOllamaUrl(e.target.value)
                            : setModelOverride(e.target.value)
                        }
                        placeholder={
                          provider === "ollama"
                            ? "http://localhost:11434"
                            : "Default auto-selected per stage"
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          MAIN WORKSPACE CONTAINER
         ========================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {errorBanner && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between">
            <span>
              <strong>Orchestration Alert:</strong> {errorBanner}
            </span>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="font-semibold underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =========================================================
            2. MAIN INPUT PANEL ("What are you building?")
           ========================================================= */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                What are you building?
              </h2>
              <span className="text-xs text-slate-500">
                Plain-English business request → 8-agent engineering specification
              </span>
            </div>
            {analysis && (
              <button
                type="button"
                onClick={() => setShowInputPanel((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                {showInputPanel ? (
                  <>
                    Collapse Input Panel <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    Edit Business Request / Context <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

          {showInputPanel && (
            <div className="p-6 space-y-5">
              <div>
                <textarea
                  rows={3}
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  placeholder="Describe your business requirement in plain English. Don't worry about technical details."
                  className="w-full rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed"
                />

                {/* Example Prompts Pills */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    Example prompts:
                  </span>
                  {EXAMPLE_PROMPTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRequirement(item.prompt);
                        setContext(item.context);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        requirement === item.prompt
                          ? "bg-slate-900 text-white border-slate-900 font-medium"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      “{item.prompt}”
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Context Collapsible */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOptionalContext((prev) => !prev)}
                  className="w-full px-4 py-2.5 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  <span>
                    Optional Context (Business/Product, Target Users, Existing Systems, Constraints, Timeline, Budget)
                  </span>
                  {showOptionalContext ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showOptionalContext && (
                  <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Business / Product
                      </label>
                      <input
                        type="text"
                        value={context.businessProduct}
                        onChange={(e) =>
                          setContext({ ...context, businessProduct: e.target.value })
                        }
                        placeholder="e.g., B2B SaaS Sales Platform"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Target Users
                      </label>
                      <input
                        type="text"
                        value={context.targetUsers}
                        onChange={(e) =>
                          setContext({ ...context, targetUsers: e.target.value })
                        }
                        placeholder="e.g., Inbound prospects, SDRs, Account Executives"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Existing Systems
                      </label>
                      <input
                        type="text"
                        value={context.existingSystems}
                        onChange={(e) =>
                          setContext({ ...context, existingSystems: e.target.value })
                        }
                        placeholder="e.g., HubSpot CRM, Google Calendar, Slack"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Known Constraints
                      </label>
                      <input
                        type="text"
                        value={context.knownConstraints}
                        onChange={(e) =>
                          setContext({ ...context, knownConstraints: e.target.value })
                        }
                        placeholder="e.g., GDPR compliance, <2.5s response latency"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Timeline
                      </label>
                      <input
                        type="text"
                        value={context.timeline}
                        onChange={(e) =>
                          setContext({ ...context, timeline: e.target.value })
                        }
                        placeholder="e.g., 6 weeks to MVP"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Budget
                      </label>
                      <input
                        type="text"
                        value={context.budget}
                        onChange={(e) =>
                          setContext({ ...context, budget: e.target.value })
                        }
                        placeholder="e.g., $45,000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block font-medium text-slate-700 mb-1">
                        Additional Notes
                      </label>
                      <input
                        type="text"
                        value={context.additionalNotes}
                        onChange={(e) =>
                          setContext({ ...context, additionalNotes: e.target.value })
                        }
                        placeholder="Any additional domain context or operational notes (leave blank if none)..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500 font-medium">Mode:</span>
                    {(["fast", "balanced", "high_quality"] as QualitySpeedMode[]).map(
                      (m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setQualityMode(m)}
                          className={`px-2.5 py-1 rounded-md border font-medium transition ${
                            qualityMode === m
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {m === "fast"
                            ? "Fast"
                            : m === "balanced"
                            ? "Balanced"
                            : "High Quality"}
                        </button>
                      )
                    )}
                  </div>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">
                    Engine:{" "}
                    <strong className="text-slate-800 uppercase">{provider}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={handleTryDemo}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-50 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-emerald-700 text-emerald-700" />
                    Try Demo
                  </button>

                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => executePipeline()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm transition"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Running 8-Agent Pipeline...
                      </>
                    ) : (
                      <>
                        Analyze Requirement
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================
            3. LIVE 8-STAGE ORCHESTRATION PROGRESS UI (Section #14)
           ========================================================= */}
        {isAnalyzing && (
          <section className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                <div>
                  <h3 className="text-sm font-bold">
                    Multi-Agent Technical BA Orchestration in Progress
                  </h3>
                  <p className="text-xs text-emerald-300 font-mono mt-0.5">
                    {PIPELINE_STAGES[Math.max(0, currentStageIndex)]?.statusMessage}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                Stage {Math.min(8, currentStageIndex + 1)} of 8
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PIPELINE_STAGES.map((stg, idx) => {
                const isDone = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                return (
                  <div
                    key={stg.id}
                    className={`p-3.5 rounded-xl border text-xs transition-all ${
                      isDone
                        ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-100"
                        : isCurrent
                        ? "bg-slate-800 border-blue-400 text-white ring-2 ring-blue-400/30"
                        : "bg-slate-900/60 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                      )}
                      <span>
                        {stg.number}. {stg.name}
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-1 pl-6">{stg.roleTitle}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* =========================================================
            4. RESULTS DASHBOARD (Sections #15, #16, #23, #24)
           ========================================================= */}
        {analysis && !isAnalyzing && (
          <div className="space-y-6">
            {/* AI Guardrail Warning Banner (Section #23) */}
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>AI Governance & Traceability Guardrail:</strong> AI-generated
                  specifications require human validation before engineering
                  implementation. Every requirement below distinguishes{" "}
                  <strong>User-Provided</strong> inputs from{" "}
                  <strong>AI Inferences</strong> and <strong>AI Recommendations</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("Open Questions")}
                className="px-3 py-1 rounded-lg bg-amber-900 text-white font-semibold hover:bg-amber-800 transition shrink-0"
              >
                Review {openAmbiguitiesCount} Open Ambiguities →
              </button>
            </div>

            {/* Top Results Summary Header + Specification Quality Score (Sections #15 & #24) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 8 cols: 8 KPI Metric Cards */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        ✓ All 8 Agents Completed
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {analysis.modelUsed}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">
                      {analysis.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("PRD")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Full 24-Section PRD →
                  </button>
                </div>

                {/* 8 KPI Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("Requirements")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-900 text-left transition"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      {totalReqsCount}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      Requirements Identified
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("Open Questions")}
                    className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:border-amber-600 text-left transition"
                  >
                    <div className="text-2xl font-bold text-amber-900">
                      {openAmbiguitiesCount}{" "}
                      <span className="text-xs font-normal text-amber-700">
                        / {totalAmbiguitiesCount}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-amber-900">
                      Open Ambiguities
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("Risks")}
                    className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:border-rose-600 text-left transition"
                  >
                    <div className="text-2xl font-bold text-rose-900">
                      {criticalRisksCount}
                    </div>
                    <div className="text-xs font-medium text-rose-900">
                      Critical Risks
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("APIs")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-900 text-left transition"
                  >
                    <div className="text-2xl font-bold text-slate-900">{apisCount}</div>
                    <div className="text-xs font-medium text-slate-600">
                      APIs Identified
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("Data Model")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-900 text-left transition"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      {entitiesCount}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      Data Entities
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("User Stories")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-900 text-left transition"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      {storiesCount}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      User Stories
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("QA & Edge Cases")}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:border-slate-900 text-left transition"
                  >
                    <div className="text-2xl font-bold text-slate-900">
                      {edgeCasesCount}
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      QA Edge Cases
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("Overview")}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:border-emerald-700 text-left transition"
                  >
                    <div className="text-2xl font-bold text-emerald-900">
                      {mvpFeaturesCount}
                    </div>
                    <div className="text-xs font-medium text-emerald-900">
                      P0 MVP Features
                    </div>
                  </button>
                </div>
              </div>

              {/* Right 4 cols: Specification Quality Score Card (Section #24) */}
              <div className="lg:col-span-4 bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Specification Quality Score
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      9-Dimension Audit
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-tight text-white">
                      {analysis.stages.prd_generator.quality_score.overall_score}
                    </span>
                    <span className="text-lg font-mono text-slate-400">/ 100</span>
                  </div>
                  <div className="mt-2 w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-500"
                      style={{
                        width: `${analysis.stages.prd_generator.quality_score.overall_score}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-semibold text-slate-300">
                    What is lowering the score:
                  </div>
                  {analysis.stages.prd_generator.quality_score.deductions.length ===
                  0 ? (
                    <p className="text-emerald-300">
                      ✓ All critical and high-severity ambiguities have been resolved!
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-slate-300">
                      {analysis.stages.prd_generator.quality_score.deductions
                        .slice(0, 3)
                        .map((ded, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-1.5 text-[11px] leading-snug"
                          >
                            <span className="text-amber-400 font-mono shrink-0">
                              -{ded.points_deducted}pt:
                            </span>
                            <span className="line-clamp-2">{ded.reason}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab("Open Questions")}
                  className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition text-center"
                >
                  Resolve Ambiguities to Boost Quality Score →
                </button>
              </div>
            </div>

            {/* =========================================================
                12 NAVIGATION TABS (Section #16)
               ========================================================= */}
            <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm overflow-x-auto">
              <nav className="flex items-center gap-1 min-w-max">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                      {tab.id === "Open Questions" && openAmbiguitiesCount > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isActive
                              ? "bg-amber-400 text-slate-950"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {openAmbiguitiesCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* =========================================================
                TAB 1: OVERVIEW
               ========================================================= */}
            {activeTab === "Overview" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="prd_generator"
                  stageLabel="Senior Technical Product Manager (Overview & MVP Synthesis)"
                  isRegenerating={regeneratingStage === "prd_generator"}
                  onRegenerate={handleRegenerateStage}
                />

                {/* Problem, Executive Summary, Business Objectives */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                        Problem Statement
                      </span>
                      <p className="text-sm font-medium text-slate-900 mt-1 leading-relaxed">
                        {analysis.stages.requirements_analyst.problem}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                        Executive Summary
                      </span>
                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                        {analysis.stages.prd_generator.sections.executive_summary}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-800 mb-2">
                          Business Objectives
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                          {analysis.stages.requirements_analyst.business_objectives.map(
                            (obj, i) => (
                              <li key={i}>{obj}</li>
                            )
                          )}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-800 mb-2">
                          Desired Measurable Outcomes
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                          {analysis.stages.requirements_analyst.desired_outcomes.map(
                            (out, i) => (
                              <li key={i}>{out}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 8-Stage Pipeline Traceability Card */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      8-Agent Orchestration Pipeline Trace
                    </h3>
                    <div className="space-y-2">
                      {PIPELINE_STAGES.map((stg) => (
                        <div
                          key={stg.id}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <div className="font-semibold text-slate-900">
                                {stg.number}. {stg.name}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {stg.roleTitle}
                              </div>
                            </div>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">
                            {analysis.stageTimingsMs[stg.id]}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MVP Prioritization Matrix (Section #12) */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Automated MVP Feature Prioritization (P0 / P1 / P2 / Out of Scope)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Each capability is classified with explicit engineering effort, business value, and product rationale.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                          <th className="py-3 px-4">ID</th>
                          <th className="py-3 px-4">Priority Classification</th>
                          <th className="py-3 px-4">Feature / Capability</th>
                          <th className="py-3 px-4">Effort</th>
                          <th className="py-3 px-4">Value</th>
                          <th className="py-3 px-4">Classification Reasoning</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {analysis.stages.prd_generator.mvp_prioritization.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {m.id}
                            </td>
                            <td className="py-3 px-4">
                              <PriorityBadge priority={m.priority} />
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {m.feature}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {m.effort}
                            </td>
                            <td className="py-3 px-4">{m.business_value}</td>
                            <td className="py-3 px-4 text-slate-600">{m.reasoning}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 9-Dimension Specification Quality Evaluation Layer (Section #24) */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Specification Quality Evaluation Breakdown (
                        {analysis.stages.prd_generator.quality_score.overall_score} / 100)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Evaluated across 9 requirements engineering and architecture dimensions.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.stages.prd_generator.quality_score.dimensions.map((dim) => (
                      <div
                        key={dim.name}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {dim.name}
                          </span>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900">
                            {dim.score} / {dim.max_score}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {dim.rationale}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 2: REQUIREMENTS (Agent 1)
               ========================================================= */}
            {activeTab === "Requirements" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="requirements_analyst"
                  stageLabel="Requirements Analyst"
                  isRegenerating={regeneratingStage === "requirements_analyst"}
                  onRegenerate={handleRegenerateStage}
                />

                {/* Actors Grid */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Identified System Actors (
                    {analysis.stages.requirements_analyst.actors.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analysis.stages.requirements_analyst.actors.map((actor) => (
                      <div
                        key={actor.name}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900">{actor.name}</span>
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                            {actor.type}
                          </span>
                        </div>
                        <p className="text-slate-600">{actor.role}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Explicit Requirements */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Explicit Requirements (
                    {analysis.stages.requirements_analyst.explicit_requirements.length})
                  </h3>
                  <div className="space-y-2.5">
                    {analysis.stages.requirements_analyst.explicit_requirements.map(
                      (reqItem) => (
                        <div
                          key={reqItem.id}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {reqItem.id}
                            </span>
                            <p className="text-sm text-slate-800">{reqItem.text}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <ProvenanceBadge source={reqItem.source} />
                            <ConfidenceBadge level={reqItem.confidence} />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Implied Requirements */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Implied Engineering Requirements (
                    {analysis.stages.requirements_analyst.implied_requirements.length})
                  </h3>
                  <div className="space-y-2.5">
                    {analysis.stages.requirements_analyst.implied_requirements.map(
                      (reqItem) => (
                        <div
                          key={reqItem.id}
                          className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {reqItem.id}
                            </span>
                            <p className="text-sm text-slate-800">{reqItem.text}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <ProvenanceBadge source={reqItem.source} />
                            <ConfidenceBadge level={reqItem.confidence} />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Core Capabilities & Assumptions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Core Capabilities (
                      {analysis.stages.requirements_analyst.capabilities.length})
                    </h3>
                    <div className="space-y-2.5">
                      {analysis.stages.requirements_analyst.capabilities.map((cap) => (
                        <div
                          key={cap.id}
                          className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-mono font-bold text-slate-900">
                              {cap.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <ProvenanceBadge source={cap.source} />
                              <ConfidenceBadge level={cap.confidence} />
                            </div>
                          </div>
                          <p className="text-slate-800 font-medium">{cap.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      Explicitly Flagged Assumptions (
                      {analysis.stages.requirements_analyst.assumptions.length})
                    </h3>
                    <div className="space-y-2.5">
                      {analysis.stages.requirements_analyst.assumptions.map((asm) => (
                        <div
                          key={asm.id}
                          className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-mono font-bold text-amber-950">
                              {asm.id}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <ProvenanceBadge source={asm.source} />
                              <ConfidenceBadge level={asm.confidence} />
                            </div>
                          </div>
                          <p className="text-slate-800">{asm.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 3: WORKFLOW (Agent 3 — Interactive Visual Workflow)
               ========================================================= */}
            {activeTab === "Workflow" && (
              <div>
                <SectionRegenerateBar
                  stageId="workflow_mapper"
                  stageLabel="Workflow Mapper"
                  isRegenerating={regeneratingStage === "workflow_mapper"}
                  onRegenerate={handleRegenerateStage}
                />
                <InteractiveWorkflowDiagram
                  workflow={analysis.stages.workflow_mapper}
                  requirements={analysis.stages.requirements_analyst}
                />
              </div>
            )}

            {/* =========================================================
                TAB 4: TECHNICAL (Agent 4 — Required vs Recommended vs Future)
               ========================================================= */}
            {activeTab === "Technical" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="technical_analyst"
                  stageLabel="Technical Analyst"
                  isRegenerating={regeneratingStage === "technical_analyst"}
                  onRegenerate={handleRegenerateStage}
                />

                {/* Tier Filter Bar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-700">
                    Filter Architecture Specifications by Necessity Tier:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      ["ALL", "Required", "Recommended", "Future / Optional"] as const
                    ).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setTechTierFilter(tier)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          techTierFilter === tier
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Technical Domains Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(
                    [
                      {
                        title: "Frontend Requirements",
                        items: analysis.stages.technical_analyst.frontend,
                      },
                      {
                        title: "Backend Requirements",
                        items: analysis.stages.technical_analyst.backend,
                      },
                      {
                        title: "Services & Adapters",
                        items: analysis.stages.technical_analyst.services,
                      },
                      {
                        title: "Authentication",
                        items: analysis.stages.technical_analyst.authentication,
                      },
                      {
                        title: "Authorization & Isolation",
                        items: analysis.stages.technical_analyst.authorization,
                      },
                      {
                        title: "Deterministic Business Logic",
                        items: analysis.stages.technical_analyst.business_logic,
                      },
                      {
                        title: "AI Components & Guardrails",
                        items: analysis.stages.technical_analyst.ai_components,
                      },
                      {
                        title: "Notifications & Background Jobs",
                        items: [
                          ...analysis.stages.technical_analyst.notifications,
                          ...analysis.stages.technical_analyst.background_jobs,
                        ],
                      },
                      {
                        title: "External Systems",
                        items: analysis.stages.technical_analyst.external_systems,
                      },
                      {
                        title: "Infrastructure Considerations",
                        items: analysis.stages.technical_analyst.infrastructure,
                      },
                    ] as const
                  ).map((group) => {
                    const filtered =
                      techTierFilter === "ALL"
                        ? group.items
                        : group.items.filter((i) => i.tier === techTierFilter);
                    if (filtered.length === 0) return null;
                    return (
                      <div
                        key={group.title}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                      >
                        <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                          {group.title} ({filtered.length})
                        </h3>
                        <div className="space-y-3">
                          {filtered.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono font-bold text-slate-900">
                                  {item.id} · {item.component}
                                </span>
                                <TechnicalTierBadge tier={item.tier} />
                              </div>
                              <p className="text-slate-800 leading-relaxed">
                                {item.specification}
                              </p>
                              <p className="text-slate-500 text-[11px]">
                                <strong>Architectural Rationale:</strong>{" "}
                                {item.justification}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <ProvenanceBadge source={item.source} />
                                <ConfidenceBadge level={item.confidence} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 5: APIs (Agent 5 — Interactive API Explorer)
               ========================================================= */}
            {activeTab === "APIs" && (
              <div>
                <SectionRegenerateBar
                  stageId="api_data_analyst"
                  stageLabel="API / Data Dependency Analyst"
                  isRegenerating={regeneratingStage === "api_data_analyst"}
                  onRegenerate={handleRegenerateStage}
                />
                <ApiExplorer apis={analysis.stages.api_data_analyst.apis} />
              </div>
            )}

            {/* =========================================================
                TAB 6: DATA MODEL (Agent 5 — Interactive ER Diagram & Schema)
               ========================================================= */}
            {activeTab === "Data Model" && (
              <div>
                <SectionRegenerateBar
                  stageId="api_data_analyst"
                  stageLabel="API / Data Dependency Analyst"
                  isRegenerating={regeneratingStage === "api_data_analyst"}
                  onRegenerate={handleRegenerateStage}
                />
                <DataModelExplorer dataModel={analysis.stages.api_data_analyst} />
              </div>
            )}

            {/* =========================================================
                TAB 7: USER STORIES (Agent 6)
               ========================================================= */}
            {activeTab === "User Stories" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="acceptance_criteria"
                  stageLabel="Acceptance Criteria & User Story Generator"
                  isRegenerating={regeneratingStage === "acceptance_criteria"}
                  onRegenerate={handleRegenerateStage}
                />

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Filter User Stories by MVP Priority Tier:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["ALL", "P0", "P1", "P2", "Out of Scope"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setStoryPriorityFilter(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          storyPriorityFilter === p
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {analysis.stages.acceptance_criteria.user_stories
                    .filter(
                      (st) =>
                        storyPriorityFilter === "ALL" ||
                        st.priority === storyPriorityFilter
                    )
                    .map((story) => (
                      <div
                        key={story.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                              {story.id}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">
                              {story.title}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <PriorityBadge priority={story.priority} />
                            <ProvenanceBadge source={story.source} />
                            <ConfidenceBadge level={story.confidence} />
                          </div>
                        </div>

                        <blockquote className="p-3.5 rounded-lg bg-slate-50 border-l-4 border-slate-900 text-sm text-slate-900 font-medium">
                          “{story.formatted_story}”
                        </blockquote>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          <span>
                            <strong>Prioritization Rationale:</strong>{" "}
                            {story.priority_reasoning}
                          </span>
                          {story.linked_requirement_ids.length > 0 && (
                            <span className="font-mono text-[11px] text-slate-500">
                              Traces to: {story.linked_requirement_ids.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 8: ACCEPTANCE CRITERIA (Agent 6 — Given / When / Then)
               ========================================================= */}
            {activeTab === "Acceptance Criteria" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="acceptance_criteria"
                  stageLabel="Acceptance Criteria Generator"
                  isRegenerating={regeneratingStage === "acceptance_criteria"}
                  onRegenerate={handleRegenerateStage}
                />

                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Filter Given/When/Then Scenarios by Test Category:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        "ALL",
                        "Happy Path",
                        "Alternative Path",
                        "Validation",
                        "Error",
                        "Permission",
                        "Empty State",
                        "Timeout",
                        "Integration Failure",
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAcCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                          acCategoryFilter === cat
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.stages.acceptance_criteria.acceptance_criteria
                    .filter(
                      (c) =>
                        acCategoryFilter === "ALL" || c.category === acCategoryFilter
                    )
                    .map((acItem) => (
                      <div
                        key={acItem.id}
                        className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {acItem.id}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              {acItem.category}
                            </span>
                            <span className="font-mono text-xs text-slate-400">
                              Story: {acItem.story_id}
                            </span>
                          </div>
                          <ConfidenceBadge level={acItem.confidence} />
                        </div>

                        <h4 className="text-sm font-bold text-slate-900">
                          {acItem.title}
                        </h4>

                        <div className="space-y-2 text-xs font-mono bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                          <div>
                            <span className="inline-block w-14 font-bold text-emerald-800 uppercase">
                              Given
                            </span>
                            <span className="font-sans text-slate-800">
                              {acItem.given}
                            </span>
                          </div>
                          <div>
                            <span className="inline-block w-14 font-bold text-blue-800 uppercase">
                              When
                            </span>
                            <span className="font-sans text-slate-800">
                              {acItem.when}
                            </span>
                          </div>
                          <div>
                            <span className="inline-block w-14 font-bold text-purple-800 uppercase">
                              Then
                            </span>
                            <span className="font-sans text-slate-900 font-medium">
                              {acItem.then}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 9: QA & EDGE CASES (Agent 7 — Hostile QA Review)
               ========================================================= */}
            {activeTab === "QA & Edge Cases" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="qa_reviewer"
                  stageLabel="QA / Edge Case Reviewer"
                  isRegenerating={regeneratingStage === "qa_reviewer"}
                  onRegenerate={handleRegenerateStage}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.stages.qa_reviewer.edge_cases.map((ec) => (
                    <div
                      key={ec.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {ec.id}
                          </span>
                          <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            {ec.category}
                          </span>
                        </div>
                        <SeverityBadge severity={ec.severity} />
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{ec.title}</h4>

                      <div className="space-y-1.5 text-xs text-slate-700">
                        <p>
                          <strong>Scenario:</strong> {ec.scenario}
                        </p>
                        <p>
                          <strong>Impact if Unhandled:</strong> {ec.impact}
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                        <div>
                          <strong>Recommended Engineering Mitigation:</strong>{" "}
                          {ec.recommended_mitigation}
                        </div>
                        <div className="text-[11px] text-emerald-800">
                          <strong>Verification Test Strategy:</strong> {ec.test_strategy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 10: RISKS (AI, Security, Privacy, Integration)
               ========================================================= */}
            {activeTab === "Risks" && (
              <div className="space-y-6">
                <SectionRegenerateBar
                  stageId="qa_reviewer"
                  stageLabel="QA & Risk Auditor"
                  isRegenerating={regeneratingStage === "qa_reviewer"}
                  onRegenerate={handleRegenerateStage}
                />

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900">
                    Consolidated AI, Security, Privacy & Delivery Risk Register
                  </h3>
                  <div className="space-y-3">
                    {analysis.stages.prd_generator.sections.risks.map((risk) => (
                      <div
                        key={risk.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">
                              {risk.id}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-semibold text-slate-800">
                              {risk.category} Risk
                            </span>
                            <SeverityBadge severity={risk.severity} />
                            <span className="text-slate-500">
                              Likelihood: <strong>{risk.likelihood}</strong>
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {risk.description}
                          </p>
                          <p className="text-slate-700">
                            <strong>Mitigation Control:</strong> {risk.mitigation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security & Privacy Audit Findings */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                  <h3 className="text-base font-bold text-slate-900">
                    Security, Privacy & AI Safety Audit Controls
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.stages.qa_reviewer.security_privacy_audit.map((sec) => (
                      <div
                        key={sec.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">
                            {sec.id} · {sec.domain}
                          </span>
                          <SeverityBadge severity={sec.severity} />
                        </div>
                        <p className="font-medium text-slate-900">{sec.finding}</p>
                        <p className="text-slate-600">
                          <strong>Control:</strong> {sec.control_recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================
                TAB 11: OPEN QUESTIONS (Agent 2 — Resolve & Re-run Downstream)
               ========================================================= */}
            {activeTab === "Open Questions" && (
              <div>
                <SectionRegenerateBar
                  stageId="ambiguity_detector"
                  stageLabel="Ambiguity Detector"
                  isRegenerating={regeneratingStage === "ambiguity_detector"}
                  onRegenerate={handleRegenerateStage}
                />
                <AmbiguityReviewHub
                  ambiguityOutput={analysis.stages.ambiguity_detector}
                  isRerunning={isResolvingAmbiguity}
                  onResolveAndRerun={handleResolveAmbiguities}
                />
              </div>
            )}

            {/* =========================================================
                TAB 12: PRD (Agent 8 — Full 24-Section PRD & Export)
               ========================================================= */}
            {activeTab === "PRD" && (
              <div>
                <SectionRegenerateBar
                  stageId="prd_generator"
                  stageLabel="Senior Technical Product Manager (Final PRD Generator)"
                  isRegenerating={regeneratingStage === "prd_generator"}
                  onRegenerate={handleRegenerateStage}
                />
                <PrdViewerAndExport analysis={analysis} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* =========================================================
          PORTFOLIO POSITIONING FOOTER (Section #31)
         ========================================================= */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              Built by Devansh Suri
            </span>
            <span>·</span>
            <span>
              AI Product Management · Technical Business Analysis · Agentic AI
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            AI Technical BA Agent · 8-Stage Deterministic & LLM Multi-Agent Pipeline
          </div>
        </div>
      </footer>
    </div>
  );
}
