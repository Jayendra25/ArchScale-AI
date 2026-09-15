import { NextResponse } from "next/server";
import { seedNext } from "@/lib/store";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  try {
    const result = await seedNext(projectId);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[POST /api/projects/${projectId}/seed-demo]`, err);
    return NextResponse.json({ error: "Failed to seed demo data." }, { status: 500 });
  }
}
