-- Dynamic setpoint AI: preserve the active temperature bands and filtered session
-- temperatures so yield/health can be evaluated against the target selected by user.
ALTER TABLE "ProductionLog" ADD COLUMN "suhuPirolisisFiltered" REAL;
ALTER TABLE "ProductionLog" ADD COLUMN "suhuTungkuFiltered" REAL;
ALTER TABLE "ProductionLog" ADD COLUMN "pirolisisSetpointBawah" REAL;
ALTER TABLE "ProductionLog" ADD COLUMN "pirolisisSetpointAtas" REAL;
ALTER TABLE "ProductionLog" ADD COLUMN "tungkuSetpointBawah" REAL;
ALTER TABLE "ProductionLog" ADD COLUMN "tungkuSetpointAtas" REAL;
