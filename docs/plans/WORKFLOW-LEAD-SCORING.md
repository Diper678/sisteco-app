# Lead Scoring Pipeline — Workflow n8n

> Workflow: `Sisteco — Lead Scoring Pipeline`
> Archivo JSON: `docs/plans/n8n-lead-scoring-workflow.json`
> Ultima actualizacion: 2026-03-15

---

## 1. Resumen

Este workflow automatiza el scoring de leads extraidos de LinkedIn via PhantomBuster, usando una arquitectura de **2 capas de scoring**:

**Capa 1 — ICP Score (algoritmico, instantaneo, $0)**
Evalua cada lead contra el Perfil de Cliente Ideal (ICP) del cliente usando criterios ponderados: cargo (40%), industria (25%), ubicacion (15%) y calidad de datos (10%). Clasifica en HOT / WARM / NURTURE / SKIP.

**Capa 2 — Gemini Deep Score (IA, solo HOT leads)**
Solo los leads clasificados como HOT pasan por Gemini 2.0 Flash, que genera un segundo score con razonamiento contextual y una estrategia de contacto sugerida. Esto optimiza costos al no gastar tokens en leads de baja probabilidad.

**Resultado:** Los leads scored se escriben en Google Sheets (pipeline) y los HOT generan alertas instantaneas en Discord.

---

## 2. Arquitectura

```
Manual Trigger ──┐
                 ├──> Client Config ──> PB Fetch Output ──> Extract Result URL
Schedule (14:00) ┘                                              │
                                                     Download Leads
                                                          │
                                                     ICP Score
                                                          │
                                                  Has HOT Leads?
                                                   /          \
                                               true            false
                                                /                \
                                        Filter HOT Only      Skip Gemini
                                              │                   │
                                         Batch HOT                │
                                          /      \                │
                                    [loop]      [done]            │
                                       │           │              │
                                Gemini Deep     Merge Gemini      │
                                    Score       Results           │
                                       │           │              │
                                  Rate Limit       │              │
                                    (4s)           │              │
                                       │           │              │
                                   [back to       ─┴──────────────┘
                                    Batch]              │
                                                 Prepare Sheet Data
                                                        │
                                                 Update Pipeline
                                                   (G. Sheets)
                                                        │
                                                Has HOT to Notify?
                                                  /            \
                                              true              false
                                               /                  \
                                        Discord Alert        No Notification
```

---

## 3. Requisitos previos

### Instancia n8n
- URL: `sistecotest.app.n8n.cloud`
- Plan n8n Cloud o self-hosted con acceso a internet

### Variables de entorno (configurar en n8n Settings > Variables)

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `PB_API_KEY` | API Key de PhantomBuster | `4g2SqzX1xS4...` |
| `PB_AGENT_ID` | ID del agente LinkedIn Search Export | `510547627503326` |
| `GEMINI_API_KEY` | API Key de Google AI Studio | `AIzaSy...` |
| `DISCORD_WEBHOOK_URL` | Webhook del canal de alertas | `https://discord.com/api/webhooks/...` |
| `LEADS_SHEET_ID` | ID del Google Sheet del pipeline | `1o9edhOg3LJ...` |

### Credenciales en n8n
- **Google Sheets OAuth2**: Configurar en n8n > Credentials > Google Sheets. Necesita permisos de lectura/escritura al sheet del pipeline.

### Google Sheet preparado
Crear un Google Sheet con una hoja llamada `Leads` y estas columnas en la fila 1:

```
empresa | contacto | cargo | email | linkedin | website | industria | ubicacion | source | score | categoria | status | fecha
```

---

## 4. Importar workflow

1. Abrir n8n en `sistecotest.app.n8n.cloud`
2. Click en **"..."** (menu) > **Import from File**
3. Seleccionar `docs/plans/n8n-lead-scoring-workflow.json`
4. El workflow aparecera con todos los nodos conectados
5. **Configurar credencial Google Sheets:**
   - Click en el nodo "Update Pipeline"
   - En "Credential to connect with", seleccionar la credencial Google Sheets configurada
   - Guardar
6. **Verificar variables de entorno:**
   - Settings > Variables > confirmar que `PB_API_KEY`, `GEMINI_API_KEY`, etc. estan definidas
7. **Test manual:**
   - Click en "Test workflow" para ejecutar con el trigger manual
   - Verificar que los leads aparecen en el Google Sheet
8. **Activar:**
   - Toggle "Active" para que el Schedule Trigger corra diariamente a las 14:00 Chile

---

## 5. Configuracion por cliente

El nodo **"Client Config"** centraliza toda la parametrizacion. Para adaptar a un nuevo cliente, modificar estos campos:

| Campo | Tipo | Descripcion | Default |
|-------|------|-------------|---------|
| `pbApiKey` | string | API key de PhantomBuster | Env var `PB_API_KEY` |
| `pbAgentId` | string | ID del agente PB asignado al cliente | Env var `PB_AGENT_ID` |
| `geminiApiKey` | string | API key de Gemini | Env var `GEMINI_API_KEY` |
| `discordWebhook` | string | Webhook de Discord para alertas | Env var `DISCORD_WEBHOOK_URL` |
| `sheetId` | string | ID del Google Sheet del pipeline | Env var `LEADS_SHEET_ID` |
| `clientName` | string | Nombre del cliente (usado en prompts Gemini) | `"Sisteco"` |
| `hotThreshold` | number | Score minimo para clasificar como HOT | `80` |
| `warmThreshold` | number | Score minimo para clasificar como WARM | `50` |
| `useGemini` | boolean | Activar/desactivar Capa 2 (Gemini) | `true` |

**Para desactivar Gemini** (ej: ahorrar costos en fase inicial): cambiar `useGemini` a `false`. Los leads HOT se registraran sin AI score.

---

## 6. Nodos clave

### Triggers
- **Manual Trigger**: Para testing y ejecuciones ad-hoc.
- **Schedule Trigger**: Ejecuta automaticamente cada dia a las 14:00 hora Chile (America/Santiago).

### Extraccion de datos
- **PB Fetch Output**: Llama a la API v1 de PhantomBuster para obtener el ultimo resultado del agente LinkedIn Search Export.
- **Extract Result URL**: Parsea el `resultObject` de PB para extraer la URL del JSON con los leads.
- **Download Leads**: Descarga el archivo JSON de leads desde S3 (donde PB almacena resultados).

### Scoring
- **ICP Score**: Motor de scoring algoritmico completo. Evalua cargo, industria, ubicacion y calidad de datos. Clasifica en HOT/WARM/NURTURE/SKIP. Totalmente parametrizable.
- **Has HOT Leads?**: Bifurca el flujo. Solo los HOT pasan a Gemini.
- **Filter HOT Only**: Filtra leads que necesitan revision por IA.
- **Batch HOT**: Procesa HOT leads uno por uno para respetar rate limits de Gemini.
- **Gemini Deep Score**: Envia cada HOT lead a Gemini 2.0 Flash para un analisis contextual. Retorna aiScore, reasoning y suggested_approach.
- **Rate Limit**: Espera 4 segundos entre llamadas (15 RPM free tier Gemini).
- **Merge Gemini Results**: Combina el ICP score con el AI score en un objeto unificado.

### Output
- **Prepare Sheet Data**: Formatea los datos para las columnas del Google Sheet.
- **Update Pipeline**: Escribe los leads en Google Sheets (append).
- **Has HOT to Notify?**: Filtra solo HOT para notificacion.
- **Discord Alert**: Envia un embed rico a Discord con los datos del lead HOT.

---

## 7. Costos

### Por ejecucion (estimados)

| Componente | Costo por ejecucion | Notas |
|------------|---------------------|-------|
| PhantomBuster | $0 (ya incluido en $69/mes) | Plan Starter = 5h/dia de phantom |
| Gemini 2.0 Flash | ~$0.003 por HOT lead | Free tier: 15 RPM, 1M tokens/dia |
| Google Sheets API | $0 | Free |
| Discord Webhook | $0 | Free |
| n8n Cloud | $0 (ya incluido en plan) | Starter = 2,500 ejecuciones/mes |

### Estimacion mensual segun volumen

| Leads/dia | HOT estimados (15%) | Gemini calls/mes | Costo Gemini/mes | Total stack/mes |
|-----------|---------------------|-------------------|-------------------|-----------------|
| 50 | 7-8 | ~225 | ~$0.68 | $69 (PB) + n8n plan |
| 100 | 15 | ~450 | ~$1.35 | $69 (PB) + n8n plan |
| 500 | 75 | ~2,250 | ~$6.75 | $69 (PB) + n8n plan |
| 1,000 | 150 | ~4,500 | ~$13.50 | Upgrade PB a $159 |

**Conclusion:** El costo de IA es despreciable. El costo principal es PhantomBuster ($69/mes) y n8n Cloud.

---

## 8. Escalar a multi-cliente

### Opcion A: Un workflow por cliente (Simple)

**Cuando usar:** 1-5 clientes.

1. Duplicar el workflow en n8n (click derecho > Duplicate)
2. Renombrar a `[NombreCliente] — Lead Scoring Pipeline`
3. Modificar el nodo "Client Config" con los datos del cliente
4. Configurar un agente PB separado por cliente
5. Crear un Google Sheet separado por cliente
6. Ajustar horario del Schedule Trigger (ej: cliente A 14:00, cliente B 15:00)

**Pros:** Aislamiento total, facil de debugear.
**Contras:** Mas workflows que mantener, cambios deben replicarse manualmente.

### Opcion B: Workflow unico con loop de clientes (Avanzado)

**Cuando usar:** 5-20 clientes.

1. Crear un Google Sheet "master" con configuracion de cada cliente (una fila por cliente)
2. El primer nodo lee la lista de clientes
3. Un SplitInBatches itera sobre cada cliente
4. Cada iteracion usa la config del cliente actual
5. Un solo Schedule Trigger ejecuta todo

**Pros:** Un solo workflow, actualizaciones centralizadas.
**Contras:** Mas complejo de debugear, falla de un cliente puede afectar a otros.

### Opcion C: Webhook con parametro clientId (API-driven)

**Cuando usar:** 20+ clientes o integracion con dashboard.

1. Reemplazar triggers por un Webhook Trigger que recibe `{ clientId: "xxx" }`
2. El webhook busca la config del cliente en Convex o Google Sheets
3. El dashboard o un cron job externo dispara el webhook por cada cliente
4. Permite ejecucion on-demand desde la UI

**Pros:** Maximo control, integracion directa con el producto.
**Contras:** Requiere infraestructura adicional (API caller, cron externo).

---

## 9. Personalizar ICP

El ICP se define dentro del nodo **"ICP Score"** en la variable `ICP`. Para adaptar a un nuevo cliente:

### Modificar cargos objetivo

```javascript
titles: {
  hot: ['gerente de ventas', 'director comercial', ...],  // Score maximo
  warm: ['gerente comercial', 'sales manager', ...]       // Score medio
}
```

- **hot**: Cargos que son exactamente el decision-maker. Reciben 40 puntos.
- **warm**: Cargos influyentes pero no decisores directos. Reciben 25 puntos.

### Modificar industrias objetivo

```javascript
industries: {
  hot: ['information technology', 'financial services', ...],  // 25 puntos
  warm: ['logistics', 'retail', ...]                           // 15 puntos
}
```

Las industrias usan los nombres de LinkedIn en ingles (asi vienen de PhantomBuster).

### Modificar ubicaciones

```javascript
locations: {
  premium: ['santiago', 'las condes', 'providencia'],  // 15 puntos
  standard: ['chile']                                    // 10 puntos
}
```

Para clientes en otros paises, cambiar a las ciudades/regiones relevantes.

### Modificar pesos

```javascript
weights: { title: 40, industry: 25, location: 15, dataQuality: 10 }
```

Los pesos suman 90 puntos como maximo (10 adicionales vienen de calidad de datos). Un lead "perfecto" obtiene 100.

### Modificar umbrales

En el nodo "Client Config":
- `hotThreshold`: Minimo para ser HOT (default: 80). Bajar si se quieren mas leads HOT.
- `warmThreshold`: Minimo para ser WARM (default: 50). Subir si se quiere ser mas selectivo.

---

## 10. Troubleshooting

### Gemini retorna error 429 (Too Many Requests)

**Causa:** Se excedio el rate limit del free tier (15 RPM).
**Solucion:**
- Aumentar el Wait node de 4 a 6 segundos
- O upgradear a Gemini API de pago (Blaze plan, ~$0.10/1M tokens)
- El nodo tiene `continueOnFail: true`, asi que el workflow no se detiene, pero el lead no tendra AI score

### PhantomBuster retorna error o datos vacios

**Causa posible:** Session cookie de LinkedIn expirada.
**Solucion:**
1. Ir a PhantomBuster > el agente > Settings
2. Actualizar la session cookie de LinkedIn (ver `docs/PHANTOMBUSTER-LINKEDIN-SEARCH-GUIDE.md`)
3. Ejecutar el agente manualmente en PB para verificar
4. Re-ejecutar el workflow n8n

### Google Sheets error de autenticacion

**Causa:** Token OAuth2 expirado o permisos insuficientes.
**Solucion:**
1. n8n > Credentials > Google Sheets > "Reconnect"
2. Verificar que la cuenta tiene acceso de escritura al Sheet
3. Verificar que el Sheet ID en Client Config es correcto

### Discord webhook no envia mensajes

**Causa:** Webhook URL invalida o canal eliminado.
**Solucion:**
1. Ir a Discord > Server Settings > Integrations > Webhooks
2. Verificar que el webhook existe y apunta al canal correcto
3. Probar manualmente con curl:
```bash
curl -X POST "URL_DEL_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test desde n8n"}'
```

### El workflow ejecuta pero no aparecen leads en el Sheet

**Posibles causas:**
1. El agente PB no tiene resultados nuevos — verificar en PB dashboard
2. La URL del resultado JSON expiro (PB las mantiene ~24h) — re-ejecutar agente PB primero
3. Todos los leads fueron clasificados como SKIP — revisar los thresholds en Client Config
4. El nombre de la hoja no es exactamente "Leads" — verificar en Google Sheets (case sensitive)

### Los scores son todos bajos (< 50)

**Causa:** Los leads no matchean el ICP configurado.
**Solucion:**
1. Revisar que los cargos y industrias en el ICP coinciden con lo que devuelve PB
2. Los cargos de LinkedIn vienen en el idioma del perfil (pueden ser en ingles o espanol)
3. Considerar agregar mas variantes de cargos al array `titles.warm`
4. Temporalmente bajar `warmThreshold` a 40 para capturar mas leads

### Error "Cannot read property of undefined" en Extract Result URL

**Causa:** PhantomBuster no retorno un `resultObject` valido.
**Solucion:**
1. Verificar que el agente PB ha completado al menos una ejecucion exitosa
2. Revisar el output crudo del nodo "PB Fetch Output" en n8n (click en el nodo despues de ejecutar)
3. Si `data.resultObject` es null, el agente no genero resultados — revisar config en PB
