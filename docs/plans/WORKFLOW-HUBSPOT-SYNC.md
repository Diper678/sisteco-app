# HubSpot CRM Sync — Workflow n8n (T5)

> Workflow: `Sisteco — HubSpot CRM Sync`
> Archivo JSON: `docs/plans/n8n-hubspot-sync-workflow.json`
> Plan: Crecimiento ($797/mo)
> Ultima actualizacion: 2026-03-15

---

## 1. Resumen

Este workflow sincroniza automaticamente los leads scored del pipeline de Sisteco hacia el HubSpot CRM del cliente. Se ejecuta cada 2 horas y procesa unicamente leads HOT y WARM que estan por encima del umbral de score configurado.

**Que hace:**
- Lee leads con status "Nuevo" o "Prioridad" del Google Sheet del pipeline
- Filtra por score >= threshold (default: 50) y categoria HOT/WARM
- Busca cada lead en HubSpot por email (o LinkedIn URL como fallback)
- Si el contacto existe: actualiza score, categoria y lifecycle stage
- Si no existe: crea contacto + deal (solo HOT) con asignacion round-robin a sales reps
- Actualiza el Google Sheet con status "Synced to CRM" + HubSpot IDs
- Envia alerta a Discord cuando se sincronizan leads HOT

**Resultado:** El CRM del cliente se mantiene sincronizado con el pipeline de Sisteco sin intervencion manual.

---

## 2. Arquitectura

```
Manual Trigger ──┐
                 ├──> Client Config ──> Read Leads Sheet ──> Filter Eligible Leads
Schedule (2h)  ──┘                                                  │
                                                           Has Eligible Leads?
                                                            /              \
                                                        true               false
                                                         /                   \
                                                    Loop Leads         No Eligible — Done
                                                     /       \
                                               [done]         [each lead]
                                                 │                │
                                          Build Summary     Prepare Search
                                                 │                │
                                         Has HOT Synced?    Has Identifier?
                                          /          \       /           \
                                       true         false  true          false
                                        /             \     /              \
                                  Discord Alert   Done   HubSpot       Skip No
                                                        Search          Identifier
                                                        Contact            │
                                                          │                │
                                                   Check Contact           │
                                                      Exists              │
                                                          │                │
                                                   Contact Exists?         │
                                                    /           \          │
                                                true            false      │
                                                 /                \        │
                                          HubSpot Update    HubSpot Create │
                                            Contact           Contact      │
                                               │                │         │
                                          Mark Updated    Extract Contact  │
                                               │              ID          │
                                               │               │          │
                                               │          Needs Deal?     │
                                               │           /       \      │
                                               │        true      false   │
                                               │         /          \     │
                                               │  HubSpot Create  Skip   │
                                               │     Deal         Deal   │
                                               │        │           │    │
                                               │    Assign Rep      │    │
                                               │        │           │    │
                                               └───> Prepare Sync Result <┘
                                                          │
                                                   Update Sheet Status
                                                          │
                                                     Rate Limit (0.5s)
                                                          │
                                                    [back to Loop]
```

---

## 3. Requisitos previos

### Instancia n8n
- URL: `sistecotest.app.n8n.cloud`
- Plan n8n Cloud o self-hosted con acceso a internet

### Cuenta HubSpot del cliente
- Plan: Free CRM o superior
- Private App Token con scopes:
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.objects.deals.read`
  - `crm.objects.deals.write`
- Propiedades custom creadas (ver seccion 5)

### Variables de entorno (configurar en n8n Settings > Variables)

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `HUBSPOT_API_KEY` | Private App Token de HubSpot del cliente | `pat-na1-xxxx...` |
| `LEADS_SHEET_ID` | ID del Google Sheet del pipeline | `1o9edhOg3LJ...` |
| `DISCORD_WEBHOOK_URL` | Webhook del canal de alertas | `https://discord.com/api/webhooks/...` |

### Credenciales en n8n
- **Google Sheets OAuth2**: Configurar en n8n > Credentials > Google Sheets. Necesita permisos de lectura/escritura al sheet del pipeline.

### Google Sheet preparado
El sheet debe tener la hoja `Leads` con estas columnas (ademas de las standard del pipeline):

```
empresa | contacto | cargo | email | linkedin | website | industria | ubicacion | source | score | categoria | status | fecha | hubspot_contact_id | hubspot_deal_id | sync_date | assigned_rep
```

Las ultimas 4 columnas son escritas por este workflow. Agregarlas vacias si no existen.

---

## 4. Importar workflow

1. Abrir n8n en `sistecotest.app.n8n.cloud`
2. Click en **"..."** (menu) > **Import from File**
3. Seleccionar `docs/plans/n8n-hubspot-sync-workflow.json`
4. El workflow aparecera con 29 nodos conectados
5. **Configurar credencial Google Sheets:**
   - Click en los nodos "Read Leads Sheet" y "Update Sheet Status"
   - En "Credential to connect with", seleccionar la credencial Google Sheets configurada
6. **Configurar Client Config:**
   - Click en el nodo "Client Config"
   - Actualizar `hubspotApiKey`, `sheetId`, `discordWebhook`, `salesReps` y `clientName`
7. **Test manual:**
   - Click en "Test workflow" para ejecutar con el trigger manual
   - Verificar que los leads aparecen en HubSpot y el sheet se actualiza
8. **Activar:**
   - Toggle "Active" para que el Schedule Trigger corra cada 2 horas

---

## 5. Propiedades custom en HubSpot

Antes de la primera ejecucion, crear estas propiedades custom en HubSpot:

### En Contactos (Settings > Properties > Contact properties)

| Propiedad | Internal name | Tipo | Descripcion |
|-----------|--------------|------|-------------|
| Sisteco Score | `sisteco_score` | Number | Score ICP del pipeline (0-100) |
| Sisteco Categoria | `sisteco_categoria` | Single-line text | HOT, WARM, NURTURE |
| Sisteco Sync Date | `sisteco_sync_date` | Date | Fecha de ultima sincronizacion |

### En Deals (Settings > Properties > Deal properties)

| Propiedad | Internal name | Tipo | Descripcion |
|-----------|--------------|------|-------------|
| Sisteco Score | `sisteco_score` | Number | Score del lead asociado |

**Nota:** Si no se crean estas propiedades, HubSpot las ignorara silenciosamente (no generara error). Los campos standard (email, firstname, etc.) funcionan sin configuracion adicional.

---

## 6. Configuracion por cliente

El nodo **"Client Config"** centraliza toda la parametrizacion:

| Campo | Tipo | Descripcion | Default |
|-------|------|-------------|---------|
| `hubspotApiKey` | string | Private App Token de HubSpot | Env var `HUBSPOT_API_KEY` |
| `sheetId` | string | ID del Google Sheet del pipeline | Env var `LEADS_SHEET_ID` |
| `syncThreshold` | number | Score minimo para sincronizar | `50` |
| `discordWebhook` | string | Webhook de Discord para alertas | Env var `DISCORD_WEBHOOK_URL` |
| `assignmentRule` | string | Regla de asignacion: `round-robin` | `"round-robin"` |
| `salesReps` | array | Emails de los vendedores del cliente | `["rep1@client.com", "rep2@client.com"]` |
| `clientName` | string | Nombre del cliente (usado en alertas) | `"ClientName"` |

---

## 7. Mapeo de campos Sisteco a HubSpot

### Contactos

| Campo Sisteco | Propiedad HubSpot | Notas |
|---------------|-------------------|-------|
| `empresa` | `company` | Nombre de la empresa |
| `contacto` | `firstname` + `lastname` | Se divide automaticamente por espacio |
| `cargo` | `jobtitle` | Titulo del cargo |
| `email` | `email` | Identificador primario de deduplicacion |
| `linkedin` | `hs_linkedin_url` | Identificador fallback si no hay email |
| `website` | `website` | URL de la empresa |
| `industria` | `industry` | Industria del lead |
| `ubicacion` | `city` | Ciudad / ubicacion |
| `score` | `sisteco_score` (custom) | Score ICP 0-100 |
| `categoria` | `lifecyclestage` | HOT = salesqualifiedlead, WARM = marketingqualifiedlead |
| — | `hs_lead_status` | HOT = OPEN, WARM = IN_PROGRESS |
| — | `lead_source` | "Sisteco Pipeline" (solo en creacion) |

### Deals (solo para HOT leads nuevos)

| Campo | Valor |
|-------|-------|
| `dealname` | "[Empresa] — Oportunidad Sisteco" |
| `pipeline` | default |
| `dealstage` | appointmentscheduled |
| `amount` | 0 (a completar por el vendedor) |
| `description` | Info del lead + score + categoria |
| Asociacion | Contacto recien creado (associationTypeId: 3) |

---

## 8. Nodos clave

### Triggers
- **Manual Trigger**: Para testing y ejecuciones ad-hoc.
- **Schedule Trigger**: Ejecuta automaticamente cada 2 horas (America/Santiago).

### Lectura y filtrado
- **Read Leads Sheet**: Lee todas las filas del sheet `Leads`.
- **Filter Eligible Leads**: Filtra por status (Nuevo/Prioridad) + score >= threshold + categoria (HOT/WARM). Divide `contacto` en firstname/lastname y mapea categoria a lifecyclestage.
- **Has Eligible Leads?**: Cortocircuita si no hay leads que sincronizar.

### Loop de sincronizacion
- **Loop Leads**: Procesa leads uno por uno (batchSize: 1) para respetar rate limits.
- **Prepare Search**: Determina si buscar por email (preferido) o LinkedIn URL (fallback).
- **Has Identifier?**: Salta leads sin email ni LinkedIn.

### Deduplicacion HubSpot
- **HubSpot Search Contact**: Usa la API Search v3 para buscar contacto existente por email o LinkedIn URL.
- **Check Contact Exists**: Evalua si la busqueda retorno resultados.
- **Contact Exists?**: Bifurca entre update y create.

### Creacion / Actualizacion
- **HubSpot Update Contact**: PATCH al contacto existente con score, categoria y lifecyclestage actualizados.
- **HubSpot Create Contact**: POST para crear contacto nuevo con todos los campos mapeados.
- **Extract Contact ID**: Extrae el ID del contacto recien creado para asociar al deal.
- **Needs Deal?**: Solo HOT leads recien creados generan deal.
- **HubSpot Create Deal**: Crea deal asociado al contacto con nombre "[Empresa] — Oportunidad Sisteco".
- **Assign Rep**: Asigna vendedor por round-robin del array `salesReps`.

### Tracking y output
- **Prepare Sync Result**: Unifica datos de todas las ramas (update/create/deal/skip).
- **Update Sheet Status**: Escribe "Synced to CRM" + hubspot_contact_id + deal_id + sync_date + assigned_rep en el Google Sheet.
- **Rate Limit**: Espera 0.5 segundos entre leads (respeta 10 req/s del free tier HubSpot).
- **Build Summary**: Agrega estadisticas de toda la ejecucion.
- **Has HOT Synced?**: Si hubo HOT leads, envia alerta a Discord.
- **Discord Alert**: Embed con resumen de la sincronizacion.

---

## 9. Logica de deduplicacion

El workflow **nunca** crea contactos duplicados:

1. **Busqueda por email** (preferido): Si el lead tiene email valido, busca en HubSpot por `email = X`.
2. **Busqueda por LinkedIn** (fallback): Si no tiene email pero tiene LinkedIn URL, busca por `hs_linkedin_url = X`.
3. **Sin identificador**: Si no tiene ni email ni LinkedIn, el lead se **salta** (no se sincroniza).
4. **Contacto encontrado**: Se actualiza con los datos mas recientes (score, categoria, lifecyclestage).
5. **Contacto no encontrado**: Se crea nuevo.

**Status en Google Sheet:**
- `Nuevo` o `Prioridad` = elegible para sync
- `Synced to CRM` = ya sincronizado (no se vuelve a procesar)

Esto significa que si un lead se re-procesa (manualmente cambiando status a "Nuevo"), se actualizara en HubSpot sin crear duplicado.

---

## 10. Rate limits

### HubSpot API

| Plan HubSpot | Rate limit | Wait entre requests | Leads/hora maximo |
|--------------|-----------|---------------------|-------------------|
| Free | 10 req/s | 0.5s (configurado) | ~3,600 |
| Starter | 10 req/s | 0.5s | ~3,600 |
| Professional | 100 req/s | 0.5s (sobra) | ~7,200 |
| Enterprise | 100 req/s | 0.5s (sobra) | ~7,200 |

Cada lead usa entre 2-4 requests (search + create/update + deal + sheet update), asi que el throughput real es ~900-1,800 leads/hora con el wait de 0.5s. Mas que suficiente para el volumen tipico (50-200 leads/dia).

### Google Sheets API
- 300 requests/min: No es un problema con el procesamiento secuencial.

---

## 11. Costos

### Por ejecucion (estimados)

| Componente | Costo | Notas |
|------------|-------|-------|
| HubSpot API | $0 | Incluido en el plan del cliente |
| Google Sheets API | $0 | Free |
| Discord Webhook | $0 | Free |
| n8n Cloud | $0 (incluido en plan) | Usa ejecuciones del plan n8n |

### Este workflow no tiene costos adicionales
Todo el costo esta en el plan HubSpot del cliente (que ya pagan) y el plan n8n de Sisteco.

---

## 12. Escalar a multi-cliente

### Opcion A: Un workflow por cliente (1-5 clientes)

1. Duplicar el workflow en n8n
2. Renombrar a `[NombreCliente] — HubSpot CRM Sync`
3. Modificar Client Config con los datos del cliente
4. Escalonar Schedule Triggers (cliente A: minutos 0,30; cliente B: minutos 15,45)

### Opcion B: Webhook trigger desde dashboard (5+ clientes)

1. Reemplazar Schedule Trigger por Webhook Trigger
2. El dashboard de Sisteco llama al webhook con `{ clientId, hubspotApiKey, sheetId, ... }`
3. Un cron en Vercel o n8n dispara la sincronizacion por cliente
4. Permite sincronizacion on-demand desde la UI del cliente

---

## 13. Troubleshooting

### Error 401 en HubSpot (Unauthorized)

**Causa:** API key invalida o expirada.
**Solucion:**
1. Verificar que el `hubspotApiKey` en Client Config es un Private App Token valido
2. Ir a HubSpot > Settings > Integrations > Private Apps > verificar que la app esta activa
3. Verificar que los scopes incluyen `crm.objects.contacts.read/write` y `crm.objects.deals.read/write`
4. Generar un nuevo token si el actual expiro

### Error 409 en HubSpot (Conflict / Duplicate)

**Causa:** Se intento crear un contacto que ya existe (fallo en deduplicacion).
**Solucion:**
1. El nodo tiene `continueOnFail: true`, asi que el workflow continua
2. Revisar si el email del lead ya existe en HubSpot con un formato diferente (mayusculas, espacios)
3. Verificar que la propiedad `hs_linkedin_url` no tiene formato inconsistente

### Error 429 en HubSpot (Rate Limit)

**Causa:** Se excedio el rate limit.
**Solucion:**
1. Aumentar el Wait node de 0.5s a 1s o 2s
2. Reducir la frecuencia del Schedule Trigger (de cada 2h a cada 4h)
3. Si el cliente tiene HubSpot Professional+, el rate limit es 100 req/s y no deberia ser problema

### Los leads no aparecen en HubSpot

**Posibles causas:**
1. El `syncThreshold` es muy alto — verificar scores de los leads en el sheet
2. Ningun lead tiene status "Nuevo" o "Prioridad" — todos ya estan "Synced to CRM"
3. Ningun lead tiene email ni LinkedIn URL — no se pueden buscar/crear en HubSpot
4. La API key no tiene permisos suficientes

### El sheet no se actualiza con "Synced to CRM"

**Causa:** El matching column `email` no coincide.
**Solucion:**
1. Verificar que la columna `email` existe en el sheet y tiene datos
2. Si los leads no tienen email, el update por email fallara — considerar usar otro matching column (como `linkedin`)
3. Verificar credenciales de Google Sheets en los nodos del workflow

### Discord no envia alerta

**Causa:** Webhook URL invalida o ningun lead HOT sincronizado.
**Solucion:**
1. Verificar que `discordWebhook` en Client Config es correcto
2. Revisar el nodo "Build Summary" — si `hotLeadsSynced` es 0, la alerta no se envia (correcto)
3. Probar el webhook manualmente:
```bash
curl -X POST "URL_DEL_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test HubSpot sync"}'
```

### Los deals no se crean

**Causa:** Solo se crean deals para leads HOT **nuevos** (no para updates ni WARM).
**Solucion:**
1. Verificar que hay leads con categoria HOT y que no existian previamente en HubSpot
2. Revisar el nodo "Needs Deal?" — solo pasa leads con `_needsDeal: true`
3. Verificar que la API key tiene scope `crm.objects.deals.write`
4. Revisar si el pipeline "default" existe en HubSpot del cliente

---

## 14. Propiedades HubSpot — Setup rapido

Script para crear propiedades custom via API (ejecutar una vez por cliente):

```bash
# Crear sisteco_score en Contacts
curl -X POST "https://api.hubapi.com/crm/v3/properties/contacts" \
  -H "Authorization: Bearer PAT_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sisteco_score",
    "label": "Sisteco Score",
    "type": "number",
    "fieldType": "number",
    "groupName": "contactinformation",
    "description": "Score ICP generado por Sisteco Pipeline (0-100)"
  }'

# Crear sisteco_categoria en Contacts
curl -X POST "https://api.hubapi.com/crm/v3/properties/contacts" \
  -H "Authorization: Bearer PAT_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sisteco_categoria",
    "label": "Sisteco Categoria",
    "type": "string",
    "fieldType": "text",
    "groupName": "contactinformation",
    "description": "Categoria del lead: HOT, WARM, NURTURE"
  }'

# Crear sisteco_sync_date en Contacts
curl -X POST "https://api.hubapi.com/crm/v3/properties/contacts" \
  -H "Authorization: Bearer PAT_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sisteco_sync_date",
    "label": "Sisteco Sync Date",
    "type": "date",
    "fieldType": "date",
    "groupName": "contactinformation",
    "description": "Fecha de ultima sincronizacion desde Sisteco"
  }'

# Crear sisteco_score en Deals
curl -X POST "https://api.hubapi.com/crm/v3/properties/deals" \
  -H "Authorization: Bearer PAT_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "sisteco_score",
    "label": "Sisteco Score",
    "type": "number",
    "fieldType": "number",
    "groupName": "dealinformation",
    "description": "Score ICP del lead asociado"
  }'
```

Reemplazar `PAT_TOKEN_AQUI` con el Private App Token del cliente.

---

## 15. Checklist de onboarding por cliente

- [ ] Cliente tiene cuenta HubSpot (Free o superior)
- [ ] Crear Private App en HubSpot con scopes necesarios
- [ ] Obtener Private App Token
- [ ] Crear propiedades custom (seccion 14)
- [ ] Agregar columnas extra al Google Sheet (`hubspot_contact_id`, `hubspot_deal_id`, `sync_date`, `assigned_rep`)
- [ ] Duplicar workflow en n8n y renombrar
- [ ] Configurar Client Config con datos del cliente
- [ ] Configurar credencial Google Sheets
- [ ] Obtener lista de sales reps del cliente (emails)
- [ ] Test manual — verificar que 1 lead se sincroniza correctamente
- [ ] Activar Schedule Trigger
- [ ] Verificar primera alerta Discord
- [ ] Informar al cliente que la sincronizacion esta activa
