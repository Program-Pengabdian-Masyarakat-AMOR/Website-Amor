// Pembungkus async agar error terlempar ke handler pusat.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err.stack || err.message);
  const status = err.status || 500;
  // 5xx: sembunyikan detail internal dari klien. 4xx: pesan memang untuk pengguna.
  const message = status >= 500 ? 'Terjadi kesalahan pada server.' : err.message || 'Permintaan tidak valid.';
  res.status(status).json({ message });
}

export function notFound(req, res) {
  res.status(404).json({ message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
}
