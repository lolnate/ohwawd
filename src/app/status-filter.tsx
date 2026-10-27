type Props = {
  label?: string;
  statuses: string[];
  selected: string[];
  onChange: (statuses: string[]) => void;
  emptyMeansAll?: boolean;
};

export default function StatusFilter({ label = "Status", statuses, selected, onChange, emptyMeansAll = true }: Props) {
  const active = emptyMeansAll && !selected.length ? statuses : selected;
  const allSelected = statuses.length > 0 && active.length === statuses.length;
  const toggle = (status: string) => {
    const next = active.includes(status) ? active.filter((item) => item !== status) : [...active, status];
    onChange(emptyMeansAll && next.length === statuses.length ? [] : next);
  };
  return <details className="status-filter">
    <summary><span>{label}</span><strong>{(emptyMeansAll && !selected.length) || allSelected ? "All statuses" : active.length ? `${active.length} selected` : "No statuses"}</strong></summary>
    <div className="status-options">
      <button type="button" className="text-button" onClick={() => onChange(emptyMeansAll ? [] : statuses)}>Select all</button>
      {statuses.map((status) => <label key={status}><input type="checkbox" checked={active.includes(status)} onChange={() => toggle(status)} />{status}</label>)}
    </div>
  </details>;
}
