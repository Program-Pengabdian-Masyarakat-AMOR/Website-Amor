// Badge status health: normal | warning | critical (port .badge prototype).
const META = {
  normal: { cls: 'b-normal', label: 'Normal' },
  warning: { cls: 'b-warning', label: 'Warning' },
  critical: { cls: 'b-critical', label: 'Critical' },
};

export default function HealthStatusBadge({ status = 'normal', label, size = 'md', className = '' }) {
  const meta = META[status] || META.normal;
  const pad = size === 'sm' ? 'text-[11px] px-2 py-[2px]' : '';
  return (
    <span className={`badge ${meta.cls} ${pad} ${className}`}>
      <span className="pip" />
      {label || meta.label}
    </span>
  );
}
