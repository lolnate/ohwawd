type Props = {
  label?: string;
  statuses: string[];
  selected: string[];
  onChange: (statuses: string[]) => void;
};

export default function StatusFilter({ label = "Status", statuses, selected, onChange }: Props) {
  const active = selected.length ? selected : statuses;
  const toggle = (status: string) => {
    const next = active.includes(status) ? active.filter((item) => item !== status) : [...active, status];
    onChange(next.length === statuses.length ? [] : next);
  };
  return <details className="status-filter">
    <summary><span>{label}</span><strong>{selected.length ? `${selected.length} selected` : "All statuses"}</strong></summary>
    <div className="status-options">
      <button type="button" className="text-button" onClick={() => onChange([])}>Select all</button>
      {statuses.map((status) => <label key={status}><input type="checkbox" checked={active.includes(status)} onChange={() => toggle(status)} />{status}</label>)}
    </div>
  </details>;
}
