import { NextResponse } from "next/server";
import { orchestrator } from "@/server/orchestrator";
import { type RunSpeed } from "@graph-agent/domain";
import { store } from "@/server/store";
import { workspaceService } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  orchestrator.start();
  return NextResponse.json(store.list());
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as {
    task?: unknown;
    workspacePath?: unknown;
    speed?: unknown;
  };
  if (
    typeof body.task !== "string" ||
    body.task.trim().length < 3 ||
    body.task.length > 4_000
  ) {
    return NextResponse.json(
      { error: "Task must contain 3–4,000 characters" },
      { status: 400 },
    );
  }
  if (typeof body.workspacePath !== "string")
    return NextResponse.json(
      { error: "Workspace path is required" },
      { status: 400 },
    );
  const speed: RunSpeed =
    body.speed === "deliberate" || body.speed === "balanced"
      ? body.speed
      : "fast";
  let workspacePath: string;
  try {
    workspacePath = await workspaceService.validate(body.workspacePath);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid workspace" },
      { status: 400 },
    );
  }
  const run = store.create(body.task.trim(), workspacePath, {
    speed,
    workflow: "adaptive",
  });
  await workspaceService.captureBaseline(run.id, workspacePath);
  orchestrator.wake();
  return NextResponse.json(run, { status: 201 });
}
