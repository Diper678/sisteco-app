# SII Data Enrichment — Workflow n8n (Template T2)

> Workflow: `Sisteco — SII Data Enrichment (SimpleAPI)`
> Archivo JSON: `docs/plans/n8n-sii-enrichment-workflow.json`
> Template: T2 (incluido en plan Base $397/mes)
> Referencia SAAN: `SAAN Leads Enrich — SII SimpleAPI` (ID: IU9b7jYbqbKS0tNn)
> Ultima actualizacion: 2026-03-15

---

## 1. Resumen

Este workflow enriquece leads del pipeline con datos del **Servicio de Impuestos Internos (SII)** de Chile, usando la API de SimpleAPI. Agrega datos firmograficos oficiales (RUT, actividad economica, tamano, estado tributario) a cada lead que haya superado el umbral de scoring.

**Valor para el cliente:** Datos oficiales del SII permiten validar que la empresa prospecto existe, esta activa, y coincide con el perfil de cliente ideal. Un lead con RUT verificado y actividad economica conocida es significativamente mas valioso que un nombre de empresa sin verificar.

**Posicion en el pipeline:**
```
T1 Lead Scoring → [T2 SII Enrichment] → T3 Email Sequence
```

El workflow lee leads ya scored del Google Sheet (pipeline), busca su RUT en el SII via SimpleAPI, obtiene detalles firmograficos, y actualiza el Sheet con los datos enriquecidos.

---

## 2. Arquitectura

```
Manual Trigger ──┐
                 ├──> Client Config ──> Read Leads from Sheet
Webhook Trigger ─┘                          │
                                    Filter Eligible Leads
                                    (score >= 50 AND NOT enriched)
                                            │
                                    Has Eligible Leads?
                                      /          \
                                   true           false
                                    /               \
                              No Leads           Batch Leads
                              to Enrich          (1 at a time)
                                                /          \
                                          [done]          [loop]
                                             │               │
                                    Enrichment       SimpleAPI Search RUT
                                     Summary              │
                                        │            Parse RUT Search
                                   Any Enriched?          │
                                    /       \        RUT Found?
                                 true      false      /       \
                                  /          \     true      false
                           Format           No      │          │
                           Discord         Notif  SimpleAPI   Mark SII
                           Notif.                 Get Details  Not Found
                              │                      │          │
                           Discord            Parse Company     │
                            Alert              Details          │
                                                  │            │
                                                  └────┬───────┘
                                                       │
                                               Prepare Update Data
                                                       │
                                               Update Lead in Sheet
                                                       │
                                                  Rate Limit (1s)
                                                       │
                                                  [back to Batch]
```

---

## 3. Requisitos previos

### Instancia n8n
- URL: `sistecotest.app.n8n.cloud`
- Plan n8n Cloud o self-hosted con acceso a internet

### API SimpleAPI
- **Base URL:** `https://api.simpleapi.cl`
- **API Key:** Configurada en el nodo Client Config (hardcoded por ahora)
- **Endpoints usados:**
  - `GET /api/rut/search?name=COMPANY_NAME` — buscar RUT por nombre de empresa
  - `GET /api/rut/{rut}` — obtener detalles firmograficos por RUT

### Variables de entorno (opcionales, para Discord)

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `DISCORD_WEBHOOK_URL` | Webhook del canal de alertas | `https://discord.com/api/webhooks/...` |

### Credenciales en n8n
- **Google Sheets OAuth2**: Configurar en n8n > Credentials > Google Sheets. Necesita permisos de lectura/escritura al sheet del pipeline.

### Google Sheet preparado

El Sheet debe tener una hoja llamada `Leads` con las columnas existentes del pipeline (de T1 Lead Scoring) **mas** estas columnas adicionales:

```
rut | actividad_economica | tamano_empresa | estado_tributario | rubro_sii | razon_social_sii | sii_enriched | sii_enriched_at | sii_status
```

**Columnas SII que se actualizan:**

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| `rut` | string | RUT de la empresa (ej: 76.xxx.xxx-K) |
| `actividad_economica` | string | Actividad economica registrada en SII |
| `tamano_empresa` | string | Tamano segun clasificacion SII (Micro/Pequena/Mediana/Grande) |
| `estado_tributario` | string | Estado tributario (vigente, termino giro, etc.) |
| `rubro_sii` | string | Rubro economico segun SII |
| `razon_social_sii` | string | Razon social oficial registrada |
| `sii_enriched` | boolean | `true` si fue enriquecido exitosamente |
| `sii_enriched_at` | datetime | Fecha/hora del enriquecimiento (ISO 8601) |
| `sii_status` | string | Estado del proceso: `enriched`, `not_found`, `api_error` |

---

## 4. Importar workflow

1. Abrir n8n en `sistecotest.app.n8n.cloud`
2. Click en **"..."** (menu) > **Import from File**
3. Seleccionar `docs/plans/n8n-sii-enrichment-workflow.json`
4. El workflow aparecera con todos los nodos conectados
5. **Configurar credencial Google Sheets:**
   - Click en el nodo "Read Leads from Sheet"
   - En "Credential to connect with", seleccionar la credencial Google Sheets configurada
   - Repetir para el nodo "Update Lead in Sheet"
   - Guardar
6. **Configurar Sheet ID:**
   - Click en el nodo "Client Config"
   - Cambiar `sheetId` de `CONFIGURE_PER_CLIENT` al ID real del Google Sheet
   - Guardar
7. **Configurar Discord (opcional):**
   - En n8n Settings > Variables, configurar `DISCORD_WEBHOOK_URL`
   - O editar directamente en el nodo "Discord Alert"
8. **Test manual:**
   - Click en "Test workflow" para ejecutar con el trigger manual
   - Verificar que las columnas SII se actualizan en el Google Sheet
9. **Activar webhook (produccion):**
   - Copiar la URL del Webhook Trigger
   - Usarla para ejecutar via API o desde el dashboard

---

## 5. Configuracion por cliente

El nodo **"Client Config"** centraliza toda la parametrizacion:

| Campo | Tipo | Descripcion | Default |
|-------|------|-------------|---------|
| `simpleApiKey` | string | API key de SimpleAPI | `0315-R920-6394-8986-4427` |
| `simpleApiBase` | string | URL base de SimpleAPI | `https://api.simpleapi.cl` |
| `sheetId` | string | ID del Google Sheet del pipeline | `CONFIGURE_PER_CLIENT` |
| `enrichThreshold` | number | Score minimo para enriquecer | `50` |
| `clientName` | string | Nombre del cliente (para reportes) | `Sisteco` |
| `rateLimitMs` | number | Pausa entre llamadas API (ms) | `1000` |

### Configurar umbral de enriquecimiento

El `enrichThreshold` determina que leads se enriquecen:
- **50** (default): Enriquece leads WARM y HOT
- **80**: Solo enriquece HOT leads (ahorra creditos API)
- **30**: Enriquece tambien NURTURE (usa mas creditos)

---

## 6. Nodos clave

### Triggers
- **Manual Trigger**: Para testing y ejecuciones ad-hoc.
- **Webhook Trigger**: POST a `/sii-enrich` para ejecucion automatizada (ej: despues de T1 Lead Scoring, o desde el dashboard).

### Filtrado
- **Filter Eligible Leads**: Filtra leads que cumplen las 3 condiciones: score >= threshold, no enriquecidos previamente, y tienen nombre de empresa. Ordena por score descendente para priorizar los mejores.
- **Has Eligible Leads?**: Bifurca el flujo. Si no hay leads elegibles, termina sin error.

### Busqueda SII
- **Batch Leads**: Procesa leads uno por uno via SplitInBatches (batchSize: 1).
- **SimpleAPI Search RUT**: Busca el RUT de la empresa por nombre en SimpleAPI. Usa `continueOnFail: true` para no detener el workflow si una empresa no se encuentra.
- **Parse RUT Search**: Interpreta la respuesta de SimpleAPI. Extrae el RUT del mejor match o marca como `not_found`.
- **RUT Found?**: Bifurca: si se encontro RUT, buscar detalles; si no, marcar como no encontrado.

### Detalles SII
- **SimpleAPI Get Details**: Con el RUT obtenido, consulta los detalles firmograficos completos.
- **Parse Company Details**: Extrae actividad economica, tamano, estado tributario, rubro, etc.
- **Mark SII Not Found**: Para empresas sin RUT, prepara datos vacios con estado "SII no encontrado".

### Actualizacion
- **Prepare Update Data**: Formatea los datos para las columnas del Google Sheet, incluyendo metadata de enriquecimiento.
- **Update Lead in Sheet**: Escribe los datos SII de vuelta al Google Sheet, matcheando por columna `empresa`.
- **Rate Limit**: Espera 1 segundo entre cada lead para no saturar la API de SimpleAPI.

### Notificacion
- **Enrichment Summary**: Genera resumen con totales (procesados, enriquecidos, no encontrados, errores, tasa de exito).
- **Any Enriched?**: Solo notifica si al menos un lead fue enriquecido exitosamente.
- **Discord Alert**: Envia embed con resumen de la ejecucion al canal Discord de alertas.

---

## 7. Logica de error y resiliencia

### continueOnFail
Ambos nodos HTTP (`SimpleAPI Search RUT` y `SimpleAPI Get Details`) tienen `continueOnFail: true`. Si la API falla para un lead especifico, el workflow continua con el siguiente lead en lugar de detenerse.

### retryOnFail
Ambos nodos HTTP tienen `retryOnFail: true` con `maxTries: 2`. Si hay un error transitorio (timeout, 500), se reintenta una vez antes de continuar.

### Clasificacion de estados

| Estado (`sii_status`) | Significado | Accion recomendada |
|------------------------|-------------|---------------------|
| `enriched` | Datos SII obtenidos exitosamente | Lead listo para siguiente fase |
| `not_found` | Empresa no encontrada en SII por nombre | Verificar nombre manualmente o usar variantes |
| `api_error` | Error de SimpleAPI (timeout, 500, auth) | Re-ejecutar el workflow; si persiste, revisar API key |
| `detail_error` | RUT encontrado pero detalles fallaron | Re-ejecutar; posible RUT invalido |

### Rate limiting
- SimpleAPI: 1 segundo entre llamadas (configurable via `rateLimitMs`)
- Google Sheets API: Sin rate limit adicional (limite de Google es 300 req/min)
- Leads procesados secuencialmente (batchSize: 1) para control total

---

## 8. Costos

### SimpleAPI

| Concepto | Costo | Notas |
|----------|-------|-------|
| Busqueda RUT por nombre | Segun plan SimpleAPI | 1 llamada por lead |
| Detalle por RUT | Segun plan SimpleAPI | 1 llamada por lead encontrado |
| **Total por lead encontrado** | **2 llamadas** | Busqueda + detalle |
| **Total por lead no encontrado** | **1 llamada** | Solo busqueda |

### Estimacion mensual segun volumen

| Leads/mes | Encontrados (~70%) | Llamadas API | Costo estimado |
|-----------|--------------------|--------------|-----------------------|
| 50 | 35 | 85 | Depende del plan SimpleAPI |
| 100 | 70 | 170 | Depende del plan SimpleAPI |
| 500 | 350 | 850 | Depende del plan SimpleAPI |
| 1,000 | 700 | 1,700 | Evaluar plan enterprise |

### Otros costos

| Componente | Costo | Notas |
|------------|-------|-------|
| Google Sheets API | $0 | Free |
| Discord Webhook | $0 | Free |
| n8n Cloud | $0 (incluido en plan) | Ejecuciones cuentan hacia cuota |

---

## 9. Datos SII que se obtienen

### Clasificacion de tamano empresarial (SII)

| Categoria | Ventas Anuales (UF) | Valor para Sisteco |
|-----------|---------------------|--------------------|
| Micro | 0 - 2.400 | SKIP — fuera de mercado |
| Pequena | 2.400 - 25.000 | NURTURE — potencial futuro |
| Mediana | 25.000 - 100.000 | **TARGET** — mercado principal |
| Grande | > 100.000 | **TARGET** — aspiracional |

### Uso de datos enriquecidos

Los datos SII se pueden usar para:

1. **Validacion:** Confirmar que la empresa existe y esta activa
2. **Segmentacion:** Filtrar por tamano, rubro, region
3. **Scoring adicional:** Sumar puntos al ICP score por tamano mediana/grande
4. **Compliance:** Verificar estado tributario antes de prospeccion
5. **Personalizacion:** Usar actividad economica para personalizar emails (T3)
6. **Exclusion:** Descartar empresas con giro terminado o micro-empresas

---

## 10. Escalar a multi-cliente

### Opcion A: Workflow duplicado por cliente (1-5 clientes)
1. Duplicar workflow en n8n
2. Cambiar Client Config (sheetId, clientName)
3. Cada cliente usa su propio Google Sheet

### Opcion B: Webhook con clientId (5+ clientes)
1. El dashboard o cron envia POST a `/sii-enrich` con `{ clientId: "xxx" }`
2. El workflow lee config del cliente desde Convex o Google Sheet master
3. Enriquece y actualiza el Sheet del cliente especifico

### Encadenar con T1 Lead Scoring
El flujo ideal es ejecutar T2 automaticamente despues de T1:

```
T1 Lead Scoring termina
  → Webhook POST a /sii-enrich
  → T2 enriquece leads nuevos
  → T3 Email Sequence puede usar datos SII en personalizacion
```

Para esto, agregar un nodo HTTP Request al final de T1 que haga POST al webhook de T2.

---

## 11. Troubleshooting

### SimpleAPI retorna 401 (Unauthorized)

**Causa:** API key invalida o expirada.
**Solucion:**
1. Verificar la API key en Client Config
2. Probar la key manualmente:
```bash
curl -H "Authorization: Bearer 0315-R920-6394-8986-4427" \
  "https://api.simpleapi.cl/api/rut/search?name=SISTECO"
```
3. Si la key expiro, renovar en portal SimpleAPI

### SimpleAPI retorna 429 (Rate Limited)

**Causa:** Demasiadas solicitudes en poco tiempo.
**Solucion:**
- Aumentar `rateLimitMs` en Client Config (ej: de 1000 a 2000)
- El Wait node entre llamadas deberia prevenir esto, pero si ocurre con volumen alto, duplicar el tiempo

### Empresa no encontrada pero existe en SII

**Causa:** El nombre de busqueda no coincide con la razon social en SII.
**Solucion:**
- Los nombres en SII son en MAYUSCULAS y pueden diferir del nombre comercial
- Ej: "Google Chile" en LinkedIn → "GOOGLE CHILE LIMITADA" en SII
- El workflow ya convierte a mayusculas, pero las variaciones (Ltda, SpA, S.A.) pueden causar no-match
- Considerar agregar logica de fuzzy matching o busqueda parcial en futuras versiones

### Google Sheets error de autenticacion

**Causa:** Token OAuth2 expirado o permisos insuficientes.
**Solucion:**
1. n8n > Credentials > Google Sheets > "Reconnect"
2. Verificar que la cuenta tiene acceso de escritura al Sheet
3. Verificar que el Sheet ID en Client Config es correcto

### Los leads no se actualizan en el Sheet

**Posibles causas:**
1. La columna `empresa` en el Sheet no coincide exactamente con el valor del lead
2. Las columnas SII no existen en el Sheet — crearlas manualmente
3. El matching por `empresa` no encuentra la fila — verificar que la columna existe y tiene datos

### El workflow termina inmediatamente sin procesar leads

**Causa:** No hay leads elegibles (todos ya enriquecidos, score bajo, o sin empresa).
**Solucion:**
1. Verificar que hay leads con `score >= enrichThreshold` en el Sheet
2. Verificar que la columna `sii_enriched` no dice `true` para todos
3. Verificar que la columna `empresa` tiene datos

---

## 12. Mejoras futuras

- [ ] **Fuzzy matching:** Buscar con variaciones del nombre (sin Ltda, SpA, etc.)
- [ ] **Cache de RUTs:** Almacenar RUTs conocidos en Convex para evitar busquedas repetidas
- [ ] **Bulk search:** Si SimpleAPI ofrece endpoint batch, usarlo para reducir llamadas
- [ ] **Cross-reference ChileCompra:** Cruzar RUT con API de Mercado Publico para datos adicionales
- [ ] **Score boost:** Automaticamente sumar puntos al ICP score si empresa es mediana/grande
- [ ] **Convex migration:** Mover de Google Sheets a Convex como data layer

---

*Ultima actualizacion: 2026-03-15*
