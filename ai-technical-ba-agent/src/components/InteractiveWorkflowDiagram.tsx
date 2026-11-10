"use client";

import React, { useState } from "react";
import {
  WorkflowMapperOutput,
  WorkflowNode,
  RequirementsAnalystOutput,
  TraceableItem,
} from "@/lib/types";
import { ConfidenceBadge, ProvenanceBadge } from "./GuardrailBadges";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GitBranch,
  UserCheck,
  AlertOctagon,
  Code2,
  Copy,
  Check,
  ArrowRight,
  Cpu,
  Play,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

export function InteractiveWorkflowDiagram({
  workflow,
  requirements,
}: {
  workflow: WorkflowMapperOutput;
  requirements: RequirementsAnalystOutput;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    workflow.steps[0]?.id || ""
  );
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showMermaidCode, setShowMermaidCode] = useState(false);
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const allReqsMap = new Map<string, TraceableItem>();
  for (const r of [
    ...requirements.explicit_requirements,
    ...requirements.implied_requirements,
    ...requirements.capabilities,
  ]) {
    allReqsMap.set(r.id, r);
  }

  const selectedNode: WorkflowNode | undefined =
    workflow.steps.find((s) => s.id === selectedNodeId) || workflow.steps[0];

  const linkedReqs: TraceableItem[] = (selectedNode?.linked_requirement_ids || [])
    .map((id) => allReqsMap.get(id))
    .filter((item): item is TraceableItem => Boolean(item));

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const copyMermaid = () => {
    navigator.clipboard.writeText(workflow.mermaid_diagram);
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const nodeTypeStyle = (type: WorkflowNode["type"], isSelected: boolean) => {
    const ring = isSelected ? "ring-2 ring-slate-900 shadow-md scale-[1.01]" : "hover:border-slate-400";
    switch (type) {
      case "trigger":
        return `bg-slate-900 text-white border-slate-900 ${
          isSelected ? "ring-2 ring-blue-500 shadow-md" : ""
        }`;
      case "decision":
        return `bg-amber-50/90 text-amber-950 border-amber-300 ${ring}`;
      case "ai_action":
        return `bg-indigo-50/90 text-indigo-950 border-indigo-300 ${ring}`;
      case "human_handoff":
        return `bg-purple-50/90 text-purple-950 border-purple-300 ${ring}`;
      case "success":
        return `bg-emerald-50/90 text-emerald-950 border-emerald-300 ${ring}`;
      case "failure":
        return `bg-rose-50/90 text-rose-950 border-rose-300 ${ring}`;
      default:
        return `bg-white text-slate-900 border-slate-200 ${ring}`;
    }
  };

  const nodeTypeIcon = (type: WorkflowNode["type"]) => {
    switch (type) {
      case "trigger":
        return <Play className="w-3.5 h-3.5 text-emerald-400" />;
      case "decision":
        return <HelpCircle className="w-3.5 h-3.5 text-amber-600" />;
      case "ai_action":
        return <Cpu className="w-3.5 h-3.5 text-indigo-600" />;
      case "human_handoff":
        return <UserCheck className="w-3.5 h-3.5 text-purple-600" />;
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "failure":
        return <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <GitBranch className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Diagram Canvas + Selected Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Zoom/Pan Interactive Canvas */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Interactive State-Machine Workflow
              </h3>
              <p className="text-xs text-slate-500">
                Click any node to inspect linked requirements. Drag canvas to pan or use zoom controls.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-slate-600 px-1.5">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetViewport}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                title="Reset View"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowMermaidCode((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  showMermaidCode
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Mermaid
              </button>
            </div>
          </div>

          {showMermaidCode && (
            <div className="border-b border-slate-200 bg-slate-900 text-slate-100 p-4 text-xs font-mono relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">Mermaid Flowchart Definition</span>
                <button
                  type="button"
                  onClick={copyMermaid}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                >
                  {copiedMermaid ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Mermaid
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed text-emerald-300">
                {workflow.mermaid_diagram}
              </pre>
            </div>
          )}

          {/* Interactive Graph Viewport */}
          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] min-h-[520px] p-6 select-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top center",
              }}
              className="transition-transform duration-75 max-w-xl mx-auto space-y-3"
            >
              {workflow.steps.map((node, idx) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div key={node.id} className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full text-left rounded-lg border p-3.5 transition-all ${nodeTypeStyle(
                        node.type,
                        isSelected
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {nodeTypeIcon(node.type)}
                          <span className="font-mono text-xs opacity-75">{node.id}</span>
                          <span className="text-sm font-semibold">{node.label}</span>
                        </div>
                        <span
                          className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded ${
                            node.type === "trigger"
                              ? "bg-slate-800 text-slate-200"
                              : "bg-black/5 text-current"
                          }`}
                        >
                          {node.type.replace("_", " ")}
                        </span>
                      </div>
                      <p
                        className={`text-xs leading-relaxed ${
                          node.type === "trigger" ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {node.description}
                      </p>
                      <div className="mt-2 pt-2 border-t border-black/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="opacity-80">
                          Actor: <strong>{node.actor}</strong>
                        </span>
                        <span className="font-mono opacity-80">
                          {node.linked_requirement_ids.length} linked req(s)
                        </span>
                      </div>
                    </button>

                    {/* Branch connectors */}
                    {node.next_nodes.length > 0 && idx < workflow.steps.length - 1 && (
                      <div className="flex flex-wrap items-center justify-center gap-3 py-1.5">
                        {node.next_nodes.map((edge) => (
                          <button
                            key={`${node.id}-${edge.target_id}`}
                            type="button"
                            onClick={() => setSelectedNodeId(edge.target_id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-300 text-[11px] font-medium text-slate-700 hover:border-slate-900 shadow-sm"
                          >
                            {edge.condition ? (
                              <span className="font-semibold text-slate-900">{edge.condition}</span>
                            ) : (
                              <span>Next</span>
                            )}
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                            <span className="font-mono text-slate-600">{edge.target_id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Node Selection & Associated Requirements Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                  Selected Workflow Node
                </span>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                  {selectedNode?.id}: {selectedNode?.label}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded text-xs font-mono uppercase bg-slate-100 text-slate-800 border border-slate-200">
                {selectedNode?.type.replace("_", " ")}
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Primary Actor</span>
                <p className="text-slate-900 font-medium mt-0.5">{selectedNode?.actor}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-slate-500 uppercase">Step Behavior</span>
                <p className="text-slate-700 text-xs leading-relaxed mt-0.5">
                  {selectedNode?.description}
                </p>
              </div>

              {selectedNode && selectedNode.next_nodes.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">
                    Outbound Transitions
                  </span>
                  <div className="mt-1.5 space-y-1.5">
                    {selectedNode.next_nodes.map((edge) => {
                      const target = workflow.steps.find((s) => s.id === edge.target_id);
                      return (
                        <button
                          key={edge.target_id}
                          type="button"
                          onClick={() => setSelectedNodeId(edge.target_id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs text-left transition"
                        >
                          <span>
                            {edge.condition ? (
                              <strong className="text-slate-900">{edge.condition}: </strong>
                            ) : null}
                            <span className="text-slate-700">
                              {target ? `${target.id} — ${target.label}` : edge.target_id}
                            </span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                    Associated Requirements ({linkedReqs.length})
                  </span>
                </div>
                {linkedReqs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    No direct requirement IDs linked to this node.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {linkedReqs.map((reqItem) => (
                      <div
                        key={reqItem.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-900">
                            {reqItem.id}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <ProvenanceBadge source={reqItem.source} />
                            <ConfidenceBadge level={reqItem.confidence} />
                          </div>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{reqItem.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Terminal Success State Card */}
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-900 mb-1">
              Terminal Success State
            </div>
            <p className="text-xs text-emerald-950 leading-relaxed">{workflow.success_state}</p>
          </div>
        </div>
      </div>

      {/* Decisions, Human Handoffs, and Failure States */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Human Handoffs */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-600" />
            Human-in-the-Loop Handoffs ({workflow.human_handoffs.length})
          </h4>
          <div className="space-y-3">
            {workflow.human_handoffs.map((ho) => (
              <div
                key={ho.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-900">{ho.id}</span>
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-medium">
                    SLA: {ho.sla_expectation}
                  </span>
                </div>
                <p className="text-slate-800 font-medium">
                  {ho.from_actor} → {ho.to_actor}
                </p>
                <p className="text-slate-600">
                  <strong>Trigger:</strong> {ho.trigger_condition}
                </p>
                <p className="text-slate-600">
                  <strong>Context Passed:</strong> {ho.context_passed.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Failure States */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            Failure States & Recovery ({workflow.failure_states.length})
          </h4>
          <div className="space-y-3">
            {workflow.failure_states.map((fs) => (
              <div
                key={fs.id}
                className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/40 space-y-1.5 text-xs"
              >
                <span className="font-mono font-semibold text-rose-950">{fs.id}</span>
                <p className="text-slate-800">
                  <strong>Trigger:</strong> {fs.trigger}
                </p>
                <p className="text-slate-700">
                  <strong>Recovery Action:</strong> {fs.recovery_action}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
