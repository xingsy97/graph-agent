import { recordingService } from "@/server/recording";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({ recordings: await recordingService.list() });
}
