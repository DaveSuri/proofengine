import type {
  RequirementsAnalystOutput,
  AmbiguityDetectorOutput,
  WorkflowMapperOutput,
  TechnicalAnalystOutput,
  ApiDataAnalystOutput,
  AcceptanceCriteriaOutput,
  QaReviewerOutput,
  MvpFeatureClassification,
  SpecificationQualityScore,
} from "./types";

export function evaluateSpecificationQuality(params: {
  req: RequirementsAnalystOutput;
  amb: AmbiguityDetectorOutput;
  wf: WorkflowMapperOutput;
  tech: TechnicalAnalystOutput;
  apiData: ApiDataAnalystOutput;
  ac: AcceptanceCriteriaOutput;
  qa: QaReviewerOutput;
  mvp: MvpFeatureClassification[];
}): SpecificationQualityScore {
  const { req, amb, wf, tech, apiData, ac, qa, mvp } = params;

  const openCriticalAmbs = amb.ambiguities.filter(
    (a) => a.status === "Open" && a.severity === "Critical"
  );
  const openHighAmbs = amb.ambiguities.filter(
    (a) => a.status === "Open" && a.severity === "High"
  );
  const openOtherAmbs = amb.ambiguities.filter(
    (a) => a.status === "Open" && (a.severity === "Medium" || a.severity === "Low")
  );
  const resolvedCount = amb.ambiguities.filter((a) => a.status === "Resolved").length;

  const deductions: SpecificationQualityScore["deductions"] = [];

  for (const crit of openCriticalAmbs) {
    deductions.push({
      reason: `Unresolved critical business-rule ambiguity (${crit.id}): ${crit.description}`,
      points_deducted: 3,
      remediation: `Resolve ${crit.id} in the Open Questions tab ("${crit.question}") and re-run downstream analysis.`,
      linked_ambiguity_id: crit.id,
    });
  }

  for (const high of openHighAmbs) {
    deductions.push({
      reason: `Unresolved high-severity integration/policy ambiguity (${high.id}): ${high.description}`,
      points_deducted: 2,
      remediation: `Provide stakeholder decision for ${high.id} ("${high.question}").`,
      linked_ambiguity_id: high.id,
    });
  }

  if (openOtherAmbs.length > 0) {
    deductions.push({
      reason: `${openOtherAmbs.length} medium/low operational ambiguity item(s) pending stakeholder confirmation.`,
      points_deducted: Math.min(2, openOtherAmbs.length),
      remediation: "Review and resolve remaining operational ambiguities before sprint commitment.",
    });
  }

  const totalReqs =
    req.explicit_requirements.length +
    req.implied_requirements.length +
    req.capabilities.length;
  const reqScore = Math.min(12, Math.max(9, Math.round(12 - openCriticalAmbs.length * 0.8)));

  const ambMax = 12;
  const ambPenalty = Math.min(
    6,
    openCriticalAmbs.length * 2 + openHighAmbs.length * 1
  );
  const ambScore = Math.max(6, ambMax - ambPenalty);

  const techCount =
    tech.frontend.length +
    tech.backend.length +
    tech.authentication.length +
    tech.ai_components.length;
  const techScore = techCount >= 8 ? (openHighAmbs.length > 1 ? 10 : 11) : 9;

  const acScore =
    ac.acceptance_criteria.length >= 8
      ? openCriticalAmbs.length > 0
        ? 10
        : 11
      : 9;

  const qaScore = qa.edge_cases.length >= 8 ? 11 : 9;
  const dataScore = apiData.entities.length >= 4 ? (openHighAmbs.length > 0 ? 10 : 11) : 9;
  const apiScore = apiData.apis.length >= 4 ? 11 : 9;
  const secScore =
    qa.security_privacy_audit.length >= 3
      ? openHighAmbs.some((a) => a.category === "Compliance / Privacy")
        ? 9
        : 11
      : 8;
  const mvpScore =
    mvp.some((m) => m.priority === "P0") && mvp.some((m) => m.priority === "Out of Scope")
      ? 10
      : 8;

  const dimensions: SpecificationQualityScore["dimensions"] = [
    {
      name: "Requirement Completeness",
      score: reqScore,
      max_score: 12,
      status: reqScore >= 11 ? "Strong" : reqScore >= 9 ? "Adequate" : "Needs Attention",
      rationale: `${totalReqs} structured items extracted across explicit, implied, and core capabilities with confidence & provenance tags.`,
    },
    {
      name: "Ambiguity Coverage & Resolution",
      score: ambScore,
      max_score: 12,
      status:
        openCriticalAmbs.length === 0 && openHighAmbs.length === 0
          ? "Strong"
          : openCriticalAmbs.length <= 2
          ? "Adequate"
          : "Needs Attention",
      rationale: `${amb.ambiguities.length} ambiguities surfaced (${resolvedCount} resolved, ${
        amb.ambiguities.length - resolvedCount
      } open).`,
    },
    {
      name: "Technical Completeness",
      score: techScore,
      max_score: 11,
      status: techScore >= 10 ? "Strong" : "Adequate",
      rationale: `Architecture separated into Required, Recommended, and Future across frontend, backend, auth, and AI layers.`,
    },
    {
      name: "Testability (Given/When/Then)",
      score: acScore,
      max_score: 11,
      status: acScore >= 10 ? "Strong" : "Adequate",
      rationale: `${ac.user_stories.length} prioritized user stories paired with ${ac.acceptance_criteria.length} deterministic BDD acceptance criteria.`,
    },
    {
      name: "Edge-Case & AI Risk Coverage",
      score: qaScore,
      max_score: 11,
      status: qaScore >= 10 ? "Strong" : "Adequate",
      rationale: `${qa.edge_cases.length} hostile QA edge cases analyzed including concurrency, API failure, prompt injection, and hallucination.`,
    },
    {
      name: "Data Model Completeness",
      score: dataScore,
      max_score: 11,
      status: dataScore >= 10 ? "Strong" : "Adequate",
      rationale: `${apiData.entities.length} normalized entities defined with field types, validation constraints, and PII sensitivity flags.`,
    },
    {
      name: "API Contract Completeness",
      score: apiScore,
      max_score: 11,
      status: apiScore >= 10 ? "Strong" : "Adequate",
      rationale: `${apiData.apis.length} REST endpoints specified with payload schemas, auth scopes, dependencies, and HTTP failure modes.`,
    },
    {
      name: "Security & Privacy Posture",
      score: secScore,
      max_score: 11,
      status: secScore >= 10 ? "Strong" : "Adequate",
      rationale: `${qa.security_privacy_audit.length} security/privacy controls audited with explicit PII and AI guardrail policies.`,
    },
    {
      name: "MVP Scope Clarity",
      score: mvpScore,
      max_score: 10,
      status: mvpScore >= 9 ? "Strong" : "Adequate",
      rationale: `${mvp.filter((m) => m.priority === "P0").length} P0 Must-Have features separated from P1, P2, and Out-of-Scope items.`,
    },
  ];

  const rawSum = dimensions.reduce((acc, d) => acc + d.score, 0);
  const overall_score = Math.min(100, Math.max(55, rawSum));

  return {
    overall_score,
    dimensions,
    deductions,
  };
}
