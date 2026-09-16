
import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";

const display = Manrope({
	subsets: ["latin"],
	variable: "--font-manrope",
	weight: ["600", "800"],
});

const body = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	weight: ["400", "500", "600"],
});

export const metadata: Metadata = { title: "ArchFlow AI", description: "Project communication intelligence" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className={`${display.variable} ${body.variable}`}>{children}</body>
		</html>
	);
}
