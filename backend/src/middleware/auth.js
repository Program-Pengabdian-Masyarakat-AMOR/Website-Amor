import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Tiga role aplikasi. Tiap role punya section dashboard sendiri:
// - admin      : monitoring data sekarang & lampau, health check sistem, rekap data, anggota
// - operator   : operasional mesin (dashboard, monitoring live, kontrol)
// - management : penjualan & konten data yang tampil di landing page
export const ROLES = ['admin', 'operator', 'management'];

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

// Wajib login. Menempelkan req.user bila token valid.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Butuh autentikasi.' });
  try {
    req.user = jwt.verify(token, env.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau kedaluwarsa.' });
  }
}

// Batasi ke role tertentu (mis. requireRole('admin')). Pakai setelah requireAuth.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Akses ditolak untuk role ini.' });
    }
    next();
  };
}

// Gabungan requireAuth + requireRole untuk dipasang sekali di router/route.
export const allow = (...roles) => [requireAuth, requireRole(...roles)];
