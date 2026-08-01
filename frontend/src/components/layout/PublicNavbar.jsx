import { Link } from 'react-router-dom';

const LINKS = [
  { href: '#profil', label: 'Profil Program' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#dokumentasi', label: 'Dokumentasi' },
  { href: '#kontak', label: 'Kontak' },
];

// Header sticky landing (port prototype header.nav + tombol Masuk per FE-S2).
export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-krem/[.86] backdrop-blur-[10px]">
      <div className="wrap flex items-center justify-between h-[68px]">
        <a href="#hero" className="font-heading font-semibold text-[24px] leading-none text-tinta no-underline">
          AMOR<span className="text-amber">.</span>
        </a>
        <nav className="flex gap-[30px] max-[860px]:hidden">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-tinta-60 text-[14.5px] font-medium no-underline hover:text-amber-teks transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-[18px]">
          <Link to="/login" className="btn btn-primary px-5 py-[11px] text-[14.5px]">
            Masuk
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
