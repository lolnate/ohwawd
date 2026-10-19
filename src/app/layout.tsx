import type { Metadata } from "next";
import "./styles.css";
import "./project-filters.css";
import "./workspace-shell.css";
import "./view-state.css";

export const metadata: Metadata = { title: "Oh, WAWD!", description: "Outcomes and Linear work, connected." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
