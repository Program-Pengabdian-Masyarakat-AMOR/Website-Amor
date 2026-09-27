-- Role baru "management" tidak butuh perubahan kolom (User.role bertipe TEXT).
-- Tabel konten publik yang diedit role management (statistik produksi landing page).
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);
