"use client";

import React, { useState } from "react";
import {
  ConfidenceLevel,
  ProvenanceType,
  SeverityLevel,
  PriorityTier,
  TechnicalNeedTier,
  AgentStageId,
} from "@/lib/types";
import {
  ShieldCheck,
  Sparkles,
  Lightbulb,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const styles: Record<ConfidenceLevel, string> = {
    High: "bg-emerald-50 text-emerald-800 border-emerald-200",
    Medium: "bg-amber-50 text-amber-800 border-amber-200",
    Low: "bg-rose-50 text-rose-800 border-rose-200",
  };
  const dotStyles: Record<ConfidenceLevel, string> = {
    High: "bg-emerald-500",
    Medium: "bg-amber-500",
    Low: "bg-rose-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${styles[level]}`}
      title={`AI Confidence Level: ${level}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[level]}`} />
      Confidence: {level}
    </span>
  );
}

export function ProvenanceBadge({ source }: { source: ProvenanceType }) {
  if (source === "User-provided information") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-900 text-white border border-slate-900">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        User-Provided
      </span>
    );
  }
  if (source === "AI inference") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
        <Sparkles className="w-3 h-3 text-blue-600" />
        AI Inference
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">
      <Lightbulb className="w-3 h-3 text-indigo-600" />
      AI Recommendation
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  const styles: Record<SeverityLevel, string> = {
    Critical: "bg-rose-100 text-rose-900 border-rose-300 font-semibold",
    High: "bg-orange-50 text-orange-800 border-orange-200 font-medium",
    Medium: "bg-amber-50 text-amber-800 border-amber-200 font-medium",
    Low: "bg-slate-100 text-slate-700 border-slate-200 font-medium",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${styles[severity]}`}>
      {severity}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: PriorityTier }) {
  const styles: Record<PriorityTier, string> = {
    P0: "bg-slate-900 text-white border-slate-900 font-semibold",
    P1: "bg-blue-50 text-blue-900 border-blue-200 font-semibold",
    P2: "bg-slate-100 text-slate-700 border-slate-300 font-medium",
    "Out of Scope": "bg-rose-50 text-rose-800 border-rose-200 font-medium",
  };
  const labels: Record<PriorityTier, string> = {
    P0: "P0 · Must Have (MVP)",
    P1: "P1 · Should Have",
    P2: "P2 · Could Have",
    "Out of Scope": "Out of Scope",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs border ${styles[priority]}`}>
      {labels[priority]}
    </span>
  );
}

export function TechnicalTierBadge({ tier }: { tier: TechnicalNeedTier }) {
  const styles: Record<TechnicalNeedTier, string> = {
    Required: "bg-slate-900 text-white border-slate-900 font-semibold",
    Recommended: "bg-blue-50 text-blue-800 border-blue-200 font-medium",
    "Future / Optional": "bg-slate-100 text-slate-600 border-slate-200 font-medium",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${styles[tier]}`}>
      {tier}
    </span>
  );
}

export function SectionRegenerateBar({
  stageId,
  stageLabel,
  isRegenerating,
  onRegenerate,
}: {
  stageId: AgentStageId;
  stageLabel: string;
  isRegenerating: boolean;
  onRegenerate: (stageId: AgentStageId, customInstruction?: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [instruction, setInstruction] = useState("");

  const handleTrigger = () => {
    onRegenerate(stageId, instruction.trim() || undefined);
    setInstruction("");
    setShowCustom(false);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            Agent Stage: {stageLabel}
          </span>
          <span>Isolated regeneration preserves upstream context.</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCustom((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showCustom ? "Hide Refinement" : "Add Guidance"}
          </button>
          <button
            type="button"
            disabled={isRegenerating}
            onClick={handleTrigger}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
            {isRegenerating ? `Regenerating ${stageLabel}...` : `Regenerate ${stageLabel}`}
          </button>
        </div>
      </div>

      {showCustom && (
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={`Optional refinement for ${stageLabel} (e.g., "Require HIPAA audit logging" or "Add timeout scenario for webhook")...`}
            className="flex-1 text-xs px-3 py-2 rounded border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          <button
            type="button"
            disabled={isRegenerating}
            onClick={handleTrigger}
            className="px-3 py-2 rounded text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Apply & Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
