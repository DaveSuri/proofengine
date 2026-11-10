"use client";

import React, { useState } from "react";
import { ApiDataAnalystOutput, DataEntitySpec } from "@/lib/types";
import { ConfidenceBadge, ProvenanceBadge } from "./GuardrailBadges";
import {
  Database,
  ShieldAlert,
  Link2,
  Code2,
  Copy,
  Check,
  Info,
} from "lucide-react";

export function DataModelExplorer({ dataModel }: { dataModel: ApiDataAnalystOutput }) {
  const [selectedEntityName, setSelectedEntityName] = useState<string>(
    dataModel.entities[0]?.name || ""
  );
  const [showMermaidEr, setShowMermaidEr] = useState(false);
  const [copiedEr, setCopiedEr] = useState(false);

  const selectedEntity: DataEntitySpec | undefined =
    dataModel.entities.find((e) => e.name === selectedEntityName) ||
    dataModel.entities[0];

  const handleCopyEr = () => {
    navigator.clipboard.writeText(dataModel.er_diagram_mermaid);
    setCopiedEr(true);
    setTimeout(() => setCopiedEr(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* ER Diagram Visual Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" />
              Entity-Relationship (ER) Topology ({dataModel.entities.length} Entities)
            </h3>
            <p className="text-xs text-slate-500">
              Select any entity node below to inspect its schema, validation rules, PII classification, and relationships.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMermaidEr((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition ${
              showMermaidEr
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            {showMermaidEr ? "Hide Mermaid ER" : "View Mermaid ER"}
          </button>
        </div>

        {showMermaidEr && (
          <div className="p-4 bg-slate-900 text-slate-100 border-b border-slate-200 text-xs font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400">Mermaid erDiagram Definition</span>
              <button
                type="button"
                onClick={handleCopyEr}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                {copiedEr ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="text-emerald-300 overflow-x-auto leading-relaxed">
              {dataModel.er_diagram_mermaid}
            </pre>
          </div>
        )}

        {/* Interactive Visual ER Grid */}
        <div className="p-5 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataModel.entities.map((ent) => {
              const isSelected = ent.name === selectedEntity?.name;
              const piiCount = ent.fields.filter((f) => f.sensitive).length;
              return (
                <button
                  key={ent.name}
                  type="button"
                  onClick={() => setSelectedEntityName(ent.name)}
                  className={`text-left rounded-xl border p-4 transition-all ${
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900 shadow-md"
                      : "bg-white text-slate-900 border-slate-200 hover:border-slate-400 shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/10">
                    <span className="font-mono text-sm font-bold">{ent.name}</span>
                    <div className="flex items-center gap-1.5">
                      {piiCount > 0 && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-rose-500/20 text-rose-200 border border-rose-400/30"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {piiCount} PII/Secret
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-mono ${
                          isSelected ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {ent.fields.length} cols
                      </span>
                    </div>
                  </div>

                  {/* Preview fields */}
                  <div className="mt-2.5 space-y-1 font-mono text-[11px]">
                    {ent.fields.slice(0, 4).map((f) => (
                      <div key={f.name} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {f.name}
                          {f.required ? "*" : ""}
                        </span>
                        <span
                          className={`truncate text-[10px] ${
                            isSelected ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {f.type}
                        </span>
                      </div>
                    ))}
                    {ent.fields.length > 4 && (
                      <div
                        className={`text-[10px] pt-0.5 ${
                          isSelected ? "text-slate-400" : "text-slate-400"
                        }`}
                      >
                        + {ent.fields.length - 4} more fields...
                      </div>
                    )}
                  </div>

                  {/* Relationships */}
                  <div className="mt-3 pt-2 border-t border-current/10 flex flex-wrap gap-1">
                    {ent.relationships.map((rel) => (
                      <span
                        key={`${ent.name}-${rel.target_entity}`}
                        className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-slate-800 text-slate-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {rel.cardinality} → {rel.target_entity}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Entity Deep-Dive Table */}
      {selectedEntity && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-900 text-white">
                  Entity Schema
                </span>
                <h3 className="text-base font-bold font-mono text-slate-900">
                  {selectedEntity.name}
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">{selectedEntity.description}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold">
                  <th className="py-3 px-4">Field Name</th>
                  <th className="py-3 px-4">Data Type</th>
                  <th className="py-3 px-4">Required</th>
                  <th className="py-3 px-4">Validation Rules</th>
                  <th className="py-3 px-4">Sensitivity / PII</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedEntity.fields.map((field) => (
                  <tr key={field.name} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {field.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-800">{field.type}</td>
                    <td className="py-3 px-4">
                      {field.required ? (
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-medium text-[11px]">
                          Required
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{field.validation}</td>
                    <td className="py-3 px-4">
                      {field.sensitive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-medium text-[11px]">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          {field.pii_classification || "PII / Sensitive"}
                        </span>
                      ) : (
                        <span className="text-slate-400">Standard</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{field.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Entity Relationships & Flagged Assumptions */}
          <div className="p-5 bg-slate-50 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-600" />
                Foreign Key & Cardinality Relationships
              </h4>
              <div className="space-y-1.5">
                {selectedEntity.relationships.map((rel) => (
                  <div
                    key={`${selectedEntity.name}-${rel.target_entity}`}
                    className="p-2.5 rounded bg-white border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-900">
                        {selectedEntity.name} ({rel.cardinality}) {rel.target_entity}
                      </span>
                      <p className="text-slate-600 mt-0.5">{rel.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEntityName(rel.target_entity)}
                      className="px-2 py-1 rounded text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium shrink-0"
                    >
                      Inspect {rel.target_entity} →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                Explicitly Flagged Data Model Assumptions
              </h4>
              <div className="space-y-2">
                {selectedEntity.assumptions.map((asm, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded bg-amber-50/70 border border-amber-200 text-amber-950"
                  >
                    <strong>Entity Assumption:</strong> {asm}
                  </div>
                ))}
                {dataModel.data_assumptions.map((dAsm) => (
                  <div
                    key={dAsm.id}
                    className="p-2.5 rounded bg-white border border-slate-200 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono font-semibold text-slate-800">{dAsm.id}</span>
                      <div className="flex items-center gap-1">
                        <ProvenanceBadge source={dAsm.source} />
                        <ConfidenceBadge level={dAsm.confidence} />
                      </div>
                    </div>
                    <p className="text-slate-700">{dAsm.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
