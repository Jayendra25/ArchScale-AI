import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, createdAt: true },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    return NextResponse.json({ error: "Failed to load project." }, { status: 500 });
  }
}
