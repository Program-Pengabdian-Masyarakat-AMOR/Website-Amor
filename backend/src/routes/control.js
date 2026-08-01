import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { getControl, setSetpoint, setKontrol } from '../services/firebaseBridge.js';

const router = Router();

// Batas keamanan suhu (°C). Nilai di luar ini ditolak demi keamanan alat.
const SUHU_MIN = 0;
const SUHU_MAKS = 1200;

// Validasi satu grup {bawah, atas}: wajib integer, dalam rentang, bawah < atas.
function validasiGrup(nama, grup) {
  if (grup == null) return null; // grup opsional; kalau ada harus valid
  const bawah = Number(grup.bawah);
  const atas = Number(grup.atas);
  if (!Number.isFinite(bawah) || !Number.isFinite(atas)) return `Setpoint ${nama} harus berupa angka.`;
  if (bawah < SUHU_MIN || atas > SUHU_MAKS) return `Setpoint ${nama} harus di rentang ${SUHU_MIN}–${SUHU_MAKS} °C.`;
  if (bawah >= atas) return `Setpoint ${nama}: batas bawah harus lebih kecil dari batas atas.`;
  return null;
}

// GET /api/control → { pirolisis:{bawah,atas}, tungku:{bawah,atas}, blower, feeder }
router.get('/', requireAuth, (req, res) => res.json(getControl()));

// PUT /api/control/setpoint (integer °C) → Firebase /input/pirolisis|tungku
router.put(
  '/setpoint',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pirolisis, tungku } = req.body || {};
    if (pirolisis == null && tungku == null) {
      return res.status(400).json({ message: 'Tidak ada setpoint untuk disimpan.' });
    }
    const err = validasiGrup('pirolisis', pirolisis) || validasiGrup('tungku', tungku);
    if (err) return res.status(400).json({ message: err });

    const clean = {};
    if (pirolisis) clean.pirolisis = { bawah: Math.trunc(Number(pirolisis.bawah)), atas: Math.trunc(Number(pirolisis.atas)) };
    if (tungku) clean.tungku = { bawah: Math.trunc(Number(tungku.bawah)), atas: Math.trunc(Number(tungku.atas)) };
    res.json(await setSetpoint(clean));
  })
);

// PUT /api/control/kontrol (boolean) → Firebase /input/kontrol
router.put(
  '/kontrol',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { blower, feeder } = req.body || {};
    res.json(await setKontrol({ blower, feeder }));
  })
);

export default router;
