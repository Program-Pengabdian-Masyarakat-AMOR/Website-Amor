// Placeholder isi halaman untuk FE-S1. Akan diganti konten asli di sprint berikutnya.
export default function PagePlaceholder({ sprint, children }) {
  return (
    <div className="card p-7">
      <div className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.1em] text-amber-teks bg-amber-lembut rounded-full px-3 py-1">
        Placeholder · {sprint}
      </div>
      <p className="mt-4 text-tinta-60 max-w-prose">{children}</p>
    </div>
  );
}
