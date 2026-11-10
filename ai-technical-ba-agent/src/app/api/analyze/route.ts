import { NextRequest, NextResponse } from "next/server";
import { AnalysisRequestInput } from "@/lib/types";
import { runFullOrchestrationPipeline } from "@/lib/agents/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalysisRequestInput;
    if (!body.requirement || typeof body.requirement !== "string" || !body.requirement.trim()) {
      return NextResponse.json(
        { error: "Business requirement text is required." },
        { status: 400 }
      );
    }

    const result = await runFullOrchestrationPipeline({
      requirement: body.requirement.trim(),
      context: body.context || {
        businessProduct: "",
        targetUsers: "",
        existingSystems: "",
        knownConstraints: "",
        timeline: "",
        budget: "",
        additionalNotes: "",
      },
      provider: body.provider || "demo",
      qualityMode: body.qualityMode || "balanced",
      apiKey: body.apiKey,
      modelOverride: body.modelOverride,
      ollamaUrl: body.ollamaUrl,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during multi-agent orchestration.",
      },
      { status: 500 }
    );
  }
}
