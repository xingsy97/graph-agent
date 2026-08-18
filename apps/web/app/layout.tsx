import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "@/styles/index.css";

export const metadata: Metadata = {
  title: "Graph Agent",
  description: "Local-first, dynamic DAG orchestration for AI agents",
  applicationName: "Graph Agent",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
