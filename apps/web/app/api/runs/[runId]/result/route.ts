import { NextResponse } from "next/server";
import { store } from "@/server/store";
import { workspaceService } from "@/server/workspace";
import { recordingService } from "@/server/recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }): Promise<NextResponse> {
  const { runId } = await context.params;
  const run = store.get(runId);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const report = await workspaceService.report(store.snapshot(runId));
  await recordingService.attachReport(runId, report).catch((error) =>
    console.error("Unable to attach workspace report to replay", error),
  );
  return NextResponse.json(report);
}
