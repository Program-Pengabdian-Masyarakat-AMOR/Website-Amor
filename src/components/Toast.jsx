// Toast terkontrol. Hook pendamping ada di hooks/useToast.js.
export default function Toast({ message, show }) {
  return (
    <div
      className={`fixed bottom-[26px] left-1/2 -translate-x-1/2 z-[200] flex items-center gap-[10px] bg-tinta text-[#F4F0E9] text-[14px] font-medium px-5 py-[13px] rounded-md shadow-2 transition-all duration-200 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" className="w-[17px] h-[17px] text-[#8FC489]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="m20 6-11 11-5-5" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
