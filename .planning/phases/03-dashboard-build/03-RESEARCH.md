# Phase 3: Dashboard Build - Research

**Researched:** 2026-03-12
**Domain:** Vanilla JS + Clerk auth + Convex queries + multi-tenant isolation + PDF generation + Gemini NL fallback
**Confidence:** HIGH (auth patterns, Convex queries, architecture) — MEDIUM (PDF, Gemini fallback UX)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Mockups aprobados:** CEO (ceo.html), VP Ventas (vp-ventas.html), SDR (sdr.html) — estas son la referencia visual exacta
- **Frontend stack:** Vanilla HTML/CSS/JS + GSAP 3.12.7 + Lucide 0.468.0 (sin framework)
- **Command bar filosofia:** "todo pasa por el command bar" — compartir, reportes, configuracion son queries, no botones separados
- **Queries predefinidas por rol:** CEO ve KPIs/funnel/tendencias, VP ve pipeline/equipo/asignaciones, SDR ve sus leads/pendientes/HOT
- **Fallback Gemini:** Para queries no reconocidas — Gemini recibe solo datos del scope del rol
- **Formato respuesta Gemini:** datos estructurados (mini-card con dato duro) + narrativa interpretativa debajo
- **Historial de queries:** ultimas 5 consultas del usuario, visibles al abrir el command bar
- **Botones de query dinamicos con badges:** indicadores contextuales ("Leads HOT (3 nuevos)", "Pipeline (12 activos)")
- **Comparacion temporal:** toggle vs semana anterior y mes anterior. Solo esos 2 periodos en MVP
- **Persistencia:** al recargar pagina, restaura la ultima vista/query abierta
- **Sin atajo de teclado:** command bar siempre visible, acceso solo por click
- **Sin match Gemini:** intenta Gemini como fallback antes de mostrar error
- **Asignar leads:** select (checkboxes) + boton asignar en tabla del VP. Permite bulk assign
- **4 estados de lead:** Sin asignar → Asignado → En progreso → Cerrado
- **3 subestados de cierre:** Ganado / Perdido / Descartado
- **Cambio de estado:** click directo, sin nota obligatoria
- **Audit trail:** timeline en el panel del lead con historial de acciones
- **Reasignar:** VP puede reasignar con dialogo de confirmacion
- **SDR no rechaza leads en MVP**
- **Notificacion al SDR:** solo dentro del dashboard (to-do list). Sin Discord/email
- **0 leads:** pantalla limpia con mensaje "Tu pipeline esta vacio" + command bar activo
- **Wizard ICP breve:** 3-4 preguntas antes de activar pipeline (industria, tamano, ubicacion, keywords)
- **VP dual:** sin SDRs, el VP trabaja como SDR. Cuando invite equipo, cambia a vista de gestion
- **Responsive:** misma app web con layout adaptado via CSS. No PWA ni app nativa
- **Tabla VP en movil:** lista simplificada vertical. Tap para ver detalle
- **Datos de contacto SDR:** tap para abrir (tel, email, LinkedIn) + icono copiar
- **Informe PDF:** via query del command bar ("Generar reporte PDF"). Branded Sisteco.
- **PDF periodo:** usuario elige rango (esta semana, este mes, ultimo trimestre)
- **Multi-tenant:** via Clerk Organizations
- **Deploy:** npx vercel --prod (sin git remote de proyecto)
- **DB:** Convex (reactiva, ya deployada con schema de leads)
- **Auth:** Clerk (Email + Google OAuth + Organizations)
- **DASH-07:** Dashboard NO usa suscripciones reactivas a tablas completas (usar ConvexHttpClient one-shot)

### Claude's Discretion

- Command bar mobile UX (sticky vs FAB + bottom sheet)
- Diseno del PDF (layout, graficos, spacing)
- Exact implementation del fallback Gemini (prompt engineering, context window)
- Loading states y transiciones entre queries
- Skeleton/loading patterns
- Error handling para Convex/Gemini failures
- Exact ICP wizard fields and validation

### Deferred Ideas (OUT OF SCOPE)

- Envio automatico de PDF programado (post-MVP)
- Ficha PDF de lead individual (futura)
- Notificacion Discord al cerrar como Ganado (evaluar post-MVP)
- SDR rechaza/devuelve lead asignado (futura)
- Pipeline value en pesos estimado (futura)
- PWA instalable (evaluar post-MVP)
- Rendimiento individual por SDR ranking (deferred Phase 2)
- Integracion directa con email/secuencias desde dashboard (deferred Phase 2)
- Alertas in-app badges/notificaciones (deferred Phase 2)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Login con Clerk (email + Google OAuth) | Clerk JS SDK via CDN carga sin React. `Clerk.load()` + `Clerk.openSignIn()`. Auth state via `Clerk.user`. |
| DASH-02 | Vista de leads con filtros (score, industria, estado, fecha) | ConvexHttpClient.query() con indexes compuestos. Filtros en JS del lado cliente (datos <500 leads por org). |
| DASH-03 | KPIs principales: leads nuevos, leads HOT, tasa conversion, pipeline value | Convex query `getLeadsStats` ya existe. KPI cards ya implementadas en interactions.js — reemplazar mock por datos reales. |
| DASH-04 | Detalle de lead individual (datos enriquecidos, score breakdown, timeline) | Panel slide-in ya diseñado en mockups. Lead data incluye audit trail en Convex. ConvexHttpClient.query(api.leads.getLeadById). |
| DASH-05 | Multi-tenant: cada cliente ve solo sus datos | Clerk Organizations -> orgId en JWT -> auth.config.ts Convex -> getUserIdentity() en cada query. withIndex("by_orgId"). |
| DASH-06 | Responsive en movil | styles.css tiene breakpoints. interactions.js tiene structure mobile-ready. Tabla VP → lista vertical card. SDR → quick-copy contacto. |
| DASH-07 | Dashboard NO usa suscripciones reactivas a tablas completas | ConvexHttpClient (one-shot) en vez de ConvexClient (reactive). Queries puntuales por accion del usuario. |
</phase_requirements>

---

## Summary

El dashboard de Sisteco es una aplicacion vanilla HTML/CSS/JS multi-pagina que necesita conectarse a datos reales de Convex usando Clerk para autenticacion multi-tenant. Los mockups de Phase 2 (ceo.html, vp-ventas.html, sdr.html) son la referencia visual exacta — el trabajo de Phase 3 es "hacer funcionar" esos mockups reemplazando `SISTECO_DATA` (objeto JS mock) con datos reales de Convex, agregando auth real via Clerk, y construyendo las interacciones reales (asignacion de leads, cambio de estados, PDF, Gemini fallback).

El patron central es: Clerk JS SDK (CDN, sin React) inicializa auth — el usuario hace login — se obtiene JWT con orgId del Clerk Organizations — ConvexHttpClient.setAuth(token) autenticado hace queries one-shot a Convex — los datos reemplazan el mock en contentBuilders — GSAP anima la entrada del contenido real. DASH-07 indica explicitamente usar ConvexHttpClient (no reactivo) en vez de ConvexReactClient.

La complejidad principal esta en: (1) bootstrap de Clerk sin React, (2) configurar auth.config.ts en Convex con Clerk domain + JWT template "convex", (3) agregar campo orgId a todos los documentos leads y queries con withIndex, (4) construir las mutaciones de estado y asignacion, (5) integrar PDF generation con html2pdf.js via CDN, y (6) proxy Vercel serverless para las llamadas a Gemini (para proteger la API key del frontend publico).

**Primary recommendation:** Construir en waves: Wave 0 (auth + Convex real), Wave 1 (datos por rol + KPIs), Wave 2 (interacciones VP/SDR), Wave 3 (PDF + Gemini fallback), Wave 4 (mobile + polish).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Clerk JS | 5.x | Auth + Organizations (vanilla JS, CDN) | Ya en stack. CDN disponible sin React. `Clerk.load()` pattern funciona. |
| ConvexHttpClient | latest | One-shot queries/mutations a Convex | Cumple DASH-07 (no reactivo). `setAuth(token)` acepta JWT de Clerk. |
| GSAP | 3.12.7 | Animaciones de contenido (ya en mockups) | animateBlockIn/Out ya implementados y aprobados. |
| Lucide | 0.468.0 | Iconos (ya en mockups) | Ya implementado en interactions.js. initLucide() pattern. |
| html2pdf.js | 0.10.1 | PDF generation cliente-side (CDN) | Wrapper sobre jsPDF + html2canvas. Minimo setup. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| convex/browser | latest (npm CDN) | ConvexHttpClient import | Queries/mutations autenticadas desde browser |
| Vercel Serverless Functions | — | Proxy para Gemini API (proteger API key) | Llamadas a Gemini deben pasar por /api/gemini-query.js |
| n8n Webhook | — | Activacion de pipeline desde dashboard | VP activa el pipeline via POST al webhook de n8n |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ConvexHttpClient (one-shot) | ConvexClient (reactivo) | ConvexClient = subscripciones WebSocket = DASH-07 viola. ConvexHttpClient = fetch puntual = correcto. |
| html2pdf.js | jsPDF + html2canvas directos | html2pdf.js es wrapper mas simple. Tradeoff: texto no seleccionable en PDF (aceptable para reporte ejecutivo). |
| Vercel proxy para Gemini | Llamada directa desde browser | Llamada directa expone GEMINI_API_KEY en frontend. Vercel /api/gemini-query.js mantiene key en env var server-side. |
| Clerk Organizations | Custom multi-tenant | Clerk Organizations ya en stack y tiene orgId en JWT claims automaticamente. |

**Installation (CDN — no npm build requerido):**
```html
<!-- Clerk JS -->
<script
  async
  crossorigin="anonymous"
  data-clerk-publishable-key="pk_..."
  src="https://YOUR_CLERK_FRONTEND_API/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
  type="text/javascript"
></script>

<!-- Convex (via CDN ESM shim o bundle pre-built) -->
<script type="module">
  import { ConvexHttpClient } from "https://esm.sh/convex@latest/browser";
  window.ConvexHttpClient = ConvexHttpClient;
</script>

<!-- html2pdf.js -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
```

---

## Architecture Patterns

### Recommended Project Structure
```
/ (raiz del proyecto)
├── index.html               # Landing / redirect a /app/
├── app/
│   ├── login.html           # Clerk sign-in UI
│   ├── ceo.html             # Dashboard CEO (from mockup)
│   ├── vp-ventas.html       # Dashboard VP (from mockup)
│   └── sdr.html             # Dashboard SDR (from mockup)
├── shared/
│   ├── styles.css           # Design system (ya existe en mockups/)
│   ├── interactions.js      # Command bar, GSAP, Lucide (ya existe)
│   ├── mock-data.js         # ELIMINAR o vaciar (reemplazado por Convex)
│   ├── auth.js              # Clerk init + getToken + role detection
│   └── convex-client.js     # ConvexHttpClient wrapper + auth + queries
├── api/
│   └── gemini-query.js      # Vercel serverless — proxy para Gemini
└── vercel.json              # Routing config para multi-page
```

### Pattern 1: Clerk JS Bootstrap (Vanilla, sin React)
**What:** Inicializar Clerk desde CDN, esperar load, entonces arrancar la app
**When to use:** Cada pagina del dashboard al inicio
**Example:**
```javascript
// shared/auth.js
// Source: https://clerk.com/docs/quickstarts/javascript

window.addEventListener('load', async function () {
  await Clerk.load();

  if (!Clerk.user) {
    // No hay sesion — redirigir a login
    window.location.href = '/app/login.html';
    return;
  }

  // Obtener orgId del Organizations activo
  const orgId = Clerk.session?.lastActiveOrganizationId;
  if (!orgId) {
    // Usuario sin org — mostrar pantalla de setup
    showNoOrgScreen();
    return;
  }

  // Obtener JWT con template "convex" (incluye orgId en claims)
  const token = await Clerk.session.getToken({ template: 'convex' });

  // Inicializar ConvexHttpClient autenticado
  const convex = new ConvexHttpClient(window.CONVEX_URL);
  convex.setAuth(token);
  window.CONVEX = convex;
  window.CURRENT_ORG_ID = orgId;

  // Iniciar la app
  initDashboard();
});
```

### Pattern 2: Convex Auth Config para Clerk (auth.config.ts)
**What:** Configurar Convex para validar JWTs de Clerk
**When to use:** Wave 0 — necesario antes de cualquier query autenticada
**Example:**
```typescript
// convex/auth.config.ts
// Source: https://docs.convex.dev/auth/clerk

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",  // DEBE coincidir con el aud del JWT
    },
  ],
};
```
Luego en Clerk Dashboard: configurar JWT template llamado "convex" con custom claims que incluyan orgId.

### Pattern 3: Multi-Tenant Isolation en Convex Queries
**What:** Todas las queries filtran por orgId extraido del JWT — NO del request body
**When to use:** TODA query que acceda a datos de leads, KPIs, assignments
**Example:**
```typescript
// convex/leads.ts — patron de aislamiento
export const getLeadsByOrg = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // orgId viene del JWT claim — el cliente NO puede falsificarlo
    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No organization context");

    return await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

// convex/schema.ts — agregar orgId a leads
leads: defineTable({
  orgId: v.string(),           // Clerk Organization ID
  nombre: v.string(),
  empresa: v.string(),
  // ... resto de campos existentes
  asignadoA: v.optional(v.string()),  // userId del SDR asignado
  estado: v.union(
    v.literal("sin_asignar"),
    v.literal("asignado"),
    v.literal("en_progreso"),
    v.literal("cerrado")
  ),
  subestado: v.optional(v.union(
    v.literal("ganado"),
    v.literal("perdido"),
    v.literal("descartado")
  )),
  auditTrail: v.array(v.object({
    accion: v.string(),
    usuario: v.string(),
    timestamp: v.number(),
  })),
}).index("by_orgId", ["orgId"])
  .index("by_orgId_estado", ["orgId", "estado"])
  .index("by_orgId_asignadoA", ["orgId", "asignadoA"]),
```

### Pattern 4: ConvexHttpClient One-Shot Query (DASH-07)
**What:** Queries puntuales sin subscripcion reactiva — cumple DASH-07
**When to use:** Cada vez que el usuario hace click en un query button
**Example:**
```javascript
// shared/convex-client.js
// Source: https://docs.convex.dev/api/classes/browser.ConvexHttpClient

async function queryConvex(queryFn, args = {}) {
  // Refrescar token si expiro
  const token = await Clerk.session.getToken({ template: 'convex' });
  window.CONVEX.setAuth(token);

  try {
    return await window.CONVEX.query(queryFn, args);
  } catch (err) {
    if (err.message?.includes('Unauthenticated')) {
      // Token expirado y refresh fallo — redirigir a login
      Clerk.openSignIn();
    }
    throw err;
  }
}

async function mutateConvex(mutationFn, args = {}) {
  const token = await Clerk.session.getToken({ template: 'convex' });
  window.CONVEX.setAuth(token);
  return await window.CONVEX.mutation(mutationFn, args);
}
```

### Pattern 5: Command Bar + Datos Reales
**What:** Reemplazar SISTECO_DATA mock por queries reales en contentBuilders
**When to use:** Para cada query button — el click dispara fetch a Convex
**Example:**
```javascript
// Reemplaza contentBuilders.ceo.kpis en interactions.js

contentBuilders.ceo.kpis = async function() {
  showLoadingSkeleton();  // GSAP fade in skeleton

  try {
    const stats = await queryConvex(api.leads.getLeadsStats);
    // Construir HTML igual que el mockup pero con datos reales
    var html = '<div class="kpi-grid">';
    html += buildKPICard('users', 'Leads Nuevos', stats.nuevos, ...);
    // ...
    animateBlockIn(contentArea);
  } catch (err) {
    showErrorState(err.message);
  }
};
```

### Pattern 6: Gemini Fallback via Vercel Proxy
**What:** Queries de lenguaje natural no reconocidas pasan a Gemini — pero la API key esta en el servidor
**When to use:** Cuando ninguna query predefinida matchea el input del command bar
**Example:**
```javascript
// api/gemini-query.js (Vercel Serverless Function)
// Source: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query, roleContext, orgData } = req.body;

  // NUNCA exponer orgData sensible — solo metricas agregadas
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un asistente de ventas B2B para ${roleContext.rol}.
            Datos del pipeline: ${JSON.stringify(orgData)}
            Consulta del usuario: "${query}"
            Responde con un JSON: { "miniCard": { "titulo": "", "valor": "", "unidad": "" }, "narrativa": "..." }`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  res.status(200).json(JSON.parse(text));
}
```

### Pattern 7: PDF Generation via html2pdf.js (CDN)
**What:** Capturar el contenido del command bar area como PDF branded Sisteco
**When to use:** Cuando el usuario ejecuta query "Generar reporte PDF"
**Example:**
```javascript
// Source: https://ekoopmans.github.io/html2pdf.js/

async function generarReportePDF(periodo) {
  const contenido = document.querySelector('#pdf-content-area');

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `reporte-sisteco-${periodo}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(contenido).save();
}
```

### Pattern 8: n8n Pipeline Activation via Webhook
**What:** VP activa pipeline desde el dashboard disparando n8n workflow
**When to use:** Cuando VP completa wizard ICP y confirma activacion
**Example:**
```javascript
// Source: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/

async function activarPipeline(icpData) {
  const response = await fetch(window.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': window.N8N_API_KEY  // obtener del Vercel env
    },
    body: JSON.stringify({
      orgId: window.CURRENT_ORG_ID,
      icp: icpData  // { industria, tamano, ubicacion, keywords }
    })
  });
  return response.json();
}
```

### Anti-Patterns to Avoid

- **ConvexClient reactivo para todo:** Viola DASH-07. Usar ConvexHttpClient para queries on-demand.
- **orgId en el body del request:** El orgId DEBE venir del JWT token, no del body. Si viene del body, cualquier usuario puede falsificarlo.
- **API key Gemini en frontend:** NUNCA poner GEMINI_API_KEY en HTML/JS del cliente. Siempre via Vercel serverless proxy.
- **Subscripciones WebSocket:** No usar `client.onUpdate()` ni la API reactiva. Fetch puntual por accion.
- **Un solo archivo HTML con todo:** Mantener 3 paginas separadas (ceo.html, vp-ventas.html, sdr.html) — cada rol tiene su layout.
- **Llamar a Convex directamente desde n8n via HTTP Action:** Las HTTP Actions de Convex son para n8n → Convex (server to server). El dashboard usa ConvexHttpClient (browser client) con JWT auth.
- **PDF de toda la pagina:** Capturar solo el content block del command bar, no el sidebar ni el header.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | jsPDF directo con layout manual | html2pdf.js | Maneja pagination automatica, CSS-based layout, CDN disponible |
| Auth state machine | Custom cookie/session manager | Clerk JS SDK | Refresh de token, session expiry, org switching ya implementados |
| Multi-tenant filtering | Custom middleware | Convex getUserIdentity() + withIndex | Convex no tiene RLS — la isolation DEBE ser en la funcion. Patron ya documentado. |
| Gemini request formatting | Custom prompt builder | Prompt template simple con JSON schema | Gemini 2.5 Flash acepta `responseMimeType: "application/json"` nativo |
| Webhook security | Custom HMAC verification | n8n Header Auth (X-API-Key) | n8n soporta header auth nativo en el Webhook node |
| Lead state machine | Custom state management | Convex mutations con validacion de estado | updateLeadStatus mutation valida transiciones validas |

**Key insight:** El 60% del frontend ya esta construido (mockups aprobados). El trabajo es conectar datos reales, no re-disenar la UI.

---

## Common Pitfalls

### Pitfall 1: JWT Template no llamado "convex"
**What goes wrong:** `ctx.auth.getUserIdentity()` retorna null — todas las queries autenticadas fallan con "Unauthenticated"
**Why it happens:** ConvexProviderWithClerk (y el patron vanilla JS) busca un Clerk JWT template especificamente llamado "convex". Si el template se llama diferente, el token no funciona.
**How to avoid:** En Clerk Dashboard → JWT Templates → crear template llamado exactamente "convex". En el token, agregar custom claim `org_id` con valor `{{org.id}}`.
**Warning signs:** `identity` es null en queries autenticadas aunque el usuario esta logged in.

### Pitfall 2: orgId no en el schema de leads existente
**What goes wrong:** Leads existentes en Convex no tienen campo `orgId` — queries con withIndex("by_orgId") retornan 0 resultados para todos
**Why it happens:** El schema de leads fue creado en SAAN v1.0 para single-tenant (no habia org concept). Phase 3 lo necesita multi-tenant.
**How to avoid:** Wave 0 debe incluir migracion del schema: agregar `orgId` como campo requerido, crear los indices, correr script de migracion para datos existentes.
**Warning signs:** Dashboard muestra "0 leads" aunque Convex tiene datos.

### Pitfall 3: CORS en HTTP Actions de Convex
**What goes wrong:** Fetch desde browser a Convex HTTP Action falla con "CORS policy" error
**Why it happens:** ConvexHttpClient usa el endpoint `.convex.cloud` (no `.convex.site`) que maneja CORS automaticamente. Si se intenta llamar HTTP Actions directamente desde el browser, hay que agregar headers CORS manualmente en el httpAction handler.
**How to avoid:** Usar ConvexHttpClient.query() y .mutation() para queries del dashboard (CORS manejado). Solo usar HTTP Actions para n8n → Convex (server-to-server, sin CORS).
**Warning signs:** "Access-Control-Allow-Origin" error en DevTools Network.

### Pitfall 4: Token expirado entre queries
**What goes wrong:** Primera query funciona, query posterior falla con 401 — Clerk tokens expiran cada 60 segundos por defecto
**Why it happens:** ConvexHttpClient.setAuth(token) se llama una sola vez al inicio. Cuando el token expira, el client sigue enviando el token viejo.
**How to avoid:** Llamar `Clerk.session.getToken({ template: 'convex' })` antes de CADA query (Clerk hace cache interno si no expiro). Ver Pattern 4 del queryConvex wrapper.
**Warning signs:** Queries funcionan los primeros minutos, luego empiezan a fallar con 401.

### Pitfall 5: Mobile — Command Bar obstaculiza contenido
**What goes wrong:** En movil, el command bar pegado arriba consume demasiado espacio vertical — el contenido queda oculto bajo el fold
**Why it happens:** El diseno desktop asume sidebar + content area horizontal. En movil el layout es vertical y el command bar toma 120px+.
**How to avoid:** En mobile (<768px), usar FAB (Floating Action Button) en esquina inferior derecha que abre un bottom sheet con el command bar. El content area toma el 100% del espacio. Ver breakpoint de styles.css.
**Warning signs:** En iPhone SE, el usuario tiene que scrollear mucho para ver el KPI card.

### Pitfall 6: PDF — Fuentes no cargan (CORS en html2canvas)
**What goes wrong:** El PDF se genera pero las fuentes Sharp Grotesk y Nasalization aparecen como fallback (system-ui)
**Why it happens:** html2canvas intenta renderizar las fuentes custom locales. Si el servidor no tiene los headers CORS correctos para los archivos .otf, html2canvas no puede cargarlos.
**How to avoid:** Configurar `html2canvas: { useCORS: true }` y asegurar que Vercel sirva los assets de fuentes con header `Access-Control-Allow-Origin: *`. Alternativa: usar Source Sans 3 (Google Fonts, CORS OK) para el PDF y aceptar que Sharp Grotesk no aparezca.
**Warning signs:** PDF generado tiene texto en Arial/system-ui en vez de las fuentes de marca.

### Pitfall 7: Gemini fallback — datos sensibles en el prompt
**What goes wrong:** El proxy Vercel envia datos personales de leads (emails, telefono, RUTs) al API de Gemini
**Why it happens:** La funcion de fallback intenta dar "todo el contexto" a Gemini para mejores respuestas
**How to avoid:** En el proxy, solo enviar metricas AGREGADAS (conteos, porcentajes, fechas) — nunca datos PII de leads individuales. El contexto de Gemini debe ser: `{ total_leads: 45, hot_leads: 8, conversion_rate: "8.5%" }` — no los leads con nombre y email.
**Warning signs:** Prompt enviado a Gemini contiene campos `email`, `telefono`, `rut`.

---

## Code Examples

Verified patterns from official sources:

### Clerk JS Init (Vanilla, CDN)
```javascript
// Source: https://clerk.com/docs/quickstarts/javascript
// Colocar en cada pagina del dashboard

window.addEventListener('load', async function () {
  await Clerk.load();

  if (!Clerk.user) {
    window.location.href = '/app/login.html';
    return;
  }

  // Verificar que tiene una org activa
  const orgId = Clerk.session?.lastActiveOrganizationId;
  if (!orgId) {
    // Mostrar selector de org o pantalla de primer uso
    return;
  }

  initDashboard(Clerk.user, orgId);
});
```

### ConvexHttpClient con setAuth
```javascript
// Source: https://docs.convex.dev/api/classes/browser.ConvexHttpClient

// Inicializacion una vez
const convex = new ConvexHttpClient(CONVEX_URL);

// Antes de cada query — Clerk cachea el token si no expiro
const token = await Clerk.session.getToken({ template: 'convex' });
convex.setAuth(token);

// Query one-shot (DASH-07 compliant — no reactive subscription)
const leads = await convex.query(api.leads.getLeadsByOrg);

// Mutation
await convex.mutation(api.leads.updateLeadStatus, {
  leadId: "abc123",
  nuevoEstado: "en_progreso"
});
```

### Convex Auth Config (auth.config.ts)
```typescript
// Source: https://docs.convex.dev/auth/clerk
// convex/auth.config.ts

export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

### Schema Update para orgId
```typescript
// Source: Convex best practices — multi-tenant pattern
// convex/schema.ts (agregar a tabla leads existente)

leads: defineTable({
  orgId: v.string(),              // NUEVO: Clerk Organization ID
  estado: v.union(
    v.literal("sin_asignar"),
    v.literal("asignado"),
    v.literal("en_progreso"),
    v.literal("cerrado")
  ),
  subestado: v.optional(v.union(
    v.literal("ganado"),
    v.literal("perdido"),
    v.literal("descartado")
  )),
  asignadoA: v.optional(v.string()),   // Clerk userId del SDR
  auditTrail: v.optional(v.array(v.object({
    accion: v.string(),
    usuarioId: v.string(),
    usuarioNombre: v.string(),
    timestamp: v.number(),
  }))),
  // ... campos existentes (empresa, email, score, etc.)
})
.index("by_orgId", ["orgId"])
.index("by_orgId_estado", ["orgId", "estado"])
.index("by_orgId_asignadoA", ["orgId", "asignadoA"])
.index("by_orgId_score", ["orgId", "scoreCategory"]),
```

### Multi-Tenant Query Pattern
```typescript
// Source: https://docs.convex.dev/database/reading-data/indexes/
// convex/leads.ts

export const getLeadsByOrg = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const orgId = identity["org_id"] as string;
    if (!orgId) throw new Error("No active organization");

    return await ctx.db
      .query("leads")
      .withIndex("by_orgId", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(200);  // No traer tabla completa — max 200 leads
  },
});

export const updateLeadStatus = mutation({
  args: {
    leadId: v.id("leads"),
    nuevoEstado: v.union(
      v.literal("sin_asignar"),
      v.literal("asignado"),
      v.literal("en_progreso"),
      v.literal("cerrado")
    ),
    subestado: v.optional(v.union(
      v.literal("ganado"),
      v.literal("perdido"),
      v.literal("descartado")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const orgId = identity["org_id"] as string;

    const lead = await ctx.db.get(args.leadId);
    // Verificar que el lead pertenece a la org del usuario
    if (lead?.orgId !== orgId) throw new Error("Forbidden");

    await ctx.db.patch(args.leadId, {
      estado: args.nuevoEstado,
      subestado: args.subestado,
    });

    // Agregar al audit trail
    const currentTrail = lead.auditTrail || [];
    await ctx.db.patch(args.leadId, {
      auditTrail: [...currentTrail, {
        accion: `Estado cambiado a ${args.nuevoEstado}`,
        usuarioId: identity.subject,
        usuarioNombre: identity.name || "Usuario",
        timestamp: Date.now(),
      }]
    });
  },
});
```

### Gemini API fetch (via Vercel proxy)
```javascript
// Source: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
// api/gemini-query.js (Vercel serverless)

export default async function handler(req, res) {
  const { userQuery, roleContext, metricas } = req.body;

  const prompt = `Eres un asistente de ventas B2B chileno para rol ${roleContext}.
Pipeline metrics: ${JSON.stringify(metricas)}
Pregunta: "${userQuery}"
Responde en JSON: { "titulo": "str", "valor": "str", "narrativa": "str (max 2 oraciones)" }`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  res.status(200).json(JSON.parse(text));
}
```

### vercel.json para multi-page static app
```json
{
  "version": 2,
  "routes": [
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clerk React SDK obligatorio | Clerk JS SDK (vanilla) con CDN | 2024-2025 | Dashboards vanilla sin framework posibles |
| ConvexReactClient para todo | ConvexHttpClient para one-shot | 2024 | DASH-07 posible — no subscripciones en dashboard |
| Clerk session tokens v1 | Session tokens v2 (required) | Abril 2025 | V1 deprecated — usar token v2 en JWT template |
| html2canvas original | html2canvas-pro (en jspdf-html2canvas) | 2024 | Mejor performance y features extra |
| Gemini Pro | Gemini 2.5 Flash (stable) | 2025 | Mejor precio/performance, JSON mode nativo |

**Deprecated/outdated:**
- `gemini-2.5-flash-preview-09-2025`: Usar `gemini-2.5-flash` (stable) — la preview fue deprecada.
- Clerk session token v1: Deprecated abril 2025. Asegurar que el Clerk project este en v2.
- `ConvexReactClient` para vanilla JS: No aplica. Usar `ConvexHttpClient`.

---

## Open Questions

1. **Convex codebase existente — donde esta el proyecto Convex de SAAN?**
   - What we know: El STATE.md menciona funciones en `convex/leads.ts`, `convex/http.ts`, schema existente. Pero no se encontro la carpeta `convex/` en el working directory actual.
   - What's unclear: El proyecto Convex puede estar en un directorio separado o deployado directamente desde otro path.
   - Recommendation: Wave 0 debe comenzar con `npx convex dev --once` para localizar/crear el proyecto Convex y verificar el schema existente.

2. **Role detection: como sabe el dashboard que el usuario es CEO vs VP vs SDR?**
   - What we know: Clerk Organizations tiene Roles y Permissions configurables. El `orgRole` en el JWT puede ser custom.
   - What's unclear: Los roles en Clerk Organizations por defecto son `org:admin` y `org:member` — se necesita mapear a CEO/VP/SDR.
   - Recommendation: Crear custom roles en Clerk Dashboard (sisteco:ceo, sisteco:vp, sisteco:sdr) O usar un campo en la tabla `users` de Convex para almacenar el rol. La segunda opcion es mas flexible.

3. **Migration de leads existentes a orgId**
   - What we know: El schema actual no tiene `orgId`. Los leads existentes en Convex no tienen campo org.
   - What's unclear: Cuantos leads hay actualmente en produccion vs development.
   - Recommendation: Wave 0 incluir script de migracion que asigna `orgId = "default_org"` a todos los leads existentes, luego actualizar cuando haya clientes reales.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright CLI (disponible en `.claude/skills/playwright-cli/`) |
| Config file | `.playwright-cli/` (directorio de sesiones) |
| Quick run command | `playwright-cli open https://localhost:3000/app/ceo.html` + snapshots manuales |
| Full suite command | Script de verificacion visual con playwright-cli screenshots |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Login con Clerk redirige a /app/login.html si no autenticado | smoke | `playwright-cli open /app/ceo.html` → verificar redirect | ❌ Wave 0 |
| DASH-01 | Google OAuth abre popup de Google | manual | Click "Continuar con Google" en login.html | — |
| DASH-02 | Filtros de leads actualizan tabla sin recargar | integration | playwright-cli click filtro → snapshot tabla filtrada | ❌ Wave 0 |
| DASH-03 | KPIs muestran datos reales de Convex (no zeros) | smoke | playwright-cli eval `document.querySelector('.card-kpi-value').textContent` | ❌ Wave 1 |
| DASH-04 | Click en lead abre panel de detalle con datos reales | integration | playwright-cli click lead-row → snapshot panel | ❌ Wave 1 |
| DASH-05 | Org A NO puede ver leads de Org B | security | Login Org A → query leads → verificar solo Org A leads | ❌ Wave 0 |
| DASH-06 | Mobile 375px — command bar y tabla accesibles | visual | playwright-cli resize 375 812 → screenshot | ❌ Wave 4 |
| DASH-07 | No hay WebSocket connections abiertas | unit | playwright-cli network → verificar no WS connections | ❌ Wave 1 |

### Sampling Rate
- **Por tarea commit:** `playwright-cli open /app/{rol}.html` → screenshot visual
- **Por wave merge:** Script completo de smoke tests para los 3 roles
- **Phase gate:** Todos los DASH-XX verificados antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `convex/auth.config.ts` — Clerk integration, no existe aun
- [ ] `convex/schema.ts` update — agregar orgId, estados, auditTrail
- [ ] `shared/auth.js` — Clerk bootstrap para vanilla JS
- [ ] `shared/convex-client.js` — ConvexHttpClient wrapper
- [ ] `api/gemini-query.js` — Vercel serverless proxy
- [ ] `app/login.html` — Pagina de login con Clerk UI
- [ ] `vercel.json` — Multi-page routing config

---

## Sources

### Primary (HIGH confidence)
- [Clerk JS Quickstart](https://clerk.com/docs/quickstarts/javascript) — CDN init, Clerk.load(), getToken()
- [Clerk Session Object](https://clerk.com/docs/reference/javascript/session) — getToken() con template y organizationId
- [Convex + Clerk Auth](https://docs.convex.dev/auth/clerk) — auth.config.ts, getUserIdentity(), orgId claims
- [ConvexHttpClient API](https://docs.convex.dev/api/classes/browser.ConvexHttpClient) — setAuth(), query(), mutation()
- [Convex Auth in Functions](https://docs.convex.dev/auth/functions-auth) — getUserIdentity() pattern, custom claims
- [Convex Indexes](https://docs.convex.dev/database/reading-data/indexes/) — withIndex pattern, compound indexes, multi-tenant
- [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) — endpoint, responseMimeType, model name stable
- [Convex HTTP Actions + CORS](https://docs.convex.dev/functions/http-actions) — CORS headers en httpAction handlers

### Secondary (MEDIUM confidence)
- [html2pdf.js docs](https://ekoopmans.github.io/html2pdf.js/) — PDF generation CDN, options API
- [n8n Webhook docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) — POST trigger, Header Auth
- [Vercel CORS guide](https://vercel.com/kb/guide/how-to-enable-cors) — headers config en vercel.json
- [Clerk multi-tenant architecture](https://clerk.com/docs/guides/how-clerk-works/multi-tenant-architecture) — Organizations, orgId isolation
- Verified by multiple sources: `convex.setAuth(() => session.getToken({ template: 'convex' }))` pattern para Vue/vanilla

### Tertiary (LOW confidence — marcar para validacion)
- Role detection via Clerk custom roles (sisteco:ceo, sisteco:vp, sisteco:sdr) — necesita verificacion en Clerk Dashboard de como configurar custom roles en Organizations
- Gemini `responseMimeType: "application/json"` disponibilidad en gemini-2.5-flash stable — verificar en primera llamada real

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Clerk JS CDN, ConvexHttpClient, html2pdf.js todos verificados en fuentes oficiales
- Auth Architecture: HIGH — patron vanilla JS + Convex verificado en docs oficiales y comunidad Vue.js (analogia directa)
- Multi-tenant isolation: HIGH — withIndex + getUserIdentity patron documentado en Convex docs
- Gemini integration: MEDIUM — endpoint y formato verificados, pero model "gemini-2.5-flash" stable vs preview necesita prueba
- PDF generation: MEDIUM — html2pdf.js CDN verificado, limitacion de fuentes custom es LOW (un pitfall conocido pero no verificado para este stack especifico)
- Mobile UX: MEDIUM — CSS breakpoints ya en styles.css, FAB pattern es best practice pero implementacion especifica es discrecional

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 dias — Clerk y Convex cambian moderadamente)
