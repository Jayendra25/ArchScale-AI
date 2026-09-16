import { prisma } from "@/lib/prisma";
import { HomeClient } from "./home-client";
import { Manrope, Inter } from "next/font/google";
import { unstable_cache } from "next/cache";

const display = Manrope({ subsets: ["latin"], weight: ["600", "800"] });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

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
    const raw = await getProjects();

    projects = raw.map((p) => {
      const state = p.snapshots[0]?.state as Record<string, unknown> | null;
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        createdAt: new Date(p.createdAt).toISOString(),
        messageCount: p._count.messages,
        batchCount: p._count.batches,
        summary: (state?.summary as string) ?? null,
      };
    });
  } catch (err) {
    console.error("[Home] Failed to load projects:", err);
  }

  return (
    <HomeClient
      initialProjects={projects}
      displayFontClass={display.className}
      bodyFontClass={body.className}
    />
  );
}

const getProjects = unstable_cache(
  async () =>
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { state: true },
        },
        _count: { select: { messages: true, batches: true } },
      },
    }),
  ["home-projects"],
  { revalidate: 30 }
);