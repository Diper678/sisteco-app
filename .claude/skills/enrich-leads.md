---
name: enrich-leads
description: >
  Enriquecer leads con emails usando pipeline multi-capa (dominios, patrones, MX, export).
  Usa PhantomBuster Email Finder + resolucion propia de dominios.
  Activar cuando el usuario diga: enrich leads, enriquecer leads, find emails, buscar emails,
  email enrichment, encontrar correos.
triggers:
  - enrich leads
  - enriquecer leads
  - find emails
  - buscar emails
  - email enrichment
  - encontrar correos
  - enrich
  - enrichment
---

# Enrich Leads — Pipeline de enriquecimiento de emails

> Combina dos motores: `enrich-emails.js` (resolucion propia de dominios + MX) y
> `pb-email-finder.js` (PhantomBuster Professional Email Finder).

## Directorio de trabajo

```
C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company
```

## Paso 1: Mostrar estado actual

Siempre comenzar mostrando el progreso actual de ambos motores:

```bash
cd "C:/Users/Dell 5520/Documents/AgenticWorkflows/The Agentic Company"
node scripts/enrich-emails.js progress
```

Si existe `pb-email-progress.json`, tambien mostrar:

```bash
node scripts/pb-email-finder.js progress
```

Reportar al usuario:
- Total leads sin email
- Leads con dominio resuelto
- Leads con candidatos generados
- Leads con MX verificado
- Leads ya enriquecidos con email

## Paso 2: Ofrecer acciones

Preguntar al usuario que quiere hacer:

### Opcion A: Pipeline completo (recomendado)

Ejecuta todos los pasos en secuencia:

```bash
node scripts/enrich-emails.js enrich
```

Esto ejecuta: resolve-domains -> generate-candidates -> verify-mx -> export

### Opcion B: Pasos individuales

```bash
# Solo resolver dominios de empresas
node scripts/enrich-emails.js resolve-domains

# Solo generar candidatos de email (requiere dominios resueltos)
node scripts/enrich-emails.js generate-candidates

# Solo verificar MX records
node scripts/enrich-emails.js verify-mx

# Solo exportar leads enriquecidos
node scripts/enrich-emails.js export
```

### Opcion C: PhantomBuster Email Finder (mas preciso, usa creditos PB)

```bash
# Preparar batch para PB
node scripts/pb-email-finder.js prepare

# Lanzar phantom (siguiente batch)
node scripts/pb-email-finder.js launch

# Ciclo completo: launch -> wait -> collect
node scripts/pb-email-finder.js run

# Recoger resultados
node scripts/pb-email-finder.js collect

# Mergear emails encontrados al JSON principal
node scripts/pb-email-finder.js merge

# Exportar CSV de leads que necesitan email
node scripts/pb-email-finder.js export-csv
```

## Paso 3: Mostrar resultados

Despues de cualquier ejecucion, mostrar:

```bash
node scripts/enrich-emails.js progress
```

Reportar al usuario:
- Cuantos emails nuevos se encontraron
- Tasa de exito (% leads con email)
- Cuantos quedan pendientes
- Siguiente accion recomendada

## Archivos clave

| Archivo | Contenido |
|---------|-----------|
| `pb-leads-latest.json` | Leads crudos de PhantomBuster |
| `pb-leads-enriched.json` | Leads con emails enriquecidos |
| `pb-company-domains.json` | Dominios resueltos por empresa |
| `pb-email-progress.json` | Progreso del PB Email Finder |

## Variables de entorno necesarias (.env)

```
PHANTOMBUSTER_API_KEY   — Para PB Email Finder
PB_EMAIL_FINDER_ID      — Phantom ID (default: 5808820309237769)
HUNTER_API_KEY          — Opcional, Hunter.io (25 free/month)
FIRECRAWL_API_KEY       — Opcional, para scraping de websites
```
