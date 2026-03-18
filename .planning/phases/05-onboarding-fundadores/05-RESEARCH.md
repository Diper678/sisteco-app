# Phase 05: Onboarding Clientes Fundadores — Research

**Researched:** 2026-03-18
**Domain:** SaaS trial provisioning, payment webhooks, Convex schema extensions, Clerk org automation, Resend transactional email
**Confidence:** HIGH (most from codebase inspection + official Reveniu/Clerk docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Area 1 — Trial y primera entrega de valor**
- Trial = 1 corrida del pipeline (PB + scoring + SII + Sheet). No recurrente. ~200-600 leads, ~100 HOT.
- Formulario ICP integrado: vive en landing page Y como link directo. Pregunta sector, mercado, tipo cliente, CRM, almacenamiento leads, setup correos, proceso ventas actual.
- Datos del formulario van a Convex.
- 14-15 dias de evaluacion. Max 1 corrida/semana si se extiende.
- White-glove setup: Sisteco configura todo. Cliente no configura nada.
- Precios CON IVA: Base ~$472, Crecimiento ~$949, Enterprise ~$2,142 USD.
- Conversion en trial = home run. Optimizar entrega con leads HOT primero.

**Area 2 — Flujo de pago (Reveniu)**
- Link Reveniu integrado en dashboard y emails automaticos. 3 links ya en .env (Base, Crecimiento, Enterprise).
- DPA se firma al pagar (no antes del trial).
- 7 dias de gracia en pago fallido — pipeline se pausa, datos se mantienen.
- Exit-intent descuento en pagina de precios.

**Area 3 — Secuencia de provisioning**
- Secuencia: formulario → Clerk org + acceso dashboard (inmediato) → Sisteco configura pipeline → pipeline corre 1 vez → Sheet entregada → 14-15 dias evaluacion → pago → DPA → pipeline recurrente.
- Cuenta Clerk se crea inmediatamente al llenar formulario.
- Automatizacion maxima — script/workflow que crea Sheet, configura PB, corre pipeline, notifica.
- Rate limit: max 1 corrida/semana por cliente.
- Entrega completa sin limitar artificialmente (~200-600 leads).
- Sheet es el entregable principal del trial. Dashboard es accesorio.

**Area 4 — Terminos programa fundadores**
- Setup gratuito para los 5 fundadores.
- Mensual sin contrato minimo.
- Todos los fundadores opt-in para caso de estudio.
- Programa cerrado a 5 fundadores.
- Post-fundadores: sistema de tickets (Discord + Notion).
- Exit-intent en pricing.

### Claude's Discretion

Nada marcado explicitamente como discretion — todas las areas tienen decisiones consolidadas.

### Deferred Ideas (OUT OF SCOPE)

- Automatizacion de cobros avanzada (dunning, retries via API) — post 5 fundadores
- Reveniu Enterprise / dLocal Go API — post 5 fundadores
- Sistema de tickets automatizado completo — post 5 fundadores (solo estructura inicial)
- Metrica ANA-01 a ANA-04 (benchmarking, prediccion, ROI calc) — v2 H2
- Sales Navigator upgrade — trigger: 3+ clientes pagando
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Cobro mensual via Reveniu (CLP, sin entidad legal) | Reveniu tiene webhooks de confirmacion de pago + 3 links de checkout ya en .env. El webhook `subscription_activated` confirma pago exitoso y activa el pipeline recurrente. |
| PAY-02 | Planes: Starter ($99.990 CLP), Growth ($249.990 CLP), Enterprise (custom) | Los 3 links de Reveniu (REVENIU_LINK_BASE_MONTHLY, REVENIU_LINK_GROWTH_MONTHLY, REVENIU_LINK_ENTERPRISE_MONTHLY) ya estan configurados en .env. Solo falta embedirlos en el dashboard y los emails. |
| PAY-03 | Trial de 14 dias con datos reales del prospecto | Requiere tabla `trialRequests` en Convex + logica de estado en el dashboard (banner "X dias restantes" + CTA de pago). El formulario publico es el punto de entrada. |
| PAY-04 | Metricas: MRR, churn, LTV calculados automaticamente | Requiere tabla `subscriptions` en Convex (plan, status, billing dates). MRR = suma de planes activos. Churn = subscriptions canceladas / activas. LTV = MRR / churn rate. Calculable desde Convex query. |
</phase_requirements>

---

## Summary

Esta fase construye la capa de monetizacion y provisioning sobre una base tecnica ya lista (dashboard, compliance, pipeline). El trabajo es conectar los extremos: el prospecto llena un formulario, Sisteco crea su cuenta Clerk, corre una corrida del pipeline, entrega una Google Sheet con leads scored, y al cabo de 14 dias ofrece conversion a pago mensual via Reveniu.

La arquitectura sigue el patron ya establecido en el proyecto: Convex como fuente de verdad, HTTP actions para endpoints publicos, `internalAction` para email via Resend, y n8n para orquestar el pipeline. No hay nuevas dependencias externas — todo reutiliza stack existente.

El mayor riesgo tecnico es la creacion de la cuenta Clerk de forma automatica. Clerk tiene Backend SDK (`@clerk/backend`) que permite crear organizaciones server-side desde un Node.js script o Convex action. Esto es necesario para que el prospecto tenga acceso al dashboard desde el dia 1 del trial sin intervencion manual de Felipe.

**Recomendacion primaria:** Construir en 3 waves: (1) schema + formulario publico, (2) provisioning automatico + trial dashboard, (3) pago Reveniu + DPA + activacion recurrente.

---

## Standard Stack

### Core (todo ya en el proyecto)

| Libreria | Version | Proposito | Estado |
|----------|---------|-----------|--------|
| Convex | 1.33.0 | Base de datos reactiva, schema extensions | Instalado |
| Clerk Backend SDK | via @clerk/backend | Crear orgs server-side (provisioning) | A instalar |
| Resend | (via Convex internalAction) | Emails transaccionales (bienvenida, trial, pago) | Patron establecido en compliance.ts |
| Google Sheets API | googleapis | Crear Sheet del cliente, poblar con leads scored | Instalado (scripts/sheets-manager.js) |
| Reveniu | checkout links | Cobro mensual CLP | 3 links en .env |

### Nuevas dependencias necesarias

| Paquete | Version | Proposito |
|---------|---------|-----------|
| `@clerk/backend` | latest | Crear organizaciones server-side desde script de provisioning |
| `@convex-dev/rate-limiter` | latest | Rate limit pipeline runs (max 1/semana por orgId) |

**Instalacion:**
```bash
npm install @clerk/backend @convex-dev/rate-limiter
```

**Verificar versiones actuales antes de usar:**
```bash
npm view @clerk/backend version
npm view @convex-dev/rate-limiter version
```

### Alternativas consideradas

| En vez de | Se podria usar | Tradeoff |
|-----------|---------------|---------|
| `@clerk/backend` en script Node.js | Clerk Dashboard manual | Elimina automatizacion — inaceptable para >2 fundadores |
| `@convex-dev/rate-limiter` | Campo `lastRunAt` en tabla + check manual | Mas simple pero no transaccional — race condition posible |
| Reveniu checkout links | dLocal Go API | dLocal requiere entidad legal y setup complejo — fuera de scope hasta 10+ clientes |

---

## Architecture Patterns

### Estructura de archivos nuevos en esta fase

```
convex/
├── schema.ts              # MODIFICAR: agregar subscriptions + trialRequests
├── subscriptions.ts       # NUEVO: CRUD subscriptions, calculo MRR/churn/LTV
├── trialRequests.ts       # NUEVO: intake del formulario publico
├── provisioning.ts        # NUEVO: orquestar creacion Clerk org + Sheet + pipeline
├── http.ts                # MODIFICAR: agregar /intake endpoint publico
scripts/
├── provision-trial.js     # NUEVO: script manual para provisioning white-glove
app/
├── pricing.html           # NUEVO o MODIFICAR landing: exit-intent popup + links Reveniu
├── shared/
│   └── trial-banner.js    # NUEVO: componente banner "X dias de trial" para dashboard
```

### Pattern 1: Formulario Publico → Convex HTTP Action

El formulario de intake vive en la landing page y envia a un endpoint publico en Convex HTTP router.

**Que hace:** POST a `/intake` → guarda en tabla `trialRequests` → dispara `internalAction` de provisioning

```typescript
// convex/http.ts — agregar a router existente
http.route({
  path: "/intake",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    // Validar campos requeridos
    const requestId = await ctx.runMutation(internal.trialRequests.create, { ...body });
    // Disparar provisioning asincronamente
    await ctx.runAction(internal.provisioning.startProvisioning, { requestId });
    return new Response(JSON.stringify({ ok: true, requestId }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
});
```

### Pattern 2: Provisioning Automatizado (Node.js script — MVP)

Para los 5 fundadores, el provisioning puede ser un script Node.js que Felipe ejecuta semi-manualmente. Esto es pragmatico: Clerk org creation requiere `createdBy` (un userId existente), lo que complica la automatizacion total desde Convex.

**Secuencia del script:**

```javascript
// scripts/provision-trial.js — uso: node scripts/provision-trial.js <requestId>
// 1. Leer trialRequest de Convex por requestId
// 2. Crear usuario en Clerk (si no existe) con su email
// 3. Crear organization en Clerk con nombre de la empresa
// 4. Agregar usuario como admin de la org
// 5. Crear Sheet en Google Drive para el cliente
// 6. Registrar spreadsheetId en Convex tabla tenantSheets
// 7. Crear registro en subscriptions (status: "trial")
// 8. Disparar corrida del pipeline via n8n webhook
// 9. Enviar email de bienvenida via Resend
// 10. Marcar trialRequest como provisioned
```

**Clerk Backend SDK — crear org:**
```javascript
// Source: https://clerk.com/docs/reference/backend/organization/create-organization
const { createClerkClient } = require('@clerk/backend');
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Crear usuario Clerk
const user = await clerk.users.createUser({
  emailAddress: [prospecto.email],
  firstName: prospecto.nombre.split(' ')[0],
  skipPasswordRequirement: true,
});

// Crear organization
const org = await clerk.organizations.createOrganization({
  name: prospecto.empresa,
  createdBy: user.id,
});

// org.id es el orgId que va en Convex (todos los documentos multi-tenant)
```

### Pattern 3: Tabla `subscriptions` en Convex

Nueva tabla central para PAY-01 a PAY-04. Vincula orgId con plan, estado de trial, y billing.

```typescript
// convex/schema.ts — agregar tabla subscriptions
subscriptions: defineTable({
  orgId: v.string(),
  // Plan
  plan: v.union(v.literal("base"), v.literal("crecimiento"), v.literal("enterprise")),
  status: v.union(
    v.literal("trial"),          // Trial activo (14-15 dias)
    v.literal("active"),         // Pagando mensualmente
    v.literal("grace"),          // Pago fallido, 7 dias de gracia
    v.literal("paused"),         // Pipeline pausado (grace expirado)
    v.literal("cancelled"),      // Cancelado por cliente
    v.literal("expired"),        // Trial expirado sin pago
  ),
  // Trial
  trialStartedAt: v.number(),
  trialEndsAt: v.number(),          // trialStartedAt + 14 dias
  // Billing
  reveniuSubscriptionId: v.optional(v.string()),  // ID de Reveniu al pagar
  billingEmail: v.string(),
  billingAmount: v.optional(v.number()),           // CLP con IVA
  billingCycle: v.optional(v.string()),            // "monthly"
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  // Pipeline rate limit
  lastPipelineRunAt: v.optional(v.number()),
  pipelineRunCount: v.number(),    // Total de corridas
  // DPA
  dpaSignedAt: v.optional(v.number()),
  dpaVersion: v.optional(v.string()),
  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_orgId", ["orgId"])
  .index("by_status", ["status"])
  .index("by_trialEndsAt", ["trialEndsAt"]),
```

### Pattern 4: Tabla `trialRequests` en Convex

Captura el formulario de intake antes de que exista un orgId (el prospect no es aun usuario).

```typescript
// convex/schema.ts — agregar tabla trialRequests
trialRequests: defineTable({
  // Identificacion
  nombre: v.string(),
  email: v.string(),
  empresa: v.string(),
  cargo: v.optional(v.string()),
  telefono: v.optional(v.string()),
  // ICP (para personalizar pipeline)
  sector: v.string(),             // industria del cliente
  mercado: v.string(),            // quien compra al cliente
  tipoclientes: v.string(),       // B2B / B2B2C / etc
  // Stack del cliente (para setup white-glove)
  crm: v.optional(v.string()),          // HubSpot, Pipedrive, Salesforce, nada
  almacenamientoLeads: v.optional(v.string()),  // Sheet, CRM, Excel, nada
  setupCorreos: v.optional(v.string()),         // Google Workspace, Outlook, etc
  procesoVentas: v.optional(v.string()),        // descripcion libre
  // Estado del provisioning
  status: v.union(
    v.literal("received"),        // Formulario recibido
    v.literal("provisioning"),    // Provisioning en curso
    v.literal("provisioned"),     // Todo listo, trial activo
    v.literal("error"),           // Error en provisioning
  ),
  // Resultado del provisioning
  clerkOrgId: v.optional(v.string()),
  clerkUserId: v.optional(v.string()),
  spreadsheetId: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  // Timestamps
  createdAt: v.number(),
  provisionedAt: v.optional(v.number()),
})
  .index("by_email", ["email"])
  .index("by_status", ["status"]),
```

### Pattern 5: Reveniu Webhook → Activar Subscription

Reveniu notifica via POST a endpoint publico cuando el pago se confirma. El mismo patron que ARCO-POL en http.ts.

```typescript
// convex/http.ts — agregar endpoint para webhook Reveniu
http.route({
  path: "/reveniu-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verificar Reveniu-Secret-Key header
    const secret = request.headers.get("Reveniu-Secret-Key");
    if (secret !== process.env.REVENIU_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    const event = await request.json();
    if (event.event === "subscription_activated") {
      await ctx.runMutation(internal.subscriptions.activateSubscription, {
        reveniuSubscriptionId: event.data.subscription_id,
        email: event.data.email,   // lookup por email para encontrar orgId
      });
    }
    return new Response("OK", { status: 200 });
  })
});
```

### Pattern 6: Trial Banner en el Dashboard

El dashboard existente necesita un banner que muestre el estado del trial. Este componente es JS vanilla (mismo patron que el resto del dashboard).

```javascript
// app/shared/trial-banner.js
// Carga subscription status desde Convex y muestra:
// - Trial activo: "Quedan X dias de tu trial gratuito — [Contratar ahora]"
// - Grace: "Tu pago falló — [Actualizar pago] — Pipeline pausado en X dias"
// - Expired: "Tu trial venció — [Ver planes]"
// Los links "Contratar" apuntan a los REVENIU_LINK_* del .env
```

### Anti-Patterns a Evitar

- **No crear org Clerk desde Convex Action directamente:** El SDK de Clerk no esta disponible en el runtime de Convex (V8). Usar script Node.js externo o Vercel Serverless Function.
- **No confiar en `subscription_external_id` de Reveniu como null inicial:** Siempre usar email del webhook para lookup del orgId en Convex.
- **No hacer pipeline run sincrono en el provisioning:** El run de PB tarda minutos. Disparar via n8n webhook y notificar al cliente por email cuando la Sheet este lista.
- **No olvidar el indice by_orgId en subscriptions:** Todas las queries deben filtrar por orgId primero — mismo patron que leads/users.

---

## Don't Hand-Roll

| Problema | No construir | Usar en cambio | Por que |
|----------|-------------|---------------|---------|
| Rate limiting pipeline por tenant | Campo `lastRunAt` + logica manual | `@convex-dev/rate-limiter` con key=orgId | Es transaccional y type-safe. El campo manual tiene race conditions. |
| Crear Clerk org server-side | API REST de Clerk directamente | `@clerk/backend` createOrganization() | SDK maneja auth, retry, tipos. La API REST requiere manejo manual de errores. |
| Crear Google Sheet para cliente | Codigo manual de Sheets API desde cero | `scripts/sheets-manager.js` ya existente | Ya probado, soporta create + share + template. Solo llamar: `node scripts/sheets-manager.js create --title "Leads [EMPRESA]"` |
| Calcular MRR/Churn/LTV | Queries complejas ad hoc | Query Convex desde tabla subscriptions | MRR = count(active) * avg(billingAmount). Churn = cancelled/active. Simple con los indices correctos. |
| Email de bienvenida HTML | Template HTML desde cero | Patron de compliance.ts (internalAction + Resend) | Patron completamente establecido en el proyecto. Solo agregar nuevo internalAction en compliance.ts o nuevo archivo. |

---

## Common Pitfalls

### Pitfall 1: Clerk `createdBy` requiere userId existente

**Que sale mal:** `createOrganization()` requiere un `createdBy` (userId de un usuario Clerk ya existente). No se puede crear una org sin primero crear o encontrar el usuario.

**Por que pasa:** El modelo de Clerk asume que siempre hay un humano creando la org.

**Como evitarlo:** En el script de provisioning: (1) buscar si el usuario ya existe por email con `clerk.users.getUserList({ emailAddress: [email] })`, (2) si no existe, crearlo con `createUser()`, (3) usar ese userId en `createOrganization({ createdBy: user.id })`.

**Senal de advertencia:** Error "User not found" o "createdBy is required" al crear org.

### Pitfall 2: Reveniu webhook no llega si el URL no es HTTPS publico

**Que sale mal:** El webhook de Reveniu solo funciona con URLs publicas HTTPS. En desarrollo local no funciona.

**Por que pasa:** Reveniu hace POST al URL configurado en el panel de administracion.

**Como evitarlo:** El endpoint `/reveniu-webhook` en Convex HTTP router ya es publico HTTPS (dominio `animated-pika-122.convex.cloud`). Configurar este URL en el panel Reveniu. Para tests usar la simulacion manual de Reveniu en su dashboard.

**Senal de advertencia:** El pago se completa en Reveniu pero la subscription en Convex no se activa.

### Pitfall 3: Race condition entre provisioning y primera carga del dashboard

**Que sale mal:** El prospecto recibe el email con el link al dashboard y entra antes de que el provisioning termine. Ve pantalla de error porque su orgId no tiene datos aun.

**Por que pasa:** El provisioning es asincrono (PB tarda varios minutos).

**Como evitarlo:** El dashboard debe manejar el estado "provisioning en curso" con un skeleton/loading state. Verificar `subscription.status === "trial"` antes de mostrar datos. Si no hay datos de leads aun, mostrar mensaje "Tu pipeline esta en curso, te avisamos por email cuando este listo."

**Senal de advertencia:** Usuarios que reportan "veo una pagina en blanco" o "error al cargar".

### Pitfall 4: DPA vacio en el trial — compliance

**Que sale mal:** Si se olvida recolectar el DPA al momento del pago, se opera sin acuerdo de tratamiento de datos, violando Ley 21.719 para los datos del cliente.

**Por que pasa:** El flujo de pago via link de Reveniu es directo y no incluye paso de firma de DPA automaticamente.

**Como evitarlo:** Antes de mostrar el link de Reveniu, mostrar el DPA para aceptar con checkbox. Guardar `dpaSignedAt` en Convex. Solo despues redirigir al link de Reveniu. Alternativa simple: email post-pago con DPA para firmar (aceptable para MVP con 5 fundadores).

**Senal de advertencia:** `subscription.dpaSignedAt` es null para suscripciones activas.

### Pitfall 5: Tasa de cambio USD/CLP en los precios con IVA

**Que sale mal:** Los precios en Reveniu estan en CLP pero los displayes en el dashboard pueden mostrar USD. Si no se aclara el tipo de cambio, el cliente puede sentirse engañado.

**Por que pasa:** Los precios de CONTEXT.md estan en USD pero el cobro es en CLP.

**Como evitarlo:** Siempre mostrar precios en CLP con IVA incluido. Los links de Reveniu ya tienen el precio en CLP configurado. En el dashboard solo mostrar "Plan Base $99.990 CLP/mes (IVA incluido)".

---

## Code Examples

### Crear Google Sheet para cliente fundador

```javascript
// Fuente: scripts/sheets-manager.js (existente, probado)
// Ejecutar desde scripts/provision-trial.js
const { execSync } = require('child_process');

function crearSheetCliente(empresaNombre, emailCliente) {
  const titulo = `Sisteco Leads — ${empresaNombre}`;
  const result = execSync(
    `node scripts/sheets-manager.js create --title "${titulo}" --sheets "HOT,WARM,NURTURE"`,
    { cwd: process.cwd(), encoding: 'utf-8' }
  );
  const sheet = JSON.parse(result);
  // Compartir con el cliente
  execSync(
    `node scripts/sheets-manager.js share --id ${sheet.spreadsheetId} --email ${emailCliente} --role reader`,
    { cwd: process.cwd(), encoding: 'utf-8' }
  );
  return sheet.spreadsheetId;
}
```

### Registrar tenantSheet en Convex (para compliance propagation)

```javascript
// Fuente: convex/schema.ts tabla tenantSheets (existente)
// Llamar desde provision-trial.js via Convex HTTP call
await fetch(`${CONVEX_SITE_URL}/api/call`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-SAAN-Secret': SAAN_API_SECRET,
  },
  body: JSON.stringify({
    path: 'tenantSheets:upsertTenantSheet',  // NUEVA funcion a crear
    args: { orgId, spreadsheetId, sheetName: 'HOT' }
  })
});
```

### Rate limit pipeline por orgId (Convex Component)

```typescript
// Source: https://www.convex.dev/components/rate-limiter
// convex/provisioning.ts
import { components } from './_generated/api';
import { RateLimiter } from '@convex-dev/rate-limiter';

const rateLimiter = new RateLimiter(components.rateLimiter, {
  pipelineRun: {
    kind: "fixed window",
    rate: 1,
    period: 7 * 24 * 60 * 60 * 1000,  // 1 por semana
  },
});

export const requestPipelineRun = mutation({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const { ok, retryAfter } = await rateLimiter.limit(ctx, "pipelineRun", {
      key: args.orgId,
    });
    if (!ok) {
      const days = Math.ceil(retryAfter! / (24 * 60 * 60 * 1000));
      throw new Error(`Rate limit: proxima corrida disponible en ${days} dias`);
    }
    // Actualizar lastPipelineRunAt
    await ctx.db.patch(subscriptionId, { lastPipelineRunAt: Date.now() });
    // Retornar confirmacion para que el script de provisioning dispare n8n
    return { ok: true };
  },
});
```

### MRR / Churn / LTV desde Convex query

```typescript
// convex/subscriptions.ts — calculo de metricas (PAY-04)
export const getMetrics = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db.query("subscriptions")
      .withIndex("by_status", q => q.eq("status", "active"))
      .collect();
    const cancelled = await ctx.db.query("subscriptions")
      .withIndex("by_status", q => q.eq("status", "cancelled"))
      .collect();
    const mrr = active.reduce((sum, s) => sum + (s.billingAmount ?? 0), 0);
    const churnRate = active.length > 0 ? cancelled.length / active.length : 0;
    const ltv = churnRate > 0 ? (mrr / active.length) / churnRate : 0;
    return { mrr, churnRate, ltv, activeCount: active.length, cancelledCount: cancelled.length };
  },
});
```

### Webhook Reveniu — verificar y activar

```typescript
// convex/http.ts — patron identico al de compliance
http.route({
  path: "/reveniu-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("Reveniu-Secret-Key");
    if (!secret || secret !== process.env.REVENIU_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    const event = await request.json();
    if (event.event === "subscription_activated") {
      await ctx.runMutation(internal.subscriptions.activateFromWebhook, {
        reveniuSubscriptionId: event.data.subscription_id,
        email: event.data.email ?? event.data.customer_email,
        plan: event.data.plan_name ?? "base",
        amount: event.data.amount,
      });
    }
    return new Response("OK", { status: 200 });
  }),
});
```

---

## State of the Art

| Approach Anterior | Approach Actual | Impacto |
|-------------------|-----------------|---------|
| Manual onboarding (email + PDF) | Semi-automated con scripts | Felipe ejecuta 1 comando por cliente |
| DPA en papel o PDF | DPA digital pre-pago | Flujo legible, aceptado con click |
| Pipeline recurrente sin rate limit | Rate limit 1/semana via Convex component | Previene abuso y controla costos |
| Reveniu sin webhook | Webhook activacion → Convex | Pipeline se activa automaticamente al pagar |
| Google Sheet creada manualmente | `sheets-manager.js` automatizado | 5 minutos → 30 segundos |

---

## Open Questions

1. **REVENIU_WEBHOOK_SECRET configurado?**
   - Lo que sabemos: Hay 3 links de checkout en .env (`REVENIU_LINK_*`). No hay `REVENIU_WEBHOOK_SECRET` visible.
   - Brecha: Sin este secret, el webhook no puede verificarse.
   - Recomendacion: Wave 0 — verificar en `.env` si existe el secret. Si no, configurarlo en el panel de Reveniu y agregar la variable.

2. **Clerk: JWT template "convex" con org_id**
   - Lo que sabemos: STATE.md lista esto como un bloqueante: "Clerk Organizations: activar en Clerk Dashboard + crear JWT template 'convex' con claim org_id = {{org.id}}".
   - Brecha: Si el JWT template no esta configurado, el `getUserIdentity()` en Convex no retornara `org_id` y el dashboard no funcionara para el nuevo cliente.
   - Recomendacion: Plan 1 debe verificar o configurar este JWT template antes de cualquier otra cosa.

3. **Integracion n8n → corrida para cliente especifico**
   - Lo que sabemos: El pipeline actual corre para todos los leads. Para el trial, necesita correr con el ICP del cliente especifico y depositar en el spreadsheetId del cliente.
   - Brecha: El workflow de n8n actual no tiene parametros por-cliente.
   - Recomendacion: El provisioning envia un webhook a n8n con `{ orgId, spreadsheetId, icpConfig }`. n8n corre el pipeline con esos parametros y deposita en la Sheet del cliente.

4. **Email del usuario Clerk vs email del formulario**
   - Lo que sabemos: El formulario captura email del prospecto. La cuenta Clerk se crea con ese email.
   - Brecha: Si el prospecto ya tiene cuenta Clerk (por algun motivo), `createUser()` fallara por email duplicado.
   - Recomendacion: Siempre buscar primero con `getUserList({ emailAddress })` antes de crear.

---

## Validation Architecture

> nyquist_validation = true en config.json — seccion requerida.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js scripts (no test runner formal en este proyecto) |
| Config file | package.json scripts (ninguno de "test" actualmente) |
| Quick run command | `node scripts/test-compliance.js` (patron existente) |
| Full suite command | Verificacion manual UAT (patron de Phase 4) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Webhook Reveniu activa subscription en Convex | integration | `node scripts/test-reveniu-webhook.js` | ❌ Wave 0 |
| PAY-02 | Links de Reveniu correctos en dashboard y emails | smoke | `node scripts/test-plan-links.js` | ❌ Wave 0 |
| PAY-03 | Trial de 14 dias — estado correcto, banner visible | unit | `node scripts/test-trial-status.js` | ❌ Wave 0 |
| PAY-04 | MRR/Churn/LTV calculan correctamente con datos seed | unit | `node scripts/test-metrics.js` | ❌ Wave 0 |

### Sampling Rate

- **Por task commit:** `node scripts/test-compliance.js` (verifica endpoints HTTP existentes — regresion rapida)
- **Por wave merge:** Todos los scripts de test de esta fase
- **Phase gate:** UAT manual con un trial real antes de `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/test-reveniu-webhook.js` — simula POST al endpoint /reveniu-webhook con payload de prueba
- [ ] `scripts/test-trial-status.js` — verifica logica de dias restantes y estado de trial
- [ ] `scripts/test-plan-links.js` — verifica que REVENIU_LINK_* esten presentes en .env y sean URLs validas
- [ ] `scripts/test-metrics.js` — seed de subscriptions y verifica calculo MRR/churn/LTV
- [ ] `REVENIU_WEBHOOK_SECRET` en .env — si no existe, configurar antes de Wave 1

---

## Sources

### Primary (HIGH confidence)

- Inspeccion directa de `convex/schema.ts` — estado actual de todas las tablas Convex
- Inspeccion directa de `convex/http.ts` — patron establecido de endpoints publicos + CORS + internalAction
- Inspeccion directa de `convex/compliance.ts` — patron de email via Resend (internalAction)
- Inspeccion directa de `scripts/sheets-manager.js` — API de Google Sheets ya funcional
- Inspeccion directa de `.env` (keys redactadas) — confirma presencia de REVENIU_LINK_*, RESEND_API_KEY, GOOGLE_REFRESH_TOKEN
- [Reveniu Webhooks Docs](https://docs.reveniu.com/api-recursos/webhooks) — eventos, payload, verificacion de secret
- [Reveniu Subscriptions Docs](https://docs.reveniu.com/api-recursos/suscripciones) — lifecycle de suscripciones
- [Clerk createOrganization](https://clerk.com/docs/reference/backend/organization/create-organization) — parametros requeridos (name + createdBy)

### Secondary (MEDIUM confidence)

- [Convex Rate Limiter Component](https://stack.convex.dev/rate-limiting) — patron rate limit con key por orgId
- [Clerk Webhooks + Convex](https://clerk.com/blog/webhooks-data-sync-convex) — patron httpAction para eventos Clerk
- `.claude/skills/sales-pipeline.md` — arquitectura n8n + Convex ya documentada y probada

### Tertiary (LOW confidence)

- Nada en esta categoria — toda la investigacion fue verificada con fuentes primarias o codebase existente.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — todo verificado en codebase + docs oficiales
- Architecture: HIGH — sigue patrones establecidos en fases 3 y 4
- Pitfalls: HIGH — identificados desde experiencia del proyecto (STATE.md blockers) + logica del sistema
- Reveniu webhooks: MEDIUM — docs leidos, pero no verificado con prueba real

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stack estable; Reveniu docs pueden cambiar si publican nueva version de API)
