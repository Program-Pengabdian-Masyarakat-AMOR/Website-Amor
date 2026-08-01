// Rate limiter in-memory sederhana (tanpa dependency). Cukup untuk melindungi
// endpoint sensitif seperti login dari brute-force. Untuk skala besar/multi-instance,
// ganti dengan express-rate-limit + store Redis.
export function rateLimit({ windowMs = 60_000, max = 10, message = 'Terlalu banyak percobaan. Coba lagi nanti.' } = {}) {
  const hits = new Map(); // ip → { count, resetAt }

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({ message });
    }
    next();
  };
}
