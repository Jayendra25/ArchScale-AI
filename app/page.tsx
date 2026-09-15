import { prisma } from "@/lib/prisma";
import { HomeClient } from "./home-client";

export default async function Home() {
  let projects: {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    messageCount: number;
    batchCount: number;
    summary: string | null;
  }[] = [];

  try {
    const raw = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        snapshots: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true, batches: true } },
      },
    });

    projects = raw.map((p) => {
      const state = p.snapshots[0]?.state as Record<string, unknown> | null;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: p.createdAt.toISOString(),
        messageCount: p._count.messages,
        batchCount: p._count.batches,
        summary: (state?.summary as string) ?? null,
      };
    });
  } catch (err) {
    console.error("[Home] Failed to load projects:", err);
    // Render empty state on DB error so the app doesn't crash
  }

  return <HomeClient initialProjects={projects} />;
}
