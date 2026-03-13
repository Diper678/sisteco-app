# Piloto SII + Firecrawl -> Notion

> **Fecha:** 2026-03-12
> **Estado:** Aprobado (rev2 — issues del reviewer resueltos)
> **Scope:** Micro-piloto 50 empresas chilenas medianas+

---

## Objetivo

Validar el flujo completo de extraccion de datos B2B chilenos:
SII (nomina publica) + SimpleAPI (enriquecimiento tributario) + Firecrawl (scraping web) -> Notion (base de datos limpia).

PhantomBuster esta operativo con busqueda LinkedIn normal, por lo que el pipeline completo de leads esta desbloqueado.

---

## Arquitectura

```
SII Nomina TXT (descarga manual desde sii.cl)
        |
        v
  [1] Parser Node.js (scripts/sii-pilot.js)
  Filtrar: rubro tech/servicios + medianas+ (25K UF) + vigentes
  Output: 50 empresas con RUT, razon social, rubro, N trabajadores, region
        |
        v
  [2] SimpleAPI Enrichment (por nombre de empresa)
  Endpoint: GET https://api.simpleapi.cl/api/rut/buscar?q={empresa_name}
  Auth: Authorization: Bearer {SIMPLE_API_KEY}
  Datos: situacion tributaria, actividades economicas, direccion actualizada
  Free tier: 500 queries/mes (suficiente para 50 empresas)
        |
        v
  [3] Firecrawl Scraping (sitio web de cada empresa)
  Discovery: Firecrawl search endpoint para encontrar website
  Extract: Firecrawl scrape con schema JSON para datos de contacto
  API: POST https://api.firecrawl.dev/v1/scrape (Bearer FIRECRAWL_API_KEY)
  Free tier: 500 credits/mes (1 scrape = 1 credit, 50 << 500)
        |
        v
  [4] Consolidar + Push a Notion
  SDK: @notionhq/client (ya instalado)
  DB: creada manualmente en Notion (prerequisito)
  Dedup: por RUT (si ya existe, actualizar)
```

---

## Filtros del piloto

- **Tamano:** Medianas+ (tramo ventas >= 25.000 UF, codigos SII "5", "6", "7"+)
- **Rubro:** Tecnologia, servicios profesionales, ventas/prospeccion B2B, comercio exterior
- **Estado:** Empresa vigente (sin fecha termino giro)
- **Cantidad:** 50 empresas (primeras que cumplan criterios)

---

## Formato archivo SII TXT

**Descarga:** `https://www.sii.cl/estadisticas/nominas/PUB_EMPRESAS_PJ_2020_A_2024.zip`
(ZIP contiene TXT con datos 2020-2024, ultima actualizacion febrero 2026)

**Encoding:** ISO-8859-1 (Latin-1) — comun en archivos del gobierno chileno.
El script debe convertir a UTF-8 al parsear.

**Delimitador:** `;` (punto y coma)

**Columnas esperadas:**
```
RUT;DV;RAZON_SOCIAL;TRAMO_VENTAS;N_TRABAJADORES;REGION;COMUNA;
RUBRO;SUBRUBRO;ACTIVIDAD_ECONOMICA;FECHA_INICIO;TIPO_CONTRIBUYENTE;
TRAMO_CAPITAL
```

**Mapeo tramo ventas SII:**
| Codigo | Categoria | UF anuales | Target |
|--------|-----------|------------|--------|
| 1 | Sin ventas | 0 | No |
| 2 | Micro 1 | 0 - 800 | No |
| 3 | Micro 2 | 800 - 2.400 | No |
| 4 | Pequena 1 | 2.400 - 5.000 | No |
| 5 | Pequena 2 | 5.000 - 10.000 | No |
| 6 | Pequena 3 | 10.000 - 25.000 | No |
| 7 | Mediana 1 | 25.000 - 50.000 | **SI** |
| 8 | Mediana 2 | 50.000 - 100.000 | **SI** |
| 9 | Grande 1 | 100.000 - 200.000 | **SI** |
| 10+ | Grande 2+ | > 200.000 | SI |

**Nota:** Los codigos exactos pueden variar. El script debe inspeccionar las primeras filas
del archivo real para ajustar columnas y codigos si es necesario. Se guarda un archivo
intermedio `data/sii-parsed.json` para no re-parsear.

---

## Schema Notion (propiedades de la base de datos)

La DB debe crearse **manualmente** en Notion antes de ejecutar el script.
Usar env var separada: `NOTION_SII_DATABASE_ID` (distinta de la DB de leads).

| Campo | Fuente | Tipo Notion |
|-------|--------|-------------|
| RUT | SII | Title |
| Razon Social | SII | Text |
| Rubro | SII | Select |
| Subrubro | SII | Text |
| Tramo Ventas | SII | Select |
| N Trabajadores | SII | Number |
| Region | SII | Select |
| Comuna | SII | Text |
| Fecha Inicio | SII | Date |
| Situacion Tributaria | SimpleAPI | Select |
| Actividades Economicas | SimpleAPI | Text |
| Direccion | SimpleAPI | Text |
| Website | Firecrawl | URL |
| Website Encontrado | Firecrawl | Checkbox |
| Email Contacto | Firecrawl | Email |
| Telefono | Firecrawl | Phone |
| Descripcion Servicios | Firecrawl | Text |
| Equipo Directivo | Firecrawl | Text |
| Fuente | Script | Select (valor: "SII Piloto") |

---

## Implementacion: script unico `scripts/sii-pilot.js`

### Paso 1: Parsear nomina SII

- Leer archivo TXT desde `data/sii-nomina-pj.txt` (o ZIP extraido)
- Convertir encoding ISO-8859-1 → UTF-8
- Parsear columnas delimitadas por `;`
- Inspeccionar primera fila para detectar header vs datos
- Filtrar por: tramo ventas >= 7 (mediana+), rubro match, sin fecha termino giro
- Tomar las primeras 50
- **Guardar intermedio:** `data/sii-parsed.json` (para reanudar sin re-parsear)

### Paso 2: Enriquecer con SimpleAPI

- Para cada empresa, buscar por nombre: `GET /api/rut/buscar?q={razon_social}`
- Header: `Authorization: Bearer {SIMPLE_API_KEY}`
- Rate limit: 1 call/segundo (delay 1000ms entre calls)
- Si falla: registrar error, continuar con la siguiente
- **Guardar intermedio:** `data/sii-enriched.json`

### Paso 3: Scraping con Firecrawl

**Descubrimiento de website:**
- Usar Firecrawl search: `POST https://api.firecrawl.dev/v1/search`
  con query `{razon_social} Chile sitio oficial`
- Tomar el primer resultado como website candidato
- Validar que el dominio no sea linkedin.com, facebook.com, etc.

**Extraccion de datos:**
- Usar Firecrawl scrape: `POST https://api.firecrawl.dev/v1/scrape`
- Schema de extraccion (en `formats: ["extract"]`):
```json
{
  "extract": {
    "schema": {
      "type": "object",
      "properties": {
        "emails": { "type": "array", "items": { "type": "string" } },
        "phones": { "type": "array", "items": { "type": "string" } },
        "description": { "type": "string" },
        "services": { "type": "array", "items": { "type": "string" } },
        "team": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "role": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```
- Rate limit: 2 segundos entre calls (Firecrawl free: ~3 req/min)
- Si no encuentra website: marcar `websiteFound: false`, continuar
- **Guardar intermedio:** `data/sii-scraped.json`

### Paso 4: Push a Notion

- Leer `data/sii-scraped.json` (resultado final consolidado)
- Para cada empresa: crear pagina en Notion con todas las propiedades
- Deduplicacion por RUT en titulo (query existing, update si existe)
- Rate limit: 350ms entre calls (Notion API: 3 req/sec)

### CLI flags

```bash
node scripts/sii-pilot.js                    # Ejecuta todo
node scripts/sii-pilot.js --dry-run           # Solo parsea SII, muestra 50 empresas, no llama APIs
node scripts/sii-pilot.js --from enriched     # Resume desde paso 3 (lee sii-enriched.json)
node scripts/sii-pilot.js --from scraped      # Resume desde paso 4 (lee sii-scraped.json)
```

---

## Prerequisitos

1. **Descargar nomina SII:**
   - URL: `https://www.sii.cl/estadisticas/nominas/PUB_EMPRESAS_PJ_2020_A_2024.zip`
   - Extraer el TXT del ZIP
   - Guardar en `data/sii-nomina-pj.txt`
   - Crear directorio `data/` y agregar a `.gitignore`

2. **Crear base de datos Notion:**
   - Crear una DB nueva en Notion con las columnas del schema
   - Compartir con la integracion (Settings > Connections > agregar integracion)
   - Copiar el Database ID de la URL

3. **Variables en .env:**
   - `SIMPLE_API_KEY` = ✅ configurada (0315-R920-...)
   - `FIRECRAWL_API_KEY` = ✅ configurada
   - `NOTION_API_KEY` = verificar / crear integracion en notion.so/my-integrations
   - `NOTION_SII_DATABASE_ID` = copiar de URL de la nueva DB

4. **npm dependencies:**
   - `@notionhq/client` ✅ instalado
   - `dotenv` ✅ instalado
   - No se necesita SDK de Firecrawl — se usan llamadas HTTP directas (patron de notion-sync.js)

---

## Constraints

- **SimpleAPI:** Free tier 500 queries/mes — suficiente para 50 empresas.
  El workflow n8n existente usa limite conservador de 10/mes; el script del piloto no tiene esa restriccion.
- **Firecrawl:** Free tier 500 credits/mes. 50 search + 50 scrape = 100 credits (holgado).
- **Encoding SII:** Puede ser ISO-8859-1 o UTF-8. El script debe detectar y convertir.
- **Formato TXT SII:** Puede variar entre versiones. El script valida headers antes de parsear.

---

## Criterio de exito

- [ ] 50 empresas parseadas del TXT SII
- [ ] 50 empresas enriquecidas con datos SimpleAPI
- [ ] 30+ empresas con datos de Firecrawl (no todas tendran sitio web)
- [ ] Base de datos Notion con datos limpios y estructurados
- [ ] Script reproducible: `node scripts/sii-pilot.js`
- [ ] Archivos intermedios permiten resumir desde cualquier paso

---

## PhantomBuster desbloqueado (2026-03-12)

PhantomBuster funciona con busqueda LinkedIn normal (sin Sales Navigator).
Pipeline completo operativo:
- PhantomBuster -> contactos LinkedIn
- SII -> datos firmograficos empresa
- Firecrawl -> sitio web + contactos adicionales
- Notion -> base consolidada

El piloto SII+Firecrawl valida datos empresariales.
PhantomBuster valida contactos. Juntos completan el MVP.
