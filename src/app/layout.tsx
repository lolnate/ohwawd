import type { Metadata } from "next";
import "./styles.css";
import "./project-filters.css";
import "./outcome-project-picker.css";
import "./board.css";
import "./board-compact.css";
import "./board-actions.css";
import "./stream-controls.css";
import "./stream-manager.css";
import "./scenario.css";
import "./workspace-shell.css";
import "./view-state.css";
import "./responsive.css";

export const metadata: Metadata = { title: "Oh, WAWD!", description: "Outcomes and Linear work, connected." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
