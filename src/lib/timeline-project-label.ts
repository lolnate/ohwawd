export type TimelineProjectLabelMode = "full" | "ellipsized" | "code";

export const TIMELINE_LABEL_TOLERANCE_PX = 0.5;

export function timelineProjectLabelMode(availableWidth: number, fullNameWidth: number): TimelineProjectLabelMode {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(fullNameWidth) || fullNameWidth < 0) return "code";
  const available = Math.max(0, availableWidth);
  if (fullNameWidth <= available + TIMELINE_LABEL_TOLERANCE_PX) return "full";
  if (fullNameWidth / 2 <= available + TIMELINE_LABEL_TOLERANCE_PX) return "ellipsized";
  return "code";
}
