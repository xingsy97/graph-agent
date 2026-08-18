import { store } from "@/server/store";
import { orchestrator } from "@/server/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await context.params;
  if (!store.get(runId)) return Response.json({ error: "Run not found" }, { status: 404 });
  orchestrator.start();
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const push = () => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(store.snapshot(runId))}\n\n`)); } catch { cleanup(); }
      };
      push();
      const unsubscribe = store.subscribe(runId, push);
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(": heartbeat\n\n")); } catch { cleanup(); }
      }, 15_000);
      cleanup = () => { unsubscribe(); clearInterval(heartbeat); };
      request.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive",
  } });
}
