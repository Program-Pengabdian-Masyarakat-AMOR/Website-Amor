import { readFileSync } from 'fs';
import { resolve } from 'path';
import admin from 'firebase-admin';
import { env, firebaseConfigured } from './env.js';

let app = null;

// Ambil kredensial dari file service account (disarankan) atau dari variabel env.
function loadCredential() {
  if (env.firebase.serviceAccountPath) {
    const json = JSON.parse(readFileSync(resolve(env.firebase.serviceAccountPath), 'utf-8'));
    return admin.credential.cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key,
    });
  }
  return admin.credential.cert({
    projectId: env.firebase.projectId,
    clientEmail: env.firebase.clientEmail,
    privateKey: env.firebase.privateKey,
  });
}

export function initFirebase() {
  if (app) return app;
  if (!firebaseConfigured) {
    console.warn('[firebase] Kredensial belum lengkap di .env — bridge Firebase dinonaktifkan.');
    return null;
  }
  try {
    app = admin.initializeApp({ credential: loadCredential(), databaseURL: env.firebase.databaseURL });
    console.log('[firebase] Terhubung ke', env.firebase.databaseURL);
    return app;
  } catch (e) {
    console.error('[firebase] Gagal inisialisasi:', e.message);
    return null;
  }
}

/** Realtime Database, atau null bila Firebase belum dikonfigurasi. */
export function getDb() {
  const a = initFirebase();
  return a ? admin.database() : null;
}
