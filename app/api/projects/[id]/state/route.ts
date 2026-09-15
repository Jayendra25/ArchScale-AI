import { NextResponse } from "next/server";
import { getData } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  try {
    const d = await getData(projectId);
    return NextResponse.json({
      messages: d.messages,
      snapshot: d.snapshots.at(-1) ?? null,
      snapshots: d.snapshots,
    });
  } catch (err) {
    console.error(`[GET /api/projects/${projectId}/state]`, err);
    return NextResponse.json({ error: "Failed to load project state." }, { status: 500 });
  }
}
