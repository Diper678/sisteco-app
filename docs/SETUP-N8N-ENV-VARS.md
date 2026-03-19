# Setup: Variables de Entorno en n8n (Railway)

> Guia para migrar secretos hardcodeados del workflow "Sisteco — Lead Scoring Pipeline"
> a variables de entorno de Railway, accedidas via `$env` en n8n.
>
> Fecha: 2026-03-15
> Tiempo estimado: ~20 minutos

---

## Contexto

El workflow **Sisteco — Lead Scoring Pipeline** (ID: `dLrpslRLhoIjMh6Y`) tiene un nodo
"Client Config" con secretos hardcodeados en JSON. Esto es un riesgo de seguridad porque:

1. Los secretos quedan visibles en la UI de n8n para cualquier usuario del workspace.
2. Si se exporta el workflow (backup o template), los secretos se filtran.
3. No se pueden rotar credenciales sin editar el workflow manualmente.

**Solucion:** Mover los secretos a variables de entorno de Railway y referenciarlos
en n8n con la sintaxis `{{ $env.VARIABLE_NAME }}`.

---

## Paso 1: Habilitar variables de entorno en n8n

n8n bloquea por defecto el acceso a `$env` en los workflows por seguridad.
Se necesita la variable de configuracion de n8n para habilitarlo.

1. Ir a **Railway Dashboard** → proyecto n8n → **Variables**
2. Agregar:

```
N8N_ALLOW_ENVIRONMENT_VARIABLES=true
```

> **Nota:** Esta variable es de configuracion de n8n, no un secreto de la app.
> Permite que los workflows lean variables de entorno del container con `$env.XXX`.

---

## Paso 2: Agregar los secretos en Railway

En el mismo panel de **Railway → Variables**, agregar cada variable:

| Variable | Valor | Descripcion |
|----------|-------|-------------|
| `PB_API_KEY` | *(ver .env)* | PhantomBuster API key |
| `PB_AGENT_ID` | *(ver .env)* | PhantomBuster LinkedIn Search agent |
| `PB_TD_AGENT_ID` | *(ver .env)* | PhantomBuster Transformacion Digital agent |
| `GEMINI_API_KEY` | *(ver .env)* | Google Gemini API key |
| `DISCORD_WEBHOOK_URL` | *(webhook URL completa)* | Discord webhook para alertas HOT |
| `LEADS_SHEET_ID` | *(ver .env)* | Google Sheets ID para leads |
| `SIMPLE_API_KEY` | *(ver .env)* | SimpleAPI.cl para consultas SII |
| `GOOGLE_CLIENT_ID` | *(OAuth client ID)* | Google OAuth para Sheets |
| `GOOGLE_CLIENT_SECRET` | *(OAuth client secret)* | Google OAuth para Sheets |

**Total: 9 variables + 1 config = 10 entradas.**

### Como agregar en Railway

1. Ir a [Railway Dashboard](https://railway.app/dashboard)
2. Seleccionar el proyecto donde corre n8n
3. Click en el servicio de n8n
4. Ir a la pestana **Variables**
5. Click **+ New Variable** para cada una
6. Alternativamente, usar **RAW Editor** y pegar todo de una vez:

```env
N8N_ALLOW_ENVIRONMENT_VARIABLES=true
PB_API_KEY=<ver .env local>
PB_AGENT_ID=<ver .env local>
PB_TD_AGENT_ID=<ver .env local>
GEMINI_API_KEY=<ver .env local>
DISCORD_WEBHOOK_URL=<ver .env local>
LEADS_SHEET_ID=<ver .env local>
SIMPLE_API_KEY=<ver .env local>
GOOGLE_CLIENT_ID=<ver .env local>
GOOGLE_CLIENT_SECRET=<ver .env local>
```

---

## Paso 3: Redeploy n8n

Despues de agregar las variables, Railway deberia hacer redeploy automatico.
Si no lo hace:

1. Ir al servicio de n8n en Railway
2. Click en **Deployments** → **Redeploy** (ultimo deploy exitoso)
3. Esperar ~2 minutos a que el servicio este healthy

**Verificar:** Abrir `https://primary-production-24f87.up.railway.app` y confirmar que n8n carga.

---

## Paso 4: Migrar el workflow

Una vez que n8n esta corriendo con las nuevas variables de entorno:

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"

# Primero: preview de cambios (no modifica nada)
node scripts/n8n-env-migrate.js --dry-run

# Si todo se ve bien: aplicar cambios
node scripts/n8n-env-migrate.js
```

El script reemplaza el JSON hardcodeado del nodo "Client Config" con expresiones `$env`:

**Antes:**
```json
{
  "pbApiKey": "4g2SqzX1xS45348l...",
  "geminiApiKey": "AIzaSyAP...",
  ...
}
```

**Despues:**
```json
{
  "pbApiKey": "{{ $env.PB_API_KEY }}",
  "geminiApiKey": "{{ $env.GEMINI_API_KEY }}",
  ...
}
```

---

## Paso 5: Verificar

### 5.1 Test en n8n UI

1. Abrir el workflow "Sisteco — Lead Scoring Pipeline" en n8n
2. Ir al nodo **Client Config**
3. Verificar que los valores muestran `{{ $env.XXX }}` (no los secretos)
4. Ejecutar manualmente el workflow → el nodo deberia resolver las variables

### 5.2 Test de resolucion de variables

En n8n, crear un workflow de prueba con un nodo Set que contenga:
```
{{ $env.PB_API_KEY }}
```

Si resuelve al valor correcto, la configuracion funciona.

### 5.3 Si algo falla: revertir

```bash
node scripts/n8n-env-migrate.js --revert
```

Esto restaura los valores hardcodeados en el nodo Client Config.

---

## Checklist de Verificacion

- [ ] `N8N_ALLOW_ENVIRONMENT_VARIABLES=true` agregado en Railway
- [ ] 9 variables de secretos agregadas en Railway
- [ ] n8n redeployed y accesible
- [ ] `node scripts/n8n-env-migrate.js --dry-run` muestra cambios correctos
- [ ] `node scripts/n8n-env-migrate.js` ejecutado exitosamente
- [ ] Workflow ejecutado manualmente sin errores
- [ ] Nodo Client Config ya no muestra secretos en texto plano
- [ ] Discord recibe notificacion de prueba (si hay leads HOT)

---

## Revertir (rollback)

Si las variables de entorno no funcionan (ej: Railway no las inyecta correctamente):

```bash
node scripts/n8n-env-migrate.js --revert
```

Esto restaura los valores hardcodeados originales. Luego investigar por que `$env` no funciona.

**Causas comunes de fallo:**
- `N8N_ALLOW_ENVIRONMENT_VARIABLES` no esta en `true`
- n8n no fue redeployed despues de agregar variables
- Typo en el nombre de la variable (case-sensitive)
- Railway no inyecta variables en el container (verificar en Deployments → Logs)

---

## Proximos pasos (post-migracion)

1. **Eliminar secretos de `n8n-update-config.js`** — ya no son necesarios ahi
2. **Repetir para otros workflows** que tengan secretos hardcodeados
3. **Documentar en `.env.example`** las variables de Railway como seccion separada
4. **Considerar Railway Shared Variables** si multiples servicios necesitan las mismas keys

---

*Generado: 2026-03-15*
