import { useEffect, useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import Reveal from '../../components/Reveal';
import Toast from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';

const svg = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
const AI_MODES = [
  { key: 'off', label: 'OFF', desc: 'AI feeder tidak melakukan inferensi/gerak otomatis.' },
  { key: 'observe', label: 'OBSERVE', desc: 'ONNX + lightweight MPC menghitung rekomendasi dinamis tanpa menulis aktuator.' },
  { key: 'auto', label: 'AUTO', desc: 'ONNX + MPC dapat memilih durasi pulse feeder setelah seluruh guard aman.' },
];

// Halaman Kontrol: nilai yang dikirim Web → IoT (Firebase node input, key datar).
export default function Kontrol() {
  const { data, loading, error, reload } = useApi(() => api.get('/control'), []);
  const { role } = useAuth();
  const { toast, toastProps } = useToast();

  const [form, setForm] = useState(null); // { pirolisis:{bawah,atas}, tungku:{bawah,atas} }
  const [invalid, setInvalid] = useState({});
  const [saving, setSaving] = useState(false);
  const [blower, setBlower] = useState(false);
  const [feeder, setFeeder] = useState(false);
  const [alarm, setAlarm] = useState(true);
  const [switching, setSwitching] = useState(null);
  const [aiFeeder, setAiFeeder] = useState(null);
  const [switchingAi, setSwitchingAi] = useState(false);
  const [autoDialog, setAutoDialog] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({ pirolisis: { ...data.pirolisis }, tungku: { ...data.tungku } });
    setBlower(Boolean(data.blower));
    setFeeder(Boolean(data.feeder));
    setAlarm(data.alarm !== false); // default aktif
    setAiFeeder(data.ai_feeder || null);
  }, [data]);

  useEffect(() => {
    const socket = getSocket();
    const onDecision = (decision) => setAiFeeder((old) => (old ? { ...old, last_decision: decision } : old));
    const onMode = (status) => setAiFeeder(status);
    const onMovement = (movement) => {
      if (movement?.action === 'on') setFeeder(true);
      if (movement?.action === 'off') setFeeder(false);
    };
    socket.on('ai-feeder-decision', onDecision);
    socket.on('ai-feeder-mode', onMode);
    socket.on('feeder-movement', onMovement);
    return () => {
      socket.off('ai-feeder-decision', onDecision);
      socket.off('ai-feeder-mode', onMode);
      socket.off('feeder-movement', onMovement);
    };
  }, []);

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
      toast('Setpoint dikirim. Target AI feeder, yield, dan health langsung mengikuti pita baru.');
      await reload();
    } catch {
      toast('Gagal mengirim setpoint. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  const setters = { blower: setBlower, feeder: setFeeder, alarm: setAlarm };
  const labels = { blower: 'Blower', feeder: 'Feeder', alarm: 'Alarm gas' };

  async function toggle(nama, nilai) {
    setSwitching(nama);
    setters[nama](nilai); // optimistik
    try {
      await api.put('/control/kontrol', { [nama]: nilai });
      toast(`${labels[nama]} ${nilai ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch {
      setters[nama](!nilai); // rollback
      toast('Gagal mengirim perintah.');
    } finally {
      setSwitching(null);
    }
  }

  async function applyAiMode(next) {
    setSwitchingAi(true);
    try {
      const status = await api.put('/ai/feeder-mode', { mode: next });
      setAiFeeder(status);
      toast(
        next === 'auto'
          ? 'AUTO aktif. Feeder fisik dapat digerakkan AI setelah interlock aman.'
          : next === 'observe'
            ? 'OBSERVE aktif. AI hanya mengamati dan memberi rekomendasi.'
            : 'AI feeder dinonaktifkan.'
      );
    } catch (e) {
      toast(e?.message || 'Gagal mengubah mode AI feeder.');
    } finally {
      setSwitchingAi(false);
      setAutoDialog(false);
    }
  }

  function requestAiMode(next) {
    if (next === aiFeeder?.mode || switchingAi) return;
    if (role !== 'operator') {
      toast('Hanya operator yang dapat mengubah mode AI feeder.');
      return;
    }
    if (next === 'auto') {
      if (aiFeeder?.model_envelope?.valid === false) {
        toast(aiFeeder.model_envelope.issue || 'Setpoint berada di luar envelope model AUTO.');
        return;
      }
      setAutoDialog(true);
      return;
    }
    applyAiMode(next);
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
          Nilai di halaman ini <b>dikirim langsung ke mesin</b>. Mode <b>OBSERVE</b> tidak menggerakkan feeder,
          sedangkan <b>AUTO</b> dapat menggerakkan feeder fisik setelah lolos interlock. Setpoint yang Anda simpan menjadi target dinamis untuk <b>ONNX + lightweight MPC</b>, prediksi yield, dan health check.
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
                  <div className="text-[13px] text-tinta-60">Batas bawah &amp; atas pita target (°C)</div>
                </div>
              </div>
              <div className="p-[22px] flex flex-col gap-6">
                <SetpointGroup judul="Pirolisis (reaktor)" hint="Target AI = titik tengah pita yang Anda pilih" band={form.pirolisis} invalid={invalid} grup="pirolisis" onChange={setField} />
                <SetpointGroup judul="Tungku (pembakaran)" hint="Target AI mengikuti pita tungku aktif" band={form.tungku} invalid={invalid} grup="tungku" onChange={setField} />
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
                <SwitchRow label="Blower" desc="Kipas pendorong udara pembakaran" on={blower} busy={switching === 'blower'} onToggle={(v) => toggle('blower', v)} />
                <SwitchRow label="Feeder" desc={aiFeeder?.mode === 'auto' ? 'Manual override; AUTO akan menunggu selama override aktif' : 'Pengumpan bahan ke reaktor'} on={feeder} busy={switching === 'feeder'} onToggle={(v) => toggle('feeder', v)} />
                <SwitchRow label="Alarm gas" desc="Bunyikan alarm saat gas terdeteksi (matikan untuk membisukan)" on={alarm} busy={switching === 'alarm'} onToggle={(v) => toggle('alarm', v)} />
              </div>
            </Reveal>

            {/* AI Feeder Mode */}
            <Reveal delay={130} className="card col-span-2 max-[1080px]:col-span-1">
              <div className="card-hd">
                <div>
                  <h3 className="text-[16px] font-semibold">AI Feeder · ONNX + Lightweight MPC</h3>
                  <div className="text-[13px] text-tinta-60">Setpoint-aware: model menilai kondisi relatif terhadap pita aktif, MPC memilih HOLD / durasi pulse</div>
                </div>
                <ModeBadge mode={aiFeeder?.mode || 'observe'} />
              </div>

              <div className="p-[22px] grid grid-cols-[1.15fr_.85fr] gap-5 max-[880px]:grid-cols-1">
                <div>
                  <div className="grid grid-cols-3 gap-3 max-[620px]:grid-cols-1">
                    {AI_MODES.map((m) => {
                      const active = aiFeeder?.mode === m.key;
                      const auto = m.key === 'auto';
                      return (
                        <button
                          key={m.key}
                          type="button"
                          disabled={switchingAi || (role !== 'operator' && !active)}
                          onClick={() => requestAiMode(m.key)}
                          className={`text-left border rounded-md px-4 py-[14px] transition disabled:opacity-55 ${
                            active
                              ? auto
                                ? 'border-critical bg-critical-bg'
                                : 'border-olive bg-olive/[.08]'
                              : 'border-border bg-permukaan hover:border-border-kuat'
                          }`}
                        >
                          <div className={`text-[13px] font-bold tracking-[.06em] ${active && auto ? 'text-critical-teks' : active ? 'text-olive' : 'text-tinta'}`}>{m.label}</div>
                          <div className="text-[12.5px] leading-[1.45] text-tinta-60 mt-1">{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 text-[12.5px] text-tinta-60 leading-[1.6]">
                    <b>Guard AUTO:</b> mesin harus running, gas tidak terdeteksi, suhu berada di pita user sekaligus batas hardware,
                    setpoint masih berada dalam envelope model, cooldown selesai, dan tidak ada manual override.
                    ONNX memberi probabilitas feed; lightweight MPC memproyeksikan tren suhu lalu memilih HOLD, ½ pulse, atau full pulse.
                  </div>
                  {role !== 'operator' && (
                    <div className="mt-3 text-[12.5px] text-amber-teks bg-amber-lembut border border-[#EAC9AE] rounded-md px-3 py-2">
                      Perubahan OFF / OBSERVE / AUTO hanya dapat dilakukan operator.
                    </div>
                  )}
                </div>

                <AiDecisionPanel ai={aiFeeder} />
              </div>
            </Reveal>
          </div>
        )
      )}

      <AutoModeDialog
        open={autoDialog}
        loading={switchingAi}
        ai={aiFeeder}
        onCancel={() => setAutoDialog(false)}
        onConfirm={() => applyAiMode('auto')}
      />
      <Toast {...toastProps} />
    </>
  );
}

function AiDecisionPanel({ ai }) {
  const d = ai?.last_decision;
  const p = ai?.dynamic_setpoint?.pirolisis;
  const f = ai?.dynamic_setpoint?.tungku;
  const mpc = d?.mpc;
  const envelope = ai?.model_envelope;
  return (
    <div className="border border-border rounded-md bg-latar px-4 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[13px] font-semibold">Status AI feeder dinamis</div>
        {envelope && (
          <span className={`rounded-full px-2 py-[3px] text-[10.5px] font-bold ${envelope.valid ? 'bg-normal-bg text-normal-teks' : 'bg-warning-bg text-warning-teks'}`}>
            {envelope.valid ? 'IN ENVELOPE' : 'OUT OF ENVELOPE'}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
        <Metric label="Pita pirolisis" value={p ? `${p.bawah}–${p.atas} °C` : '—'} />
        <Metric label="Target pirolisis" value={p?.target != null ? `${Number(p.target).toFixed(1)} °C` : '—'} />
        <Metric label="Pita tungku" value={f ? `${f.bawah}–${f.atas} °C` : '—'} />
        <Metric label="Target tungku" value={f?.target != null ? `${Number(f.target).toFixed(1)} °C` : '—'} />
        <Metric label="Hard cutoff pirolisis" value={`${ai?.pyro_high_cutoff_c ?? '—'} °C`} />
        <Metric label="Threshold ONNX" value={ai?.threshold != null ? Number(ai.threshold).toFixed(2) : '—'} />
        <Metric label="MPC horizon" value={ai?.mpc?.horizon_sec != null ? `${ai.mpc.horizon_sec} s` : '—'} />
        <Metric label="Pulse maksimum" value={(ai?.pulse_ms_max ?? ai?.pulse_ms) != null ? `${((ai.pulse_ms_max ?? ai.pulse_ms) / 1000).toFixed(1)} s` : '—'} />
      </div>
      {envelope?.valid === false && (
        <div className="mt-3 text-[12px] leading-[1.45] text-warning-teks bg-warning-bg border border-[#ECD7A6] rounded-md px-3 py-2">
          AUTO ditahan: {envelope.issue}. OBSERVE tetap aman untuk melihat rekomendasi/guard.
        </div>
      )}
      <div className="border-t border-border mt-4 pt-4">
        <div className="text-[11px] uppercase tracking-[.08em] text-tinta-40">Keputusan terakhir</div>
        {d ? (
          <>
            <div className="flex items-center justify-between gap-3 mt-1">
              <span className="text-[14px] font-semibold">{String(d.action || '—').replaceAll('-', ' ')}</span>
              <span className="tnum text-[12px] text-tinta-60">{d.probability == null ? 'score —' : `score ${Number(d.probability).toFixed(3)}`}</span>
            </div>
            <div className="text-[12.5px] leading-[1.45] text-tinta-60 mt-1">{d.reason || '—'}</div>
            <div className="grid grid-cols-2 gap-3 mt-3 text-[12px]">
              <Metric label="Tren pirolisis" value={d.trends?.pyro_c_per_min != null ? `${Number(d.trends.pyro_c_per_min).toFixed(2)} °C/min` : '—'} />
              <Metric label="Tren tungku" value={d.trends?.furnace_c_per_min != null ? `${Number(d.trends.furnace_c_per_min).toFixed(2)} °C/min` : '—'} />
              <Metric label="Pulse pilihan MPC" value={mpc?.pulse_ms != null ? `${(mpc.pulse_ms / 1000).toFixed(1)} s` : '—'} />
              <Metric label="Prediksi horizon" value={mpc ? `${mpc.predicted_pyro_c} / ${mpc.predicted_furnace_c} °C` : '—'} />
            </div>
          </>
        ) : (
          <div className="text-[12.5px] text-tinta-40 mt-1">Belum ada inferensi feeder pada sesi ini.</div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-tinta-40">{label}</div>
      <div className="font-semibold tnum mt-[2px]">{value}</div>
    </div>
  );
}

function ModeBadge({ mode }) {
  const m = String(mode || 'observe').toUpperCase();
  const cls = mode === 'auto' ? 'bg-critical-bg text-critical-teks' : mode === 'observe' ? 'bg-amber-lembut text-amber-teks' : 'bg-latar text-tinta-60';
  return <span className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[.08em] ${cls}`}>{m}</span>;
}

function AutoModeDialog({ open, loading, ai, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] bg-tinta/[.45] backdrop-blur-[2px] flex items-start justify-center px-5 py-12 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <div role="alertdialog" aria-modal="true" className="modal-rise w-full max-w-[520px] bg-permukaan border border-border rounded-lg shadow-2">
        <div className="p-[26px] flex gap-4">
          <div className="w-11 h-11 rounded-xl bg-critical-bg text-critical-teks grid place-items-center flex-none">
            <svg viewBox="0 0 24 24" className="w-[23px] h-[23px]" {...svg} strokeWidth="1.9">
              <path d="M12 3 2.8 19h18.4L12 3Z" />
              <path d="M12 9v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <div>
            <h2 className="text-[19px] font-semibold mb-[7px]">Aktifkan AUTO pada feeder fisik?</h2>
            <div className="text-[13.5px] leading-[1.6] text-tinta-60">
              AUTO mengizinkan backend menulis langsung ke <b>Firebase input/feeder</b>. ONNX membaca setpoint aktif dan tren; lightweight MPC memilih durasi pulse hanya jika guard lolos. Baseline feeder di-reset ke OFF saat AUTO diaktifkan.
            </div>
            <div className="mt-4 border border-border rounded-md px-3 py-3 text-[12.5px] leading-[1.55] bg-latar">
              Pita pirolisis <b>{ai?.dynamic_setpoint?.pirolisis?.bawah ?? '—'}–{ai?.dynamic_setpoint?.pirolisis?.atas ?? '—'} °C</b> · pita tungku <b>{ai?.dynamic_setpoint?.tungku?.bawah ?? '—'}–{ai?.dynamic_setpoint?.tungku?.atas ?? '—'} °C</b> · hard cutoff pirolisis <b>{ai?.pyro_high_cutoff_c ?? '—'} °C</b>.
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end px-[26px] pt-[18px] pb-6 border-t border-border">
          <button type="button" onClick={onCancel} disabled={loading} className="btn btn-ghost px-[18px] py-[11px] text-[14.5px] disabled:opacity-70">Batal</button>
          <button type="button" onClick={onConfirm} disabled={loading} className="btn btn-danger px-[18px] py-[11px] text-[14.5px] disabled:opacity-70">
            {loading ? 'Mengaktifkan…' : 'Ya, aktifkan AUTO'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetpointGroup({ judul, hint, band, invalid, grup, onChange }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-[10px]">
        <span className="text-[14px] font-semibold">{judul}</span>
        <span className="text-[12px] text-tinta-40">{hint}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[420px]:grid-cols-1">
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
      <div className="pr-4">
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
