// MSW handlers — kontrak endpoint (lihat src/mocks/README.md).
// Bentuk request/response & nama endpoint dikunci: backend FASE 2 tinggal mengikuti.
import { http, HttpResponse } from 'msw';
import { users } from './data/users';
import { sensorLatest, sensorSeries } from './data/sensors';
import { productionLogs } from './data/production';
import { healthStatus } from './data/health';
import { predictions } from './data/predictions';
import { members as membersSeed } from './data/members';
import { oilSales as salesSeed } from './data/sales';
import { controlDefault } from './data/control';
import { hitungAlert, statusDariAlert } from '../lib/thresholds';

const BASE = '/api';

// Salinan in-memory agar mutasi (CRUD/kontrol) terlihat selama sesi berjalan.
let members = membersSeed.map((m) => ({ ...m }));
let sales = salesSeed.map((s) => ({ ...s }));
let production = productionLogs.map((p) => ({ ...p }));
let control = JSON.parse(JSON.stringify(controlDefault));

const nextId = (arr) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1);

function healthTerkini() {
  const alerts = hitungAlert({
    suhuPirolisis: sensorLatest.suhu_pirolisis,
    suhuTungku: sensorLatest.suhu_tungku,
    statusGas: sensorLatest.status_gas,
    statusSistem: sensorLatest.status_sistem,
    setpoint: control,
  });
  return {
    id: 'live',
    session_id: 'live',
    status: statusDariAlert(alerts),
    keterangan: alerts.length ? alerts.map((a) => a.pesan).join('; ') : 'Semua parameter dalam batas aman.',
    created_at: new Date().toISOString(),
  };
}

export const handlers = [
  // POST /api/auth/login → { token, role }
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const { username, password } = await request.json();
    if (!username || !password) {
      return HttpResponse.json({ message: 'Username dan kata sandi wajib diisi.' }, { status: 400 });
    }
    const found = users.find((u) => u.username === username && u.password === password);
    const role = found ? found.role : 'operator';
    return HttpResponse.json({ token: `mock.${btoa(username)}.${Date.now()}`, role });
  }),

  // GET /api/sensor-data/latest → telemetri terkini + tren
  http.get(`${BASE}/sensor-data/latest`, () =>
    HttpResponse.json({ latest: sensorLatest, series: sensorSeries })
  ),

  // GET/POST /api/production-logs
  http.get(`${BASE}/production-logs`, () => HttpResponse.json(production)),
  http.post(`${BASE}/production-logs`, async ({ request }) => {
    const body = await request.json();
    const item = { id: nextId(production), created_at: new Date().toISOString(), ...body };
    production = [item, ...production];
    return HttpResponse.json(item, { status: 201 });
  }),

  // GET /api/health-status → status terkini (terhitung) + riwayat
  http.get(`${BASE}/health-status`, () =>
    HttpResponse.json({ current: healthTerkini(), history: healthStatus })
  ),

  // GET /api/predictions
  http.get(`${BASE}/predictions`, () => HttpResponse.json(predictions)),

  // --- Kontrol (Web → IoT) ---
  http.get(`${BASE}/control`, () => HttpResponse.json(control)),
  http.put(`${BASE}/control/setpoint`, async ({ request }) => {
    const body = await request.json();
    if (body.pirolisis) control.pirolisis = { ...control.pirolisis, ...body.pirolisis };
    if (body.tungku) control.tungku = { ...control.tungku, ...body.tungku };
    return HttpResponse.json(control);
  }),
  http.put(`${BASE}/control/kontrol`, async ({ request }) => {
    const body = await request.json();
    if (typeof body.blower === 'boolean') control.blower = body.blower;
    if (typeof body.feeder === 'boolean') control.feeder = body.feeder;
    if (typeof body.alarm === 'boolean') control.alarm = body.alarm;
    return HttpResponse.json(control);
  }),

  // --- CRUD /api/members ---
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

  // --- CRUD /api/sales ---
  http.get(`${BASE}/sales`, () => HttpResponse.json(sales)),
  http.post(`${BASE}/sales`, async ({ request }) => {
    const body = await request.json();
    const total_harga = Number(body.jumlah_liter) * Number(body.harga_per_liter);
    const item = { id: nextId(sales), created_at: new Date().toISOString(), ...body, total_harga };
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

  // GET /api/sales/summary?dari&sampai
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
