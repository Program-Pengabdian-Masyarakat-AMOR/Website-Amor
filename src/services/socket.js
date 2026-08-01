// Koneksi real-time ke backend (Socket.io). Backend merelay telemetri Firebase
// lewat event 'sensor-update' & 'health-update'.
//
// Pemakaian tetap sama seperti sebelumnya:
//   const socket = getSocket();
//   socket.on('sensor-update', handler);
//   socket.off('sensor-update', handler);
import { io } from 'socket.io-client';
import { getToken } from './api';

const URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

let socket = null;

/** Singleton koneksi socket.io (mengirim JWT di handshake). */
export function getSocket() {
  if (!socket) {
    socket = io(URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      auth: (cb) => cb({ token: getToken() }),
    });
  }
  return socket;
}

/** Putuskan koneksi (dipanggil saat logout). */
export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;
