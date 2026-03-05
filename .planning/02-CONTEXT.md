# Phase 2 Context: HTTP Layer + Telegram Bot

**Created:** 2026-03-05
**Phase goal:** n8n puede leer/escribir datos en Convex via HTTP Actions, y el CEO interactua con los agentes via Telegram
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07

---

## Prior Decisions (from Phase 1 / PROJECT.md)

- Convex SAAN es proyecto independiente de la landing
- Telegram (NO Slack) para alertas y comunicacion CEO
- n8n self-hosted en Railway como motor de orquestacion
- Shared secret para auth n8n -> Convex
- Human-in-the-loop via toAgent:"human" en agentTasks

## Area A: HTTP Actions API Design

### Decisions

| Decision | Detail |
|----------|--------|
| Pattern | Hibrido: endpoint generico `POST /api/call` que recibe `{ function, args }` |
| Scope (Phase 2) | Solo funciones necesarias para Fase 2-3: `upsertAgentState`, `createTask`, `updateTaskStatus`, `saveMemory`, `send` (messages), `getAgentState`, `getAllAgentsState`, `getPendingTasks`, `getHumanPendingTasks`, `getHealthSnapshot` |
| Extensibility | El endpoint generico permite agregar mutations/queries futuras sin tocar http.ts — solo se agrega a un allowlist |
| HTTP method | POST con body para todo (mutations Y queries) — consistencia sobre convencion REST |
| Auth | Header `X-SAAN-Secret` validado contra env var `SAAN_API_SECRET` |
| Response format | Wrapper estandar: `{ ok: true, data: ... }` o `{ ok: false, error: "mensaje" }` |

### Implementation notes

- Crear `SAAN/convex/http.ts` con httpRouter de Convex
- El allowlist es un Map de nombre -> referencia a funcion
- n8n siempre llama a `https://<deployment>.convex.site/api/call` con el secret en header
- El orchestrator actual (`saan-orchestrator.json`) usa paths incorrectos (`/api/mutation`) — debe actualizarse

## Area B: Telegram Bot Interaction

### Decisions

| Decision | Detail |
|----------|--------|
| Formato mensajes | HTML (no Markdown) — mas predecible, sin conflictos con datos tecnicos |
| Identidad por agente | Emoji fijo + nombre: Monitor=magnifying glass, Finance=chart, Leads=target, etc. |
| Estructura mensaje | Secciones estandar: Header (emoji+agente+tipo), Separador, Detalle (bullets), Pasos sugeridos (si aplica), Severidad |
| Botones inline | SI en Fase 2 — Aprobar/Rechazar/Posponer para tareas human-in-the-loop |
| Callback de botones | Webhook en n8n que recibe callback_query de Telegram, actualiza agentTasks en Convex |
| Comando desconocido | Responde con sugerencia + lista de comandos disponibles via /help |
| Comandos Fase 2 | /status (estado agentes), /help (lista comandos), /health (servicios) |

### Message template (referencia para implementacion)

```
[EMOJI] [Agent Name] — [Tipo de mensaje]
---separador---

[Detalle con bullets]

Pasos sugeridos: (solo si hay problema)
1. Paso 1
2. Paso 2

Severidad: [CRITICAL/WARNING/INFO]
```

### Emojis por agente

| Agente | Emoji | Uso |
|--------|-------|-----|
| Monitor | magnifying glass | Health checks, alertas de servicios |
| Finance | bar chart | Metricas financieras, cobros |
| Leads | target | Prospectos, scoring |
| System | gear | Circuit breaker, cola, errores internos |
| Human tasks | clipboard | Tareas que requieren aprobacion CEO |

## Area C: Circuit Breaker

### Decisions

| Decision | Detail |
|----------|--------|
| Limites por agente | Monitor: 15/h, Leads: 10/h, Finance: 5/h, Default: 10/h |
| Activacion | Pausa automatica + alerta al CEO con boton Reactivar |
| Cooldown | Escalada progresiva: 1er trip=30min auto-reset, 2do=1h auto-reset, 3ero=manual obligatorio |
| Estado | En Convex, campo `metadata` de agentsState (campos: `circuitBreaker.tripCount`, `circuitBreaker.trippedAt`, `circuitBreaker.resetAt`) |
| Conteo | Contador de tareas creadas por agente en la ultima hora, consultado antes de cada createTask |

### Implementation notes

- Antes de cada `createTask`, el HTTP Action consulta cuantas tareas creo ese agente en la ultima hora
- Si excede el limite, rechaza la tarea y activa el breaker
- El cron de n8n verifica agentes pausados y ejecuta auto-reset segun el cooldown
- El boton Reactivar en Telegram llama al webhook de n8n que resetea el breaker en Convex

## Area D: Cola Telegram

### Decisions

| Decision | Detail |
|----------|--------|
| Storage | Nueva tabla `telegramQueue` en Convex schema |
| Consumo | Cron n8n cada 2-3 segundos lee la cola y envia |
| Consolidacion | Ventana de 30 segundos para WARNING/INFO. CRITICAL siempre inmediato (bypasea ventana) |
| Prioridad | CRITICAL > HIGH > NORMAL > LOW. CRITICAL va al frente de la cola |
| Reintentos | 3 intentos con backoff exponencial (2s, 4s, 8s) |
| Fallo | Marcar como `failed` en cola. Al recuperar conexion, enviar resumen de mensajes fallidos al CEO por Telegram |
| Visibilidad | Mensajes fallidos visibles en dashboard para detalle completo |

### Schema telegramQueue (referencia)

```
telegramQueue: {
  messageType: string,     // "alert" | "report" | "task" | "system"
  agentId: string,
  priority: string,        // "critical" | "high" | "normal" | "low"
  content: string,         // HTML formateado listo para enviar
  status: string,          // "pending" | "consolidated" | "sent" | "failed"
  retryCount: number,
  createdAt: number,
  sentAt: optional(number),
  consolidationWindow: optional(string),  // ID de ventana para agrupar
}
```

## Code Context (assets existentes relevantes)

| File | Relevancia para Fase 2 |
|------|----------------------|
| `SAAN/convex/schema.ts` | Agregar tabla `telegramQueue`. Modificar si se necesita campo en agentsState |
| `SAAN/convex/agents.ts` | Ya tiene upsertAgentState, createTask — exponer via HTTP Actions |
| `SAAN/convex/agentMessages.ts` | Ya tiene send, broadcast — exponer via HTTP Actions |
| `SAAN/convex/intelligence.ts` | Ya tiene recordHealthMetric, getHealthSnapshot — exponer via HTTP Actions |
| `SAAN/n8n-workflows/saan-orchestrator.json` | REEMPLAZAR — usa Slack y paths Convex incorrectos |

## Deferred Ideas

| Idea | Fase sugerida |
|------|---------------|
| Endpoints HTTP especificos por recurso (REST-like) | Fase 4+ si el generico se queda corto |
| Comandos Telegram avanzados (/leads, /mrr, /pause agent) | Fase 3-5 cuando existan esos agentes |
| Dashboard de cola Telegram con graficos de entrega | Fase 6 con Dashboard CEO |

## Scope Boundary

Esta fase construye SOLO:
1. `http.ts` con endpoint generico + auth
2. Telegram Bot con webhook a n8n + 3 comandos basicos + botones inline
3. Cola Telegram en Convex con consolidacion y prioridad
4. Circuit breaker en Convex con escalada
5. Actualizar orchestrator n8n (reemplazar Slack por Telegram, corregir paths Convex)

NO incluye: Monitor Agent (Fase 3), Leads Agent (Fase 4), Finance Agent (Fase 5), Dashboard funcional (Fase 6).

---
*Context created: 2026-03-05*
*Areas discussed: API Design, Telegram Bot, Circuit Breaker, Cola Telegram*
