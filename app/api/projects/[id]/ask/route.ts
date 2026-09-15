import { NextResponse } from "next/server";
import { answer } from "@/lib/store";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  try {
    const { question } = await req.json();
    const result = await answer(projectId, question || "");
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[POST /api/projects/${projectId}/ask]`, err);
    return NextResponse.json({ error: "Failed to answer question." }, { status: 500 });
  }
}
