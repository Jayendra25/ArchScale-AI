import { ProjectClient } from "@/components/ProjectClient";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      name: true,
      _count: { select: { messages: true, batches: true } },
    },
  });
  if (!project) notFound();

  return (
    <ProjectClient
      projectId={id}
      projectName={project.name}
      hasProjectData={project._count.messages > 0 || project._count.batches > 0}
    />
  );
}