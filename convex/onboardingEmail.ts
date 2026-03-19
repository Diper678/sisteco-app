// Sisteco Onboarding Emails — Emails de bienvenida y recordatorio via Resend
//
// Funciones:
//   sendWelcomeEmail (internalAction) — Enviar email de bienvenida al crear trial
//   triggerWelcomeEmail (action publica) — Wrapper publico con adminSecret para CLI
//   sendTrialExpiryReminder (internalAction) — Recordatorio antes de vencimiento
//   sendPaymentConfirmation (internalAction) — Confirmacion de pago exitoso
//
// REVENIU_LINKS y PLAN_INFO son constantes exportadas para uso en dashboard y emails.
//
// Ref: CLAUDE.md "Identidad visual"
// Branding: fondo #F8F7F5, acento #c5ed36

import { v } from "convex/values";
import { internalAction, action } from "./_generated/server";

// ── Checkout links de Reveniu (hardcoded — constantes de negocio) ─────────────

export const REVENIU_LINKS = {
  base: "https://app.reveniu.com/checkout-custom-link/DQ3MuizcwIXplfgDk7z2Mq5nthVjgH6j",
  crecimiento: "https://app.reveniu.com/checkout-custom-link/k3Gp19rB3jede89nHDY9PklmJxaiTfU2",
  enterprise: "https://app.reveniu.com/checkout-custom-link/HOxbQ8ILI2jRiH2Ps6tSo6nMUenIsHlN",
} as const;

// ── Informacion de planes (nombres y precios CLP) ─────────────────────────────

export const PLAN_INFO = {
  base: { name: "Base", priceCLP: "$99.990", priceUSD: "~$472 USD" },
  crecimiento: { name: "Crecimiento", priceCLP: "$249.990", priceUSD: "~$949 USD" },
  enterprise: { name: "Enterprise", priceCLP: "Personalizado", priceUSD: "~$2.142 USD" },
} as const;

// ── Helper: Estilos compartidos con branding Sisteco ─────────────────────────

function buildEmailStyles(): string {
  return `
    body { font-family: 'Source Sans 3', Arial, sans-serif; background: #F8F7F5; color: #111111; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px; }
    .logo { font-size: 22px; font-weight: 700; color: #111111; margin: 0 0 4px 0; letter-spacing: -0.5px; }
    .accent-bar { width: 32px; height: 3px; background: #c5ed36; margin: 0 0 32px 0; }
    h2 { font-size: 20px; font-weight: 700; color: #111111; margin: 0 0 16px 0; }
    p { font-size: 15px; color: #444444; line-height: 1.6; margin: 0 0 16px 0; }
    .cta-btn { display: inline-block; background: #c5ed36; color: #111111; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 8px 0 24px 0; }
    .info-box { background: #F8F7F5; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px 20px; margin: 16px 0; }
    .info-box p { margin: 0; font-size: 14px; color: #555555; }
    .footer { border-top: 1px solid #e5e5e5; margin-top: 32px; padding-top: 24px; }
    .footer p { font-size: 13px; color: #888888; margin: 0 0 4px 0; }
    .footer a { color: #111111; text-decoration: underline; }
  `;
}

// ── Helper: Enviar email via Resend ───────────────────────────────────────────

async function sendViaResend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("sendViaResend: RESEND_API_KEY no configurado — omitiendo envio de email");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Sisteco <noreply@sisteco.cl>",
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`sendViaResend: error HTTP ${response.status} — ${errorText}`);
    // No lanzar error — emails son no-blocking
  } else {
    console.log(`sendViaResend: email enviado a ${opts.to} (subject: ${opts.subject})`);
  }
}

// ── Helper: Construir HTML de email de bienvenida ─────────────────────────────

function buildWelcomeEmailHtml(args: {
  nombre: string;
  empresa: string;
  dashboardUrl: string;
  trialEndsAt: number;
}): string {
  const trialEndDate = new Date(args.trialEndsAt).toLocaleDateString("es-CL");
  const styles = buildEmailStyles();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Sisteco</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <p class="logo">Sisteco</p>
    <div class="accent-bar"></div>

    <h2>Bienvenido, ${args.nombre}</h2>

    <p>Tu trial de Sisteco para <strong>${args.empresa}</strong> ya esta activo. Durante los proximos 14 dias tendras acceso completo a la plataforma.</p>

    <p>Tu periodo de prueba vence el <strong>${trialEndDate}</strong>.</p>

    <div class="info-box">
      <p>Tu Sheet con leads scored estara lista pronto. Nuestro equipo iniciara el pipeline de prospeccion para ${args.empresa} en las proximas horas.</p>
    </div>

    <a href="${args.dashboardUrl}" class="cta-btn">Acceder al Dashboard</a>

    <p>Si tienes preguntas sobre el proceso de onboarding o la plataforma, estamos disponibles para ayudarte.</p>

    <div class="footer">
      <p>Sisteco — Infraestructura inteligente para ventas B2B</p>
      <p><a href="mailto:contacto@sisteco.cl">contacto@sisteco.cl</a> · +56 9 40065566 · Las Condes, Santiago de Chile</p>
    </div>
  </div>
</body>
</html>`;
}

// ── ACTIONS ───────────────────────────────────────────────────────────────────

/**
 * sendWelcomeEmail — Email de bienvenida al crear trial.
 * InternalAction: llamada desde webhooks o crons internos.
 * Para llamar desde CLI (provision-trial.js), usar triggerWelcomeEmail.
 */
export const sendWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    nombre: v.string(),
    empresa: v.string(),
    dashboardUrl: v.string(),
    trialEndsAt: v.number(),
  },
  handler: async (_ctx, args) => {
    const html = buildWelcomeEmailHtml({
      nombre: args.nombre,
      empresa: args.empresa,
      dashboardUrl: args.dashboardUrl,
      trialEndsAt: args.trialEndsAt,
    });

    await sendViaResend({
      to: args.email,
      subject: "Bienvenido a Sisteco — Tu trial esta activo",
      html,
    });
  },
});

/**
 * triggerWelcomeEmail — Wrapper publico de sendWelcomeEmail para uso desde CLI.
 * Requiere adminSecret (SAAN_API_SECRET) para autenticacion.
 * Llamado por provision-trial.js paso 9 via `npx convex run onboardingEmail:triggerWelcomeEmail`.
 */
export const triggerWelcomeEmail = action({
  args: {
    email: v.string(),
    nombre: v.string(),
    empresa: v.string(),
    dashboardUrl: v.string(),
    trialEndsAt: v.number(),
    adminSecret: v.string(),
  },
  handler: async (_ctx, args) => {
    const expectedSecret = process.env.SAAN_API_SECRET;
    if (!expectedSecret || args.adminSecret !== expectedSecret) {
      throw new Error("Unauthorized: invalid admin secret");
    }

    const html = buildWelcomeEmailHtml({
      nombre: args.nombre,
      empresa: args.empresa,
      dashboardUrl: args.dashboardUrl,
      trialEndsAt: args.trialEndsAt,
    });

    await sendViaResend({
      to: args.email,
      subject: "Bienvenido a Sisteco — Tu trial esta activo",
      html,
    });

    return { ok: true, email: args.email };
  },
});

/**
 * sendTrialExpiryReminder — Recordatorio antes del vencimiento del trial.
 * InternalAction: llamada por cron o scheduler de Convex.
 */
export const sendTrialExpiryReminder = internalAction({
  args: {
    email: v.string(),
    nombre: v.string(),
    empresa: v.string(),
    daysRemaining: v.number(),
    plan: v.string(),
  },
  handler: async (_ctx, args) => {
    const reveniuLink = REVENIU_LINKS[args.plan as keyof typeof REVENIU_LINKS]
      ?? REVENIU_LINKS.base;

    const styles = buildEmailStyles();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu trial de Sisteco vence pronto</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <p class="logo">Sisteco</p>
    <div class="accent-bar"></div>

    <h2>Tu trial vence en ${args.daysRemaining} dias</h2>

    <p>Hola ${args.nombre}, tu periodo de prueba de Sisteco para <strong>${args.empresa}</strong> vence en <strong>${args.daysRemaining} dias</strong>.</p>

    <p>Para mantener tu pipeline de leads activo y no perder los leads que ya hemos prospectado para ti, contrata antes de que venza el trial.</p>

    <a href="${reveniuLink}" class="cta-btn">Contratar ahora</a>

    <div class="info-box">
      <p><strong>Lo que incluye tu plan:</strong> Pipeline de leads scored semanalmente, ICP automatico, scoring con IA, integracion con tu CRM, y soporte directo del equipo Sisteco.</p>
    </div>

    <p>Si tienes preguntas o quieres conversar sobre el plan que mejor se adapta a ${args.empresa}, escríbenos.</p>

    <div class="footer">
      <p>Sisteco — Infraestructura inteligente para ventas B2B</p>
      <p><a href="mailto:contacto@sisteco.cl">contacto@sisteco.cl</a> · +56 9 40065566 · Las Condes, Santiago de Chile</p>
    </div>
  </div>
</body>
</html>`;

    await sendViaResend({
      to: args.email,
      subject: `Tu trial de Sisteco vence en ${args.daysRemaining} dias`,
      html,
    });
  },
});

/**
 * sendPaymentConfirmation — Confirmacion de pago exitoso al activar suscripcion.
 * InternalAction: llamada desde activateFromWebhook despues de activar la suscripcion.
 */
export const sendPaymentConfirmation = internalAction({
  args: {
    email: v.string(),
    nombre: v.string(),
    empresa: v.string(),
    plan: v.string(),
    amount: v.number(),
  },
  handler: async (_ctx, args) => {
    const planKey = args.plan as keyof typeof PLAN_INFO;
    const planInfo = PLAN_INFO[planKey] ?? { name: args.plan, priceCLP: `$${args.amount}`, priceUSD: "" };

    const styles = buildEmailStyles();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago confirmado — Sisteco</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <p class="logo">Sisteco</p>
    <div class="accent-bar"></div>

    <h2>Pago confirmado</h2>

    <p>Hola ${args.nombre}, confirmamos que hemos recibido tu pago para la suscripcion de <strong>${args.empresa}</strong>.</p>

    <div class="info-box">
      <p><strong>Plan:</strong> ${planInfo.name}</p>
      <p><strong>Monto:</strong> ${planInfo.priceCLP} (${planInfo.priceUSD})</p>
      <p><strong>Estado:</strong> Activo</p>
    </div>

    <p>Tu pipeline recurrente de leads ya esta habilitado. A partir de ahora recibirás leads scored semanalmente en tu Sheet de trabajo.</p>

    <p>Para gestionar tu suscripcion o revisar la politica de tratamiento de datos, puedes contactarnos directamente.</p>

    <div class="footer">
      <p>Sisteco — Infraestructura inteligente para ventas B2B</p>
      <p><a href="mailto:contacto@sisteco.cl">contacto@sisteco.cl</a> · +56 9 40065566 · Las Condes, Santiago de Chile</p>
      <p style="margin-top: 8px; font-size: 12px; color: #aaaaaa;">El tratamiento de datos se rige por la Ley 21.719 (Chile). Para solicitudes ARCO-POL, escribir a contacto@sisteco.cl.</p>
    </div>
  </div>
</body>
</html>`;

    await sendViaResend({
      to: args.email,
      subject: `Pago confirmado — Sisteco ${planInfo.name}`,
      html,
    });
  },
});
