// Ekspor CSV di sisi browser. Pemisah ";" + desimal koma agar langsung rapi
// dibuka Excel berbahasa Indonesia. BOM UTF-8 menjaga karakter seperti "°" tetap benar.

function sel(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v).replace('.', ',') : '';
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [{ header, value: (row) => any }] */
export function toCsv(columns, rows) {
  const head = columns.map((c) => sel(c.header)).join(';');
  const body = rows.map((r) => columns.map((c) => sel(c.value(r))).join(';'));
  return [head, ...body].join('\r\n');
}

export function downloadCsv(filename, columns, rows) {
  const blob = new Blob(['﻿', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
