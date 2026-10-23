"use client";

import { useEffect, useRef, useState } from "react";

const sections = [
  { id: "capacity", title: "Capacity assumptions", description: "Baseline delivery capacity, reserve points, and forecast horizon." },
  { id: "scope", title: "Scope readiness", description: "The lead time for preparing project scope before delivery begins." },
  { id: "availability", title: "Weekly availability and holidays", description: "Weekly availability overrides and holiday planning assumptions." },
] as const;

function outside(dialog: HTMLDialogElement, x: number, y: number) {
  const bounds = dialog.getBoundingClientRect();
  return x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom;
}

export default function WorkspaceSettings({ connected, onClose }: { connected: boolean; onClose: () => void }) {
  const [sectionId, setSectionId] = useState<(typeof sections)[number]["id"]>("capacity");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  const section = sections.find((item) => item.id === sectionId)!;

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      const target = opener?.isConnected && opener.getClientRects().length ? opener : document.getElementById("workspace-settings-button");
      target?.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} className="workspace-settings" aria-labelledby="workspace-settings-title" aria-describedby="workspace-settings-description"
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex='0']")).filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      // Keep edge traversal inside the surface rather than moving into browser chrome.
      if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { backdropPress.current = event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY); }}
    onPointerCancel={() => { backdropPress.current = false; }}
    onClick={(event) => {
      const startedOutside = backdropPress.current;
      backdropPress.current = false;
      if (startedOutside && event.target === event.currentTarget && outside(event.currentTarget, event.clientX, event.clientY)) onClose();
    }}>
    <header className="workspace-settings-header">
      <div><h2 id="workspace-settings-title" ref={headingRef} tabIndex={-1}>Settings</h2><p id="workspace-settings-description">Shared planning assumptions for this workspace.</p></div>
      <button type="button" className="secondary" aria-label="Close Settings" onClick={onClose}>Close</button>
    </header>
    <div className="workspace-settings-body">
      <nav className="workspace-settings-nav" aria-label="Settings sections">{sections.map((item) => <button type="button" key={item.id} aria-current={sectionId === item.id ? "true" : undefined} onClick={() => setSectionId(item.id)}>{item.title}</button>)}</nav>
      <section className="workspace-settings-content" aria-labelledby={`settings-${section.id}-title`}>
        <h3 id={`settings-${section.id}-title`}>{section.title}</h3>
        <p>{section.description}</p>
        {!connected && sectionId === "capacity" && <p>Linear is not connected. Imported capacity evidence is not available.</p>}
        <p className="workspace-settings-notice">These controls are still available on the Board. Editing in Settings is not available yet.</p>
      </section>
    </div>
  </dialog>;
}
