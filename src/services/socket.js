// Fake-socket FASE 1 — interface dibuat identik dengan socket.io-client supaya
// FASE 2 tinggal swap implementasi (lihat docs/CLAUDE.md → Real-time).
//
// Pemakaian:
//   import { getSocket } from '../services/socket';
//   const socket = getSocket();
//   socket.on('sensor-update', (payload) => { ... });
//   ...nanti: socket.off('sensor-update', handler);
//
// Event yang di-emit: 'sensor-update' (mirip sensor_logs), 'health-update' (mirip health_status).

import { hitungPelanggaran, statusDariPelanggaran } from '../lib/thresholds';

const DEVICE_ID = 'ESP32-RW04-01';

function acak(min, max, digits = 0) {
  const v = Math.random() * (max - min) + min;
  return Number(v.toFixed(digits));
}

function buatSensorPayload() {
  return {
    id: `s-${Date.now()}`,
    device_id: DEVICE_ID,
    timestamp: new Date().toISOString(),
    berat_input: acak(8, 14, 1),
    suhu_reaktor: acak(360, 440, 0),
    gas_level: acak(120, 720, 0),
    status_proses: 'running',
  };
}

function buatHealthPayload(sensor) {
  const pelanggaran = hitungPelanggaran({
    suhu: sensor.suhu_reaktor,
    gas: sensor.gas_level,
  });
  const status = statusDariPelanggaran(pelanggaran.length);
  return {
    id: `h-${Date.now()}`,
    session_id: 'live',
    status,
    keterangan: pelanggaran.length ? pelanggaran.join('; ') : 'Semua parameter dalam batas aman.',
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
      // emit pertama langsung supaya UI tidak kosong saat mount
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
    // FASE 1: client→server tidak melakukan apa-apa.
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
