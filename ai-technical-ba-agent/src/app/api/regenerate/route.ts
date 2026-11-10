import { NextRequest, NextResponse } from "next/server";
import { AgentStageId, CompleteAnalysisResult } from "@/lib/types";
import { regenerateSingleStage } from "@/lib/agents/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      currentAnalysis: CompleteAnalysisResult;
      stageId: AgentStageId;
      customInstruction?: string;
    };

    if (!body.currentAnalysis || !body.stageId) {
      return NextResponse.json(
        { error: "Both currentAnalysis and stageId are required." },
        { status: 400 }
      );
    }

    const updated = await regenerateSingleStage({
      currentAnalysis: body.currentAnalysis,
      stageId: body.stageId,
      customInstruction: body.customInstruction,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to regenerate the requested section.",
      },
      { status: 500 }
    );
  }
}
