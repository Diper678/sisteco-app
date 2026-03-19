# Setup Manual — Pipeline de Leads B2B Sisteco

> Guia consolidada de todo lo que falta configurar manualmente.
> Tiempo estimado: ~30 minutos.
> Fecha: 2026-03-10

---

## Estado actual

| Componente | Estado |
|------------|--------|
| Workflows n8n (6 pipeline) | ✅ Importados (inactivos) |
| Convex deployment | ✅ Activo |
| PhantomBuster API | ✅ Configurado |
| Firecrawl API | ✅ Configurado |
| Scripts de import/update | ✅ Listos |
| Gemini API key | ❌ Pendiente |
| SimpleAPI key | ❌ Pendiente |
| Discord webhook | ❌ Pendiente |
| PhantomBuster search config | ❌ Pendiente |
| Activacion de workflows | ❌ Pendiente |

---

## Paso 1: Obtener API keys pendientes (~10 min)

### 1.1 Gemini API Key
1. Ir a [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Copiar la key (empieza con `AIza...`)
4. Pegarla en `.env` → `GEMINI_API_KEY=`

### 1.2 SimpleAPI Key (SII/RUT)
1. Ir a [SimpleAPI.cl](https://www.simpleapi.cl)
2. Crear cuenta o iniciar sesion
3. Ir a Mi Cuenta → API Key → copiar
4. Pegarla en `.env` → `SIMPLE_API_KEY=`
5. **Nota:** Free tier = 10 consultas/mes. Suficiente para MVP.

### 1.3 Discord Webhook
1. Ir a tu servidor de Discord
2. Ir al canal donde quieres recibir alertas de leads HOT
3. Click derecho → **Editar Canal** → **Integraciones** → **Webhooks**
4. Click **Nuevo Webhook** → nombre: "Sisteco Leads"
5. Click **Copiar URL del Webhook**
6. Pegarla en `.env` → `DISCORD_WEBHOOK_URL=`
7. **Verificar** (pegar en terminal):
   ```bash
   curl -X POST "TU_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content":"Test: Pipeline de leads Sisteco activado"}'
   ```

---

## Paso 2: Configurar PhantomBuster (~10 min)

### 2.1 Cookie de LinkedIn
1. Abrir LinkedIn en Chrome
2. F12 → Application → Cookies → linkedin.com
3. Buscar cookie `li_at` → copiar su valor
4. Ir a [PhantomBuster](https://phantombuster.com) → tu phantom (ID: 510547627503326)
5. En configuracion del phantom → pegar la cookie `li_at`

### 2.2 Search URL con filtros Chile B2B
1. Ir a LinkedIn → barra de busqueda
2. Buscar con keywords relevantes, ejemplo:
   - **Keywords:** `Director Comercial` o `Gerente Ventas` o `CEO` o `VP Sales`
   - **Ubicacion:** Chile
   - **Filtro People**
3. Copiar la URL completa de la busqueda
4. Pegarla en la configuracion del phantom en PhantomBuster → "Search URL"

### 2.3 Configurar schedule
1. En PhantomBuster → phantom settings → Schedule
2. Configurar: Lunes, Miercoles, Viernes a las 07:00 (Chile)
3. Max profiles per run: 25

---

## Paso 3: Actualizar credenciales en n8n (~5 min)

Una vez que tengas las 3 keys pendientes, ejecutar:

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
node scripts/n8n-update-config.js
```

**Antes de ejecutar**, editar `scripts/n8n-update-config.js` y llenar:
- `GEMINI_API_KEY: 'tu-key-aqui'`
- `SIMPLE_API_KEY: 'tu-key-aqui'`
- `DISCORD_WEBHOOK_URL: 'tu-webhook-url-aqui'`
- `PB_LINKEDIN_SEARCH_URL: 'tu-url-busqueda-linkedin'`

El script reemplaza todas las referencias `$vars.XXX` en los workflows de n8n con los valores reales.

---

## Paso 4: Activar workflows en orden (~5 min)

**IMPORTANTE:** Seguir este orden exacto.

### Primero: Enrichment (procesamiento intermedio)
```
1. Activar: SAAN Leads Enrich — Firecrawl Scrape
2. Activar: SAAN Leads Enrich — SII SimpleAPI
3. Esperar 1 ciclo (~2h) y verificar en n8n Executions que no hay errores
```

### Segundo: Scoring
```
4. Activar: SAAN Leads Score AI (Gemini)
5. Esperar 1 ciclo (~3h) y verificar
```

### Tercero: Notificaciones
```
6. Activar: SAAN Leads Notify HOT (Discord)
```

### Cuarto: Discovery (entrada de leads)
```
7. Activar: SAAN Leads Discover — Firecrawl Search
8. Verificar que produce leads correctamente
9. Activar: SAAN Leads Discover — PhantomBuster LinkedIn
```

---

## Paso 5: Test end-to-end (~5 min)

### Test rapido
1. Ir a Convex Dashboard → Data → leads
2. Insertar lead de prueba:
   ```json
   {
     "empresa": "Test Corp",
     "websiteUrl": "https://example.com",
     "status": "new",
     "source": "manual_test"
   }
   ```
3. Esperar ciclo de enrichment → verificar `status: "enriched"`
4. Esperar ciclo de scoring → verificar `score` y `scoreCategory`
5. Si es HOT → verificar que llega a Discord

### Test Discord directo
1. En n8n → workflow "SAAN Leads Notify HOT" → ejecutar manualmente
2. Si no hay leads HOT, crear uno en Convex con `scoreCategory: "HOT"`, `status: "scored"`

---

## Paso 6: Monitoreo 24h

- [ ] Dejar todos los workflows activos por 24h
- [ ] Revisar n8n → Executions para errores
- [ ] Verificar que la tabla `leads` tiene nuevas entradas
- [ ] Confirmar que no hay ejecuciones fallidas repetitivas

---

## Workflows en n8n (ya importados)

| ID | Nombre | Estado |
|----|--------|--------|
| HNQY3FVG3qVPNruj | SAAN Leads Discover — PhantomBuster LinkedIn | INACTIVO |
| PUsrt0WTA8UXh6oR | SAAN Leads Discover — Firecrawl Search | INACTIVO |
| oy9dSo9H46Z1XQqF | SAAN Leads Enrich — Firecrawl Scrape | INACTIVO |
| zHiz8g5LuEKz650V | SAAN Leads Enrich — SII SimpleAPI | INACTIVO |
| Lx5tMu3pBHPhUt5P | SAAN Leads Score AI (Gemini) | INACTIVO |
| 8zSsCKg9PxDopxv6 | SAAN Leads Notify HOT (Discord) | INACTIVO |

**Legacy (no activar):**
| l5m4hBEqp6XLK8r9 | LinkedIn Lead Scoring - Phantombuster + Gemini | LEGACY |
| HfSEueNxQ3awHJ1k | Facturacion Automatica | FUTURO |
| kUTcarSlqXEaLSJ3 | B2B Prospecting - Secuencia 5 Emails | LEGACY |

---

## Schedule post-activacion

| Workflow | Frecuencia | Hora (Chile) |
|----------|------------|--------------|
| PhantomBuster Discovery | Lun/Mie/Vie | 07:00 |
| Firecrawl Discovery | Diario | 06:00 |
| Firecrawl Enrichment | Cada 2 horas | 00:00, 02:00, ... |
| SII Enrichment | Cada 4 horas | 00:00, 04:00, ... |
| AI Scoring (Gemini) | Cada 3 horas | 01:00, 04:00, 07:00, ... |
| Discord Notifications | Cada 30 minutos | :00, :30 |

---

## Costos mensuales

| Servicio | Costo |
|----------|-------|
| PhantomBuster (Starter) | $69 USD |
| Firecrawl (Free 500 credits) | $0 |
| SimpleAPI (Free 10 queries) | $0 |
| Gemini Flash Lite | ~$0.50 |
| Discord | $0 |
| n8n Cloud | ~$20 |
| **Total** | **~$90 USD/mes** |

---

## Troubleshooting

### "Authentication failed" en Convex
- Verificar `SAAN_API_SECRET` en n8n = valor en Convex Environment Variables
- Verificar `SAAN_CONVEX_SITE_URL` sin trailing slash

### PhantomBuster no produce resultados
- Verificar cookie `li_at` vigente (expira periodicamente)
- Probar URL de busqueda directamente en LinkedIn

### Discord no envia mensajes
- Verificar webhook URL con curl manual
- Verificar que el canal existe y el webhook no fue eliminado

### SimpleAPI rate limit
- Free: 10 consultas/mes
- Workflow tiene rate limiting integrado
- Si se agotan, loguea error pero no falla

---

## Archivo .env

Todas las credenciales estan centralizadas en:
```
C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company/.env
```

Los scripts `n8n-import.js` y `n8n-update-config.js` usan la API key de n8n directamente (hardcodeada por ahora, ya que no hay git remote).

---

*Generado: 2026-03-10*
