export type ConfidenceLevel = "High" | "Medium" | "Low";

export type ProvenanceType =
  | "User-provided information"
  | "AI inference"
  | "AI recommendation";

export type SeverityLevel = "Critical" | "High" | "Medium" | "Low";

export type PriorityTier = "P0" | "P1" | "P2" | "Out of Scope";

export type TechnicalNeedTier = "Required" | "Recommended" | "Future / Optional";

export type LLMProviderType =
  | "demo"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "ollama";

export type QualitySpeedMode = "fast" | "balanced" | "high_quality";

export type AgentStageId =
  | "requirements_analyst"
  | "ambiguity_detector"
  | "workflow_mapper"
  | "technical_analyst"
  | "api_data_analyst"
  | "acceptance_criteria"
  | "qa_reviewer"
  | "prd_generator";

export interface OptionalContext {
  businessProduct: string;
  targetUsers: string;
  existingSystems: string;
  knownConstraints: string;
  timeline: string;
  budget: string;
  additionalNotes: string;
}

export interface AnalysisRequestInput {
  requirement: string;
  context: OptionalContext;
  provider: LLMProviderType;
  qualityMode: QualitySpeedMode;
  apiKey?: string;
  modelOverride?: string;
  ollamaUrl?: string;
}

export interface TraceableItem {
  id: string;
  text: string;
  category?: string;
  confidence: ConfidenceLevel;
  source: ProvenanceType;
  rationale?: string;
}

// ==========================================
// AGENT 1: Requirements Analyst Output
// ==========================================
export interface RequirementsAnalystOutput {
  problem: string;
  users: string[];
  business_objectives: string[];
  desired_outcomes: string[];
  actors: {
    name: string;
    role: string;
    type: "Human" | "System" | "AI Agent" | "External Service";
  }[];
  capabilities: TraceableItem[];
  explicit_requirements: TraceableItem[];
  implied_requirements: TraceableItem[];
  assumptions: TraceableItem[];
}

// ==========================================
// AGENT 2: Ambiguity Detector Output
// ==========================================
export type AmbiguityCategory =
  | "Missing Requirements"
  | "Ambiguous Terminology"
  | "Undefined Business Rules"
  | "Missing Actors"
  | "Missing Permissions"
  | "Missing Failure States"
  | "Missing Integrations"
  | "Missing Data Requirements"
  | "Compliance / Privacy"
  | "Contradictions";

export interface AmbiguityItem {
  id: string;
  category: AmbiguityCategory;
  description: string;
  severity: SeverityLevel;
  impact: string;
  question: string;
  status: "Open" | "Resolved";
  resolution?: string;
  resolvedAt?: string;
  affectedDownstreamStages: AgentStageId[];
}

export interface AmbiguityDetectorOutput {
  ambiguities: AmbiguityItem[];
  summary_risk_assessment: string;
}

// ==========================================
// AGENT 3: Workflow Mapper Output
// ==========================================
export interface WorkflowNode {
  id: string;
  label: string;
  description: string;
  type: "trigger" | "process" | "decision" | "ai_action" | "human_handoff" | "success" | "failure";
  actor: string;
  linked_requirement_ids: string[];
  next_nodes: {
    target_id: string;
    condition?: string;
  }[];
}

export interface WorkflowMapperOutput {
  actors: string[];
  trigger: string;
  steps: WorkflowNode[];
  decisions: {
    id: string;
    question: string;
    yes_branch: string;
    no_branch: string;
    rule_reference: string;
  }[];
  branches: {
    name: string;
    condition: string;
    outcome: string;
  }[];
  success_state: string;
  failure_states: {
    id: string;
    trigger: string;
    recovery_action: string;
  }[];
  human_handoffs: {
    id: string;
    trigger_condition: string;
    from_actor: string;
    to_actor: string;
    context_passed: string[];
    sla_expectation: string;
  }[];
  mermaid_diagram: string;
}

// ==========================================
// AGENT 4: Technical Analyst Output
// ==========================================
export interface TechnicalRequirementItem {
  id: string;
  component: string;
  specification: string;
  tier: TechnicalNeedTier;
  confidence: ConfidenceLevel;
  source: ProvenanceType;
  justification: string;
}

export interface TechnicalAnalystOutput {
  frontend: TechnicalRequirementItem[];
  backend: TechnicalRequirementItem[];
  services: TechnicalRequirementItem[];
  authentication: TechnicalRequirementItem[];
  authorization: TechnicalRequirementItem[];
  business_logic: TechnicalRequirementItem[];
  notifications: TechnicalRequirementItem[];
  background_jobs: TechnicalRequirementItem[];
  ai_components: TechnicalRequirementItem[];
  external_systems: TechnicalRequirementItem[];
  infrastructure: TechnicalRequirementItem[];
}

// ==========================================
// AGENT 5: API & Data Dependency Analyst Output
// ==========================================
export interface ApiEndpointSpec {
  id: string;
  name: string;
  purpose: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  authentication: string;
  request_data: Record<string, unknown>;
  response_data: Record<string, unknown>;
  dependencies: string[];
  failure_scenarios: {
    status_code: number;
    error_code: string;
    scenario: string;
    mitigation: string;
  }[];
  tier: TechnicalNeedTier;
  confidence: ConfidenceLevel;
}

export interface EntityFieldSpec {
  name: string;
  type: string;
  required: boolean;
  validation: string;
  sensitive: boolean;
  pii_classification?: "None" | "PII - Standard" | "PII - Sensitive" | "Secret/Auth";
  description: string;
}

export interface DataEntitySpec {
  name: string;
  description: string;
  fields: EntityFieldSpec[];
  relationships: {
    target_entity: string;
    cardinality: "1:1" | "1:N" | "N:1" | "M:N";
    description: string;
  }[];
  assumptions: string[];
}

export interface ApiDataAnalystOutput {
  apis: ApiEndpointSpec[];
  entities: DataEntitySpec[];
  er_diagram_mermaid: string;
  data_assumptions: TraceableItem[];
}

// ==========================================
// AGENT 6: Acceptance Criteria Generator Output
// ==========================================
export type AcceptanceCategory =
  | "Happy Path"
  | "Alternative Path"
  | "Validation"
  | "Error"
  | "Permission"
  | "Empty State"
  | "Timeout"
  | "Integration Failure";

export interface UserStoryItem {
  id: string;
  title: string;
  actor: string;
  action: string;
  benefit: string;
  formatted_story: string;
  priority: PriorityTier;
  priority_reasoning: string;
  linked_requirement_ids: string[];
  confidence: ConfidenceLevel;
  source: ProvenanceType;
}

export interface AcceptanceCriteriaItem {
  id: string;
  story_id: string;
  category: AcceptanceCategory;
  title: string;
  given: string;
  when: string;
  then: string;
  confidence: ConfidenceLevel;
}

export interface AcceptanceCriteriaOutput {
  user_stories: UserStoryItem[];
  acceptance_criteria: AcceptanceCriteriaItem[];
}

// ==========================================
// AGENT 7: QA / Edge Case Reviewer Output
// ==========================================
export type EdgeCaseCategory =
  | "Race Condition"
  | "Duplicate Request"
  | "Invalid Input"
  | "API Failure"
  | "Authentication / Authorization"
  | "Data Loss"
  | "Privacy / Compliance"
  | "AI Hallucination"
  | "Prompt Injection"
  | "AI Failure"
  | "Human Escalation"
  | "Performance / Scale";

export interface EdgeCaseItem {
  id: string;
  category: EdgeCaseCategory;
  title: string;
  severity: SeverityLevel;
  scenario: string;
  trigger: string;
  impact: string;
  recommended_mitigation: string;
  test_strategy: string;
}

export interface QaReviewerOutput {
  edge_cases: EdgeCaseItem[];
  security_privacy_audit: {
    id: string;
    domain: "Security" | "Privacy" | "AI Safety" | "Compliance";
    finding: string;
    severity: SeverityLevel;
    control_recommendation: string;
  }[];
}

// ==========================================
// AGENT 8: Senior Technical Product Manager (Final PRD)
// ==========================================
export interface MvpFeatureClassification {
  id: string;
  feature: string;
  priority: PriorityTier;
  reasoning: string;
  effort: "S" | "M" | "L" | "XL";
  business_value: "High" | "Medium" | "Low";
}

export interface SpecificationQualityScore {
  overall_score: number;
  dimensions: {
    name: string;
    score: number;
    max_score: number;
    status: "Strong" | "Adequate" | "Needs Attention";
    rationale: string;
  }[];
  deductions: {
    reason: string;
    points_deducted: number;
    remediation: string;
    linked_ambiguity_id?: string;
  }[];
}

export interface PrdSections {
  executive_summary: string;
  problem_statement: string;
  business_objective: string;
  users_and_personas: {
    name: string;
    role: string;
    goals: string[];
    pain_points: string[];
  }[];
  goals: string[];
  non_goals: string[];
  user_journeys: {
    name: string;
    persona: string;
    steps: string[];
  }[];
  functional_requirements_summary: string;
  workflow_summary: string;
  technical_requirements_summary: string;
  api_dependencies_summary: string;
  data_model_summary: string;
  user_stories_summary: string;
  acceptance_criteria_summary: string;
  edge_cases_summary: string;
  non_functional_requirements: {
    performance: string[];
    reliability: string[];
    security: string[];
    privacy: string[];
    scalability: string[];
    observability: string[];
  };
  ai_requirements: {
    involved: boolean;
    model_purpose: string;
    inputs: string[];
    outputs: string[];
    prompt_requirements: string[];
    context_requirements: string[];
    tool_usage: string[];
    guardrails: string[];
    human_in_loop: string[];
    evaluation_metrics: string[];
    failure_handling: string[];
  };
  risks: {
    id: string;
    category: "AI" | "Technical" | "Security/Privacy" | "Product/Business" | "Integration";
    description: string;
    severity: SeverityLevel;
    likelihood: "High" | "Medium" | "Low";
    mitigation: string;
  }[];
  assumptions: string[];
  open_questions: string[];
  dependencies: string[];
  mvp_scope: MvpFeatureClassification[];
  phase_2_scope: MvpFeatureClassification[];
  recommended_implementation_sequence: {
    phase: string;
    title: string;
    duration_estimate: string;
    deliverables: string[];
    dependencies: string[];
  }[];
}

export interface PrdGeneratorOutput {
  sections: PrdSections;
  mvp_prioritization: MvpFeatureClassification[];
  quality_score: SpecificationQualityScore;
  markdown_document: string;
}

// ==========================================
// Complete Orchestration Result
// ==========================================
export interface CompleteAnalysisResult {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  input: AnalysisRequestInput;
  providerUsed: LLMProviderType;
  modelUsed: string;
  stages: {
    requirements_analyst: RequirementsAnalystOutput;
    ambiguity_detector: AmbiguityDetectorOutput;
    workflow_mapper: WorkflowMapperOutput;
    technical_analyst: TechnicalAnalystOutput;
    api_data_analyst: ApiDataAnalystOutput;
    acceptance_criteria: AcceptanceCriteriaOutput;
    qa_reviewer: QaReviewerOutput;
    prd_generator: PrdGeneratorOutput;
  };
  stageTimingsMs: Record<AgentStageId, number>;
  revisionHistory: {
    timestamp: string;
    action: string;
    stagesUpdated: AgentStageId[];
  }[];
}

export interface StageDescriptor {
  id: AgentStageId;
  number: number;
  name: string;
  roleTitle: string;
  statusMessage: string;
  description: string;
}

export const PIPELINE_STAGES: StageDescriptor[] = [
  {
    id: "requirements_analyst",
    number: 1,
    name: "Requirements Analyst",
    roleTitle: "Principal Business Systems Analyst",
    statusMessage: "Deconstructing business problem, actors, explicit & implied requirements...",
    description: "Extracts problem statement, actors, capabilities, explicit/implied requirements, and foundational assumptions.",
  },
  {
    id: "ambiguity_detector",
    number: 2,
    name: "Ambiguity Detector",
    roleTitle: "Requirements Risk & Gap Auditor",
    statusMessage: "Scanning for undefined business rules, missing integrations, and compliance gaps...",
    description: "Identifies dangerous ambiguities, unstated rules, missing failure states, and formulates clarifying questions.",
  },
  {
    id: "workflow_mapper",
    number: 3,
    name: "Workflow Mapper",
    roleTitle: "Process & State Machine Architect",
    statusMessage: "Mapping business workflow, decision branches, failure states, and human handoffs...",
    description: "Constructs end-to-end state transitions, decision logic, exception flows, and interactive visual diagrams.",
  },
  {
    id: "technical_analyst",
    number: 4,
    name: "Technical Analyst",
    roleTitle: "Staff Solutions Architect",
    statusMessage: "Identifying technical dependencies across frontend, backend, auth, and AI components...",
    description: "Translates workflows into Required, Recommended, and Future technical architecture specifications.",
  },
  {
    id: "api_data_analyst",
    number: 5,
    name: "API / Data Dependency Analyst",
    roleTitle: "Data & Integration Architect",
    statusMessage: "Designing REST API contracts, payload schemas, and entity-relationship data models...",
    description: "Defines REST endpoints, request/response schemas, failure codes, and normalized entity data models.",
  },
  {
    id: "acceptance_criteria",
    number: 6,
    name: "Acceptance Criteria Generator",
    roleTitle: "Lead Product Owner & BDD Specialist",
    statusMessage: "Generating P0-P2 user stories and Given/When/Then acceptance criteria...",
    description: "Produces prioritized user stories and testable BDD scenarios across happy paths, timeouts, and errors.",
  },
  {
    id: "qa_reviewer",
    number: 7,
    name: "QA / Edge Case Reviewer",
    roleTitle: "Principal QA & AI Security Reviewer",
    statusMessage: "Reviewing edge cases, race conditions, prompt injection, and AI hallucination vectors...",
    description: "Conducts hostile-constructive QA audit covering concurrency, API failures, PII exposure, and AI guardrails.",
  },
  {
    id: "prd_generator",
    number: 8,
    name: "Final PRD Generator",
    roleTitle: "Senior Technical Product Manager",
    statusMessage: "Synthesizing 24-section engineering-ready PRD and computing Specification Quality Score...",
    description: "Compiles all 7 upstream agent outputs into a unified 24-section PRD with MVP prioritization and quality scoring.",
  },
];
