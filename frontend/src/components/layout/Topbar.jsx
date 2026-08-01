import { formatJam, formatTanggal } from '../../lib/format';

// Topbar generik — tiap halaman mengoper crumb, judul, dan (opsional) live indicator.
export default function Topbar({ crumb, title, live = false, now = new Date() }) {
  return (
    <div className="flex items-end justify-between gap-[18px] flex-wrap mb-[26px] max-md:mb-5">
      <div>
        {crumb && <div className="text-[13px] text-tinta-40 mb-[5px]">{crumb}</div>}
        <h1 className="text-[28px] font-semibold max-md:text-[21px]">{title}</h1>
      </div>
      {live && (
        <div className="text-[13px] text-tinta-60 flex items-center gap-2 max-md:text-[12px]">
          <span className="w-[7px] h-[7px] rounded-full bg-normal animate-pulse" />
          Data langsung · diperbarui {formatJam(now)} WIB · {formatTanggal(now)}
        </div>
      )}
    </div>
  );
}
