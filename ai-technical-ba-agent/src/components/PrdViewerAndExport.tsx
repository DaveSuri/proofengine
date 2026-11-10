"use client";

import React, { useState } from "react";
import { CompleteAnalysisResult } from "@/lib/types";
import { PriorityBadge, SeverityBadge } from "./GuardrailBadges";
import {
  Copy,
  Check,
  Download,
  FileText,
  FileCode2,
  Printer,
  ListChecks,
} from "lucide-react";

const PRD_TOC = [
  "1. Executive Summary",
  "2. Problem Statement",
  "3. Business Objective",
  "4. Users & Personas",
  "5. Goals",
  "6. Non-Goals",
  "7. User Journeys",
  "8. Functional Requirements",
  "9. Workflow",
  "10. Technical Requirements",
  "11. API Dependencies",
  "12. Data Model",
  "13. User Stories",
  "14. Acceptance Criteria",
  "15. Edge Cases",
  "16. Non-Functional Requirements",
  "17. AI Requirements",
  "18. Risks",
  "19. Assumptions",
  "20. Open Questions",
  "21. Dependencies",
  "22. MVP",
  "23. Phase 2",
  "24. Recommended Implementation Sequence",
];

export function PrdViewerAndExport({
  analysis,
}: {
  analysis: CompleteAnalysisResult;
}) {
  const [viewMode, setViewMode] = useState<"structured" | "markdown">("structured");
  const [copiedPrd, setCopiedPrd] = useState(false);

  const prd = analysis.stages.prd_generator;
  const sec = prd.sections;
  const req = analysis.stages.requirements_analyst;
  const wf = analysis.stages.workflow_mapper;
  const tech = analysis.stages.technical_analyst;
  const apiData = analysis.stages.api_data_analyst;
  const ac = analysis.stages.acceptance_criteria;
  const qa = analysis.stages.qa_reviewer;
  const amb = analysis.stages.ambiguity_detector;

  const handleCopyPrd = () => {
    navigator.clipboard.writeText(prd.markdown_document);
    setCopiedPrd(true);
    setTimeout(() => setCopiedPrd(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([prd.markdown_document], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${analysis.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-prd.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${analysis.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-full-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Export & Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("structured")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "structured"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            24-Section Structured PRD
          </button>
          <button
            type="button"
            onClick={() => setViewMode("markdown")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === "markdown"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Raw Markdown Source
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPrd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition"
          >
            {copiedPrd ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied PRD
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy PRD
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download PRD (.md)
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {viewMode === "markdown" ? (
        <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 p-6 overflow-x-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-slate-200">
            {prd.markdown_document}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 3 cols: 24-Section TOC */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sticky top-20 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-900 pb-2.5 mb-2.5 border-b border-slate-200">
                <ListChecks className="w-4 h-4 text-slate-700" />
                24-Section PRD Index
              </div>
              <nav className="space-y-1">
                {PRD_TOC.map((item, idx) => (
                  <a
                    key={item}
                    href={`#prd-sec-${idx + 1}`}
                    className="block px-2 py-1 rounded text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition truncate"
                  >
                    {item}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Right 9 cols: Full 24-Section Specification Document */}
          <div className="lg:col-span-9 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-8">
            <div className="pb-6 border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-500 mb-2">
                <FileText className="w-4 h-4 text-slate-700" />
                <span>ENGINEERING PRODUCT REQUIREMENTS DOCUMENT</span>
                <span>·</span>
                <span>QUALITY SCORE: {prd.quality_score.overall_score}/100</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{analysis.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Generated via 8-Agent Technical Business Analysis Pipeline · Last updated{" "}
                {new Date(analysis.updatedAt).toLocaleString()}
              </p>
            </div>

            {/* 1. Executive Summary */}
            <section id="prd-sec-1" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                1. Executive Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{sec.executive_summary}</p>
            </section>

            {/* 2. Problem Statement */}
            <section id="prd-sec-2" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                2. Problem Statement
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{sec.problem_statement}</p>
            </section>

            {/* 3. Business Objective */}
            <section id="prd-sec-3" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                3. Business Objective
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">{sec.business_objective}</p>
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1 pt-1">
                {req.business_objectives.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </section>

            {/* 4. Users & Personas */}
            <section id="prd-sec-4" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                4. Users & Personas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {sec.users_and_personas.map((p) => (
                  <div key={p.name} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-slate-500 font-medium">{p.role}</div>
                    <div>
                      <strong>Goals:</strong> {p.goals.join("; ")}
                    </div>
                    <div>
                      <strong>Pain Points:</strong> {p.pain_points.join("; ")}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Goals & 6. Non-Goals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section id="prd-sec-5" className="space-y-2 scroll-mt-24">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  5. Goals
                </h3>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1.5">
                  {sec.goals.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </section>

              <section id="prd-sec-6" className="space-y-2 scroll-mt-24">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  6. Non-Goals
                </h3>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1.5">
                  {sec.non_goals.map((ng, i) => (
                    <li key={i}>{ng}</li>
                  ))}
                </ul>
              </section>
            </div>

            {/* 7. User Journeys */}
            <section id="prd-sec-7" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                7. User Journeys
              </h3>
              <div className="space-y-3">
                {sec.user_journeys.map((j) => (
                  <div key={j.name} className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-2">
                    <div className="font-semibold text-slate-900">
                      {j.name} <span className="text-slate-500 font-normal">({j.persona})</span>
                    </div>
                    <ol className="list-decimal pl-5 space-y-1 text-slate-700">
                      {j.steps.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            {/* 8. Functional Requirements */}
            <section id="prd-sec-8" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                8. Functional Requirements ({req.explicit_requirements.length + req.implied_requirements.length})
              </h3>
              <p className="text-xs text-slate-600">{sec.functional_requirements_summary}</p>
              <div className="space-y-2">
                {[...req.explicit_requirements, ...req.implied_requirements].map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2">{r.id}</span>
                      <span className="text-slate-700">{r.text}</span>
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                      {r.source} · {r.confidence}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 9. Workflow */}
            <section id="prd-sec-9" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                9. Workflow ({wf.steps.length} States)
              </h3>
              <p className="text-xs text-slate-600">{sec.workflow_summary}</p>
              <pre className="p-4 rounded-lg bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto">
                {wf.mermaid_diagram}
              </pre>
            </section>

            {/* 10. Technical Requirements */}
            <section id="prd-sec-10" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                10. Technical Requirements
              </h3>
              <p className="text-xs text-slate-600">{sec.technical_requirements_summary}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  ...tech.frontend,
                  ...tech.backend,
                  ...tech.services,
                  ...tech.authentication,
                  ...tech.ai_components,
                  ...tech.infrastructure,
                ].map((t) => (
                  <div key={t.id} className="p-3 rounded border border-slate-200 bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{t.id}</span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-medium text-[11px]">
                        {t.tier}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800">{t.component}</div>
                    <p className="text-slate-600">{t.specification}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 11. API Dependencies */}
            <section id="prd-sec-11" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                11. API Dependencies ({apiData.apis.length} Endpoints)
              </h3>
              <p className="text-xs text-slate-600">{sec.api_dependencies_summary}</p>
              <div className="space-y-2 text-xs">
                {apiData.apis.map((api) => (
                  <div key={api.id} className="p-3 rounded border border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-blue-800 mr-2">
                        {api.method} {api.endpoint}
                      </span>
                      <span className="font-semibold text-slate-900">{api.name}:</span>{" "}
                      <span className="text-slate-600">{api.purpose}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">{api.tier}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 12. Data Model */}
            <section id="prd-sec-12" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                12. Data Model ({apiData.entities.length} Entities)
              </h3>
              <p className="text-xs text-slate-600">{sec.data_model_summary}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {apiData.entities.map((e) => (
                  <div key={e.name} className="p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="font-mono font-bold text-slate-900">{e.name}</div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{e.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 13. User Stories */}
            <section id="prd-sec-13" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                13. User Stories ({ac.user_stories.length})
              </h3>
              <div className="space-y-2 text-xs">
                {ac.user_stories.map((st) => (
                  <div key={st.id} className="p-3 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 mr-2">{st.id}</span>
                      <span className="text-slate-800">{st.formatted_story}</span>
                    </div>
                    <PriorityBadge priority={st.priority} />
                  </div>
                ))}
              </div>
            </section>

            {/* 14. Acceptance Criteria */}
            <section id="prd-sec-14" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                14. Acceptance Criteria ({ac.acceptance_criteria.length} Scenarios)
              </h3>
              <div className="space-y-2 text-xs">
                {ac.acceptance_criteria.map((c) => (
                  <div key={c.id} className="p-3 rounded border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-semibold text-slate-900">
                      <span className="font-mono mr-1.5">{c.id}</span> [{c.category}] {c.title}
                    </div>
                    <div>
                      <strong>Given</strong> {c.given} · <strong>When</strong> {c.when} ·{" "}
                      <strong>Then</strong> {c.then}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 15. Edge Cases */}
            <section id="prd-sec-15" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                15. Edge Cases ({qa.edge_cases.length})
              </h3>
              <div className="space-y-2 text-xs">
                {qa.edge_cases.map((e) => (
                  <div key={e.id} className="p-3 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold mr-2">{e.id}</span>
                      <strong>{e.title}:</strong> {e.recommended_mitigation}
                    </div>
                    <SeverityBadge severity={e.severity} />
                  </div>
                ))}
              </div>
            </section>

            {/* 16. Non-Functional Requirements */}
            <section id="prd-sec-16" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                16. Non-Functional Requirements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {Object.entries(sec.non_functional_requirements).map(([domain, list]) => (
                  <div key={domain} className="p-3.5 rounded border border-slate-200 bg-slate-50 space-y-1">
                    <div className="font-bold uppercase text-slate-800">{domain}</div>
                    <ul className="list-disc pl-4 space-y-1 text-slate-700">
                      {list.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* 17. AI Requirements */}
            <section id="prd-sec-17" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                17. AI Requirements & Guardrails
              </h3>
              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/40 text-xs space-y-2.5">
                <div>
                  <strong>Model Purpose:</strong> {sec.ai_requirements.model_purpose}
                </div>
                <div>
                  <strong>Inputs:</strong> {sec.ai_requirements.inputs.join("; ")}
                </div>
                <div>
                  <strong>Outputs:</strong> {sec.ai_requirements.outputs.join("; ")}
                </div>
                <div>
                  <strong>Safety Guardrails:</strong>{" "}
                  {sec.ai_requirements.guardrails.join(" | ")}
                </div>
                <div>
                  <strong>Human-in-the-Loop:</strong>{" "}
                  {sec.ai_requirements.human_in_loop.join(" | ")}
                </div>
                <div>
                  <strong>Evaluation Benchmarks:</strong>{" "}
                  {sec.ai_requirements.evaluation_metrics.join(" | ")}
                </div>
                <div>
                  <strong>Failure Handling:</strong>{" "}
                  {sec.ai_requirements.failure_handling.join(" | ")}
                </div>
              </div>
            </section>

            {/* 18. Risks */}
            <section id="prd-sec-18" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                18. Risks
              </h3>
              <div className="space-y-2 text-xs">
                {sec.risks.map((r) => (
                  <div key={r.id} className="p-3 rounded border border-slate-200 flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono font-bold mr-2">{r.id}</span>
                      <strong>[{r.category}]</strong> {r.description} →{" "}
                      <span className="text-slate-600">Mitigation: {r.mitigation}</span>
                    </div>
                    <SeverityBadge severity={r.severity} />
                  </div>
                ))}
              </div>
            </section>

            {/* 19. Assumptions & 20. Open Questions & 21. Dependencies */}
            <section id="prd-sec-19" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                19. Assumptions
              </h3>
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                {req.assumptions.map((a) => (
                  <li key={a.id}>
                    <strong>{a.id} ({a.source}):</strong> {a.text}
                  </li>
                ))}
              </ul>
            </section>

            <section id="prd-sec-20" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                20. Open Questions ({amb.ambiguities.filter((a) => a.status === "Open").length} Open)
              </h3>
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                {amb.ambiguities.map((a) => (
                  <li key={a.id}>
                    <strong>[{a.status.toUpperCase()} · {a.id}]</strong> {a.question}
                    {a.resolution ? (
                      <span className="text-emerald-800 font-semibold">
                        {" "}
                        → Confirmed: {a.resolution}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <section id="prd-sec-21" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                21. Dependencies
              </h3>
              <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
                {sec.dependencies.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </section>

            {/* 22. MVP & 23. Phase 2 */}
            <section id="prd-sec-22" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                22. MVP Scope (P0 Must-Have & P1 Should-Have)
              </h3>
              <div className="space-y-2 text-xs">
                {prd.mvp_prioritization
                  .filter((m) => m.priority === "P0" || m.priority === "P1")
                  .map((m) => (
                    <div key={m.id} className="p-3 rounded border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold mr-2">{m.id}</span>
                        <span className="font-semibold text-slate-900">{m.feature}</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">{m.reasoning}</p>
                      </div>
                      <PriorityBadge priority={m.priority} />
                    </div>
                  ))}
              </div>
            </section>

            <section id="prd-sec-23" className="space-y-2 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                23. Phase 2 & Out of Scope
              </h3>
              <div className="space-y-2 text-xs">
                {prd.mvp_prioritization
                  .filter((m) => m.priority === "P2" || m.priority === "Out of Scope")
                  .map((m) => (
                    <div key={m.id} className="p-3 rounded border border-slate-200 flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold mr-2">{m.id}</span>
                        <span className="font-semibold text-slate-900">{m.feature}</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">{m.reasoning}</p>
                      </div>
                      <PriorityBadge priority={m.priority} />
                    </div>
                  ))}
              </div>
            </section>

            {/* 24. Recommended Implementation Sequence */}
            <section id="prd-sec-24" className="space-y-3 scroll-mt-24">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                24. Recommended Implementation Sequence
              </h3>
              <div className="space-y-3 text-xs">
                {sec.recommended_implementation_sequence.map((seq) => (
                  <div key={seq.phase} className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {seq.phase}: {seq.title}
                      </span>
                      <span className="font-mono text-slate-600">{seq.duration_estimate}</span>
                    </div>
                    <ul className="list-disc pl-5 text-slate-700 space-y-0.5">
                      {seq.deliverables.map((deliv, i) => (
                        <li key={i}>{deliv}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
