import { NextResponse } from "next/server";
import { type RunSpeed } from "@graph-agent/domain";
import { orchestrator } from "@/server/orchestrator";
import { store } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  orchestrator.start();
  const { runId } = await context.params;
  const run = store.get(runId);
  return run
    ? NextResponse.json(store.snapshot(runId))
    : NextResponse.json({ error: "Run not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const { runId } = await context.params;
  if (!store.get(runId))
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const body = (await request.json()) as { action?: string; speed?: unknown };
  if (body.action === "pause") orchestrator.pause(runId);
  else if (body.action === "resume") {
    store.setRunStatus(runId, "running");
    orchestrator.wake();
  } else if (body.action === "cancel") store.setRunStatus(runId, "cancelled");
  else if (body.action === "reset") {
    if (
      !["completed", "failed", "cancelled"].includes(
        store.snapshot(runId).status,
      )
    ) {
      return NextResponse.json(
        { error: "Only a finished run can be reset" },
        { status: 409 },
      );
    }
    store.reset(runId);
    orchestrator.wake();
  } else if (body.action === "configure") {
    const speed: RunSpeed | undefined =
      body.speed === "deliberate" ||
      body.speed === "balanced" ||
      body.speed === "fast"
        ? body.speed
        : undefined;
    if (!speed)
      return NextResponse.json(
        { error: "A valid parallelism value is required" },
        { status: 400 },
      );
    store.configure(runId, { speed });
    orchestrator.wake();
  } else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json(store.snapshot(runId));
}
