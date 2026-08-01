// Placeholder saat chunk chart (Recharts) sedang dimuat (Suspense fallback).
export default function ChartFallback({ height = 240 }) {
  return (
    <div className="grid place-items-center text-tinta-40 text-[13px]" style={{ height }}>
      Memuat grafik…
    </div>
  );
}
