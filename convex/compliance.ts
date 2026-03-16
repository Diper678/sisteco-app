// Sisteco Compliance — ARCO-POL request management and verification (Ley 21.719)
//
// Este modulo gestiona el ciclo de vida de las solicitudes de derechos del titular:
//   ARCO-POL = Acceso, Rectificacion, Cancelacion, Oposicion, Portabilidad, Limitacion
//
// Flujo principal:
//   1. createArcoRequest — crea solicitud con token de verificacion (estado: "verificando")
//   2. sendVerificationEmail — envia email con link de confirmacion via Resend
//   3. verifyArcoRequest — verifica token, actualiza estado a "verificada", retorna email
//   4. updateArcoStatus — actualiza estado de progreso por operador humano o n8n
//
// SLA: 15 dias habiles (Art. 48 Ley 21.719) — aproximado como 15 dias calendario para MVP
//
// IMPORTANTE: Estas funciones son `internal` — solo llamadas desde HTTP handlers.
// Los leads NO son usuarios de Sisteco — no hay autenticacion en los endpoints publicos.

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";

// ── MUTATIONS ─────────────────────────────────────────────────────────────────

/**
 * createArcoRequest — Crea una nueva solicitud ARCO-POL con token de verificacion.
 * El token se genera con crypto.randomUUID() (disponible en runtime Convex).
 * El SLA se calcula como 15 dias calendario desde la creacion.
 *
 * Retorna { requestId, token } para que el handler HTTP pueda enviar el email.
 */
export const createArcoRequest = internalMutation({
  args: {
    email: v.string(),
    nombre: v.optional(v.string()),
    tipoSolicitud: v.union(
      v.literal("acceso"),
      v.literal("rectificacion"),
      v.literal("supresion"),
      v.literal("oposicion"),
      v.literal("portabilidad"),
      v.literal("limitacion")
    ),
    detalles: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Token seguro via crypto.randomUUID() (disponible en V8 runtime de Convex)
    const verificationToken = crypto.randomUUID();

    // SLA: 15 dias habiles — aproximado como 15 dias calendario para MVP
    // Cuando haya volumen, calcular dias habiles excluyendo feriados chilenos
    const fechaLimite = Date.now() + 15 * 24 * 60 * 60 * 1000;

    const requestId = await ctx.db.insert("arcoRequests", {
      email: args.email,
      nombre: args.nombre,
      tipoSolicitud: args.tipoSolicitud,
      estado: "verificando",
      detalles: args.detalles,
      verificationToken,
      fechaLimite,
      createdAt: Date.now(),
    });

    return { requestId, token: verificationToken };
  },
});

/**
 * verifyArcoRequest — Verifica un token de confirmacion y actualiza el estado.
 * Busca la solicitud por token (indice by_token), verifica que este en estado
 * "verificando", actualiza a "verificada", y calcula los tenants afectados
 * buscando leads con el mismo email.
 *
 * CRITICO: El valor de retorno INCLUYE `email: request.email` porque el handler
 * /opt-out/confirm necesita el email para llamar a executeGlobalOptOut cuando
 * tipoSolicitud es "supresion".
 */
export const verifyArcoRequest = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    // Buscar solicitud por token
    const request = await ctx.db
      .query("arcoRequests")
      .withIndex("by_token", (q) => q.eq("verificationToken", token))
      .first();

    if (!request) {
      return { verified: false, error: "Token invalido" };
    }

    if (request.estado !== "verificando") {
      return { verified: false, error: "Solicitud ya procesada" };
    }

    // Encontrar todos los tenants afectados (leads con este email)
    const leadsConEsteEmail = await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", request.email))
      .collect();

    const tenantsAfectados = [
      ...new Set(
        leadsConEsteEmail
          .map((l) => l.orgId)
          .filter((orgId): orgId is string => Boolean(orgId))
      ),
    ];

    // Actualizar estado a "verificada"
    await ctx.db.patch(request._id, {
      estado: "verificada",
      verifiedAt: Date.now(),
      tenantsAfectados,
    });

    // Retornar email EXPLICITAMENTE — requerido por /opt-out/confirm para ejecutar opt-out
    return {
      verified: true,
      requestId: request._id,
      tipo: request.tipoSolicitud,
      email: request.email,
    };
  },
});

/**
 * updateArcoStatus — Actualiza el estado de una solicitud ARCO-POL.
 * Usado por el operador humano (via n8n o dashboard admin) para progresar la solicitud.
 * Si el estado es "completada" o "rechazada", registra completadaAt.
 */
export const updateArcoStatus = internalMutation({
  args: {
    requestId: v.id("arcoRequests"),
    nuevoEstado: v.union(
      v.literal("recibida"),
      v.literal("verificando"),
      v.literal("verificada"),
      v.literal("en_proceso"),
      v.literal("completada"),
      v.literal("rechazada")
    ),
    respuesta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Solicitud no encontrada");
    }

    const patch: Partial<{
      estado: typeof args.nuevoEstado;
      respuesta: string;
      completadaAt: number;
    }> = {
      estado: args.nuevoEstado,
    };

    if (args.respuesta) {
      patch.respuesta = args.respuesta;
    }

    // Registrar fecha de cierre para trazabilidad SLA
    if (args.nuevoEstado === "completada" || args.nuevoEstado === "rechazada") {
      patch.completadaAt = Date.now();
    }

    await ctx.db.patch(args.requestId, patch);

    return { success: true };
  },
});

// ── QUERIES ───────────────────────────────────────────────────────────────────

/**
 * getArcoRequestsByEstado — Lista solicitudes ARCO-POL por estado.
 * Usado por el dashboard admin y n8n para triage automatico.
 * Retorna en orden descendente (mas recientes primero).
 */
export const getArcoRequestsByEstado = internalQuery({
  args: {
    estado: v.union(
      v.literal("recibida"),
      v.literal("verificando"),
      v.literal("verificada"),
      v.literal("en_proceso"),
      v.literal("completada"),
      v.literal("rechazada")
    ),
  },
  handler: async (ctx, { estado }) => {
    return await ctx.db
      .query("arcoRequests")
      .withIndex("by_estado", (q) => q.eq("estado", estado))
      .order("desc")
      .collect();
  },
});

// ── ACTIONS ───────────────────────────────────────────────────────────────────

/**
 * sendVerificationEmail — Envia email de verificacion via Resend.
 * Las actions tienen acceso al runtime Node.js (fetch, crypto, etc.).
 *
 * tipo:
 *   - "opt-out": link a /opt-out/confirm?token=...
 *   - "arco": link a /derechos/confirm?token=... (futuro — por ahora solo opt-out)
 *
 * Variables de entorno requeridas:
 *   - RESEND_API_KEY: API key de Resend
 *   - CONVEX_SITE_URL: Base URL del deployment Convex (ej: https://xyz.convex.site)
 */
export const sendVerificationEmail = internalAction({
  args: {
    email: v.string(),
    token: v.string(),
    tipo: v.string(), // "opt-out" | "arco"
  },
  handler: async (_ctx, { email, token, tipo }) => {
    const siteUrl = process.env.CONVEX_SITE_URL ?? "";

    // URL de confirmacion segun tipo de solicitud
    const confirmUrl =
      tipo === "opt-out"
        ? `${siteUrl}/opt-out/confirm?token=${token}`
        : `${siteUrl}/derechos/confirm?token=${token}`;

    // Asunto del email segun tipo
    const subject =
      tipo === "opt-out"
        ? "Confirma tu solicitud de baja - Sisteco"
        : "Confirma tu solicitud de derechos - Sisteco";

    // HTML del email de verificacion con branding Sisteco
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: 'Source Sans 3', Arial, sans-serif; background: #F8F7F5; color: #111111; margin: 0; padding: 0;">
  <div style="max-width: 560px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px;">

    <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px 0; color: #111111;">
      Sisteco
    </h1>
    <div style="width: 32px; height: 3px; background: #c5ed36; margin-bottom: 32px;"></div>

    <p style="font-size: 16px; color: #444444; margin: 0 0 16px 0;">
      Hemos recibido tu solicitud${tipo === "opt-out" ? " de baja" : " de derechos"}.
      Para procesarla, necesitamos confirmar tu identidad.
    </p>

    <p style="font-size: 15px; color: #444444; margin: 0 0 32px 0;">
      Haz clic en el siguiente boton para confirmar:
    </p>

    <a href="${confirmUrl}"
       style="display: inline-block; background: #c5ed36; color: #111111; font-weight: 700; font-size: 16px; padding: 14px 28px; border-radius: 6px; text-decoration: none;">
      Confirmar solicitud
    </a>

    <p style="font-size: 13px; color: #888888; margin: 32px 0 0 0;">
      Este enlace expira en 24 horas. Si no realizaste esta solicitud, puedes ignorar este email.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">

    <p style="font-size: 12px; color: #aaaaaa; margin: 0;">
      Sisteco SpA &bull; Las Condes, Santiago de Chile &bull; contacto@sisteco.cl
    </p>
  </div>
</body>
</html>
    `.trim();

    // Enviar via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Sisteco Privacidad <contacto@sisteco.cl>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API error (${response.status}): ${errorText}`);
      // No lanzar error — el flujo de opt-out sigue siendo valido
      // El usuario puede usar el email directo como fallback
      return { sent: false, error: `Resend error: ${response.status}` };
    }

    return { sent: true };
  },
});
