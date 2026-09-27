import { useEffect, useState } from 'react';
import PublicNavbar from '../../components/layout/PublicNavbar';
import ImageSlot from '../../components/ImageSlot';
import Reveal from '../../components/Reveal';
import { api } from '../../services/api';

// Nilai cadangan bila API belum bisa dihubungi. Nilai aktual diedit role management
// lewat Dashboard → Data Publik (GET/PUT /api/site-content/landing-stats).
const DEFAULT_STATS = [
  { value: '1.240', unit: 'kg', caption: 'Sampah plastik diolah' },
  { value: '760', unit: 'L', caption: 'Minyak dihasilkan' },
  { value: '2', unit: 'titik', caption: 'Reaktor pirolisis' },
];

function useLandingStats() {
  const [stats, setStats] = useState(DEFAULT_STATS);
  useEffect(() => {
    let aktif = true;
    api
      .get('/site-content/landing-stats')
      .then((res) => {
        const items = (res?.items || []).filter((it) => it.visible !== false);
        if (aktif && items.length) setStats(items);
      })
      .catch(() => {}); // tetap tampilkan nilai cadangan
    return () => {
      aktif = false;
    };
  }, []);
  return stats;
}

const STEPS = [
  {
    n: 'Langkah 01',
    h: 'Timbang sampah',
    p: 'Sampah plastik dikumpulkan, dipilah, lalu ditimbang agar jumlah bahan tercatat sejak awal.',
    icon: (
      <>
        <path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        <path d="M6.5 7h11l2.5 11a2 2 0 0 1-2 2.4H6a2 2 0 0 1-2-2.4z" />
      </>
    ),
  },
  {
    n: 'Langkah 02',
    h: 'Pirolisis',
    p: 'Plastik dipanaskan dalam ruang tertutup tanpa oksigen sehingga terurai, bukan terbakar.',
    icon: (
      <>
        <path d="M7 8h10l-1.5 11.5a2 2 0 0 1-2 1.5h-3a2 2 0 0 1-2-1.5z" />
        <path d="M9 8V5a3 3 0 0 1 6 0v3" />
      </>
    ),
  },
  {
    n: 'Langkah 03',
    h: 'Jadi minyak',
    p: 'Uap hasil pemanasan didinginkan dan mengembun menjadi minyak yang ditampung di wadah.',
    icon: <path d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z" />,
  },
  {
    n: 'Langkah 04',
    h: 'Pantau via IoT',
    p: 'Sensor mengirim suhu, tekanan, dan hasil ke dashboard sehingga prosesnya aman diawasi.',
    icon: (
      <>
        <path d="M5 13a9 9 0 0 1 14 0" />
        <path d="M8.5 16.5a4.5 4.5 0 0 1 7 0" />
        <path d="M2 9.5a14 14 0 0 1 20 0" />
        <circle cx="12" cy="20" r="1" />
      </>
    ),
  },
];

const DOCS = [
  {
    num: '01',
    h: 'Pemasangan sensor IoT',
    p: 'Sensor suhu, tekanan, dan gas dipasang pada reaktor lalu dihubungkan ke sistem pemantauan.',
    placeholder: 'Foto pemasangan sensor IoT',
    src: '/landing/dok-1-sensor.webp',
  },
  {
    num: '02',
    h: 'Proses pirolisis',
    p: 'Sampah plastik dipanaskan dalam ruang tertutup tanpa oksigen hingga terurai menjadi uap.',
    placeholder: 'Foto proses pirolisis',
    src: '/landing/dok-2-pirolisis.webp',
  },
  {
    num: '03',
    h: 'Hasil minyak',
    p: 'Uap yang didinginkan mengembun menjadi minyak dan ditampung di wadah.',
    placeholder: 'Foto hasil minyak',
    src: '/landing/dok-3-minyak.webp',
  },
  {
    num: '04',
    h: 'Pelatihan warga',
    p: 'Warga diajak mengenali cara kerja alat dan membaca data pemantauan agar program bisa berjalan mandiri.',
    placeholder: 'Foto pelatihan warga',
    src: '/landing/dok-4-pelatihan.webp',
  },
];

const KONTAK = [
  { lbl: 'Lokasi', val: 'Jl. Pangeran Kulon / Jl. Murangan VII, Panggeran 7, Triharjo, Kec. Sleman, Kabupaten Sleman, DIY 55541', icon: (<><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>) },
  { lbl: 'Email', val: 'kontak.amor@gmail.com', icon: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>) },
  { lbl: 'Narahubung', val: 'Tim Pelaksana AMOR · 0896-2352-1050', icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z" /> },
  { lbl: 'Jadwal kunjungan', val: 'Senin–Jumat, 09.00–15.00 WIB', icon: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
];

const svgProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

// Kelas literal agar terbaca Tailwind (maks. 4 statistik, lihat backend lib/siteContent.js).
const STAT_COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export default function Landing() {
  const stats = useLandingStats();
  return (
    <div className="bg-krem text-tinta" style={{ scrollBehavior: 'smooth' }}>
      <PublicNavbar />

      {/* HERO */}
      <section id="hero" className="pt-20 pb-[72px]">
        <div className="wrap">
          <Reveal className="grid lg:grid-cols-[1.08fr_.92fr] gap-16 items-center max-[860px]:gap-10">
            <div>
              <p className="eyebrow">Pengabdian Masyarakat · Tahun ke-3</p>
              <h1 className="font-medium text-[60px] leading-[1.02] my-6 max-[860px]:text-[44px] max-[480px]:text-[34px]">
                Sampah plastik, <em className="italic text-amber-teks">dipanaskan</em> jadi minyak.
              </h1>
              <p className="text-[18.5px] text-tinta-60 mb-[18px] max-w-[520px]">
                AMOR mengolah sampah plastik menjadi minyak lewat pirolisis, lalu dipantau sensor IoT
                secara real-time — agar prosesnya aman, terukur, dan bisa dilihat siapa saja.
              </p>
              <p className="text-[15.5px] text-tinta-60 border-l-2 border-border-kuat pl-4 mb-8 max-w-[500px]">
                Tujuan kami sederhana: membantu warga mengurangi tumpukan plastik sekaligus
                menumbuhkan keterampilan mengelolanya, dengan teknologi yang jujur dan mudah dipahami.
              </p>
              <div className="flex gap-[14px] flex-wrap">
                <a href="#cara-kerja" className="btn btn-primary btn-lg">
                  Pelajari programnya
                  <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps} strokeWidth="1.8">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="relative">
              <ImageSlot src="/landing/hero-reaktor.webp" alt="Reaktor pirolisis AMOR di lokasi" placeholder="Foto reaktor pirolisis di lokasi" height={460} className="shadow-2" loading="eager" fetchPriority="high" />
              <div className="absolute left-[18px] bottom-[18px] bg-tinta/[.78] text-white backdrop-blur-[6px] px-[14px] py-2 rounded-full text-[12.5px] font-medium flex items-center gap-2">
                <span className="live-dot" />
                Sensor IoT memantau langsung
              </div>
            </div>
          </Reveal>

          <div className={`grid ${STAT_COLS[stats.length] || 'grid-cols-4'} border-t border-border mt-16 max-[860px]:grid-cols-1`}>
            {stats.map((s, i) => (
              <Reveal
                as="div"
                key={`${i}-${s.caption}`}
                delay={i * 90}
                className={`py-[26px] px-7 ${i === 0 ? 'pl-0' : ''} ${i === stats.length - 1 ? 'pr-0' : 'border-r border-border'} max-[860px]:px-0 max-[860px]:py-[22px] max-[860px]:border-r-0 ${i < stats.length - 1 ? 'max-[860px]:border-b max-[860px]:border-border' : ''}`}
              >
                <div className="font-heading font-semibold text-[34px] leading-none tnum">
                  <span className="text-amber-teks">{s.value}</span>
                  {s.unit && ` ${s.unit}`}
                </div>
                <div className="text-[13px] text-tinta-40 mt-2">{s.caption}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROFIL */}
      <section id="profil" className="py-[76px] border-t border-border">
        <div className="wrap">
          <Reveal className="max-w-[640px] mb-12">
            <p className="eyebrow">Profil Program</p>
            <h2 className="font-semibold text-[36px] leading-[1.08] mt-[18px] mb-[14px]">
              Lanjutan kerja yang sudah berjalan dua tahun.
            </h2>
            <p className="text-[17px] text-tinta-60">
              AMOR bukan dimulai dari nol. Ia tumbuh dari kegiatan tahun pertama dan kedua, dan kini
              berfokus pada pemantauan yang lebih rapi.
            </p>
          </Reveal>
          <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-14 items-start max-[860px]:gap-10">
            <div className="[&_p]:text-[16.5px] [&_p]:text-tinta-60 [&_p]:mb-[18px] [&_p:last-child]:mb-0 [&_strong]:text-tinta [&_strong]:font-semibold">
              <p>
                <strong>Latar belakang.</strong> Pada tahun pertama, kegiatan diawali dengan
                pengenalan masalah sampah plastik di lingkungan warga dan uji coba alat pirolisis
                sederhana. Tahun kedua, fokusnya beralih ke pelatihan warga dan perbaikan keamanan
                proses produksi.
              </p>
              <p>
                Memasuki <strong>tahun ketiga</strong>, AMOR melengkapi alat dengan sensor IoT
                sehingga suhu, tekanan, dan hasil minyak dapat dipantau langsung — tanpa harus selalu
                berada di samping reaktor. Tujuannya agar program ini bisa diteruskan warga secara
                mandiri.
              </p>
            </div>
            <aside className="flex flex-col gap-3 sticky top-24 max-[860px]:static">
              <p className="text-[11px] tracking-[.14em] uppercase text-tinta-40 font-semibold mb-1">
                Perjalanan
              </p>
              {[
                { y: 'Tahun 1', t: 'Pengenalan masalah & uji coba alat pirolisis', now: false },
                { y: 'Tahun 2', t: 'Pelatihan warga & keamanan proses', now: false },
                { y: 'Tahun 3 · kini', t: 'Pemantauan IoT & kemandirian warga', now: true },
              ].map((c) => (
                <div
                  key={c.y}
                  className={`bg-permukaan rounded-md px-[18px] py-[14px] shadow-1 border ${c.now ? 'border-amber-tombol' : 'border-border'}`}
                >
                  <div className="font-heading font-semibold text-[15px] text-amber-teks">{c.y}</div>
                  <div className="text-[13px] text-tinta-60 mt-[5px]">{c.t}</div>
                </div>
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* CARA KERJA */}
      <section id="cara-kerja" className="py-[76px] border-t border-border">
        <div className="wrap">
          <Reveal className="max-w-[640px] mb-12">
            <p className="eyebrow">Cara Kerja</p>
            <h2 className="font-semibold text-[36px] leading-[1.08] mt-[18px] mb-[14px]">
              Dari plastik ke minyak, dalam empat langkah.
            </h2>
            <p className="text-[17px] text-tinta-60">
              Prosesnya runtut dan dapat diawasi di setiap tahap. Tidak ada bagian yang tersembunyi.
            </p>
          </Reveal>
          <div className="grid grid-cols-4 max-[860px]:grid-cols-2 max-[860px]:gap-y-9 max-[480px]:grid-cols-1 max-[480px]:gap-y-7">
            {STEPS.map((s, i) => (
              <Reveal as="div" key={s.n} delay={i * 80} className="px-[26px] max-[860px]:px-0">
                <div className="w-[54px] h-[54px] rounded-[14px] bg-permukaan border border-border shadow-1 grid place-items-center text-olive mb-[18px]">
                  <svg viewBox="0 0 24 24" className="w-[26px] h-[26px]" {...svgProps} strokeWidth="1.6">
                    {s.icon}
                  </svg>
                </div>
                <div className="font-heading text-[13px] text-amber-teks font-semibold">{s.n}</div>
                <h3 className="text-[19px] font-semibold mt-[6px] mb-2">{s.h}</h3>
                <p className="text-[14px] text-tinta-60">{s.p}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120} className="mt-11 bg-olive text-[#EEF1EA] rounded-lg px-8 py-7 flex gap-[22px] items-center flex-wrap">
            <div className="w-[46px] h-[46px] rounded-xl bg-white/10 grid place-items-center flex-none">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#E8A56B]" {...svgProps} strokeWidth="1.7">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.4 0 2.5-1 2.5-2.7 0-1-.5-1.8-1-2.3 1.5.3 3.5 1.8 3.5 4.5A5 5 0 0 1 7 16c0-2.4 1.3-4 2.2-5.5C10 9 11 7 10.5 5c2 .8 4.5 3.2 4.5 6" />
              </svg>
            </div>
            <p className="font-heading text-[24px] font-medium max-w-[460px] leading-[1.25]">
              Tanpa oksigen, plastik tidak terbakar — ia terurai menjadi uap, lalu mengembun jadi
              minyak.
            </p>
            <p className="text-[14.5px] text-[#C4CCBF] max-w-[380px]">
              Karena itu pemantauan suhu dan tekanan penting: prosesnya harus tetap di rentang aman
              sepanjang berjalan.
            </p>
          </Reveal>
        </div>
      </section>

      {/* DOKUMENTASI */}
      <section id="dokumentasi" className="py-[76px] border-t border-border">
        <div className="wrap">
          <Reveal className="max-w-[640px] mb-12">
            <p className="eyebrow">Dokumentasi Kegiatan</p>
            <h2 className="font-semibold text-[36px] leading-[1.08] mt-[18px] mb-[14px]">
              Catatan dari lapangan.
            </h2>
            <p className="text-[17px] text-tinta-60">
              Cuplikan tahap-tahap kegiatan AMOR. Bingkai foto akan dilengkapi dari dokumentasi
              lapangan.
            </p>
          </Reveal>
          <div className="flex flex-col gap-16">
            {DOCS.map((d, i) => {
              const alt = i % 2 === 1;
              return (
                <Reveal
                  as="article"
                  key={d.num}
                  delay={(i % 2) * 80}
                  className="grid lg:grid-cols-2 gap-[52px] items-center max-[860px]:gap-6"
                >
                  <div className={alt ? 'lg:order-2' : ''}>
                    <ImageSlot src={d.src} alt={d.h} placeholder={d.placeholder} height={360} className="shadow-2" />
                  </div>
                  <div className={`max-w-[460px] ${alt ? 'lg:ml-auto' : ''} max-[860px]:max-w-none`}>
                    <span className="font-heading text-[13px] font-semibold text-amber-teks inline-flex items-center gap-[10px] before:content-[''] before:w-[22px] before:h-[1.5px] before:bg-amber before:inline-block">
                      {d.num}
                    </span>
                    <h3 className="text-[27px] font-semibold leading-[1.12] mt-4 mb-[14px]">{d.h}</h3>
                    <p className="text-[16px] text-tinta-60">{d.p}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="py-[76px] border-t border-border">
        <div className="wrap">
          <Reveal className="bg-permukaan border border-border rounded-lg overflow-hidden shadow-1 grid lg:grid-cols-[1.1fr_.9fr]">
            <div className="px-[46px] py-12 max-[860px]:px-7">
              <p className="eyebrow">Kontak & Akses</p>
              <h2 className="text-[34px] font-semibold my-4 leading-[1.08]">
                Ingin tahu lebih banyak, atau ikut mengelola?
              </h2>
              <p className="text-[16.5px] text-tinta-60 mb-7 max-w-[420px]">
                Hubungi tim pelaksana untuk informasi kegiatan, kunjungan ke lokasi, atau kerja sama
                dengan program AMOR.
              </p>
              <a href="mailto:kontak.amor@gmail.com" className="btn btn-primary btn-lg">
                <svg viewBox="0 0 24 24" className="w-4 h-4" {...svgProps} strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Kirim email
              </a>
            </div>
            <div className="bg-permukaan-2 px-[46px] py-12 border-l border-border max-[860px]:border-l-0 max-[860px]:border-t max-[860px]:px-7">
              {KONTAK.map((c, i) => (
                <div
                  key={c.lbl}
                  className={`flex gap-[14px] items-start py-4 ${i < KONTAK.length - 1 ? 'border-b border-dashed border-border' : 'pb-0'} ${i === 0 ? 'pt-0' : ''}`}
                >
                  <div className="w-9 h-9 rounded-[10px] bg-amber-lembut text-amber-teks grid place-items-center flex-none">
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" {...svgProps} strokeWidth="1.7">
                      {c.icon}
                    </svg>
                  </div>
                  <div>
                    <div className="text-[12px] text-tinta-40 uppercase tracking-[.08em] font-semibold">
                      {c.lbl}
                    </div>
                    <div className="text-[15px] text-tinta mt-[3px]">{c.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="wrap flex justify-between items-center gap-5 flex-wrap">
          <a href="#hero" className="font-heading font-semibold text-[20px] text-tinta no-underline">
            AMOR<span className="text-amber">.</span>
          </a>
          <p className="text-[13px] text-tinta-40">
            Program Pengabdian Masyarakat · Pirolisis Sampah Plastik → Minyak · Tahun ke-3
          </p>
          <p className="text-[13px] text-tinta-40">© 2026 AMOR</p>
        </div>
      </footer>
    </div>
  );
}
