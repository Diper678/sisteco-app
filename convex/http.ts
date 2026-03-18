// Sisteco Compliance — HTTP router con endpoints publicos para Ley 21.719
//
// Endpoints PUBLICOS (sin autenticacion) — los leads NO son usuarios de Sisteco.
//
// GET  /opt-out         — Formulario HTML de baja
// POST /opt-out         — Procesar solicitud de baja (envia verificacion por email)
// GET  /opt-out/confirm — Confirmar baja desde link en email (ejecuta opt-out global)
// POST /unsubscribe     — One-click unsubscribe RFC 8058 (desde cliente de correo)
// POST /derechos        — Solicitud ARCO-POL (envia verificacion por email)
// GET  /privacidad      — Politica de privacidad completa en HTML
// OPTIONS /*            — Preflight CORS para todos los endpoints
//
// Branding Sisteco: fondo #F8F7F5, texto #111111, acento #c5ed36
// Ref: CLAUDE.md "Identidad visual"

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ── CORS Helper ───────────────────────────────────────────────────────────────

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// ── HTML Templates ────────────────────────────────────────────────────────────

// Estilos compartidos con branding Sisteco
const SHARED_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #F8F7F5;
    color: #111111;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    background: #ffffff;
    border: 1px solid #e5e5e5;
    border-radius: 12px;
    padding: 40px;
    max-width: 480px;
    width: 100%;
  }
  .logo {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin-bottom: 4px;
  }
  .accent-bar {
    width: 28px;
    height: 3px;
    background: #c5ed36;
    margin-bottom: 28px;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 10px;
    line-height: 1.3;
  }
  p {
    font-size: 15px;
    color: #555555;
    line-height: 1.6;
    margin-bottom: 24px;
  }
  label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
    color: #111111;
  }
  input[type="email"], input[type="text"], select, textarea {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    font-size: 15px;
    color: #111111;
    background: #ffffff;
    margin-bottom: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: #c5ed36;
  }
  textarea { min-height: 80px; resize: vertical; }
  button[type="submit"] {
    width: 100%;
    padding: 14px;
    background: #c5ed36;
    color: #111111;
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }
  button[type="submit"]:hover { background: #b3d82f; }
  .footer {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #e5e5e5;
    font-size: 12px;
    color: #aaaaaa;
  }
  .success { color: #2d6a00; background: #f0ffd9; border: 1px solid #c5ed36; border-radius: 6px; padding: 14px; margin-top: 16px; }
  .error { color: #8b2600; background: #fff3f0; border: 1px solid #ffb3a0; border-radius: 6px; padding: 14px; margin-top: 16px; }
`;

const OPT_OUT_FORM_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Baja — Sisteco</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Solicitud de Baja</h1>
    <p>Si no deseas recibir comunicaciones de nuestra parte, ingresa tu email para iniciar el proceso de eliminacion.</p>

    <form id="optOutForm">
      <label for="email">Correo electronico</label>
      <input type="email" id="email" name="email" placeholder="tu@email.com" required autocomplete="email">
      <button type="submit">Solicitar baja</button>
    </form>

    <div id="message"></div>

    <div class="footer">
      Sisteco — Plataforma B2B | contacto@sisteco.cl<br>
      Protegido bajo Ley 21.719 de Proteccion de Datos Personales
    </div>
  </div>

  <script>
    document.getElementById('optOutForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      try {
        const res = await fetch(window.location.origin + '/opt-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        document.getElementById('message').innerHTML =
          '<div class="success">Revisa tu email para confirmar la solicitud. El enlace expira en 24 horas.</div>';
        e.target.style.display = 'none';
      } catch(err) {
        document.getElementById('message').innerHTML =
          '<div class="error">Error al enviar la solicitud. Por favor intenta nuevamente.</div>';
        btn.disabled = false;
        btn.textContent = 'Solicitar baja';
      }
    });
  </script>
</body>
</html>`;

const CONFIRM_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Baja Confirmada — Sisteco</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Solicitud procesada</h1>
    <div class="success">
      <strong>Tu solicitud ha sido procesada.</strong><br>
      Tus datos seran eliminados de nuestro sistema. Has sido agregado a nuestra lista de exclusion global — ningun cliente de Sisteco podra volver a contactarte.
    </div>
    <p style="margin-top: 20px;">
      Si tienes preguntas adicionales, escribe a <a href="mailto:contacto@sisteco.cl">contacto@sisteco.cl</a>.
    </p>
    <div class="footer">
      Sisteco — Plataforma B2B | contacto@sisteco.cl<br>
      Protegido bajo Ley 21.719 de Proteccion de Datos Personales
    </div>
  </div>
</body>
</html>`;

const CONFIRM_ERROR_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — Sisteco</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Enlace invalido</h1>
    <div class="error">
      <strong>Token invalido o expirado.</strong><br>
      El enlace de confirmacion ha expirado o ya fue utilizado. Por favor, inicia el proceso nuevamente.
    </div>
    <p style="margin-top: 20px;">
      <a href="/opt-out" style="color: #111111; font-weight: 600;">Volver al formulario de baja</a>
    </p>
    <div class="footer">
      Sisteco — Plataforma B2B | contacto@sisteco.cl
    </div>
  </div>
</body>
</html>`;

// Politica de privacidad inline — no podemos leer archivos desde Convex HTTP actions
// Contenido basado en docs/legal/politica-privacidad.md
const PRIVACIDAD_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Politica de Privacidad — Sisteco</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Source Sans 3', -apple-system, sans-serif; background: #F8F7F5; color: #111111; padding: 24px; }
    .container { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e5e5e5; border-radius: 12px; padding: 48px; }
    .logo { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .accent-bar { width: 28px; height: 3px; background: #c5ed36; margin-bottom: 32px; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
    .meta { font-size: 13px; color: #888; margin-bottom: 32px; }
    h2 { font-size: 18px; font-weight: 700; margin: 32px 0 12px; }
    p { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    th { background: #f5f5f5; padding: 10px 12px; text-align: left; border: 1px solid #e5e5e5; font-weight: 600; }
    td { padding: 10px 12px; border: 1px solid #e5e5e5; color: #444; vertical-align: top; }
    ul { padding-left: 20px; margin: 8px 0 16px; color: #444; }
    li { margin-bottom: 8px; font-size: 15px; line-height: 1.6; }
    a { color: #111111; font-weight: 600; }
    blockquote { border-left: 3px solid #c5ed36; padding: 12px 16px; background: #fafaf8; margin: 16px 0; font-size: 14px; color: #555; }
    .cta { display: inline-block; background: #c5ed36; color: #111; font-weight: 700; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 8px 4px 8px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Politica de Privacidad</h1>
    <div class="meta">Ultima actualizacion: 15 de marzo de 2026 &bull; Responsable: Sisteco SpA</div>

    <h2>Que datos recopilamos?</h2>
    <p><strong>A. Clientes (empresas contratantes):</strong> datos de contacto del representante, datos de la empresa (RUT, razon social), datos de facturacion (gestionados por Reveniu), datos de uso de la plataforma.</p>
    <p><strong>B. Prospectos B2B (leads en nuestro pipeline):</strong> nombre completo, cargo, empresa, email empresarial; URL perfil LinkedIn (datos publicos profesionales); datos SII (RUT empresa, giro, tamano estimado — datos publicos); puntaje de idoneidad generado por IA.</p>
    <p><strong>C. Visitantes del sitio web:</strong> datos de navegacion anonimos, email si se suscribe a nuestra lista.</p>

    <h2>Por que tratamos sus datos?</h2>
    <table>
      <tr><th>Proposito</th><th>Base legal</th><th>Plazo de retencion</th></tr>
      <tr><td>Prestacion del servicio contratado</td><td>Contrato (Art. 12 Ley 21.719)</td><td>Duracion contrato + 5 anos</td></tr>
      <tr><td>Prospeccion B2B</td><td>Interes legitimo (Art. 13)</td><td><strong>24 meses</strong> o hasta opt-out</td></tr>
      <tr><td>Envio de emails comerciales</td><td>Interes legitimo</td><td>Hasta opt-out</td></tr>
      <tr><td>Cumplimiento tributario (SII)</td><td>Obligacion legal (Art. 14)</td><td>6 anos</td></tr>
      <tr><td>Respuesta a solicitudes ARCO-POL</td><td>Obligacion legal</td><td>5 anos</td></tr>
    </table>
    <blockquote>Para prospectos B2B, la retencion maxima es <strong>24 meses</strong> desde la ultima interaccion. Con interacciones activas puede extenderse, con un <strong>maximo absoluto de 36 meses</strong> desde captacion original.</blockquote>

    <h2>Con quien compartimos sus datos?</h2>
    <table>
      <tr><th>Proveedor</th><th>Pais</th><th>Proposito</th></tr>
      <tr><td>Convex Inc.</td><td>USA</td><td>Base de datos en la nube</td></tr>
      <tr><td>Vercel Inc.</td><td>USA</td><td>Hosting y funciones serverless</td></tr>
      <tr><td>Clerk Inc.</td><td>USA</td><td>Autenticacion y gestion de sesiones</td></tr>
      <tr><td>Resend Inc.</td><td>USA</td><td>Comunicaciones por email</td></tr>
      <tr><td>Google LLC</td><td>USA</td><td>Scoring IA; Sheets (entrega a clientes)</td></tr>
      <tr><td>PhantomBuster</td><td>Francia</td><td>Prospeccion LinkedIn</td></tr>
    </table>
    <p>No vendemos ni cedemos datos a terceros para propositos propios de esos terceros. Todas las transferencias internacionales cuentan con garantias adecuadas (Clausulas Contractuales Tipo, conforme Ley 21.719).</p>

    <h2>Sus derechos</h2>
    <ul>
      <li><strong>Acceder</strong> a sus datos personales que tratamos</li>
      <li><strong>Rectificar</strong> datos inexactos o incompletos</li>
      <li><strong>Suprimir</strong> sus datos ("derecho al olvido")</li>
      <li><strong>Portabilidad:</strong> recibir sus datos en formato estructurado (JSON o CSV)</li>
      <li><strong>Oponerse</strong> al tratamiento basado en interes legitimo</li>
      <li><strong>Limitar</strong> el tratamiento en determinadas circunstancias</li>
    </ul>
    <p>
      <a href="/derechos" class="cta">Ejercer mis derechos (ARCO-POL)</a>
      <a href="/opt-out" class="cta" style="background: #f5f5f5;">Solicitar baja</a>
    </p>

    <h2>Opt-out de comunicaciones comerciales</h2>
    <p>Para ser eliminado de nuestro sistema de prospeccion B2B puede:</p>
    <ul>
      <li>Hacer click en el link de baja incluido en cada email que le enviemos</li>
      <li>Usar la baja automatica desde su cliente de correo (List-Unsubscribe RFC 8058)</li>
      <li>Usar el <a href="/opt-out">formulario web de baja</a></li>
    </ul>
    <p>Al hacer opt-out, sus datos se eliminan de <strong>todos</strong> nuestros clientes activos. Su email queda en nuestra lista global de exclusion permanente.</p>

    <h2>Seguridad de los datos</h2>
    <ul>
      <li>Cifrado en transito: HTTPS/TLS 1.3</li>
      <li>Cifrado en reposo: AES-256 (Convex)</li>
      <li>Control de acceso por roles (CEO, VP Ventas, SDR)</li>
      <li>Logs de auditoria de acciones sobre cada lead</li>
      <li>Aislamiento multi-tenant: cada cliente solo accede a sus propios datos</li>
    </ul>

    <h2>Contacto</h2>
    <p>
      <strong>Sisteco SpA</strong><br>
      Email: contacto@sisteco.cl<br>
      Telefono: +56 9 40065566<br>
      Direccion: Las Condes, Santiago de Chile<br>
      Formulario ARCO-POL: <a href="/derechos">/derechos</a>
    </p>

    <div class="footer">
      Sisteco SpA &bull; Las Condes, Santiago de Chile &bull; contacto@sisteco.cl &bull; Ley 21.719
    </div>
  </div>
</body>
</html>`;

// Pagina de confirmacion exitosa para solicitudes ARCO-POL (no supresion)
const DERECHOS_CONFIRM_SUCCESS_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud Verificada — Sisteco</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Solicitud verificada</h1>
    <div class="success">
      <strong>Tu solicitud de derechos ha sido verificada.</strong><br>
      Nuestro equipo la procesara dentro de 15 dias habiles, conforme a la Ley 21.719.
    </div>
    <p style="margin-top: 20px;">
      Si tienes preguntas adicionales, escribe a <a href="mailto:contacto@sisteco.cl">contacto@sisteco.cl</a>.
    </p>
    <div class="footer">
      Sisteco — Plataforma B2B | contacto@sisteco.cl<br>
      Protegido bajo Ley 21.719 de Proteccion de Datos Personales
    </div>
  </div>
</body>
</html>`;

// Pagina de error para token invalido/expirado en solicitudes ARCO-POL
const DERECHOS_CONFIRM_ERROR_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error — Sisteco</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="logo">Sisteco</div>
    <div class="accent-bar"></div>
    <h1>Enlace invalido</h1>
    <div class="error">
      <strong>Token invalido o expirado.</strong><br>
      El enlace de confirmacion ha expirado o ya fue utilizado. Por favor, inicia el proceso nuevamente.
    </div>
    <p style="margin-top: 20px;">
      <a href="/derechos" style="color: #111111; font-weight: 600;">Volver al formulario de derechos</a>
    </p>
    <div class="footer">
      Sisteco — Plataforma B2B | contacto@sisteco.cl
    </div>
  </div>
</body>
</html>`;

// ── Route: OPTIONS preflight CORS ─────────────────────────────────────────────

// Preflight para /opt-out
http.route({
  path: "/opt-out",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// Preflight para /derechos
http.route({
  path: "/derechos",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// Preflight para /derechos/confirm
http.route({
  path: "/derechos/confirm",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// Preflight para /unsubscribe
http.route({
  path: "/unsubscribe",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }),
});

// ── Route 1: GET /opt-out — Formulario HTML de baja ──────────────────────────

http.route({
  path: "/opt-out",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(OPT_OUT_FORM_HTML, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }),
});

// ── Route 2: POST /opt-out — Procesar solicitud de baja ──────────────────────

http.route({
  path: "/opt-out",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const email: string = body?.email ?? "";

      if (!email || email.trim() === "") {
        return new Response(
          JSON.stringify({ ok: false, error: "Email requerido" }),
          {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }

      // Crear solicitud ARCO de tipo supresion y obtener token
      const { token } = await ctx.runMutation(
        internal.compliance.createArcoRequest,
        {
          email: email.trim().toLowerCase(),
          tipoSolicitud: "supresion",
        }
      );

      // Enviar email de verificacion
      await ctx.runAction(internal.compliance.sendVerificationEmail, {
        email: email.trim().toLowerCase(),
        token,
        tipo: "opt-out",
      });

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Revisa tu email para confirmar la solicitud",
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      console.error("POST /opt-out error:", err);
      return new Response(
        JSON.stringify({ ok: false, error: "Error interno. Intenta nuevamente." }),
        {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ── Route 3: GET /opt-out/confirm — Confirmar baja desde email ───────────────

http.route({
  path: "/opt-out/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(CONFIRM_ERROR_HTML, {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    try {
      // Verificar token y obtener email del resultado (requerido para executeGlobalOptOut)
      const result = await ctx.runMutation(
        internal.compliance.verifyArcoRequest,
        { token }
      );

      if (!result.verified) {
        return new Response(CONFIRM_ERROR_HTML, {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Si el tipo es supresion, ejecutar opt-out global usando result.email
      if (result.tipo === "supresion" && result.email) {
        await ctx.runMutation(internal.optOut.executeGlobalOptOut, {
          email: result.email,
          motivo: "Solicitud de baja via formulario web",
        });
      }

      return new Response(CONFIRM_SUCCESS_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      console.error("GET /opt-out/confirm error:", err);
      return new Response(CONFIRM_ERROR_HTML, {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }),
});

// ── Route 4: POST /unsubscribe — One-click unsubscribe RFC 8058 ───────────────
// Spec RFC 8058: cliente de correo envia POST con body "List-Unsubscribe=One-Click"
// y el email tipicamente va en el query param de la URL

http.route({
  path: "/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    if (!email) {
      // RFC 8058: si no hay email, responder 200 de todas formas (email clients expect silent success)
      return new Response("", { status: 200, headers: corsHeaders() });
    }

    try {
      await ctx.runMutation(internal.optOut.executeGlobalOptOut, {
        email: decodeURIComponent(email).trim().toLowerCase(),
        motivo: "One-click unsubscribe RFC 8058",
      });
    } catch (err) {
      console.error("POST /unsubscribe error:", err);
      // RFC 8058: retornar 200 incluso si hay error para no re-intentos del cliente
    }

    // RFC 8058: retornar 200 con body vacio
    return new Response("", { status: 200, headers: corsHeaders() });
  }),
});

// ── Route 5: POST /derechos — Solicitud ARCO-POL ─────────────────────────────

const TIPOS_VALIDOS = [
  "acceso",
  "rectificacion",
  "supresion",
  "oposicion",
  "portabilidad",
  "limitacion",
] as const;

type TipoSolicitud = (typeof TIPOS_VALIDOS)[number];

http.route({
  path: "/derechos",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const email: string = body?.email ?? "";
      const nombre: string | undefined = body?.nombre;
      const tipo: string = body?.tipo ?? "";
      const detalles: string | undefined = body?.detalles;

      // Validar campos requeridos
      if (!email || email.trim() === "") {
        return new Response(
          JSON.stringify({ ok: false, error: "Email requerido" }),
          {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }

      if (!TIPOS_VALIDOS.includes(tipo as TipoSolicitud)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Tipo de solicitud invalido. Valores validos: acceso, rectificacion, supresion, oposicion, portabilidad, limitacion",
          }),
          {
            status: 400,
            headers: { ...corsHeaders(), "Content-Type": "application/json" },
          }
        );
      }

      // Crear solicitud ARCO y obtener token
      const { token } = await ctx.runMutation(
        internal.compliance.createArcoRequest,
        {
          email: email.trim().toLowerCase(),
          nombre: nombre?.trim(),
          tipoSolicitud: tipo as TipoSolicitud,
          detalles: detalles?.trim(),
        }
      );

      // Enviar email de verificacion
      await ctx.runAction(internal.compliance.sendVerificationEmail, {
        email: email.trim().toLowerCase(),
        token,
        tipo: "arco",
      });

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Solicitud recibida. Revisa tu email para verificar.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    } catch (err) {
      console.error("POST /derechos error:", err);
      return new Response(
        JSON.stringify({ ok: false, error: "Error interno. Intenta nuevamente." }),
        {
          status: 500,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// ── Route 6: GET /derechos/confirm — Verificar token ARCO-POL y disparar triage ──
// Flujo: verificar token → si supresion ejecutar opt-out → si otro tipo disparar webhook n8n
// Responde HTML para mostrar confirmacion al titular de datos.

http.route({
  path: "/derechos/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(DERECHOS_CONFIRM_ERROR_HTML, {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    try {
      // Verificar token y obtener datos de la solicitud
      const result = await ctx.runMutation(
        internal.compliance.verifyArcoRequest,
        { token }
      );

      if (!result.verified) {
        return new Response(DERECHOS_CONFIRM_ERROR_HTML, {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Si es supresion: ejecutar opt-out global (incluye propagacion a Sheets via scheduler)
      if (result.tipo === "supresion" && result.email) {
        await ctx.runMutation(internal.optOut.executeGlobalOptOut, {
          email: result.email,
          motivo: "Solicitud ARCO supresion verificada",
        });
      } else if (result.email) {
        // Si es acceso, rectificacion, oposicion, portabilidad, limitacion:
        // Disparar webhook n8n para triage humano (SLA 15 dias habiles)
        await ctx.runAction(internal.sheetsPropagation.triggerArcoPolWebhook, {
          requestId: result.requestId as string,
          email: result.email,
          tipo: result.tipo as string,
          tenantsAfectados: [],
        });
      }

      return new Response(DERECHOS_CONFIRM_SUCCESS_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      console.error("GET /derechos/confirm error:", err);
      return new Response(DERECHOS_CONFIRM_ERROR_HTML, {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }),
});

// ── Route 7: GET /privacidad — Politica de privacidad HTML ───────────────────

http.route({
  path: "/privacidad",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(PRIVACIDAD_HTML, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }),
});

// ── Route 8: OPTIONS /intake preflight ───────────────────────────────────────

http.route({
  path: "/intake",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }),
});

// ── Route 9: POST /intake — Formulario publico de trial ──────────────────────
// Recibe datos del formulario de intake (prospecto), los guarda en trialRequests.
// No requiere autenticacion — es el punto de entrada publico del funnel.

http.route({
  path: "/intake",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      // Validar campos requeridos
      const nombre = body?.nombre ?? "";
      const email = body?.email ?? "";
      const empresa = body?.empresa ?? "";
      const sector = body?.sector ?? "";
      const mercado = body?.mercado ?? "";
      const tipoclientes = body?.tipoclientes ?? "";

      if (!nombre || !email || !empresa || !sector || !mercado || !tipoclientes) {
        return new Response(
          JSON.stringify({ ok: false, error: "Campos requeridos: nombre, email, empresa, sector, mercado, tipoclientes" }),
          { status: 400, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
        );
      }

      const requestId = await ctx.runMutation(internal.trialRequests.create, {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        empresa: empresa.trim(),
        cargo: body?.cargo?.trim(),
        telefono: body?.telefono?.trim(),
        sector: sector.trim(),
        mercado: mercado.trim(),
        tipoclientes: tipoclientes.trim(),
        crm: body?.crm?.trim(),
        almacenamientoLeads: body?.almacenamientoLeads?.trim(),
        setupCorreos: body?.setupCorreos?.trim(),
        procesoVentas: body?.procesoVentas?.trim(),
      });

      return new Response(
        JSON.stringify({ ok: true, requestId, message: "Solicitud recibida. Te contactaremos pronto." }),
        { status: 200, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    } catch (err) {
      console.error("POST /intake error:", err);
      return new Response(
        JSON.stringify({ ok: false, error: "Error interno. Intenta nuevamente." }),
        { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
