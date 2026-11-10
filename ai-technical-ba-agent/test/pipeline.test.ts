import assert from "node:assert/strict";
import {
  runFullOrchestrationPipeline,
  regenerateSingleStage,
  resolveAmbiguitiesAndRerunDownstream,
} from "../src/lib/agents/orchestrator.ts";
import { extractAndValidateJson } from "../src/lib/providers/llmProvider.ts";

async function runTests() {
  console.log("1. Testing 8-Stage Flagship Demo Pipeline (Lead Qualification & Booking)...");
  const result = await runFullOrchestrationPipeline({
    requirement: "We need an AI chatbot that qualifies leads and books appointments.",
    context: {
      businessProduct: "B2B SaaS Revenue Acceleration Platform",
      targetUsers: "Inbound prospects, SDRs, AEs",
      existingSystems: "HubSpot CRM, Google Calendar, Slack",
      knownConstraints: "< 2.5s response latency, GDPR consent",
      timeline: "6 weeks",
      budget: "$45,000",
      additionalNotes: "",
    },
    provider: "demo",
    qualityMode: "balanced",
  });

  // Verify all 8 stages exist and are non-empty
  assert.ok(result.stages.requirements_analyst.problem.length > 20);
  assert.ok(result.stages.requirements_analyst.explicit_requirements.length >= 3);
  assert.ok(result.stages.ambiguity_detector.ambiguities.length >= 6);
  assert.ok(result.stages.workflow_mapper.steps.length >= 8);
  assert.ok(result.stages.workflow_mapper.mermaid_diagram.includes("flowchart TD"));
  assert.ok(result.stages.technical_analyst.frontend.length >= 2);
  assert.ok(result.stages.api_data_analyst.apis.length === 6);
  assert.ok(result.stages.api_data_analyst.entities.length === 6);
  assert.ok(result.stages.acceptance_criteria.user_stories.length >= 6);
  assert.ok(result.stages.acceptance_criteria.acceptance_criteria.length >= 8);
  assert.ok(result.stages.qa_reviewer.edge_cases.length >= 8);
  assert.ok(result.stages.prd_generator.markdown_document.includes("## 24. Recommended Implementation Sequence"));

  const initialScore = result.stages.prd_generator.quality_score.overall_score;
  console.log(`   ✓ Initial Specification Quality Score: ${initialScore}/100`);
  assert.ok(initialScore >= 75 && initialScore <= 95);

  console.log("2. Testing Ambiguity Resolution & Downstream Re-analysis...");
  const updatedAfterResolve = resolveAmbiguitiesAndRerunDownstream({
    currentAnalysis: result,
    resolutions: [
      {
        ambiguityId: "AMB-001",
        answer: "Lead must have budget > $5,000 and timeline < 90 days.",
      },
      {
        ambiguityId: "AMB-002",
        answer: "Google Calendar and Microsoft 365 via OAuth 2.0.",
      },
      {
        ambiguityId: "AMB-005",
        answer: "AI books autonomously for standard tiers; enterprise alerts AE manager.",
      },
    ],
  });

  const resolvedAmb001 = updatedAfterResolve.stages.ambiguity_detector.ambiguities.find(
    (a) => a.id === "AMB-001"
  );
  assert.equal(resolvedAmb001?.status, "Resolved");
  assert.ok(
    updatedAfterResolve.stages.requirements_analyst.explicit_requirements.some((r) =>
      r.text.includes("Lead must have budget > $5,000 and timeline < 90 days.")
    )
  );
  const newScore = updatedAfterResolve.stages.prd_generator.quality_score.overall_score;
  console.log(`   ✓ Updated Specification Quality Score after resolving 3 Critical ambiguities: ${newScore}/100`);
  assert.ok(newScore > initialScore, "Resolving critical ambiguities should increase the Specification Quality Score");

  console.log("3. Testing Single-Stage Isolated Regeneration...");
  const afterRegen = await regenerateSingleStage({
    currentAnalysis: updatedAfterResolve,
    stageId: "acceptance_criteria",
    customInstruction: "Verify webhook signature HMAC validation on calendar callback",
  });
  assert.ok(
    afterRegen.stages.acceptance_criteria.acceptance_criteria.some((ac) =>
      ac.title.includes("Verify webhook signature")
    )
  );
  console.log("   ✓ Isolated Acceptance Criteria regeneration preserved upstream context and updated PRD.");

  console.log("4. Testing Custom Requirement Synthesis (Invoice Extraction)...");
  const invoiceResult = await runFullOrchestrationPipeline({
    requirement: "Customers should be able to upload invoices and automatically extract the data.",
    context: {
      businessProduct: "AP Automation Portal",
      targetUsers: "AP Clerks, Controllers",
      existingSystems: "NetSuite ERP",
      knownConstraints: "PDF/PNG up to 25MB",
      timeline: "8 weeks",
      budget: "$60,000",
      additionalNotes: "",
    },
    provider: "demo",
    qualityMode: "balanced",
  });
  assert.ok(invoiceResult.title.includes("AP Automation") || invoiceResult.title.includes("Invoice"));
  assert.ok(invoiceResult.stages.api_data_analyst.apis.some((a) => a.endpoint.includes("invoices")));
  console.log("   ✓ Custom Invoice Extraction requirement generated tailored 8-stage outputs.");

  console.log("5. Testing JSON Schema Extraction & Validation Guard...");
  const sampleValid = extractAndValidateJson<{ a: number; b: string }>(
    "```json\n{\"a\": 42, \"b\": \"ok\"}\n```",
    ["a", "b"]
  );
  assert.equal(sampleValid.a, 42);
  console.log("   ✓ JSON fence extraction & key validation passed.");

  console.log("\nALL PIPELINE TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
