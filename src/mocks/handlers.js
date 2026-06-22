// MSW handlers — kontrak endpoint PERSIS sesuai docs/CLAUDE.md → Kontrak Endpoint API.
// Bentuk request/response & nama endpoint TIDAK BOLEH berubah: di FASE 2 backend tinggal
// mengikuti kontrak ini.
import { http, HttpResponse } from 'msw';
import { users } from './data/users';
import { sensorLatest, sensorSeries } from './data/sensors';
import { productionLogs } from './data/production';
import { healthStatus } from './data/health';
import { predictions } from './data/predictions';
import { members as membersSeed } from './data/members';
import { oilSales as salesSeed } from './data/sales';

const BASE = '/api';

// Salinan in-memory agar mutasi (CRUD) terlihat selama sesi berjalan.
let members = membersSeed.map((m) => ({ ...m }));
let sales = salesSeed.map((s) => ({ ...s }));
let production = productionLogs.map((p) => ({ ...p }));

const nextId = (arr) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1);

export const handlers = [
  // POST /api/auth/login → { token, role }
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { username, password } = await request.json();
    if (!username || !password) {
      return HttpResponse.json({ message: 'Username dan kata sandi wajib diisi.' }, { status: 400 });
    }
    // Mock: terima kombinasi yang valid; cocokkan ke seed bila ada, kalau tidak anggap operator.
    const found = users.find((u) => u.username === username && u.password === password);
    const role = found ? found.role : 'operator';
    return HttpResponse.json({ token: `mock.${btoa(username)}.${Date.now()}`, role });
  }),

  // GET /api/sensor-data/latest
  http.get(`${BASE}/sensor-data/latest`, () =>
    HttpResponse.json({ latest: sensorLatest, series: sensorSeries })
  ),

  // GET /api/production-logs
  http.get(`${BASE}/production-logs`, () => HttpResponse.json(production)),

  // POST /api/production-logs (FASE 2 memicu ONNX + health; FASE 1 sekadar simpan)
  http.post(`${BASE}/production-logs`, async ({ request }) => {
    const body = await request.json();
    const item = { id: nextId(production), created_at: new Date().toISOString(), ...body };
    production = [item, ...production];
    return HttpResponse.json(item, { status: 201 });
  }),

  // GET /api/health-status → status terkini + riwayat
  http.get(`${BASE}/health-status`, () =>
    HttpResponse.json({ current: healthStatus[0], history: healthStatus })
  ),

  // GET /api/predictions
  http.get(`${BASE}/predictions`, () => HttpResponse.json(predictions)),

  // CRUD /api/members
  http.get(`${BASE}/members`, () => HttpResponse.json(members)),
  http.post(`${BASE}/members`, async ({ request }) => {
    const body = await request.json();
    const item = { id: nextId(members), created_at: new Date().toISOString(), foto: '', ...body };
    members = [...members, item];
    return HttpResponse.json(item, { status: 201 });
  }),
  http.put(`${BASE}/members/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = await request.json();
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) return HttpResponse.json({ message: 'Anggota tidak ditemukan.' }, { status: 404 });
    members[idx] = { ...members[idx], ...body, id };
    return HttpResponse.json(members[idx]);
  }),
  http.delete(`${BASE}/members/:id`, ({ params }) => {
    const id = Number(params.id);
    members = members.filter((m) => m.id !== id);
    return HttpResponse.json({ id });
  }),

  // CRUD /api/sales
  http.get(`${BASE}/sales`, () => HttpResponse.json(sales)),
  http.post(`${BASE}/sales`, async ({ request }) => {
    const body = await request.json();
    const total_harga = Number(body.jumlah_liter) * Number(body.harga_per_liter);
    const item = {
      id: nextId(sales),
      created_at: new Date().toISOString(),
      ...body,
      total_harga,
    };
    sales = [item, ...sales];
    return HttpResponse.json(item, { status: 201 });
  }),
  http.put(`${BASE}/sales/:id`, async ({ params, request }) => {
    const id = Number(params.id);
    const body = await request.json();
    const idx = sales.findIndex((s) => s.id === id);
    if (idx === -1) return HttpResponse.json({ message: 'Penjualan tidak ditemukan.' }, { status: 404 });
    const merged = { ...sales[idx], ...body, id };
    merged.total_harga = Number(merged.jumlah_liter) * Number(merged.harga_per_liter);
    sales[idx] = merged;
    return HttpResponse.json(merged);
  }),
  http.delete(`${BASE}/sales/:id`, ({ params }) => {
    const id = Number(params.id);
    sales = sales.filter((s) => s.id !== id);
    return HttpResponse.json({ id });
  }),

  // GET /api/sales/summary?periode=... → agregat liter & pendapatan
  http.get(`${BASE}/sales/summary`, ({ request }) => {
    const url = new URL(request.url);
    const dari = url.searchParams.get('dari');
    const sampai = url.searchParams.get('sampai');
    const terfilter = sales.filter((s) => {
      if (dari && s.tanggal < dari) return false;
      if (sampai && s.tanggal > sampai) return false;
      return true;
    });
    const totalLiter = terfilter.reduce((a, s) => a + Number(s.jumlah_liter), 0);
    const totalPendapatan = terfilter.reduce((a, s) => a + Number(s.total_harga), 0);
    return HttpResponse.json({
      periode: { dari: dari || null, sampai: sampai || null },
      jumlah_transaksi: terfilter.length,
      total_liter: Number(totalLiter.toFixed(1)),
      total_pendapatan: totalPendapatan,
    });
  }),
];
