import { prisma } from './prisma.js';

// Nilai awal = angka yang sebelumnya tertulis langsung di Landing.jsx.
export const DEFAULT_CONTENT = {
  'landing-stats': {
    items: [
      { value: '1.240', unit: 'kg', caption: 'Sampah plastik diolah', visible: true },
      { value: '760', unit: 'L', caption: 'Minyak dihasilkan', visible: true },
      { value: '2', unit: 'titik', caption: 'Reaktor pirolisis', visible: true },
    ],
  },
};

export const CONTENT_KEYS = Object.keys(DEFAULT_CONTENT);

const MAX_ITEMS = 4; // sejalan dengan grid statistik di Landing.jsx
const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const badRequest = (message, status = 400) => Object.assign(new Error(message), { status });

// Validasi + normalisasi payload per key. Lempar Error berstatus 4xx bila tidak valid.
export function sanitizeContent(key, body) {
  if (key === 'landing-stats') {
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items || items.length === 0 || items.length > MAX_ITEMS) {
      throw badRequest(`Statistik wajib berisi 1–${MAX_ITEMS} item.`);
    }
    const clean = items.map((it) => ({
      value: clip(it?.value, 20),
      unit: clip(it?.unit, 12),
      caption: clip(it?.caption, 60),
      visible: it?.visible !== false,
    }));
    if (clean.some((it) => !it.value || !it.caption)) {
      throw badRequest('Setiap statistik wajib punya angka dan keterangan.');
    }
    return { items: clean };
  }
  throw badRequest('Konten tidak dikenal.', 404);
}

export async function readContent(key) {
  const fallback = { ...DEFAULT_CONTENT[key], updated_at: null, updated_by: null };
  const row = await prisma.siteContent.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return { ...JSON.parse(row.value), updated_at: row.updatedAt, updated_by: row.updatedBy };
  } catch {
    return fallback;
  }
}
