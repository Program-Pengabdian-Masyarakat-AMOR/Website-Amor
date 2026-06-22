// Kartu ringkasan penjualan (port .scard prototype Penjualan).
// variant: 'default' | 'accent'
export default function SalesSummaryCard({ icon, label, period, value, unit, sub, variant = 'default' }) {
  const accent = variant === 'accent';
  return (
    <div className={`rounded-lg border shadow-1 px-[22px] py-5 ${accent ? 'bg-olive-lembut border-[#D2DCCC]' : 'bg-permukaan border-border'}`}>
      <div className="text-[12.5px] text-tinta-60 flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] text-tinta-40" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
        {label}
        {period && <> · <span className="font-semibold text-tinta">{period}</span></>}
      </div>
      <div className="font-body font-bold text-[28px] tnum mt-2 leading-none">
        {value}
        {unit && <small className="text-[14px] font-semibold text-tinta-60"> {unit}</small>}
      </div>
      {sub && <div className="text-[12.5px] text-tinta-40 mt-2">{sub}</div>}
    </div>
  );
}
