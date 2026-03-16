import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ─────────────────────────────────────────────────────────────────────────────
// Sisteco — Cron Jobs de Compliance
// Cumple Ley 21.719 COMP-05: eliminacion automatica de datos expirados
//
// JOBS:
//   retention-scan  (03:00 UTC / 00:00 Chile) — anonimiza PII de leads expirados
//   hard-delete-batch (04:00 UTC / 01:00 Chile) — elimina permanentemente post-gracia
//
// Ver convex/retention.ts para logica detallada.
// ─────────────────────────────────────────────────────────────────────────────

const crons = cronJobs();

// Diario a las 03:00 UTC (00:00 Chile Standard Time / 23:00 Chile Summer Time)
// Detecta leads sin interaccion por 24+ meses, anonimiza PII y agenda hard-delete.
crons.daily(
  "retention-scan",
  { hourUTC: 3, minuteUTC: 0 },
  internal.retention.scanExpiredLeads
);

// Diario a las 04:00 UTC (01:00 Chile) — 1 hora despues del scan
// Elimina permanentemente los leads que cumplieron el periodo de gracia de 30 dias.
crons.daily(
  "hard-delete-batch",
  { hourUTC: 4, minuteUTC: 0 },
  internal.retention.hardDeleteExpired
);

export default crons;
