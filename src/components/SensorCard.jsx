// Kartu sensor (port .scard prototype Monitoring). Dipakai untuk pembacaan real-time.
export default function SensorCard({
  icon,
  label,
  value,
  unit,
  sub,
  tone = 'amber', // 'amber' | 'olive'
  live = false,
  children,
}) {
  const icoTone =
    tone === 'olive' ? 'bg-olive-lembut text-olive' : 'bg-amber-lembut text-amber-teks';

  return (
    <div className="bg-permukaan border border-border rounded-lg shadow-1 px-5 py-[18px] flex flex-col gap-[2px]">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center flex-none ${icoTone}`}>
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-tinta-60">{label}</span>
        {live && (
          <span className="ml-auto inline-flex items-center gap-[5px] text-[10.5px] font-bold tracking-[.06em] uppercase text-normal-teks">
            <span className="live-dot !w-[6px] !h-[6px]" />
            Live
          </span>
        )}
      </div>

      {value != null && (
        <div className="font-body font-bold text-[30px] leading-none tnum">
          {value}
          {unit && <small className="text-[15px] font-semibold text-tinta-60"> {unit}</small>}
        </div>
      )}
      {children}
      {sub && <div className="text-[12.5px] text-tinta-40 mt-2">{sub}</div>}
    </div>
  );
}
