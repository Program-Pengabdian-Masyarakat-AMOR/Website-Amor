import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-ganti-di-produksi',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  firebase: {
    // Bisa pakai file service account (disarankan) ATAU tiga variabel di bawah.
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
  },
};

const hasCreds =
  Boolean(env.firebase.serviceAccountPath) ||
  Boolean(env.firebase.projectId && env.firebase.clientEmail && env.firebase.privateKey);

export const firebaseConfigured = Boolean(env.firebase.databaseURL && hasCreds);

// Keamanan: di produksi JWT_SECRET WAJIB diset (jangan pakai fallback dev).
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diset di produksi (NODE_ENV=production).');
}
if (!process.env.JWT_SECRET) {
  console.warn('[env] JWT_SECRET belum diset — memakai secret dev. Set nilai acak di .env.');
}
