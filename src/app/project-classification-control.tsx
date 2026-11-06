"use client";

import type { BoardProject } from "./project-plan-card";

export type ClassificationDraft = "roadmap" | "ongoing" | "";

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function ProjectClassificationControl({ project, draft, busy, onDraft, onSave }: {
  project: BoardProject;
  draft: ClassificationDraft;
  busy: boolean;
  onDraft: (value: ClassificationDraft) => void;
  onSave: () => void;
}) {
  const roadmapLabels = project.roadmap_label_ids ?? [];
  const ongoingLabels = project.ongoing_label_ids ?? [];
  const sourceAuthoritative = project.classification_provenance === "linear-label";
  const both = roadmapLabels.length > 0 && ongoingLabels.length > 0;
  const sourceContext = both
    ? `Linear label conflict: Roadmap (${roadmapLabels.join(", ")}) and Ongoing (${ongoingLabels.join(", ")}).`
    : roadmapLabels.length
      ? `Linear source label: Roadmap (${roadmapLabels.join(", ")}).`
      : ongoingLabels.length
        ? `Linear source label: Ongoing (${ongoingLabels.join(", ")}).`
        : "Linear source labels: neither Roadmap nor Ongoing.";
  const provenance = sourceAuthoritative ? "Linear label" : project.classification_provenance === "local-decision" ? "Local decision" : "Unresolved";
  const savedIntent = project.local_classification ? title(project.local_classification) : "none";
  const sourceOverridesLocal = sourceAuthoritative && !!project.local_classification && project.local_classification !== project.effective_classification;
  const dirty = draft !== (project.local_classification ?? "");

  return <section className="project-classification" data-classification-project={project.project_id}>
    <div className="classification-heading">
      <div><h4>Project classification</h4><p><strong>{title(project.effective_classification ?? "unresolved")}</strong> <span className={`classification-provenance ${project.classification_provenance}`}>{provenance}</span></p></div>
    </div>
    <p className={both ? "classification-source conflict" : "classification-source"}>{sourceContext}</p>
    {sourceOverridesLocal && <p className="classification-override">Linear currently controls the effective classification. Saved local intent ({savedIntent}) is retained but overridden until the source labels become ambiguous.</p>}
    {!sourceAuthoritative && <p className="meta">Choose a durable Oh WAWD classification for ambiguous labels. This saves locally and does not change Linear.</p>}
    <fieldset disabled={busy}>
      <legend>Saved local decision</legend>
      <label><input type="radio" name={`classification-${project.id}`} value="roadmap" checked={draft === "roadmap"} onChange={() => onDraft("roadmap")} />Roadmap</label>
      <label><input type="radio" name={`classification-${project.id}`} value="ongoing" checked={draft === "ongoing"} onChange={() => onDraft("ongoing")} />Ongoing</label>
    </fieldset>
    <button type="button" className="secondary classification-save" disabled={busy || !draft || !dirty} onClick={onSave}>Save local classification</button>
  </section>;
}
