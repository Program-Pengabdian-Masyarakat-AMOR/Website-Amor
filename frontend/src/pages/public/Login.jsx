import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_META, ROLES } from '../../lib/roles';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function Login() {
  const { login, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [alert, setAlert] = useState(null); // { message, variant: 'error' | 'warning' }
  const [shakeField, setShakeField] = useState(null); // 'role' | 'user' | 'pass'

  const userRef = useRef(null);
  const passRef = useRef(null);

  function clearAlert() {
    setAlert(null);
  }

  function triggerShake(field) {
    setShakeField(null);
    // paksa reflow agar animasi terulang
    requestAnimationFrame(() => setShakeField(field));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const u = username.trim();
    const p = password;

    if (!role) {
      setAlert({ message: 'Pilih dulu role akun yang akan dipakai untuk masuk.', variant: 'error' });
      triggerShake('role');
      return;
    }
    if (!u && !p) {
      setAlert({ message: 'Yuk isi dulu username dan kata sandinya sebelum masuk.', variant: 'error' });
      triggerShake('user');
      userRef.current?.focus();
      return;
    }
    if (!u) {
      setAlert({ message: 'Username masih kosong. Coba isi dulu, ya.', variant: 'error' });
      triggerShake('user');
      userRef.current?.focus();
      return;
    }
    if (!p) {
      setAlert({ message: 'Kata sandinya belum diisi nih. Lengkapi dulu, ya.', variant: 'error' });
      triggerShake('pass');
      passRef.current?.focus();
      return;
    }
    if (p.length < 4) {
      setAlert({ message: 'Sepertinya kata sandi belum cocok. Coba periksa kembali, ya.', variant: 'error' });
      triggerShake('pass');
      passRef.current?.focus();
      return;
    }

    clearAlert();
    try {
      await login(u, p, role);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setAlert({ message: err.message || 'Gagal masuk. Coba lagi, ya.', variant: 'error' });
      triggerShake('pass');
    }
  }

  function handleLupa(e) {
    e.preventDefault();
    setAlert({
      message: 'Tenang, kata sandi bisa direset pengelola. Hubungi narahubung program untuk bantuan.',
      variant: 'warning',
    });
  }

  // Sudah login → langsung ke dashboard sesuai role.
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const alertCls =
    alert?.variant === 'warning'
      ? 'bg-warning-bg border-[#ECD7A6] text-warning-teks'
      : 'bg-critical-bg border-[#ECC4BD] text-critical-teks';

  return (
    <div className="grid lg:grid-cols-[1.05fr_.95fr] min-h-screen">
      {/* Brand panel */}
      <aside className="relative overflow-hidden bg-olive text-[#EEF1EA] flex flex-col px-14 py-[54px] max-[840px]:px-8 max-[840px]:py-10 max-[640px]:hidden">
        <span className="absolute -right-[120px] -bottom-[120px] w-[380px] h-[380px] rounded-full border-[1.5px] border-white/[.08]" />
        <span className="absolute -right-[60px] -bottom-[60px] w-[240px] h-[240px] rounded-full border-[1.5px] border-white/[.07]" />
        <div className="font-heading font-semibold text-[28px] leading-none relative z-10">
          AMOR<span className="text-amber">.</span>
        </div>
        <div className="my-auto relative z-10 max-[840px]:my-7">
          <p className="text-[12px] tracking-[.16em] uppercase text-[#A9C0A4] font-semibold mb-[18px]">
            Pemantauan Pirolisis
          </p>
          <h1 className="font-medium text-[40px] leading-[1.1] mb-[18px] max-w-[420px] text-[#F4F6F1] max-[840px]:text-[30px]">
            Selamat datang <em className="italic text-[#E8A56B]">kembali</em>.
          </h1>
          <p className="text-[15.5px] text-[#C4CCBF] max-w-[380px]">
            Masuk untuk memantau status mesin, alert health check, dan ringkasan penjualan minyak
            secara langsung.
          </p>
        </div>
        <div className="relative z-10 text-[12.5px] text-[#9DAE98]">
          Program Pengabdian Masyarakat · Tahun ke-3
        </div>
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center p-12 max-[840px]:px-7 max-[840px]:pt-10 max-[840px]:pb-[60px]">
        <div className="w-full max-w-[400px]">
          <div className="mb-[30px]">
            <p className="text-[12px] tracking-[.14em] uppercase text-amber-teks font-semibold mb-3">
              Masuk Akun
            </p>
            <h2 className="text-[30px] font-semibold mb-2">Masuk ke AMOR</h2>
            <p className="text-[15px] text-tinta-60">
              Pilih role, lalu gunakan username dan kata sandi yang diberikan pengelola.
            </p>
          </div>

          {alert && (
            <div role="alert" className={`mb-[18px] flex items-start gap-[9px] border rounded-md px-[13px] py-[11px] text-[13.5px] leading-[1.5] ${alertCls}`}>
              <svg viewBox="0 0 24 24" className="w-[17px] h-[17px] flex-none mt-px" {...svg} strokeWidth="2">
                {alert.variant === 'warning' ? (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 16v-5" />
                    <path d="M12 8h.01" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5" />
                    <path d="M12 16h.01" />
                  </>
                )}
              </svg>
              <span>{alert.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
            <fieldset className={`flex flex-col gap-[7px] ${shakeField === 'role' ? 'shake' : ''}`}>
              <legend className="text-[13.5px] font-semibold mb-[7px]">Masuk sebagai</legend>
              <div role="radiogroup" className="grid grid-cols-3 gap-2 max-[420px]:grid-cols-1">
                {ROLES.map((r) => {
                  const aktif = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={aktif}
                      title={ROLE_META[r].desc}
                      onClick={() => { setRole(r); clearAlert(); }}
                      className={`text-left border rounded-md px-3 py-[10px] transition-colors ${
                        aktif
                          ? 'border-olive bg-olive-lembut text-olive'
                          : 'border-border bg-permukaan text-tinta-60 hover:border-border-kuat hover:text-tinta'
                      }`}
                    >
                      <span className="block text-[13.5px] font-semibold">{ROLE_META[r].label}</span>
                    </button>
                  );
                })}
              </div>
              {role && <p className="text-[12.5px] text-tinta-40">{ROLE_META[role].desc}.</p>}
            </fieldset>

            <div className={`flex flex-col gap-[7px] ${shakeField === 'user' ? 'shake' : ''}`}>
              <label htmlFor="username" className="text-[13.5px] font-semibold">Username</label>
              <div className="relative flex items-center">
                <svg viewBox="0 0 24 24" className="absolute left-[13px] w-[18px] h-[18px] text-tinta-40 pointer-events-none" {...svg} strokeWidth="1.7">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="8" r="4" />
                </svg>
                <input
                  id="username"
                  ref={userRef}
                  type="text"
                  autoComplete="username"
                  placeholder="mis. operator_rw04"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearAlert(); }}
                  className="field-input"
                />
              </div>
            </div>

            <div className={`flex flex-col gap-[7px] ${shakeField === 'pass' ? 'shake' : ''}`}>
              <label htmlFor="password" className="text-[13.5px] font-semibold">Kata sandi</label>
              <div className="relative flex items-center">
                <svg viewBox="0 0 24 24" className="absolute left-[13px] w-[18px] h-[18px] text-tinta-40 pointer-events-none" {...svg} strokeWidth="1.7">
                  <rect x="4" y="11" width="16" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <input
                  id="password"
                  ref={passRef}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearAlert(); }}
                  className="field-input pr-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-2 p-[7px] rounded-lg text-tinta-40 grid place-items-center hover:text-tinta hover:bg-permukaan-2 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" {...svg} strokeWidth="1.7">
                    {showPw ? (
                      <>
                        <path d="M9.9 4.2A9.5 9.5 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.3 3.2" />
                        <path d="M6.6 6.6A17 17 0 0 0 2 11s3.5 7 10 7a9.5 9.5 0 0 0 4.1-.9" />
                        <path d="m2 2 20 20" />
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </>
                    ) : (
                      <>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-[9px] text-[14px] text-tinta-60 cursor-pointer select-none">
                <input type="checkbox" className="w-[17px] h-[17px] accent-olive" /> Ingat saya
              </label>
              <a href="#" onClick={handleLupa} className="text-[14px] text-amber-teks font-medium no-underline hover:underline">
                Lupa kata sandi?
              </a>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full text-base py-[14px] disabled:opacity-70">
              {loading ? (
                'Memproses…'
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" {...svg} strokeWidth="1.9">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <path d="M10 17l5-5-5-5" />
                    <path d="M15 12H3" />
                  </svg>
                  Masuk
                </>
              )}
            </button>
          </form>

          <p className="mt-[26px] text-[13px] text-tinta-40 text-center leading-[1.6]">
            Belum punya akses? Hubungi pengelola program melalui halaman{' '}
            <Link to="/" className="text-tinta-60 underline">profil AMOR</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
