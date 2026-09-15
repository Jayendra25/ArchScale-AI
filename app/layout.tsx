import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "ArchFlow AI", description: "Project communication intelligence" };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
