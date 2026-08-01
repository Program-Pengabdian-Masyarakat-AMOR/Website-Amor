// Tabel data generik (port style tabel prototype Monitoring).
// columns: [{ key, header, align?: 'left'|'right', render?: (row)=>node, cellClass?, headClass? }]
// footer:  array sel sejajar kolom (opsional) → [{ content, align?, className? }]
export default function DataTable({
  columns = [],
  rows = [],
  keyField = 'id',
  footer,
  loading = false,
  error = null,
  emptyMessage = 'Belum ada data.',
}) {
  const colCount = columns.length;

  return (
    <div className="overflow-hidden rounded-b-lg">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`bg-permukaan-2 border-b border-border text-[11px] tracking-[.07em] uppercase text-tinta-40 font-semibold px-5 py-[13px] ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  } ${c.headClass || ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="px-5 py-10 text-center text-tinta-40">
                  Memuat data…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={colCount} className="px-5 py-10 text-center text-critical-teks">
                  Gagal memuat data. {error.message || ''}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-5 py-10 text-center text-tinta-40">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((row) => (
                <tr key={row[keyField]} className="hover:bg-[#F8F4ED] transition-colors [&:last-child>td]:border-b-0">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-5 py-[13px] border-b border-border ${
                        c.align === 'right' ? 'text-right' : 'text-left'
                      } ${c.cellClass || ''}`}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
          {footer && !loading && !error && rows.length > 0 && (
            <tfoot>
              <tr>
                {footer.map((f, i) => (
                  <td
                    key={i}
                    className={`bg-permukaan-2 border-t border-border px-5 py-[13px] text-[13px] text-tinta-60 ${
                      f.align === 'right' ? 'text-right' : 'text-left'
                    } ${f.className || ''}`}
                  >
                    {f.content}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
