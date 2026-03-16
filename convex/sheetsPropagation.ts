// Sisteco Compliance — Sheets propagation, tenant notification, and ARCO-POL n8n triage (Ley 21.719)
//
// Este modulo implementa la propagacion de opt-out hacia Google Sheets de cada tenant,
// la notificacion a tenants via Discord, y el triage humano de solicitudes ARCO-POL
// verificadas via webhook n8n.
//
// Funciones:
//   1. propagateOptOutToSheets — Elimina la fila del lead en el Sheet de cada tenant afectado
//   2. notifyTenantsOfDeletion — Notifica via Discord que deben limpiar su CRM
//   3. getTenantSheets        — Query interna para obtener Sheet de un tenant
//   4. triggerArcoPolWebhook  — Dispara webhook n8n para triage humano de ARCO-POL
//
// Diseño:
//   - Todas las acciones son best-effort: si un API key no existe, se loguea y se sigue
//   - Email redactado en notificaciones (primeros 3 chars + "***@dominio") para privacidad
//   - Scheduler pattern: llamadas via ctx.scheduler.runAfter(0, ...) desde mutations
//
// Ref: PLAN 04-04 — Area 2.3 (ARCO-POL triage), Area 1.5 / 3.3 (Sheet propagation)

import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Helper: redactar email para logs/notificaciones ───────────────────────────

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  const redactedLocal = local.substring(0, 3) + "***";
  return domain ? `${redactedLocal}@${domain}` : `${redactedLocal}@???`;
}

// ── QUERY ────────────────────────────────────────────────────────────────────

/**
 * getTenantSheets — Retorna el registro tenantSheets para un orgId dado.
 * Usado por propagateOptOutToSheets para obtener el spreadsheetId.
 */
export const getTenantSheets = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, { orgId }) => {
    return await ctx.db
      .query("tenantSheets")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .first();
  },
});

// ── ACTIONS ──────────────────────────────────────────────────────────────────

/**
 * propagateOptOutToSheets — Elimina la fila del lead opt-out del Sheet de cada tenant.
 *
 * Pasos por tenant:
 *   1. Obtener spreadsheetId del registro tenantSheets
 *   2. Leer todas las filas del Sheet via Sheets API
 *   3. Encontrar la fila con email matching
 *   4. Eliminar esa fila via batchUpdate deleteRange
 *
 * Best-effort: si GOOGLE_SHEETS_API_KEY no esta configurado, se loguea warning y se omite.
 * El opt-out en Convex ya se completo — la propagacion al Sheet es complementaria.
 */
export const propagateOptOutToSheets = internalAction({
  args: {
    email: v.string(),
    tenantsAfectados: v.array(v.string()),
  },
  handler: async (ctx, { email, tenantsAfectados }) => {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

    if (!apiKey) {
      console.warn(
        "[sheetsPropagation] GOOGLE_SHEETS_API_KEY no configurado. " +
          "Omitiendo propagacion de Sheet para opt-out de " +
          redactEmail(email)
      );
      return { processed: 0, deleted: 0, skipped: tenantsAfectados.length };
    }

    let deletedCount = 0;

    for (const orgId of tenantsAfectados) {
      // Obtener spreadsheetId del tenant via query interna
      const tenantSheet = await ctx.runQuery(
        internal.sheetsPropagation.getTenantSheets,
        { orgId }
      );

      // Si tenantSheet es null, el tenant no tiene Sheet registrado — skip.
      if (!tenantSheet || !tenantSheet.spreadsheetId) {
        console.log(
          `[sheetsPropagation] Tenant ${orgId} no tiene Sheet registrado. Omitiendo.`
        );
        continue;
      }

      const { spreadsheetId } = tenantSheet;
      const sheetName = tenantSheet.sheetName ?? "Leads";

      try {
        // Paso 1: Leer todas las filas del Sheet
        const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
        const readResponse = await fetch(readUrl);

        if (!readResponse.ok) {
          const errText = await readResponse.text();
          console.error(
            `[sheetsPropagation] Error leyendo Sheet ${spreadsheetId} para tenant ${orgId}: ${readResponse.status} ${errText}`
          );
          continue;
        }

        const sheetData = (await readResponse.json()) as {
          values?: string[][];
        };
        const rows = sheetData.values ?? [];

        // Paso 2: Encontrar indices de filas con email matching (1-indexed, skip header)
        const rowIndicesToDelete: number[] = [];
        for (let i = 1; i < rows.length; i++) {
          // Buscar en todas las columnas de la fila
          if (rows[i].some((cell) => cell?.toLowerCase() === email.toLowerCase())) {
            rowIndicesToDelete.push(i); // 0-indexed en array
          }
        }

        if (rowIndicesToDelete.length === 0) {
          console.log(
            `[sheetsPropagation] Email ${redactEmail(email)} no encontrado en Sheet ${spreadsheetId} (tenant ${orgId}). Nada que eliminar.`
          );
          continue;
        }

        // Paso 3: Obtener el sheetId numerico para batchUpdate deleteRange
        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}&fields=sheets.properties`;
        const metaResponse = await fetch(metaUrl);
        let numericSheetId = 0;

        if (metaResponse.ok) {
          const meta = (await metaResponse.json()) as {
            sheets?: Array<{ properties: { sheetId: number; title: string } }>;
          };
          const matchingSheet = meta.sheets?.find(
            (s) => s.properties.title === sheetName
          );
          if (matchingSheet) {
            numericSheetId = matchingSheet.properties.sheetId;
          }
        }

        // Paso 4: Eliminar filas via batchUpdate deleteRange
        // Eliminar de atras hacia adelante para no desplazar indices
        const deleteRequests = rowIndicesToDelete
          .sort((a, b) => b - a) // orden descendente
          .map((rowIdx) => ({
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: "ROWS",
                startIndex: rowIdx,
                endIndex: rowIdx + 1,
              },
            },
          }));

        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate?key=${apiKey}`;
        const batchResponse = await fetch(batchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requests: deleteRequests }),
        });

        if (!batchResponse.ok) {
          const errText = await batchResponse.text();
          console.error(
            `[sheetsPropagation] Error batchUpdate en Sheet ${spreadsheetId}: ${batchResponse.status} ${errText}`
          );
          continue;
        }

        console.log(
          `[sheetsPropagation] Sheet propagation: deleted ${rowIndicesToDelete.length} row(s) for ${redactEmail(email)} from tenant ${orgId} sheet ${spreadsheetId}`
        );
        deletedCount += rowIndicesToDelete.length;
      } catch (err) {
        console.error(
          `[sheetsPropagation] Error inesperado para tenant ${orgId} sheet ${spreadsheetId}: ${err}`
        );
      }
    }

    return {
      processed: tenantsAfectados.length,
      deleted: deletedCount,
    };
  },
});

/**
 * notifyTenantsOfDeletion — Notifica via Discord que un lead fue eliminado.
 *
 * El email se redacta en la notificacion (3 chars + "***") para privacidad.
 * Los tenants deben eliminar el contacto de su CRM manualmente.
 *
 * Canal primario: Discord webhook (si DISCORD_WEBHOOK_URL esta configurado)
 * Canal secundario: Resend email (si RESEND_API_KEY esta configurado) — futuro
 */
export const notifyTenantsOfDeletion = internalAction({
  args: {
    email: v.string(),
    tenantsAfectados: v.array(v.string()),
    reason: v.string(), // "opt_out" | "retencion_expirada"
  },
  handler: async (_ctx, { email, tenantsAfectados, reason }) => {
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    const redacted = redactEmail(email);

    // Construir mensaje segun razon
    let message: string;
    if (reason === "opt_out") {
      message =
        `Un lead ha solicitado eliminacion de datos (opt-out). ` +
        `Email: ${redacted}. ` +
        `Por favor elimine este contacto de su CRM. ` +
        `Referencia: Ley 21.719.`;
    } else {
      message =
        `Un lead ha expirado por retencion (24 meses sin interaccion). ` +
        `Email: ${redacted}. ` +
        `Por favor elimine este contacto de su CRM.`;
    }

    if (!discordUrl) {
      console.warn(
        "[sheetsPropagation] DISCORD_WEBHOOK_URL no configurado. " +
          "Omitiendo notificacion Discord para " +
          redacted
      );
      return { notified: false, reason: "no_discord_url" };
    }

    try {
      const discordPayload = {
        content:
          `**[COMPLIANCE] ${message}**\n` +
          `Tenants afectados: ${tenantsAfectados.length}\n` +
          `Accion requerida: eliminar de CRM`,
      };

      const discordResponse = await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });

      if (!discordResponse.ok) {
        const errText = await discordResponse.text();
        console.error(
          `[sheetsPropagation] Discord webhook error: ${discordResponse.status} ${errText}`
        );
        return { notified: false, reason: "discord_error" };
      }

      console.log(
        `[sheetsPropagation] Discord notification sent for ${redacted} (reason: ${reason}, tenants: ${tenantsAfectados.length})`
      );
      return { notified: true };
    } catch (err) {
      console.error(`[sheetsPropagation] Error enviando notificacion Discord: ${err}`);
      return { notified: false, reason: "exception" };
    }
  },
});

/**
 * triggerArcoPolWebhook — Dispara webhook n8n para triage humano de solicitud ARCO-POL.
 *
 * Comportamiento:
 *   1. POST a {N8N_WEBHOOK_URL}/arco-pol-triage con payload redactado
 *   2. Si N8N_WEBHOOK_URL no esta configurado, Discord como fallback
 *   3. Siempre envia notificacion Discord como canal secundario
 *
 * El payload incluye fechaLimite (15 dias habiles) para el operador humano.
 * El email se redacta para privacidad en los logs/notificaciones.
 */
export const triggerArcoPolWebhook = internalAction({
  args: {
    requestId: v.string(),
    email: v.string(),
    tipo: v.string(),
    tenantsAfectados: v.array(v.string()),
  },
  handler: async (_ctx, { requestId, email, tipo, tenantsAfectados }) => {
    const n8nBaseUrl = process.env.N8N_WEBHOOK_URL;
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    const emailRedacted = redactEmail(email);

    // Construir payload para n8n — sin PII sensible
    const webhookPayload = {
      event: "arco_pol_verified",
      requestId,
      tipo,
      emailRedacted,
      tenantsAfectados,
      fechaLimite: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      actionRequired: "Review and approve/reject this ARCO-POL request",
      source: "sisteco-compliance",
    };

    let n8nTriggered = false;

    // Paso 1: Disparar webhook n8n (canal primario)
    if (n8nBaseUrl) {
      try {
        const n8nUrl = `${n8nBaseUrl}/arco-pol-triage`;
        const n8nResponse = await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        if (n8nResponse.ok) {
          console.log(
            `[sheetsPropagation] n8n ARCO-POL webhook triggered for ${emailRedacted} (tipo: ${tipo}, requestId: ${requestId})`
          );
          n8nTriggered = true;
        } else {
          const errText = await n8nResponse.text();
          console.error(
            `[sheetsPropagation] n8n webhook error: ${n8nResponse.status} ${errText}`
          );
        }
      } catch (err) {
        console.error(`[sheetsPropagation] Error llamando webhook n8n: ${err}`);
      }
    } else {
      console.warn(
        "[sheetsPropagation] N8N_WEBHOOK_URL no configurado. " +
          "Usando Discord como fallback para ARCO-POL triage."
      );
    }

    // Paso 2: Notificacion Discord (siempre — canal secundario/fallback)
    if (discordUrl) {
      try {
        const discordMessage = {
          content:
            `**[ARCO-POL] Nueva solicitud verificada: ${tipo.toUpperCase()}**\n` +
            `Email: ${emailRedacted}\n` +
            `RequestId: ${requestId}\n` +
            `Tenants afectados: ${tenantsAfectados.length}\n` +
            `Fecha limite: ${webhookPayload.fechaLimite}\n` +
            `**Requiere triage humano.** ${!n8nTriggered ? "(n8n no configurado — revisar manualmente)" : ""}`,
        };

        const discordResponse = await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(discordMessage),
        });

        if (!discordResponse.ok) {
          const errText = await discordResponse.text();
          console.error(
            `[sheetsPropagation] Discord ARCO-POL notification error: ${discordResponse.status} ${errText}`
          );
        }
      } catch (err) {
        console.error(
          `[sheetsPropagation] Error enviando notificacion Discord para ARCO-POL: ${err}`
        );
      }
    }

    return { triggered: true, n8nTriggered };
  },
});
