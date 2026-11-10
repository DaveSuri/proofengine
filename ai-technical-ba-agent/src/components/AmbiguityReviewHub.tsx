"use client";

import React, { useState } from "react";
import { AmbiguityDetectorOutput, AmbiguityItem } from "@/lib/types";
import { SeverityBadge } from "./GuardrailBadges";
import {
  CheckCircle2,
  HelpCircle,
  Play,
  Sparkles,
  CornerDownRight,
  RotateCcw,
} from "lucide-react";

const SUGGESTED_ANSWERS: Record<string, string> = {
  "AMB-001": "Lead must have budget > $5,000, company size >= 15 employees, and timeline < 90 days.",
  "AMB-002": "Support Google Calendar and Microsoft 365 via OAuth 2.0 with weighted round-robin AE routing.",
  "AMB-003": "Prospects can reschedule or cancel up to 2 hours before the meeting via a signed magic-link in the confirmation email.",
  "AMB-004": "Automatically expand search window to 10 business days; if still empty, capture top 3 preferred times and alert on-duty SDR in Slack.",
  "AMB-005": "AI commits bookings autonomously for standard qualified leads; enterprise leads (budget > $50,000) also alert the AE manager.",
  "AMB-006": "Store only name, work email, company, and PCI/PII-scrubbed transcript for 90 days under GDPR/CCPA consent with Zero-Data-Retention LLM APIs.",
};

export function AmbiguityReviewHub({
  ambiguityOutput,
  isRerunning,
  onResolveAndRerun,
}: {
  ambiguityOutput: AmbiguityDetectorOutput;
  isRerunning: boolean;
  onResolveAndRerun: (resolutions: { ambiguityId: string; answer: string }[]) => void;
}) {
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  const openCount = ambiguityOutput.ambiguities.filter((a) => a.status === "Open").length;
  const resolvedCount = ambiguityOutput.ambiguities.filter((a) => a.status === "Resolved").length;

  const pendingDraftEntries = Object.entries(draftAnswers).filter(
    ([, val]) => val && val.trim().length > 0
  );

  const handleSingleResolve = (amb: AmbiguityItem) => {
    const val = draftAnswers[amb.id]?.trim();
    if (!val) return;
    onResolveAndRerun([{ ambiguityId: amb.id, answer: val }]);
    setActiveEditId(null);
  };

  const handleBatchRerun = () => {
    if (pendingDraftEntries.length === 0) return;
    onResolveAndRerun(
      pendingDraftEntries.map(([ambiguityId, answer]) => ({
        ambiguityId,
        answer: answer.trim(),
      }))
    );
    setActiveEditId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Status & Re-run Downstream Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-slate-900">
              Human-in-the-Loop Ambiguity Review & Downstream Re-Analysis
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
              {openCount} Open · {resolvedCount} Resolved
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            {ambiguityOutput.summary_risk_assessment}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {pendingDraftEntries.length > 0 && (
            <button
              type="button"
              disabled={isRerunning}
              onClick={handleBatchRerun}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isRerunning
                ? "Re-running Downstream Agents..."
                : `Re-run Downstream Analysis (${pendingDraftEntries.length} Resolution${
                    pendingDraftEntries.length > 1 ? "s" : ""
                  })`}
            </button>
          )}
        </div>
      </div>

      {/* Ambiguity Cards */}
      <div className="space-y-4">
        {ambiguityOutput.ambiguities.map((amb) => {
          const isResolved = amb.status === "Resolved";
          const isEditing = activeEditId === amb.id || (!isResolved && Boolean(draftAnswers[amb.id]));
          const suggested = SUGGESTED_ANSWERS[amb.id];

          return (
            <div
              key={amb.id}
              className={`rounded-xl border p-5 transition-all ${
                isResolved
                  ? "bg-emerald-50/40 border-emerald-200"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                    {amb.id}
                  </span>
                  <SeverityBadge severity={amb.severity} />
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {amb.category}
                  </span>
                  {isResolved ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      Resolved by Human Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      <HelpCircle className="w-3 h-3 text-amber-600" />
                      Needs Stakeholder Decision
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (activeEditId === amb.id) {
                      setActiveEditId(null);
                    } else {
                      setActiveEditId(amb.id);
                      if (!draftAnswers[amb.id] && amb.resolution) {
                        setDraftAnswers((prev) => ({ ...prev, [amb.id]: amb.resolution! }));
                      }
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    isResolved
                      ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {isResolved ? (
                    <>
                      <RotateCcw className="w-3 h-3" /> Edit Resolution
                    </>
                  ) : (
                    "Resolve"
                  )}
                </button>
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{amb.description}</p>
                <p className="text-xs text-slate-600">
                  <strong className="text-slate-800">Why it matters (Engineering Impact):</strong>{" "}
                  {amb.impact}
                </p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900">
                  <strong className="text-slate-700 uppercase tracking-wider text-[11px] block mb-0.5">
                    Recommended Clarifying Question:
                  </strong>
                  “{amb.question}”
                </div>
              </div>

              {/* Confirmed Resolution Box */}
              {isResolved && amb.resolution && activeEditId !== amb.id && (
                <div className="mt-3 p-3.5 rounded-lg bg-emerald-100/70 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2">
                  <CornerDownRight className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">
                      Confirmed Stakeholder Resolution (Propagated to Downstream Agents):
                    </span>
                    <p className="mt-0.5 font-medium">{amb.resolution}</p>
                  </div>
                </div>
              )}

              {/* Resolution Editor */}
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-800">
                      Provide Stakeholder Answer for {amb.id}:
                    </label>
                    {suggested && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftAnswers((prev) => ({
                            ...prev,
                            [amb.id]: suggested,
                          }))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        Use Example Resolution
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={draftAnswers[amb.id] ?? ""}
                    onChange={(e) =>
                      setDraftAnswers((prev) => ({
                        ...prev,
                        [amb.id]: e.target.value,
                      }))
                    }
                    placeholder={
                      suggested ||
                      "Enter definitive business rule or technical decision..."
                    }
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      Will re-run downstream stages:{" "}
                      <span className="font-mono text-slate-700">
                        {amb.affectedDownstreamStages.join(" → ")}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveEditId(null);
                        }}
                        className="px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isRerunning || !draftAnswers[amb.id]?.trim()}
                        onClick={() => handleSingleResolve(amb)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {isRerunning
                          ? "Updating Downstream..."
                          : "Resolve & Re-run Downstream Analysis"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
