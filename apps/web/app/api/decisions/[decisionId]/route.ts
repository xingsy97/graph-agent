import { NextResponse } from "next/server";
import { orchestrator } from "@/server/orchestrator";
import { store } from "@/server/store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ decisionId: string }> }): Promise<NextResponse> {
  const { decisionId } = await context.params;
  const body = await request.json() as { runId?: unknown; answer?: unknown };
  if (typeof body.runId !== "string" || typeof body.answer !== "string" || !body.answer.trim()) {
    return NextResponse.json({ error: "runId and answer are required" }, { status: 400 });
  }
  try {
    const decision = store.answerDecision(body.runId, decisionId, body.answer.trim());
    orchestrator.wake();
    return NextResponse.json(decision);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to answer" }, { status: 409 });
  }
}
