import { recordingService } from "@/server/recording";
import { workspaceService } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await context.params;
  let recording = await recordingService.get(runId);
  if (recording && !recording.report && recording.status !== "running") {
    const run = recording.frames.at(-1)?.run;
    if (run) {
      await recordingService
        .attachReport(
          runId,
          await workspaceService.report(run),
        )
        .catch((error) =>
          console.error("Unable to backfill replay report", error),
        );
      recording = await recordingService.get(runId);
    }
  }
  return recording ? Response.json(recording) : Response.json({ error: "Replay not found" }, { status: 404 });
}
