import { NextRequest, NextResponse } from "next/server";
import { CompleteAnalysisResult } from "@/lib/types";
import { resolveAmbiguitiesAndRerunDownstream } from "@/lib/agents/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      currentAnalysis: CompleteAnalysisResult;
      resolutions: { ambiguityId: string; answer: string }[];
    };

    if (!body.currentAnalysis || !Array.isArray(body.resolutions)) {
      return NextResponse.json(
        { error: "Both currentAnalysis and resolutions array are required." },
        { status: 400 }
      );
    }

    const updated = resolveAmbiguitiesAndRerunDownstream({
      currentAnalysis: body.currentAnalysis,
      resolutions: body.resolutions,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to resolve ambiguities and rerun downstream pipeline.",
      },
      { status: 500 }
    );
  }
}
