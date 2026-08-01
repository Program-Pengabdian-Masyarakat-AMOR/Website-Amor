// Fake-socket FASE 1 — interface identik dengan socket.io-client supaya FASE 2
// tinggal swap ke koneksi asli (backend merelay Firebase → Socket.io).
//
// Event:
//   'sensor-update' → telemetri (suhu_pirolisis, suhu_tungku, berat_sampah,
//                     berat_minyak, berat_sampah_total, status_gas, status_sistem, timestamp)
//   'health-update' → { status, keterangan, ... } dihitung dari ambang di lib/thresholds.js

import { hitungAlert, statusDariAlert, DEFAULT_SETPOINTS } from '../lib/thresholds';

function acak(min, max, digits = 0) {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(digits));
}

// State sesi yang berjalan pelan (berat sampah menyusut, minyak bertambah).
let sisaSampah = 6.0;
let minyak = 6.5;

function buatSensorPayload() {
  // suhu berfluktuasi di sekitar target (tungku ~800, pirolisis ~400)
  const suhuPirolisis = acak(388, 418, 0);
  const suhuTungku = acak(780, 828, 0);
  // gas jarang terdeteksi; lebih mungkin muncul saat suhu di bawah target
  const suhuRendah = suhuPirolisis < DEFAULT_SETPOINTS.pirolisis.bawah || suhuTungku < DEFAULT_SETPOINTS.tungku.bawah;
  const status_gas = Math.random() < (suhuRendah ? 0.5 : 0.06);

  sisaSampah = Math.max(0, Number((sisaSampah - acak(0, 0.3, 2)).toFixed(2)));
  minyak = Number((minyak + acak(0, 0.2, 2)).toFixed(2));

  return {
    timestamp: new Date().toISOString(),
    suhu_pirolisis: suhuPirolisis,
    suhu_tungku: suhuTungku,
    berat_sampah: sisaSampah,
    berat_minyak: minyak,
    berat_sampah_total: 15.2,
    status_gas,
    status_sistem: 'running',
  };
}

function buatHealthPayload(sensor) {
  const alerts = hitungAlert({
    suhuPirolisis: sensor.suhu_pirolisis,
    suhuTungku: sensor.suhu_tungku,
    statusGas: sensor.status_gas,
  });
  return {
    id: `h-${Date.now()}`,
    session_id: 'live',
    status: statusDariAlert(alerts),
    keterangan: alerts.length ? alerts.map((a) => a.pesan).join('; ') : 'Semua parameter dalam batas aman.',
    created_at: new Date().toISOString(),
  };
}

class FakeSocket {
  constructor() {
    this.handlers = new Map();
    this.timer = null;
    this.connected = false;
  }

  _emit(event, payload) {
    const set = this.handlers.get(event);
    if (set) set.forEach((fn) => fn(payload));
  }

  _tick() {
    const sensor = buatSensorPayload();
    this._emit('sensor-update', sensor);
    this._emit('health-update', buatHealthPayload(sensor));
  }

  _ensureRunning() {
    const punyaListener =
      (this.handlers.get('sensor-update')?.size || 0) +
        (this.handlers.get('health-update')?.size || 0) >
      0;
    if (punyaListener && !this.timer) {
      this.connected = true;
      this._emit('connect');
      this.timer = setInterval(() => this._tick(), 3000);
      setTimeout(() => this._tick(), 60);
    }
    if (!punyaListener && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.connected = false;
    }
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
    this._ensureRunning();
    return this;
  }

  off(event, handler) {
    const set = this.handlers.get(event);
    if (set) {
      if (handler) set.delete(handler);
      else set.clear();
    }
    this._ensureRunning();
    return this;
  }

  emit() {
    return this;
  }

  disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.connected = false;
    this.handlers.clear();
    return this;
  }
}

let instance = null;

/** Singleton, mirror io() dari socket.io-client. */
export function getSocket() {
  if (!instance) instance = new FakeSocket();
  return instance;
}

export default getSocket;
