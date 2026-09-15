import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/projects — list all projects with latest snapshot summary
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true, batches: true },
        },
      },
    });

    const result = projects.map((p) => {
      const latestSnapshot = p.snapshots[0];
      const state = latestSnapshot?.state as Record<string, unknown> | null;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt,
        messageCount: p._count.messages,
        batchCount: p._count.batches,
        summary: (state?.summary as string) ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  }
}

// POST /api/projects — create a new project
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Project name is required." }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: body.description?.trim() || null,
      },
    });

    return NextResponse.json({ id: project.id, name: project.name }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}
