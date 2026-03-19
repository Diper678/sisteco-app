# PhantomBuster LinkedIn Search Export — Guia Completa para B2B Lead Generation

> Fecha: 2026-03-11 | Contexto: Sisteco — Pipeline de leads B2B Chile
> Phantom ID actual: 510547627503326
> API Key: 4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA

---

## 1. SETUP COMPLETO DEL PHANTOM

### 1.1 Pre-requisitos

- Cuenta PhantomBuster (Free trial 14 dias o plan pagado $69/mo)
- Cuenta LinkedIn (preferentemente con 3+ meses de actividad)
- Extension de Chrome de PhantomBuster (recomendado para cookies)
- Navegador Chrome actualizado (cookies expiran mas rapido con navegadores viejos)

### 1.2 Paso a paso — Dashboard Setup

**Paso 1: Crear el Phantom**
1. Ir a phantombuster.com → Automations → buscar "LinkedIn Search Export"
2. Click "Use this automation" → se crea un nuevo Phantom
3. Anotar el **Agent ID** (visible en la URL: `/automation/XXX`)

**Paso 2: Conectar cuenta LinkedIn (Session Cookie)**
- **Opcion A (Recomendada): Extension Chrome**
  1. Instalar la extension PhantomBuster desde Chrome Web Store
  2. Ir a linkedin.com, asegurarse de estar logueado
  3. Click en la extension → "Connect to LinkedIn" → un click
  4. Se sincroniza automaticamente el cookie `li_at`

- **Opcion B: Cookie manual**
  1. Ir a linkedin.com en Chrome
  2. F12 → Application → Cookies → linkedin.com
  3. Buscar cookie `li_at` → copiar su valor
  4. En PhantomBuster → Phantom settings → Session → pegar el valor

**Paso 3: Configurar Input (Search URL)**
1. En el Phantom → Setup → seccion "LinkedIn search URL"
2. Pegar una URL de busqueda de LinkedIn (ver seccion 2)
3. O usar Google Sheets con multiples URLs (columna con nombre especificado)

**Paso 4: Configurar parametros**
- **Number of profiles**: 25-100 por ejecucion (conservador: 25)
- **Number of results per search URL**: Maximo 100 por run (limite temporal de LinkedIn)
- **Extract default URL**: true (para obtener URLs limpias)
- **File name**: nombre personalizado para el CSV de resultados

### 1.3 Datos que extrae el Phantom

El LinkedIn Search Export devuelve por cada perfil:
- `firstName`, `lastName`
- `title` / `jobTitle` (cargo)
- `companyName` / `company`
- `location`
- `linkedinUrl` / `profileUrl`
- `headline`
- `degree` (grado de conexion: 1st, 2nd, 3rd)
- `industry`
- `connectionCount` (a veces)

**NO extrae** (necesitas LinkedIn Profile Scraper para estos):
- Email
- Telefono
- Descripcion completa del perfil
- Experiencia laboral detallada

---

## 2. LINKEDIN SEARCH URL FORMAT

### 2.1 Estructura base

```
https://www.linkedin.com/search/results/people/?keywords=BUSQUEDA&geoUrn=%5B%22CODIGO%22%5D&...
```

### 2.2 Parametros de URL disponibles

| Parametro | Descripcion | Formato |
|-----------|-------------|---------|
| `keywords` | Terminos de busqueda | String libre, soporta AND/OR |
| `geoUrn` | Filtro geografico | `%5B%22CODIGO%22%5D` (URL-encoded array) |
| `currentCompany` | Empresa actual | `%5B%22COMPANY_ID%22%5D` |
| `network` | Grado de conexion | `%5B%22F%22%5D` (1st), `%5B%22S%22%5D` (2nd) |
| `profileLanguage` | Idioma del perfil | `%5B%22es%22%5D` |
| `title` | Cargo/titulo | String |
| `industry` | Industria | Codigo numerico de LinkedIn |

### 2.3 GeoUrn para Chile

**Chile (pais):** `104621616`

URL-encoded en la busqueda: `geoUrn=%5B%22104621616%22%5D`

Ciudades principales de Chile (geoUrn codes):
- Santiago: buscar en LinkedIn el ID exacto (usualmente sub-codigo de 104621616)
- Region Metropolitana: sub-region del codigo Chile

**IMPORTANTE:** El formato `%5B%22...%22%5D` es la version URL-encoded de `["..."]`.

### 2.4 URLs de busqueda listas para usar (Chile B2B)

**Busqueda 1: Directores Comerciales en Chile**
```
https://www.linkedin.com/search/results/people/?geoUrn=%5B%22104621616%22%5D&keywords=director%20comercial&origin=FACETED_SEARCH
```

**Busqueda 2: Gerentes de Ventas en Chile, empresas medianas**
```
https://www.linkedin.com/search/results/people/?geoUrn=%5B%22104621616%22%5D&keywords=gerente%20ventas&origin=FACETED_SEARCH
```

**Busqueda 3: VP Sales / Head of Sales Chile**
```
https://www.linkedin.com/search/results/people/?geoUrn=%5B%22104621616%22%5D&keywords=%22head%20of%20sales%22%20OR%20%22vp%20sales%22%20OR%20%22director%20ventas%22&origin=FACETED_SEARCH
```

**Busqueda 4: Decision makers IT/Tech Chile**
```
https://www.linkedin.com/search/results/people/?geoUrn=%5B%22104621616%22%5D&keywords=%22CTO%22%20OR%20%22director%20tecnologia%22%20OR%20%22gerente%20TI%22&origin=FACETED_SEARCH
```

### 2.5 Como obtener la URL correcta

1. Ir a linkedin.com/search/results/people/
2. Usar los filtros de la UI: Location → Chile, Keywords, etc.
3. Una vez que veas resultados filtrados, copiar la URL completa del navegador
4. Esa URL es tu input para PhantomBuster
5. **VERIFICAR:** la URL debe contener `linkedin.com/search/results/people/`

### 2.6 Sales Navigator Search URL (diferente formato)

Si usas Sales Navigator, la URL es completamente diferente:
```
https://www.linkedin.com/sales/search/people?query=(filters:List((type:REGION,values:List((id:cl,text:Chile))),...))
```

**No mezclar:** URLs de LinkedIn regular NO funcionan en el phantom de Sales Navigator, y viceversa.

---

## 3. API LAUNCH vs DASHBOARD LAUNCH

### 3.1 Dashboard Launch (Manual)

- Click "Launch" en el dashboard de PhantomBuster
- Usa la configuracion guardada en el Phantom
- Siempre funciona si el setup es correcto
- **Ideal para:** testing, verificacion, uso esporadico

### 3.2 API Launch (Programatico)

**Endpoint:** `POST https://api.phantombuster.com/api/v2/agents/launch`

**Headers:**
```
X-Phantombuster-Key: TU_API_KEY
Content-Type: application/json
```

**Body:**
```json
{
  "id": "510547627503326",
  "argument": "{\"search\":\"https://www.linkedin.com/search/results/people/?geoUrn=%5B%22104621616%22%5D&keywords=director%20comercial\",\"numberOfProfiles\":25,\"extractDefaultUrl\":true}"
}
```

**NOTA CRITICA:** El campo `argument` es un **STRING de JSON**, no un objeto JSON directo. Es JSON dentro de JSON (double-serialized).

### 3.3 Cuando el API falla pero el Dashboard funciona

**Causa #1: Argument mal formateado**
- El `argument` debe ser un string JSON escapado, no un objeto
- MAL: `"argument": { "search": "url" }`
- BIEN: `"argument": "{\"search\":\"url\"}"`

**Causa #2: Nombres de parametros incorrectos**
- Los nombres de parametros del argument varian segun el Phantom
- Para LinkedIn Search Export, los parametros comunes son:
  - `search` o `searchUrl` — la URL de busqueda de LinkedIn
  - `numberOfProfiles` — cuantos perfiles extraer
  - `extractDefaultUrl` — extraer URL canonica
  - `sessionCookie` — (opcional si ya esta configurado en dashboard)

**Causa #3: Cookie no configurada**
- Si lanzas por API sin cookie configurada en el dashboard, falla silenciosamente
- Siempre configurar la cookie PRIMERO en el dashboard, luego lanzar por API

**Causa #4: Agent ID incorrecto**
- Verificar que el ID sea string: `"id": "510547627503326"` (con comillas)

### 3.4 Como obtener los nombres exactos de parametros

1. Ir al Phantom en el dashboard
2. Configurar todo en la UI
3. Buscar el boton "JSON" o "Show JSON" en la seccion de setup
4. Copiar ese JSON — esos son los nombres exactos de los parametros
5. Ese JSON es lo que va dentro del campo `argument` (como string)

### 3.5 n8n Integration (tu setup actual)

Tu workflow actual (`saan-leads-discover-phantombuster.json`) lanza asi:

```javascript
// Body del HTTP Request en n8n
{
  "id": config.salesNavSearchAgentId,  // "510547627503326"
  "argument": JSON.stringify({
    "searchUrl": config.searchUrl,
    "numberOfProfiles": 25,
    "extractDefaultUrl": true
  })
}
```

**Variable pendiente:** `PB_LINKEDIN_SEARCH_URL` en `n8n-update-config.js` esta vacia. Hay que setearla con una URL de busqueda valida.

---

## 4. WARM-UP DE CUENTA LINKEDIN

### 4.1 Es realmente necesario?

**SI, es necesario.** LinkedIn detecta patrones de comportamiento y los compara contra tu baseline historico. Una cuenta nueva o inactiva que de repente hace 100 busquedas en un dia sera flaggeada.

**Que pasa sin warm-up:**
- Prompts de verificacion telefonica/email
- Logouts forzados
- Cookies invalidadas prematuramente
- En casos extremos: restriccion temporal o permanente de la cuenta

### 4.2 Timeline de warm-up recomendado

#### Cuentas NUEVAS (< 3 meses): 6-8 semanas

| Semana | Actividad |
|--------|-----------|
| 1-2 | Solo uso manual: visitar 10-20 perfiles/dia, dar 5-10 likes, 2-3 comentarios. NO automatizar nada |
| 3-4 | Empezar con PhantomBuster a volumen minimo: 5-10 perfiles por ejecucion, 1 vez al dia |
| 5-6 | Subir a 15-20 perfiles por ejecucion, 1 vez al dia |
| 7-8 | Subir a 25 perfiles, 3 veces por semana (tu objetivo final) |

#### Cuentas EXISTENTES activas (3+ meses con uso regular): 2-3 semanas

| Semana | Actividad |
|--------|-----------|
| 1 | 10-15 perfiles por ejecucion, 1 vez al dia |
| 2 | 20 perfiles, cada 2 dias |
| 3 | 25 perfiles, Lun/Mie/Vie |

#### Cuentas DORMIDAS (30+ dias sin uso): 3-4 semanas

| Semana | Actividad |
|--------|-----------|
| 1 | Solo actividad manual: perfiles, likes, comentarios |
| 2 | 5-10 perfiles con PhantomBuster, 1 vez al dia |
| 3 | 15 perfiles, cada 2 dias |
| 4 | 25 perfiles, Lun/Mie/Vie |

### 4.3 Reglas de oro del warm-up

1. **Consistencia > Velocidad** — mejor poco diario que mucho esporadico
2. **Horarios humanos** — ejecutar en horas de oficina (9am-6pm hora Chile)
3. **Incremento gradual** — nunca mas de 10-20% de aumento por semana
4. **Actividad mixta** — no solo searches, tambien likes/comments/connections
5. **Monitorear acceptance rate** — si cae bajo 25%, reducir volumen inmediatamente
6. **Dias de descanso** — incluir 1-2 dias sin automatizacion por semana

### 4.4 Senales de alerta (PARAR inmediatamente)

- Verificacion por telefono o email al hacer login
- Logout forzado / sesion cerrada sin razon
- Mensaje "Unusual activity detected"
- Cookie expira en menos de 24 horas
- Busquedas retornan 0 resultados cuando deberian tener muchos

**Protocolo de recuperacion:**
1. PARAR toda automatizacion por 3-5 dias
2. Reducir volumen 20-30% al retomar
3. Solo actividad manual durante la recuperacion
4. Incrementar de vuelta a 5% semanal (no 10%)

---

## 5. SALES NAVIGATOR FREE TRIAL

### 5.1 Salta el warm-up?

**NO.** Sales Navigator no elimina la necesidad de warm-up. La cuenta sigue sujeta a los mismos patrones de deteccion de LinkedIn.

**Lo que SI cambia con Sales Navigator:**
- Mas resultados por busqueda: **2,500** vs 1,000 en LinkedIn gratuito
- Sin limite comercial de busquedas (Free tiene ~300/mes)
- Filtros mucho mas avanzados (tamano empresa, revenue, headcount exacto)
- Formato de URL completamente diferente (Sales Nav URLs)
- Phantom diferente: "Sales Navigator Search Export" (no el mismo que LinkedIn Search Export)

### 5.2 Free Trial de Sales Navigator

- **Duracion:** 30 dias gratis (requiere tarjeta de credito)
- **Despues:** $99.99/mes (Sales Nav Core) — cancelar antes del dia 30 si no quieres pagar
- **Riesgo:** Si cancelas, pierdes acceso a todas las listas guardadas en Sales Nav

### 5.3 Pros de usar Sales Navigator

| Pro | Detalle |
|-----|---------|
| Sin limite comercial | No hay cap de ~300 busquedas/mes |
| 2,500 resultados | vs 1,000 en LinkedIn free |
| Filtros avanzados | Headcount (51-200, 201-500), revenue, crecimiento |
| Lead lists | Guardar y trackear leads dentro de Sales Nav |
| InMails | 50 InMails/mes incluidos |

### 5.4 Contras de usar Sales Navigator

| Contra | Detalle |
|--------|---------|
| Costo | $99.99/mes ($168/mo si sumas PhantomBuster) |
| Phantom diferente | Hay que usar "Sales Nav Search Export", no el de LinkedIn regular |
| URLs incompatibles | No puedes reusar URLs entre regular y Sales Nav |
| Dependencia | Si cancelas, pierdes lead lists |
| Warm-up igual | No te ahorra el warm-up |
| Perfil marcado | LinkedIn sabe que usas Sales Nav, puede ser mas estricto |

### 5.5 Recomendacion para Sisteco

**Empezar con LinkedIn gratuito + PhantomBuster ($69/mo total)**
- Suficiente para empezar con < 1,000 leads/mes
- Chile B2B es un mercado acotado (~5,000-20,000 perfiles relevantes)
- Upgrade a Sales Navigator cuando: 3+ clientes pagando O tasa conversion < 2%

---

## 6. ERRORES COMUNES Y SOLUCIONES

### 6.1 Session Cookie Expired / Invalid

**Error:** "Your session cookie is not valid" o "Could not connect to LinkedIn"

**Causas:**
- Cookie `li_at` expiro naturalmente (cada 30-90 dias)
- Cambiaste contrasena de LinkedIn
- LinkedIn detecto actividad sospechosa e invalido la sesion
- Navegador desactualizado (cookies expiran mas rapido)
- Te deslogueaste de LinkedIn en el navegador

**Solucion:**
1. Abrir linkedin.com → verificar que estas logueado
2. Si usas extension: click en la extension → reconectar
3. Si usas cookie manual: F12 → Application → Cookies → copiar nuevo `li_at`
4. Pegar en PhantomBuster → Settings → Session
5. Re-lanzar el Phantom

**Prevencion:**
- Mantener sesion de LinkedIn abierta en el navegador
- Usar la extension Chrome (auto-refresh de cookies)
- NO cerrar sesion de LinkedIn mientras automatizaciones corren
- Actualizar Chrome a la ultima version

### 6.2 Empty Results (0 perfiles extraidos)

**Causas:**
- URL de busqueda incorrecta o caducada
- Filtros demasiado restrictivos → no hay resultados en LinkedIn
- Limite comercial alcanzado (~300 busquedas/mes en cuenta free)
- LinkedIn cambio la estructura de la pagina (temporal)
- Cookie invalida pero el error no se reporta claramente

**Solucion:**
1. **PRIMERO:** abrir la misma URL en tu navegador logueado → verificar que hay resultados
2. Si no hay resultados en el navegador → modificar filtros
3. Si hay resultados en el navegador pero no en PB → renovar cookie
4. Si persiste → reducir `numberOfProfiles` a 10 y probar de nuevo
5. Verificar si no alcanzaste el limite comercial (buscar "Commercial use limit" en LinkedIn)

### 6.3 Rate Limits / Limite Comercial

**Error:** LinkedIn muestra "You've reached the commercial use limit on search"

**Que es:**
- Cuentas gratuitas: ~300 busquedas de personas por mes
- Se resetea el 1ro de cada mes a las 12:00 AM PT
- LinkedIn Support NO puede resetearlo antes

**Solucion:**
1. Esperar al proximo mes
2. O upgradear a LinkedIn Premium ($59.99/mo) — sin limite comercial
3. O usar Sales Navigator ($99.99/mo) — sin limite + mas resultados

**Prevencion:**
- No desperdiciar busquedas: hacer busquedas bien filtradas
- No ejecutar el Phantom multiples veces con la misma URL el mismo dia
- Maximo 3 ejecuciones/semana con LinkedIn gratuito (Lun/Mie/Vie)

### 6.4 Resultados limitados a 100 por run

**Situacion:** Aunque tu busqueda tiene 5,000 resultados, solo obtienes 100 por ejecucion.

**Razon:** Limitacion temporal de LinkedIn. El Phantom extrae un maximo de 100 perfiles por URL por run.

**Workarounds:**
1. **Ejecutar multiples veces** — cada run trae 100 diferentes (no siempre funciona)
2. **Dividir busquedas** — crear URLs mas especificas con filtros adicionales:
   - Por ciudad: Santiago, Valparaiso, Concepcion separados
   - Por cargo: "Director Comercial", "Gerente Ventas" en URLs separadas
   - Por industria: Tech, Finanzas, Servicios por separado
3. **Maximo absoluto:** 1,000 resultados por URL (free) / 2,500 (Sales Nav)

### 6.5 Phantom no termina (timeout)

**Causas:**
- Muchas URLs de busqueda en un solo run
- LinkedIn cargando lento
- Cookie invalida generando loops de login

**Solucion:**
1. Reducir numero de URLs por run (1-3 maximo)
2. Reducir `numberOfProfiles` (empezar con 25)
3. Verificar cookie activa
4. Si persiste, usar el dashboard para diagnosticar (ver logs del Phantom)

### 6.6 Datos incompletos en CSV

**Situacion:** Algunos campos vacios (email, company, etc.)

**Razon:** El LinkedIn Search Export solo extrae lo visible en la pagina de resultados. Para datos completos, necesitas el **LinkedIn Profile Scraper** como segundo paso.

**Workflow recomendado:**
1. LinkedIn Search Export → obtener lista de profileUrls
2. LinkedIn Profile Scraper → scrape completo de cada perfil
3. Ahora tienes: email, experiencia, educacion, etc.

---

## 7. PARAMETRO searchType

### 7.1 Valores validos

El parametro `searchType` en el Phantom de LinkedIn Search Export acepta:

| Valor | Uso |
|-------|-----|
| `"LinkedIn Search URL"` | URL de busqueda de linkedin.com/search/results/people/ |
| (default/omitido) | Usa LinkedIn Search URL por defecto |

**Para Sales Navigator Search Export (Phantom diferente):**

| Valor | Uso |
|-------|-----|
| `"Sales Navigator Search URL"` | URL de linkedin.com/sales/search/people |

### 7.2 Notas importantes

- **No mezclar tipos:** Una URL de LinkedIn regular no funciona en el Phantom de Sales Navigator, y viceversa
- En la mayoria de casos, no necesitas especificar `searchType` si usas el Phantom correcto
- Si lanzas por API y pasas una URL de Sales Nav al Phantom de LinkedIn Search Export, obtendras 0 resultados o error
- El nombre del parametro puede ser `search`, `searchUrl`, o variar segun la version del Phantom — siempre verificar con el JSON view del dashboard

---

## 8. BEST PRACTICES PARA EVITAR RESTRICCIONES DE LINKEDIN

### 8.1 Limites diarios seguros

| Accion | Cuenta nueva (<90 dias) | Cuenta vieja (90+ dias) |
|--------|--------------------------|--------------------------|
| Profile views | 100-200/dia | 150-300/dia |
| Connection requests | 10-15/dia | 15-25/dia |
| Messages (1st degree) | 20-40/dia | 40-80/dia |
| Searches | No publicado, ~10-15/dia safe | ~20-30/dia safe |
| Likes | 30-100/dia | 30-100/dia |

### 8.2 Delays entre acciones

- **Minimo:** 30 segundos entre acciones automatizadas
- **Recomendado:** 30-180 segundos aleatorios (mas humano)
- **Entre busquedas:** 2-5 minutos
- **Entre lanzamientos de Phantom:** espaciar en ventanas de horario (9am, 1pm, 4pm)

### 8.3 Frecuencia de ejecucion del Phantom

**Conservador (recomendado para empezar):**
- 3 veces/semana: Lun, Mie, Vie
- 25 perfiles por ejecucion
- Horario: entre 9am-12pm hora Chile (UTC-3/4)
- Total: ~75 leads/semana = ~300 leads/mes

**Moderado (despues de warm-up exitoso):**
- 5 veces/semana: Lun-Vie
- 50 perfiles por ejecucion
- Total: ~250 leads/semana = ~1,000 leads/mes

**Agresivo (solo con cuenta Premium/Sales Nav bien calentada):**
- Diario
- 100 perfiles por ejecucion
- Total: ~700 leads/semana = ~2,800 leads/mes

### 8.4 Proxies

**PhantomBuster incluye proxies propios** — no necesitas configurar proxies adicionales.

Sin embargo:
- Los proxies de PB rotan IPs, lo cual ayuda
- Si tienes problemas persistentes, PhantomBuster ofrece "Dedicated Proxy" en planes premium
- NUNCA uses VPNs/proxies publicos — LinkedIn los detecta facilmente
- La IP desde donde te logueas en linkedin.com debe ser consistente con tu uso habitual

### 8.5 Distribucion de volumen

**MAL:**
```
Lunes: 500 perfiles en 1 ejecucion a las 3am
Martes-Viernes: nada
```

**BIEN:**
```
Lunes 10am: 25 perfiles
Miercoles 11am: 25 perfiles
Viernes 10am: 25 perfiles
```

### 8.6 Coordinacion de equipo

Si multiples personas usan la misma cuenta LinkedIn:
- Deduplicar prospectos contactados
- No mas de 1 automatizacion activa por cuenta LinkedIn a la vez
- Mantener un registro centralizado de quien contacto a quien

### 8.7 Tips adicionales

1. **Personalizar mensajes** — templates identicos en masa = ban rapido
2. **Sin links en primer mensaje** — LinkedIn penaliza links en connection requests
3. **Acceptance rate > 25%** — si cae, reducir volumen inmediatamente
4. **Contenido organico** — publicar posts y comentar regularmente da "credito social"
5. **SSI Score alto** — mantener un Social Selling Index alto (linkedin.com/sales/ssi) reduce restricciones
6. **NO automatizar fines de semana** — patrones humanos reales no incluyen saturdays a las 3am
7. **Revocar invitaciones viejas** — invitaciones pendientes por 30+ dias deben retirarse

---

## 9. CHECKLIST RAPIDO — PONER A FUNCIONAR HOY

### Paso 1: Preparar la cuenta LinkedIn (5 min)
- [ ] Verificar que la cuenta tiene 3+ meses de antiguedad
- [ ] Perfil completo (foto, titulo, experiencia)
- [ ] Loguearse en LinkedIn en Chrome
- [ ] Verificar SSI score en linkedin.com/sales/ssi

### Paso 2: Configurar PhantomBuster (10 min)
- [ ] Login en phantombuster.com
- [ ] Ir a Phantom ID 510547627503326 (LinkedIn Search Export)
- [ ] Conectar LinkedIn via extension Chrome o cookie manual
- [ ] Probar cookie: lanzar una busqueda de prueba con 5 perfiles

### Paso 3: Crear la Search URL (5 min)
- [ ] Ir a linkedin.com → busqueda de personas
- [ ] Filtrar: Location = Chile
- [ ] Agregar keywords: "director comercial" o "gerente ventas"
- [ ] Copiar la URL completa del navegador
- [ ] Pegarla en el Phantom como input

### Paso 4: Test desde Dashboard (5 min)
- [ ] Click "Launch" en el dashboard de PhantomBuster
- [ ] Esperar 2-5 minutos
- [ ] Verificar resultados: deberia tener perfiles con nombre, cargo, empresa, linkedinUrl
- [ ] Si 0 resultados → revisar seccion 6.2

### Paso 5: Configurar API launch en n8n (10 min)
- [ ] Setear `PB_LINKEDIN_SEARCH_URL` en n8n con la URL de busqueda
- [ ] Verificar que `PB_LINKEDIN_AGENT_ID` = "510547627503326"
- [ ] Verificar que `PHANTOMBUSTER_API_KEY` esta configurada
- [ ] Test: ejecutar el workflow manualmente en n8n
- [ ] Verificar que los leads llegan a Convex

### Paso 6: Activar schedule
- [ ] Configurar cron: Lun/Mie/Vie a las 10am Chile
- [ ] Empezar con 25 perfiles por ejecucion
- [ ] Monitorear resultados por 1 semana antes de aumentar volumen

---

## 10. REFERENCIA RAPIDA — API

### Launch Phantom
```bash
curl -X POST https://api.phantombuster.com/api/v2/agents/launch \
  -H "X-Phantombuster-Key: 4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "510547627503326",
    "argument": "{\"search\":\"https://www.linkedin.com/search/results/people/?geoUrn=%5B%2210462161‌6%22%5D&keywords=director%20comercial&origin=FACETED_SEARCH\",\"numberOfProfiles\":25,\"extractDefaultUrl\":true}"
  }'
```

### Check Status
```bash
curl -X GET "https://api.phantombuster.com/api/v2/agents/fetch-output?id=510547627503326" \
  -H "X-Phantombuster-Key: 4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA"
```

### Get Results
```bash
curl -X GET "https://api.phantombuster.com/api/v2/agents/fetch-output?id=510547627503326" \
  -H "X-Phantombuster-Key: 4g2SqzX1xS45348lUTaaRYhF87uLc8o64HObs4QhJRA"
# Response includes resultObject with JSON array of profiles
```

---

## FUENTES

- [PhantomBuster: How to use LinkedIn Search Export](https://support.phantombuster.com/hc/en-us/articles/26971046527762)
- [PhantomBuster: Troubleshooting Inaccurate Results](https://support.phantombuster.com/hc/en-us/articles/28733572159378)
- [PhantomBuster: Cookie Expiration Errors](https://support.phantombuster.com/hc/en-us/articles/11034816771090)
- [PhantomBuster: Rate Limits by Platform](https://support.phantombuster.com/hc/en-us/articles/360017014479)
- [PhantomBuster: LinkedIn Warm-Up Timeline](https://phantombuster.com/blog/linkedin-automation/linkedin-warm-up-timeline/)
- [PhantomBuster: LinkedIn Safety for Growth Teams](https://phantombuster.com/blog/social-selling/linkedin-safety-for-growth-teams/)
- [PhantomBuster: LinkedIn Automation Safe Limits 2026](https://phantombuster.com/blog/linkedin-automation/linkedin-automation-safe-limits-2026/)
- [PhantomBuster: LinkedIn Search Limits](https://phantombuster.com/blog/social-selling/linkedin-search-limits/)
- [PhantomBuster: API Reference — /agents/launch](https://hub.phantombuster.com/reference/post_agents-launch)
- [PhantomBuster: Launch Phantom from n8n](https://support.phantombuster.com/hc/en-us/articles/27979646341906)
- [PhantomBuster: Why searches don't show all results](https://support.phantombuster.com/hc/en-us/articles/29541881497490)
- [PhantomBuster: Best Practices for Automation](https://support.phantombuster.com/hc/en-us/articles/360011875099)
- [LeadHootz: LinkedIn GeoUrn Codes](https://leadhootz.com/api/linkedin-geourn-codes/)
