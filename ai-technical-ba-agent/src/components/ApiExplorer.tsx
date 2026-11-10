"use client";

import React, { useState } from "react";
import { ApiEndpointSpec } from "@/lib/types";
import { ConfidenceBadge, TechnicalTierBadge } from "./GuardrailBadges";
import {
  Lock,
  Layers,
  AlertTriangle,
  Copy,
  Check,
  Server,
} from "lucide-react";

export function ApiExplorer({ apis }: { apis: ApiEndpointSpec[] }) {
  const [selectedApiId, setSelectedApiId] = useState<string>(apis[0]?.id || "");
  const [copiedPayload, setCopiedPayload] = useState<"req" | "res" | null>(null);

  const selectedApi = apis.find((a) => a.id === selectedApiId) || apis[0];

  const methodBadgeStyle = (method: ApiEndpointSpec["method"]) => {
    switch (method) {
      case "GET":
        return "bg-emerald-100 text-emerald-900 border-emerald-300";
      case "POST":
        return "bg-blue-100 text-blue-900 border-blue-300";
      case "PUT":
      case "PATCH":
        return "bg-amber-100 text-amber-900 border-amber-300";
      case "DELETE":
        return "bg-rose-100 text-rose-900 border-rose-300";
    }
  };

  const handleCopyJson = (type: "req" | "res", payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(type);
    setTimeout(() => setCopiedPayload(null), 1800);
  };

  if (!selectedApi) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 5 cols: Endpoint Selector List */}
      <div className="lg:col-span-5 space-y-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-1 mb-2">
          Identified REST Endpoints ({apis.length}) — Click to Inspect Contract
        </div>
        {apis.map((api) => {
          const isSelected = api.id === selectedApi.id;
          return (
            <button
              key={api.id}
              type="button"
              onClick={() => setSelectedApiId(api.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-900 border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${methodBadgeStyle(
                      api.method
                    )}`}
                  >
                    {api.method}
                  </span>
                  <span className="font-mono text-xs font-semibold truncate">
                    {api.endpoint}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono ${
                    isSelected ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {api.id}
                </span>
              </div>
              <div
                className={`text-xs font-medium ${
                  isSelected ? "text-slate-100" : "text-slate-800"
                }`}
              >
                {api.name}
              </div>
              <p
                className={`text-[11px] mt-0.5 line-clamp-2 ${
                  isSelected ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {api.purpose}
              </p>
            </button>
          );
        })}
      </div>

      {/* Right 7 cols: Active Endpoint Contract Details */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm">
        <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`font-mono text-xs font-bold px-2.5 py-1 rounded border ${methodBadgeStyle(
                  selectedApi.method
                )}`}
              >
                {selectedApi.method}
              </span>
              <code className="text-base font-mono font-bold text-slate-900">
                {selectedApi.endpoint}
              </code>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 mt-2">
              {selectedApi.name}
            </h3>
            <p className="text-xs text-slate-600 mt-1">{selectedApi.purpose}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TechnicalTierBadge tier={selectedApi.tier} />
            <ConfidenceBadge level={selectedApi.confidence} />
          </div>
        </div>

        {/* Auth & Dependencies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
              <Lock className="w-3.5 h-3.5 text-slate-600" />
              Authentication & Security
            </div>
            <p className="text-xs text-slate-700 font-mono">{selectedApi.authentication}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              Downstream Dependencies
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {selectedApi.dependencies.map((dep) => (
                <span
                  key={dep}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                >
                  <Server className="w-3 h-3 text-slate-400" />
                  {dep}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Request & Response Payloads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-900 text-slate-100">
            <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-slate-300">
                Request Payload / Params
              </span>
              <button
                type="button"
                onClick={() => handleCopyJson("req", selectedApi.request_data)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
              >
                {copiedPayload === "req" ? (
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
            <pre className="p-3.5 text-xs font-mono text-sky-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(selectedApi.request_data, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-900 text-slate-100">
            <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-slate-300">
                200 OK Response Payload
              </span>
              <button
                type="button"
                onClick={() => handleCopyJson("res", selectedApi.response_data)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
              >
                {copiedPayload === "res" ? (
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
            <pre className="p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(selectedApi.response_data, null, 2)}
            </pre>
          </div>
        </div>

        {/* Failure Scenarios */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Error & Failure Scenarios ({selectedApi.failure_scenarios.length})
          </h4>
          <div className="space-y-2.5">
            {selectedApi.failure_scenarios.map((fail) => (
              <div
                key={fail.error_code}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200">
                      HTTP {fail.status_code}
                    </span>
                    <code className="font-mono font-semibold text-slate-900">
                      {fail.error_code}
                    </code>
                  </div>
                  <p className="text-slate-700">
                    <strong>Scenario:</strong> {fail.scenario}
                  </p>
                  <p className="text-slate-600">
                    <strong>Mitigation:</strong> {fail.mitigation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
