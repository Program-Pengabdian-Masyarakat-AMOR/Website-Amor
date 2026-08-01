import { useEffect } from 'react';

// Modal generik (port .overlay/.modal prototype). Tutup via tombol X, backdrop, atau Esc.
export default function Modal({ open, onClose, title, children, footer, maxWidth = 480 }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-tinta/[.42] backdrop-blur-[2px] flex items-start justify-center px-5 py-12 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-rise w-full bg-permukaan border border-border rounded-lg shadow-2"
        style={{ maxWidth }}
      >
        <div className="flex items-center justify-between px-[26px] pt-[22px] pb-[18px] border-b border-border">
          <h2 className="text-[21px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-[6px] rounded-lg text-tinta-40 grid place-items-center hover:bg-permukaan-2 hover:text-tinta transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-[26px] py-[22px]">{children}</div>
        {footer && (
          <div className="flex gap-3 justify-end px-[26px] pt-[18px] pb-6 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
