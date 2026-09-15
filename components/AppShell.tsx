"use client";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { usePathname } from "next/navigation";

const tabs = [
  ["Dashboard", ""],
  ["Inbox", "/inbox"],
  ["Import", "/import"],
  ["What Changed", "/changes"],
  ["Ask AI", "/ask"],
];

export function AppShell({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId: string;
}) {
  const path = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <main className="shell">
      <nav className="nav">
        <Link href="/" className="brand">
          <span className="mark">
            <Building2 size={19} />
          </span>
          ArchFlow{" "}
          <span style={{ color: "#7b9290", fontWeight: 500 }}>AI</span>
        </Link>
        <div className="navlinks">
          {tabs.map(([name, suffix]) => (
            <Link
              key={name}
              href={base + suffix}
              className={path === base + suffix ? "active" : ""}
            >
              {name}
            </Link>
          ))}
        </div>
        <span className="project-label">Live project intelligence</span>
      </nav>
      {children}
    </main>
  );
}
