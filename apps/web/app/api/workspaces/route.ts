import { NextResponse } from "next/server";
import { workspaceService } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ workspaces: await workspaceService.suggestions(), runtime: process.env.AGENT_RUNTIME === "mock" ? "mock" : "copilot" });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json() as { path?: unknown };
  if (typeof body.path !== "string") return NextResponse.json({ error: "Path is required" }, { status: 400 });
  try { return NextResponse.json({ path: await workspaceService.validate(body.path) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid workspace" }, { status: 400 }); }
}
