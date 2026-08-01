import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import Reveal from '../../components/Reveal';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };

// Halaman Kontrol: nilai yang dikirim Web → IoT (via Firebase /input/...).
export default function Kontrol() {
  const { data, loading, error, reload } = useApi(() => api.get('/control'), []);
  const { toast, toastProps } = useToast();

  const [form, setForm] = useState(null); // { pirolisis:{bawah,atas}, tungku:{bawah,atas} }
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [blower, setBlower] = useState(false);
  const [feeder, setFeeder] = useState(false);
  const [switching, setSwitching] = useState(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      pirolisis: { ...data.pirolisis },
      tungku: { ...data.tungku },
    });
    setBlower(Boolean(data.blower));
    setFeeder(Boolean(data.feeder));
  }, [data]);

  function setField(grup, sisi, nilai) {
    setForm((f) => ({ ...f, [grup]: { ...f[grup], [sisi]: nilai } }));
  }

  function validasi() {
    const inv = {};
    ['pirolisis', 'tungku'].forEach((g) => {
      const b = Number(form[g].bawah);
      const a = Number(form[g].atas);
      if (!Number.isFinite(b) || form[g].bawah === '') inv[`${g}.bawah`] = true;
      if (!Number.isFinite(a) || form[g].atas === '') inv[`${g}.atas`] = true;
      if (Number.isFinite(b) && Number.isFinite(a) && b >= a) {
        inv[`${g}.bawah`] = true;
        inv[`${g}.atas`] = true;
      }
    });
    setInvalid(inv);
    return Object.keys(inv).length === 0;
  }

  async function simpanSetpoint() {
    if (!validasi()) {
      toast('Periksa nilai setpoint — batas bawah harus lebih kecil dari batas atas.');
      return;
    }
    setSaving(true);
    const payload = {
      pirolisis: { bawah: parseInt(form.pirolisis.bawah, 10), atas: parseInt(form.pirolisis.atas, 10) },
      tungku: { bawah: parseInt(form.tungku.bawah, 10), atas: parseInt(form.tungku.atas, 10) },
    };
    try {
      await api.put('/control/setpoint', payload);
      toast('Setpoint suhu dikirim ke mesin.');
      await reload();
    } catch {
      toast('Gagal mengirim setpoint. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(nama, nilai) {
    setSwitching(nama);
    // optimistik
    if (nama === 'blower') setBlower(nilai);
    else setFeeder(nilai);
    try {
      await api.put('/control/kontrol', { [nama]: nilai });
      toast(`${nama === 'blower' ? 'Blower' : 'Feeder'} ${nilai ? 'dinyalakan' : 'dimatikan'}.`);
    } catch {
      // rollback
      if (nama === 'blower') setBlower(!nilai);
      else setFeeder(!nilai);
      toast('Gagal mengirim perintah.');
    } finally {
      setSwitching(null);
    }
  }

  return (
    <>
      <Topbar crumb="Beranda · Kontrol" title="Kontrol Mesin" />

      <Reveal className="flex gap-3 items-start bg-amber-lembut border border-[#EAC9AE] rounded-md px-4 py-[13px] mb-6">
        <svg viewBox="0 0 24 24" className="w-[19px] h-[19px] flex-none text-amber-teks mt-px" {...svg} strokeWidth="1.9">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01" />
          <path d="M11 12h1v4h1" />
        </svg>
        <p className="text-[13px] leading-[1.55] text-amber-teks">
          Nilai di halaman ini <b>dikirim langsung ke mesin</b>. Pastikan setpoint sesuai kondisi
          lapangan sebelum menyimpan.
        </p>
      </Reveal>

      {loading ? (
        <div className="card p-10 text-center text-tinta-40">Memuat kontrol…</div>
      ) : error ? (
        <div className="card p-10 text-center text-critical-teks">Gagal memuat data kontrol.</div>
      ) : (
        form && (
          <div className="grid grid-cols-[1.4fr_1fr] gap-5 items-start max-[1080px]:grid-cols-1">
            {/* Setpoint suhu */}
            <Reveal className="card">
              <div className="card-hd">
                <div>
                  <h3 className="text-[16px] font-semibold">Setpoint suhu</h3>
                  <div className="text-[13px] text-tinta-60">Batas bawah & atas pita target (°C)</div>
                </div>
              </div>
              <div className="p-[22px] flex flex-col gap-6">
                <SetpointGroup
                  judul="Pirolisis (reaktor)"
                  hint="Umumnya sekitar 400 °C"
                  band={form.pirolisis}
                  invalid={invalid}
                  grup="pirolisis"
                  onChange={setField}
                />
                <SetpointGroup
                  judul="Tungku (pembakaran)"
                  hint="Umumnya sekitar 800 °C"
                  band={form.tungku}
                  invalid={invalid}
                  grup="tungku"
                  onChange={setField}
                />
                <div className="flex justify-end">
                  <button onClick={simpanSetpoint} disabled={saving} className="btn btn-primary px-5 py-[11px] text-[14.5px] disabled:opacity-70">
                    {saving ? 'Mengirim…' : 'Simpan setpoint'}
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Aktuator */}
            <Reveal delay={80} className="card">
              <div className="card-hd">
                <div>
                  <h3 className="text-[16px] font-semibold">Aktuator</h3>
                  <div className="text-[13px] text-tinta-60">Perubahan langsung diterapkan</div>
                </div>
              </div>
              <div className="p-[22px] flex flex-col gap-3">
                <SwitchRow
                  label="Blower"
                  desc="Kipas pendorong udara pembakaran"
                  on={blower}
                  busy={switching === 'blower'}
                  onToggle={(v) => toggle('blower', v)}
                />
                <SwitchRow
                  label="Feeder"
                  desc="Pengumpan bahan ke reaktor"
                  on={feeder}
                  busy={switching === 'feeder'}
                  onToggle={(v) => toggle('feeder', v)}
                />
              </div>
            </Reveal>
          </div>
        )
      )}

      <Toast {...toastProps} />
    </>
  );
}

function SetpointGroup({ judul, hint, band, invalid, grup, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <span className="text-[14px] font-semibold">{judul}</span>
        <span className="text-[12px] text-tinta-40">{hint}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {['bawah', 'atas'].map((sisi) => (
          <div key={sisi} className="flex flex-col gap-[7px]">
            <label className="text-[13px] text-tinta-60 capitalize">Batas {sisi}</label>
            <div className="relative flex items-center">
              <input
                type="number"
                inputMode="numeric"
                value={band[sisi]}
                onChange={(e) => onChange(grup, sisi, e.target.value)}
                className={`form-input tnum !pl-[13px] pr-9 ${invalid[`${grup}.${sisi}`] ? 'invalid' : ''}`}
              />
              <span className="absolute right-[13px] text-tinta-40 text-[13px]">°C</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({ label, desc, on, busy, onToggle }) {
  return (
    <div className="flex items-center justify-between border border-border rounded-md px-4 py-[14px] bg-permukaan">
      <div>
        <div className="text-[14.5px] font-semibold">{label}</div>
        <div className="text-[12.5px] text-tinta-40">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={busy}
        onClick={() => onToggle(!on)}
        className={`relative w-[46px] h-[26px] rounded-full transition-colors disabled:opacity-60 ${on ? 'bg-olive' : 'bg-border-kuat'}`}
      >
        <span className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow-1 transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
