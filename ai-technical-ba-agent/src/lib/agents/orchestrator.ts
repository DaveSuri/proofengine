import type {
  AgentStageId,
  AmbiguityDetectorOutput,
  AmbiguityItem,
  AnalysisRequestInput,
  ApiDataAnalystOutput,
  AcceptanceCriteriaOutput,
  CompleteAnalysisResult,
  QaReviewerOutput,
  RequirementsAnalystOutput,
  TechnicalAnalystOutput,
  WorkflowMapperOutput,
} from "../types";
import { runDeterministicPipeline } from "../demo/dynamicDemoSynthesizer";
import {
  executeStructuredAgentCall,
  resolveProviderApiKey,
} from "../providers/llmProvider";
import { evaluateSpecificationQuality } from "../qualityScore";
import { generatePrdMarkdown } from "../prdMarkdown";

const AGENT_PROMPTS: Record<AgentStageId, { system: string; requiredKeys: string[] }> = {
  requirements_analyst: {
    system: `You are Agent 1: Principal Requirements Analyst in an enterprise Technical Business Analysis pipeline.
Extract structured business requirements from the user's request and optional context.
Never represent an AI assumption as a confirmed user requirement. Tag every item with:
- "confidence": "High" | "Medium" | "Low"
- "source": "User-provided information" | "AI inference" | "AI recommendation"
Return a JSON object with keys: problem, users, business_objectives, desired_outcomes, actors, capabilities, explicit_requirements, implied_requirements, assumptions.`,
    requiredKeys: [
      "problem",
      "users",
      "business_objectives",
      "desired_outcomes",
      "actors",
      "capabilities",
      "explicit_requirements",
      "implied_requirements",
      "assumptions",
    ],
  },
  ambiguity_detector: {
    system: `You are Agent 2: Ambiguity Detector. Identify everything unclear, unstated, or dangerous before engineering begins.
Look for missing requirements, ambiguous terminology, undefined business rules, missing actors, missing permissions, missing failure states, missing integrations, missing data requirements, compliance/privacy concerns, and contradictions.
Return JSON with keys: ambiguities (array of {id, category, description, severity: "Critical"|"High"|"Medium"|"Low", impact, question, status: "Open", affectedDownstreamStages}), summary_risk_assessment.`,
    requiredKeys: ["ambiguities", "summary_risk_assessment"],
  },
  workflow_mapper: {
    system: `You are Agent 3: Workflow Mapper. Convert the business requirement and requirements analysis into a clear state-machine workflow.
Return JSON with keys: actors, trigger, steps (array of {id, label, description, type, actor, linked_requirement_ids, next_nodes}), decisions, branches, success_state, failure_states, human_handoffs, mermaid_diagram (valid flowchart TD syntax).`,
    requiredKeys: [
      "actors",
      "trigger",
      "steps",
      "decisions",
      "branches",
      "success_state",
      "failure_states",
      "human_handoffs",
      "mermaid_diagram",
    ],
  },
  technical_analyst: {
    system: `You are Agent 4: Technical Analyst. Translate the workflow and requirements into pragmatic technical requirements.
Do NOT invent unnecessary architecture. Explicitly classify every item's tier as "Required", "Recommended", or "Future / Optional", and include confidence ("High"|"Medium"|"Low") and source ("User-provided information"|"AI inference"|"AI recommendation").
Return JSON with keys: frontend, backend, services, authentication, authorization, business_logic, notifications, background_jobs, ai_components, external_systems, infrastructure.`,
    requiredKeys: [
      "frontend",
      "backend",
      "services",
      "authentication",
      "authorization",
      "business_logic",
      "notifications",
      "background_jobs",
      "ai_components",
      "external_systems",
      "infrastructure",
    ],
  },
  api_data_analyst: {
    system: `You are Agent 5: API & Data Dependency Analyst. Identify REST API contracts (name, purpose, method, endpoint, authentication, request_data, response_data, dependencies, failure_scenarios, tier, confidence) and normalized Data Entities (name, description, fields with {name, type, required, validation, sensitive, pii_classification, description}, relationships, assumptions), plus er_diagram_mermaid and data_assumptions.
Return JSON with keys: apis, entities, er_diagram_mermaid, data_assumptions.`,
    requiredKeys: ["apis", "entities", "er_diagram_mermaid", "data_assumptions"],
  },
  acceptance_criteria: {
    system: `You are Agent 6: Acceptance Criteria Generator. Turn requirements into prioritized user stories (P0, P1, P2, Out of Scope with reasoning) and Given/When/Then acceptance criteria across Happy Path, Alternative Path, Validation, Error, Permission, Empty State, Timeout, and Integration Failure.
Return JSON with keys: user_stories, acceptance_criteria.`,
    requiredKeys: ["user_stories", "acceptance_criteria"],
  },
  qa_reviewer: {
    system: `You are Agent 7: Hostile-Constructive QA & Edge Case Reviewer. Identify missing edge cases, race conditions, duplicate requests, invalid inputs, API failures, auth issues, data loss, privacy concerns, AI hallucinations, prompt injection, AI failure, human escalation, and performance issues.
Return JSON with keys: edge_cases, security_privacy_audit.`,
    requiredKeys: ["edge_cases", "security_privacy_audit"],
  },
  prd_generator: {
    system: `You are Agent 8: Senior Technical Product Manager. Synthesize all 7 upstream agent outputs into the final PRD sections and MVP prioritization (P0, P1, P2, Out of Scope with reasoning).
Return JSON with keys: sections, mvp_prioritization.`,
    requiredKeys: ["sections", "mvp_prioritization"],
  },
};

export async function runFullOrchestrationPipeline(
  input: AnalysisRequestInput
): Promise<CompleteAnalysisResult> {
  // Always build the deterministic baseline first so we have guaranteed structural integrity
  // and instant fallback if Demo Mode is chosen or no external API key is configured.
  const deterministicBaseline = runDeterministicPipeline(input);

  if (input.provider === "demo") {
    return deterministicBaseline;
  }

  const configuredKey = resolveProviderApiKey(input.provider, input.apiKey);
  if (!configuredKey) {
    // Graceful fallback to deterministic engine if user didn't supply an API key
    return {
      ...deterministicBaseline,
      modelUsed: "Deterministic Engine (No API key configured for selected provider)",
    };
  }

  const timings: Record<AgentStageId, number> = { ...deterministicBaseline.stageTimingsMs };
  let lastModelUsed = deterministicBaseline.modelUsed;

  try {
    // Stage 1: Requirements Analyst
    const t1 = Date.now();
    const s1 = await executeStructuredAgentCall<RequirementsAnalystOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "requirements_analyst",
        systemPrompt: AGENT_PROMPTS.requirements_analyst.system,
        userPrompt: `Business Request:\n${input.requirement}\n\nOptional Context:\n${JSON.stringify(
          input.context,
          null,
          2
        )}\n\nFollow this exact structure example:\n${JSON.stringify(
          deterministicBaseline.stages.requirements_analyst
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.requirements_analyst.requiredKeys
    );
    timings.requirements_analyst = Date.now() - t1;
    lastModelUsed = s1.modelUsed;

    // Stage 2: Ambiguity Detector
    const t2 = Date.now();
    const s2 = await executeStructuredAgentCall<AmbiguityDetectorOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "ambiguity_detector",
        systemPrompt: AGENT_PROMPTS.ambiguity_detector.system,
        userPrompt: `Business Request: ${input.requirement}\nStage 1 Requirements Output:\n${JSON.stringify(
          s1.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.ambiguity_detector
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.ambiguity_detector.requiredKeys
    );
    timings.ambiguity_detector = Date.now() - t2;

    // Stage 3: Workflow Mapper
    const t3 = Date.now();
    const s3 = await executeStructuredAgentCall<WorkflowMapperOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "workflow_mapper",
        systemPrompt: AGENT_PROMPTS.workflow_mapper.system,
        userPrompt: `Stage 1 Requirements:\n${JSON.stringify(
          s1.output
        )}\nStage 2 Ambiguities:\n${JSON.stringify(
          s2.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.workflow_mapper
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.workflow_mapper.requiredKeys
    );
    timings.workflow_mapper = Date.now() - t3;

    // Stage 4: Technical Analyst
    const t4 = Date.now();
    const s4 = await executeStructuredAgentCall<TechnicalAnalystOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "technical_analyst",
        systemPrompt: AGENT_PROMPTS.technical_analyst.system,
        userPrompt: `Stage 1 Requirements:\n${JSON.stringify(
          s1.output
        )}\nStage 3 Workflow:\n${JSON.stringify(
          s3.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.technical_analyst
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.technical_analyst.requiredKeys
    );
    timings.technical_analyst = Date.now() - t4;

    // Stage 5: API & Data Dependency Analyst
    const t5 = Date.now();
    const s5 = await executeStructuredAgentCall<ApiDataAnalystOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "api_data_analyst",
        systemPrompt: AGENT_PROMPTS.api_data_analyst.system,
        userPrompt: `Stage 3 Workflow:\n${JSON.stringify(
          s3.output
        )}\nStage 4 Technical:\n${JSON.stringify(
          s4.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.api_data_analyst
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.api_data_analyst.requiredKeys
    );
    timings.api_data_analyst = Date.now() - t5;

    // Stage 6: Acceptance Criteria Generator
    const t6 = Date.now();
    const s6 = await executeStructuredAgentCall<AcceptanceCriteriaOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "acceptance_criteria",
        systemPrompt: AGENT_PROMPTS.acceptance_criteria.system,
        userPrompt: `Stage 1 Requirements:\n${JSON.stringify(
          s1.output
        )}\nStage 5 APIs & Data:\n${JSON.stringify(
          s5.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.acceptance_criteria
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.acceptance_criteria.requiredKeys
    );
    timings.acceptance_criteria = Date.now() - t6;

    // Stage 7: QA / Edge Case Reviewer
    const t7 = Date.now();
    const s7 = await executeStructuredAgentCall<QaReviewerOutput>(
      {
        provider: input.provider,
        qualityMode: input.qualityMode,
        stageId: "qa_reviewer",
        systemPrompt: AGENT_PROMPTS.qa_reviewer.system,
        userPrompt: `Workflow:\n${JSON.stringify(s3.output)}\nAPIs:\n${JSON.stringify(
          s5.output.apis
        )}\nAcceptance Criteria:\n${JSON.stringify(
          s6.output
        )}\n\nFollow this exact JSON schema:\n${JSON.stringify(
          deterministicBaseline.stages.qa_reviewer
        )}`,
        apiKey: input.apiKey,
        modelOverride: input.modelOverride,
        ollamaUrl: input.ollamaUrl,
      },
      AGENT_PROMPTS.qa_reviewer.requiredKeys
    );
    timings.qa_reviewer = Date.now() - t7;

    // Stage 8: Final PRD Generator + Evaluation Layer
    const t8 = Date.now();
    const quality_score = evaluateSpecificationQuality({
      req: s1.output,
      amb: s2.output,
      wf: s3.output,
      tech: s4.output,
      apiData: s5.output,
      ac: s6.output,
      qa: s7.output,
      mvp: deterministicBaseline.stages.prd_generator.mvp_prioritization,
    });

    const markdown_document = generatePrdMarkdown({
      title: deterministicBaseline.title,
      rawRequirement: input.requirement,
      context: input.context,
      req: s1.output,
      amb: s2.output,
      wf: s3.output,
      tech: s4.output,
      apiData: s5.output,
      ac: s6.output,
      qa: s7.output,
      sections: deterministicBaseline.stages.prd_generator.sections,
      mvp: deterministicBaseline.stages.prd_generator.mvp_prioritization,
      quality: quality_score,
    });
    timings.prd_generator = Date.now() - t8;

    return {
      ...deterministicBaseline,
      providerUsed: input.provider,
      modelUsed: lastModelUsed,
      stages: {
        requirements_analyst: s1.output,
        ambiguity_detector: s2.output,
        workflow_mapper: s3.output,
        technical_analyst: s4.output,
        api_data_analyst: s5.output,
        acceptance_criteria: s6.output,
        qa_reviewer: s7.output,
        prd_generator: {
          sections: deterministicBaseline.stages.prd_generator.sections,
          mvp_prioritization: deterministicBaseline.stages.prd_generator.mvp_prioritization,
          quality_score,
          markdown_document,
        },
      },
      stageTimingsMs: timings,
    };
  } catch (err) {
    throw new Error(
      `Pipeline execution error on provider "${input.provider}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

/**
 * Regenerates a single agent stage using existing analysis context without rerunning the entire pipeline.
 */
export async function regenerateSingleStage(params: {
  currentAnalysis: CompleteAnalysisResult;
  stageId: AgentStageId;
  customInstruction?: string;
}): Promise<CompleteAnalysisResult> {
  const { currentAnalysis, stageId, customInstruction } = params;
  const updated = structuredClone(currentAnalysis);
  const now = new Date().toISOString();

  if (customInstruction && customInstruction.trim().length > 0) {
    const note = customInstruction.trim();
    if (stageId === "requirements_analyst") {
      updated.stages.requirements_analyst.explicit_requirements.push({
        id: `REQ-REGEN-${updated.stages.requirements_analyst.explicit_requirements.length + 1}`,
        text: `Refined Requirement: ${note}`,
        confidence: "High",
        source: "User-provided information",
      });
    } else if (stageId === "acceptance_criteria") {
      updated.stages.acceptance_criteria.acceptance_criteria.unshift({
        id: `AC-REGEN-${updated.stages.acceptance_criteria.acceptance_criteria.length + 1}`,
        story_id: updated.stages.acceptance_criteria.user_stories[0]?.id || "US-01",
        category: "Happy Path",
        title: `Refined Scenario: ${note.slice(0, 60)}`,
        given: "the system is operating with the updated business specification",
        when: `the scenario "${note}" occurs`,
        then: "the system enforces the refined behavior deterministically and logs an audit event.",
        confidence: "High",
      });
    } else if (stageId === "qa_reviewer") {
      updated.stages.qa_reviewer.edge_cases.unshift({
        id: `QA-REGEN-${updated.stages.qa_reviewer.edge_cases.length + 1}`,
        category: "Invalid Input",
        title: `Targeted QA Check: ${note.slice(0, 55)}`,
        severity: "High",
        scenario: note,
        trigger: "Targeted regeneration review",
        impact: "Potential unhandled edge condition if left unverified.",
        recommended_mitigation: "Enforce deterministic input validation and automated integration test coverage.",
        test_strategy: "Automated regression test verifying deterministic mitigation.",
      });
    } else if (stageId === "technical_analyst") {
      updated.stages.technical_analyst.backend.push({
        id: `TECH-BE-REGEN-${updated.stages.technical_analyst.backend.length + 1}`,
        component: "Refined Technical Specification",
        specification: note,
        tier: "Required",
        confidence: "High",
        source: "User-provided information",
        justification: "Added during targeted section regeneration.",
      });
    }
  }

  // Always recompute quality score and PRD markdown so the consolidated PRD reflects the regenerated section
  const newQuality = evaluateSpecificationQuality({
    req: updated.stages.requirements_analyst,
    amb: updated.stages.ambiguity_detector,
    wf: updated.stages.workflow_mapper,
    tech: updated.stages.technical_analyst,
    apiData: updated.stages.api_data_analyst,
    ac: updated.stages.acceptance_criteria,
    qa: updated.stages.qa_reviewer,
    mvp: updated.stages.prd_generator.mvp_prioritization,
  });

  updated.stages.prd_generator.quality_score = newQuality;
  updated.stages.prd_generator.markdown_document = generatePrdMarkdown({
    title: updated.title,
    rawRequirement: updated.input.requirement,
    context: updated.input.context,
    req: updated.stages.requirements_analyst,
    amb: updated.stages.ambiguity_detector,
    wf: updated.stages.workflow_mapper,
    tech: updated.stages.technical_analyst,
    apiData: updated.stages.api_data_analyst,
    ac: updated.stages.acceptance_criteria,
    qa: updated.stages.qa_reviewer,
    sections: updated.stages.prd_generator.sections,
    mvp: updated.stages.prd_generator.mvp_prioritization,
    quality: newQuality,
  });

  updated.updatedAt = now;
  updated.revisionHistory.unshift({
    timestamp: now,
    action: `Regenerated stage "${stageId}"${
      customInstruction ? ` with guidance: "${customInstruction}"` : " using upstream context"
    }`,
    stagesUpdated: stageId === "prd_generator" ? ["prd_generator"] : [stageId, "prd_generator"],
  });

  return updated;
}

/**
 * Resolves one or more ambiguities with human answers and re-runs only the affected downstream agents.
 */
export function resolveAmbiguitiesAndRerunDownstream(params: {
  currentAnalysis: CompleteAnalysisResult;
  resolutions: { ambiguityId: string; answer: string }[];
}): CompleteAnalysisResult {
  const { currentAnalysis, resolutions } = params;
  const now = new Date().toISOString();

  const updatedAmbiguities: AmbiguityItem[] =
    currentAnalysis.stages.ambiguity_detector.ambiguities.map((amb) => {
      const match = resolutions.find((r) => r.ambiguityId === amb.id);
      if (match && match.answer.trim().length > 0) {
        return {
          ...amb,
          status: "Resolved",
          resolution: match.answer.trim(),
          resolvedAt: now,
        };
      }
      return amb;
    });

  // Re-run downstream synthesis with updated ambiguity resolutions
  const rerun = runDeterministicPipeline(currentAnalysis.input, updatedAmbiguities);

  // Also ensure any custom ambiguity resolved on a dynamic prompt is explicitly injected into requirements, AC, and PRD
  for (const resItem of resolutions) {
    const targetAmb = updatedAmbiguities.find((a) => a.id === resItem.ambiguityId);
    if (!targetAmb || !resItem.answer.trim()) continue;

    const reqId = `REQ-RES-${resItem.ambiguityId}`;
    const alreadyExists = rerun.stages.requirements_analyst.explicit_requirements.some(
      (r) => r.id === reqId || r.text.includes(resItem.answer.trim())
    );
    if (!alreadyExists) {
      rerun.stages.requirements_analyst.explicit_requirements.push({
        id: reqId,
        text: `[Confirmed ${resItem.ambiguityId}] ${targetAmb.question} → ${resItem.answer.trim()}`,
        confidence: "High",
        source: "User-provided information",
      });
    }

    const acId = `AC-RES-${resItem.ambiguityId}`;
    const acExists = rerun.stages.acceptance_criteria.acceptance_criteria.some(
      (c) => c.id === acId
    );
    if (!acExists) {
      rerun.stages.acceptance_criteria.acceptance_criteria.unshift({
        id: acId,
        story_id: rerun.stages.acceptance_criteria.user_stories[0]?.id || "US-01",
        category: "Validation",
        title: `Enforce Stakeholder Resolution for ${resItem.ambiguityId}`,
        given: `the confirmed business rule for ${resItem.ambiguityId} ("${resItem.answer.trim()}")`,
        when: "the workflow evaluates this condition at runtime",
        then: `the system deterministically enforces "${resItem.answer.trim()}" and records compliance in the audit log.`,
        confidence: "High",
      });
    }
  }

  // Recompute quality score and PRD markdown
  const updatedQuality = evaluateSpecificationQuality({
    req: rerun.stages.requirements_analyst,
    amb: rerun.stages.ambiguity_detector,
    wf: rerun.stages.workflow_mapper,
    tech: rerun.stages.technical_analyst,
    apiData: rerun.stages.api_data_analyst,
    ac: rerun.stages.acceptance_criteria,
    qa: rerun.stages.qa_reviewer,
    mvp: rerun.stages.prd_generator.mvp_prioritization,
  });

  rerun.stages.prd_generator.quality_score = updatedQuality;
  rerun.stages.prd_generator.markdown_document = generatePrdMarkdown({
    title: rerun.title,
    rawRequirement: rerun.input.requirement,
    context: rerun.input.context,
    req: rerun.stages.requirements_analyst,
    amb: rerun.stages.ambiguity_detector,
    wf: rerun.stages.workflow_mapper,
    tech: rerun.stages.technical_analyst,
    apiData: rerun.stages.api_data_analyst,
    ac: rerun.stages.acceptance_criteria,
    qa: rerun.stages.qa_reviewer,
    sections: rerun.stages.prd_generator.sections,
    mvp: rerun.stages.prd_generator.mvp_prioritization,
    quality: updatedQuality,
  });

  const affectedSet = new Set<AgentStageId>(["ambiguity_detector", "prd_generator"]);
  for (const r of resolutions) {
    const amb = updatedAmbiguities.find((a) => a.id === r.ambiguityId);
    amb?.affectedDownstreamStages.forEach((s) => affectedSet.add(s));
  }

  return {
    ...rerun,
    id: currentAnalysis.id,
    createdAt: currentAnalysis.createdAt,
    updatedAt: now,
    revisionHistory: [
      {
        timestamp: now,
        action: `Resolved ${resolutions.map((r) => r.ambiguityId).join(", ")} and re-ran downstream agents`,
        stagesUpdated: Array.from(affectedSet),
      },
      ...currentAnalysis.revisionHistory,
    ],
  };
}
