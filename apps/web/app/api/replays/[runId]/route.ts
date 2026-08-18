import { recordingService } from "@/server/recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await context.params;
  const recording = await recordingService.get(runId);
  return recording ? Response.json(recording) : Response.json({ error: "Replay not found" }, { status: 404 });
}
