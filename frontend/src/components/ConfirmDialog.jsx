import { useEffect } from 'react';

// Dialog konfirmasi hapus (port .cmodal prototype).
export default function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title = 'Hapus?',
  children,
  confirmLabel = 'Ya, hapus',
  loading = false,
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-tinta/[.42] backdrop-blur-[2px] flex items-start justify-center px-5 py-12 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div role="alertdialog" aria-modal="true" className="modal-rise w-full max-w-[400px] bg-permukaan border border-border rounded-lg shadow-2">
        <div className="p-[26px] flex gap-4">
          <div className="w-11 h-11 rounded-xl bg-critical-bg text-critical grid place-items-center flex-none">
            <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </div>
          <div>
            <h2 className="text-[19px] font-semibold mb-[6px]">{title}</h2>
            <p className="text-[14px] text-tinta-60">{children}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-[26px] pt-[18px] pb-6 border-t border-border">
          <button type="button" onClick={onCancel} className="btn btn-ghost px-[18px] py-[11px] text-[14.5px]">
            Batal
          </button>
          <button type="button" onClick={onConfirm} disabled={loading} className="btn btn-danger px-[18px] py-[11px] text-[14.5px] disabled:opacity-70">
            {loading ? 'Menghapus…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
