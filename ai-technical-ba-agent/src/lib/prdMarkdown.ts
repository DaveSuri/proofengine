import type {
  RequirementsAnalystOutput,
  AmbiguityDetectorOutput,
  WorkflowMapperOutput,
  TechnicalAnalystOutput,
  ApiDataAnalystOutput,
  AcceptanceCriteriaOutput,
  QaReviewerOutput,
  PrdSections,
  MvpFeatureClassification,
  SpecificationQualityScore,
  OptionalContext,
} from "./types";

export function generatePrdMarkdown(params: {
  title: string;
  rawRequirement: string;
  context: OptionalContext;
  req: RequirementsAnalystOutput;
  amb: AmbiguityDetectorOutput;
  wf: WorkflowMapperOutput;
  tech: TechnicalAnalystOutput;
  apiData: ApiDataAnalystOutput;
  ac: AcceptanceCriteriaOutput;
  qa: QaReviewerOutput;
  sections: PrdSections;
  mvp: MvpFeatureClassification[];
  quality: SpecificationQualityScore;
}): string {
  const {
    title,
    rawRequirement,
    context,
    req,
    amb,
    wf,
    tech,
    apiData,
    ac,
    qa,
    sections,
    mvp,
    quality,
  } = params;

  const openAmbiguities = amb.ambiguities.filter((a) => a.status === "Open");
  const resolvedAmbiguities = amb.ambiguities.filter((a) => a.status === "Resolved");

  return `# Technical Product Requirements Document (PRD): ${title}

> **AI Governance Notice:** AI-generated specifications require human validation before engineering implementation. Every item below carries explicit provenance (\`User-provided information\`, \`AI inference\`, or \`AI recommendation\`) and confidence scoring (\`High\`, \`Medium\`, \`Low\`).
>
> **Specification Quality Score:** **${quality.overall_score} / 100** | **Open Ambiguities:** ${openAmbiguities.length} | **Resolved Clarifications:** ${resolvedAmbiguities.length}

---

## 1. Executive Summary

${sections.executive_summary}

**Original Business Request:**
> "${rawRequirement}"

${
  context.businessProduct || context.timeline || context.budget
    ? `**Business Context Provided:**
- **Business / Product:** ${context.businessProduct || "Not specified (AI inferred)"}
- **Target Users:** ${context.targetUsers || "Not specified (AI inferred)"}
- **Existing Systems:** ${context.existingSystems || "Not specified"}
- **Known Constraints:** ${context.knownConstraints || "Not specified"}
- **Timeline:** ${context.timeline || "Not specified"}
- **Budget:** ${context.budget || "Not specified"}`
    : ""
}

---

## 2. Problem Statement

${sections.problem_statement}

---

## 3. Business Objective

${sections.business_objective}

### Key Business Objectives
${req.business_objectives.map((b) => `- ${b}`).join("\n")}

### Desired Measurable Outcomes
${req.desired_outcomes.map((o) => `- ${o}`).join("\n")}

---

## 4. Users & Personas

${sections.users_and_personas
  .map(
    (p) => `### ${p.name} (${p.role})
- **Core Goals:** ${p.goals.join("; ")}
- **Key Pain Points:** ${p.pain_points.join("; ")}`
  )
  .join("\n\n")}

### System Actors
| Actor | Role / Responsibility | Classification |
| :--- | :--- | :--- |
${req.actors.map((a) => `| **${a.name}** | ${a.role} | \`${a.type}\` |`).join("\n")}

---

## 5. Goals

${sections.goals.map((g) => `- ${g}`).join("\n")}

---

## 6. Non-Goals

${sections.non_goals.map((ng) => `- ${ng}`).join("\n")}

---

## 7. User Journeys

${sections.user_journeys
  .map(
    (j, idx) => `### 7.${idx + 1} ${j.name} (*Persona: ${j.persona}*)
${j.steps.map((s, sIdx) => `${sIdx + 1}. ${s}`).join("\n")}`
  )
  .join("\n\n")}

---

## 8. Functional Requirements

${sections.functional_requirements_summary}

### 8.1 Explicit Requirements
| ID | Requirement | Source Provenance | Confidence |
| :--- | :--- | :--- | :--- |
${req.explicit_requirements
  .map((r) => `| \`${r.id}\` | ${r.text} | ${r.source} | **${r.confidence}** |`)
  .join("\n")}

### 8.2 Implied Engineering Requirements
| ID | Requirement | Source Provenance | Confidence |
| :--- | :--- | :--- | :--- |
${req.implied_requirements
  .map((r) => `| \`${r.id}\` | ${r.text} | ${r.source} | **${r.confidence}** |`)
  .join("\n")}

### 8.3 Core System Capabilities
${req.capabilities
  .map((c) => `- **\`${c.id}\`** (${c.source} · Confidence: ${c.confidence}): ${c.text}`)
  .join("\n")}

---

## 9. Workflow

${sections.workflow_summary}

- **Workflow Trigger:** ${wf.trigger}
- **Terminal Success State:** ${wf.success_state}

\`\`\`mermaid
${wf.mermaid_diagram}
\`\`\`

### 9.1 Decision Logic
| Decision ID | Question | Yes Branch | No Branch | Business Rule Reference |
| :--- | :--- | :--- | :--- | :--- |
${wf.decisions
  .map(
    (d) =>
      `| \`${d.id}\` | ${d.question} | ${d.yes_branch} | ${d.no_branch} | ${d.rule_reference} |`
  )
  .join("\n")}

### 9.2 Human Handoffs & Escalation Paths
${wf.human_handoffs
  .map(
    (h) =>
      `- **\`${h.id}\` (${h.from_actor} → ${h.to_actor}):** Triggered when *${h.trigger_condition}*. Context passed: \`${h.context_passed.join(", ")}\`. Target SLA: **${h.sla_expectation}**.`
  )
  .join("\n")}

---

## 10. Technical Requirements

${sections.technical_requirements_summary}

### 10.1 Frontend Architecture
${tech.frontend
  .map(
    (t) =>
      `- **[${t.tier}] \`${t.id}\` ${t.component}:** ${t.specification} *(Source: ${t.source}, Confidence: ${t.confidence})*`
  )
  .join("\n")}

### 10.2 Backend & Services
${[...tech.backend, ...tech.services]
  .map(
    (t) =>
      `- **[${t.tier}] \`${t.id}\` ${t.component}:** ${t.specification} *(Source: ${t.source}, Confidence: ${t.confidence})*`
  )
  .join("\n")}

### 10.3 Authentication & Authorization
${[...tech.authentication, ...tech.authorization]
  .map(
    (t) =>
      `- **[${t.tier}] \`${t.id}\` ${t.component}:** ${t.specification} *(Source: ${t.source}, Confidence: ${t.confidence})*`
  )
  .join("\n")}

### 10.4 Business Logic, Notifications & Background Jobs
${[...tech.business_logic, ...tech.notifications, ...tech.background_jobs]
  .map(
    (t) =>
      `- **[${t.tier}] \`${t.id}\` ${t.component}:** ${t.specification} *(Source: ${t.source}, Confidence: ${t.confidence})*`
  )
  .join("\n")}

### 10.5 Infrastructure & External Systems
${[...tech.external_systems, ...tech.infrastructure]
  .map(
    (t) =>
      `- **[${t.tier}] \`${t.id}\` ${t.component}:** ${t.specification} *(Source: ${t.source}, Confidence: ${t.confidence})*`
  )
  .join("\n")}

---

## 11. API Dependencies

${sections.api_dependencies_summary}

${apiData.apis
  .map(
    (api) => `### \`${api.method} ${api.endpoint}\` — ${api.name} (${api.tier})
- **Purpose:** ${api.purpose}
- **Authentication:** ${api.authentication}
- **Dependencies:** ${api.dependencies.join(", ") || "None"}
- **Failure Scenarios:**
${api.failure_scenarios
  .map((f) => `  - \`HTTP ${f.status_code} (${f.error_code})\`: ${f.scenario} → *Mitigation:* ${f.mitigation}`)
  .join("\n")}`
  )
  .join("\n\n")}

---

## 12. Data Model

${sections.data_model_summary}

\`\`\`mermaid
${apiData.er_diagram_mermaid}
\`\`\`

${apiData.entities
  .map(
    (ent) => `### Entity: \`${ent.name}\`
${ent.description}

| Field | Type | Required | Sensitive / PII | Validation Rules |
| :--- | :--- | :--- | :--- | :--- |
${ent.fields
  .map(
    (f) =>
      `| \`${f.name}\` | \`${f.type}\` | ${f.required ? "Yes" : "No"} | ${
        f.sensitive ? `Yes (${f.pii_classification || "PII"})` : "No"
      } | ${f.validation} |`
  )
  .join("\n")}`
  )
  .join("\n\n")}

---

## 13. User Stories

${sections.user_stories_summary}

| ID | Priority | User Story | Reasoning | Confidence |
| :--- | :--- | :--- | :--- | :--- |
${ac.user_stories
  .map(
    (s) =>
      `| \`${s.id}\` | **${s.priority}** | ${s.formatted_story} | ${s.priority_reasoning} | ${s.confidence} |`
  )
  .join("\n")}

---

## 14. Acceptance Criteria

${sections.acceptance_criteria_summary}

${ac.acceptance_criteria
  .map(
    (c) => `### \`${c.id}\` [${c.category}] — ${c.title} (Story: \`${c.story_id}\`)
- **Given** ${c.given}
- **When** ${c.when}
- **Then** ${c.then}`
  )
  .join("\n\n")}

---

## 15. Edge Cases & QA Matrix

${sections.edge_cases_summary}

| ID | Severity | Category | Scenario | Recommended Mitigation |
| :--- | :--- | :--- | :--- | :--- |
${qa.edge_cases
  .map(
    (e) =>
      `| \`${e.id}\` | **${e.severity}** | ${e.category} | ${e.scenario} | ${e.recommended_mitigation} |`
  )
  .join("\n")}

---

## 16. Non-Functional Requirements

### 16.1 Performance
${sections.non_functional_requirements.performance.map((i) => `- ${i}`).join("\n")}

### 16.2 Reliability & Availability
${sections.non_functional_requirements.reliability.map((i) => `- ${i}`).join("\n")}

### 16.3 Security
${sections.non_functional_requirements.security.map((i) => `- ${i}`).join("\n")}

### 16.4 Privacy & Data Governance
${sections.non_functional_requirements.privacy.map((i) => `- ${i}`).join("\n")}

### 16.5 Scalability
${sections.non_functional_requirements.scalability.map((i) => `- ${i}`).join("\n")}

### 16.6 Observability & Auditability
${sections.non_functional_requirements.observability.map((i) => `- ${i}`).join("\n")}

---

## 17. AI Requirements & Guardrails

- **AI Components Involved:** ${sections.ai_requirements.involved ? "Yes" : "No"}
- **Model Purpose:** ${sections.ai_requirements.model_purpose}
- **Inputs:** ${sections.ai_requirements.inputs.join("; ")}
- **Outputs:** ${sections.ai_requirements.outputs.join("; ")}
- **Prompt Requirements:**
${sections.ai_requirements.prompt_requirements.map((p) => `  - ${p}`).join("\n")}
- **Context Requirements:**
${sections.ai_requirements.context_requirements.map((c) => `  - ${c}`).join("\n")}
- **Tool / Function Calling Usage:**
${sections.ai_requirements.tool_usage.map((t) => `  - ${t}`).join("\n")}
- **Safety & Determinism Guardrails:**
${sections.ai_requirements.guardrails.map((g) => `  - ${g}`).join("\n")}
- **Human-in-the-Loop Escalation:**
${sections.ai_requirements.human_in_loop.map((h) => `  - ${h}`).join("\n")}
- **Evaluation & Quality Benchmarks:**
${sections.ai_requirements.evaluation_metrics.map((e) => `  - ${e}`).join("\n")}
- **Failure Handling & Fallback:**
${sections.ai_requirements.failure_handling.map((f) => `  - ${f}`).join("\n")}

---

## 18. Risks

| ID | Category | Severity | Likelihood | Risk Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
${sections.risks
  .map(
    (r) =>
      `| \`${r.id}\` | ${r.category} | **${r.severity}** | ${r.likelihood} | ${r.description} | ${r.mitigation} |`
  )
  .join("\n")}

---

## 19. Assumptions

${req.assumptions
  .map((a) => `- **\`${a.id}\` (${a.source} · Confidence: ${a.confidence}):** ${a.text}`)
  .join("\n")}

---

## 20. Open Questions & Resolved Clarifications

### 20.1 Unresolved Ambiguities Requiring Stakeholder Sign-Off
${
  openAmbiguities.length === 0
    ? "_All identified ambiguities have been resolved by human review._"
    : openAmbiguities
        .map(
          (a) =>
            `- **[${a.severity}] \`${a.id}\` (${a.category}):** ${a.question}\n  - *Context:* ${a.description}\n  - *Impact if unresolved:* ${a.impact}`
        )
        .join("\n")
}

${
  resolvedAmbiguities.length > 0
    ? `### 20.2 Human-Validated Resolutions
${resolvedAmbiguities
  .map(
    (a) =>
      `- **[RESOLVED] \`${a.id}\`:** ${a.question}\n  - *Confirmed Decision:* **${a.resolution}**`
  )
  .join("\n")}`
    : ""
}

---

## 21. Dependencies

${sections.dependencies.map((d) => `- ${d}`).join("\n")}

---

## 22. MVP (P0 — Must Have & P1 — Should Have)

| ID | Tier | Feature | Effort | Business Value | Classification Reasoning |
| :--- | :--- | :--- | :--- | :--- | :--- |
${mvp
  .filter((m) => m.priority === "P0" || m.priority === "P1")
  .map(
    (m) =>
      `| \`${m.id}\` | **${m.priority}** | ${m.feature} | ${m.effort} | ${m.business_value} | ${m.reasoning} |`
  )
  .join("\n")}

---

## 23. Phase 2 & Out of Scope (P2 — Could Have & Out of Scope)

| ID | Tier | Feature | Effort | Business Value | Classification Reasoning |
| :--- | :--- | :--- | :--- | :--- | :--- |
${mvp
  .filter((m) => m.priority === "P2" || m.priority === "Out of Scope")
  .map(
    (m) =>
      `| \`${m.id}\` | **${m.priority}** | ${m.feature} | ${m.effort} | ${m.business_value} | ${m.reasoning} |`
  )
  .join("\n")}

---

## 24. Recommended Implementation Sequence

${sections.recommended_implementation_sequence
  .map(
    (seq) => `### ${seq.phase}: ${seq.title} (${seq.duration_estimate})
- **Deliverables:** ${seq.deliverables.join("; ")}
- **Prerequisites / Dependencies:** ${seq.dependencies.join(", ") || "None"}`
  )
  .join("\n\n")}
`;
}
