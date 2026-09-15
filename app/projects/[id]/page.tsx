import { ProjectClient } from "@/components/ProjectClient";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Verify the project exists
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  return <ProjectClient view="dashboard" projectId={id} projectName={project.name} />;
}
