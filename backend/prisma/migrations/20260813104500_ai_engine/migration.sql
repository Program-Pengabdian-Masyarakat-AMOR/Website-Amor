-- AI engine: log every physical feeder state transition.
CREATE TABLE "FeederMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suhuPirolisis" REAL,
    "suhuTungku" REAL,
    "beratSampah" REAL,
    "aiScore" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
