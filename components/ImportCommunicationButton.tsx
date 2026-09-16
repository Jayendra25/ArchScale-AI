import Link from "next/link";

export function ImportCommunicationButton({ projectId }: { projectId: string }) {
  return (
    <Link href={`/projects/${projectId}/import`} className="button">
      Import communication
    </Link>
  );
}
