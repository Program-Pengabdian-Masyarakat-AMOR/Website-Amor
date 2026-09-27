const LINKS = [
  { href: '#profil', label: 'Profil Program' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#dokumentasi', label: 'Dokumentasi' },
  { href: '#kontak', label: 'Kontak' },
];

// Header sticky landing (port prototype header.nav). Tombol Masuk sengaja dihilangkan:
// login hanya lewat alamat tersamar (lib/roles.js → LOGIN_PATH).
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
      </div>
    </header>
  );
}
