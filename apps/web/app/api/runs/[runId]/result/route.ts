import { NextResponse } from "next/server";
import { store } from "@/server/store";
import { workspaceService } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await context.params;
  const run = store.get(runId);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(await workspaceService.report(store.snapshot(runId)));
}
