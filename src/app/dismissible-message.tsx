"use client";

import { useEffect, useRef, type ReactNode } from "react";

const dismissalDelay = 20_000;

export default function DismissibleMessage({ children, kind, onDismiss }: {
  children: ReactNode;
  kind: "error" | "notice";
  onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss.current(), dismissalDelay);
    return () => window.clearTimeout(timer);
  }, [children]);

  return <div className={`dismissible-message ${kind}`} role={kind === "error" ? "alert" : "status"}>
    <span>{children}</span>
    <button type="button" className="dismissible-message-dismiss" aria-label="Dismiss message" title="Dismiss message" onClick={onDismiss}>X</button>
  </div>;
}
