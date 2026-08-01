// Placeholder gambar (port dari custom element <image-slot> prototype).
// Di FASE 1 menampilkan area kosong + teks panduan; nanti bisa diisi <img> asli.
export default function ImageSlot({ placeholder = 'Foto', className = '', height = 360 }) {
  return (
    <div
      className={`grid place-items-center text-center bg-permukaan-2 border border-border rounded-lg text-tinta-40 text-[13px] px-6 ${className}`}
      style={{ height }}
    >
      <span className="max-w-[280px] leading-relaxed">
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7 mx-auto mb-2 opacity-60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-4.5-4.5L5 21" />
        </svg>
        {placeholder}
      </span>
    </div>
  );
}
