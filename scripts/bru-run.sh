#!/bin/bash
# bru-run.sh — Wrapper que carga .env antes de correr Bruno CLI
# Uso: bash scripts/bru-run.sh <folder> [env] [extra-flags]
# Ejemplo: bash scripts/bru-run.sh gemini-api/ development

# Extrae variables con grep en lugar de source (evita problemas con valores
# que contienen espacios, <>, $, etc. como FROM_EMAIL=Sisteco <hola@sisteco.cl>)
_env_get() { grep "^${1}=" .env 2>/dev/null | head -1 | cut -d= -f2-; }

FOLDER=${1:-""}
ENV=${2:-"development"}
shift 2 2>/dev/null

# Cargar variables del .env
GEMINI_KEY=$(_env_get GEMINI_API_KEY)
PB_KEY=$(_env_get PHANTOMBUSTER_API_KEY)
PB_AGENT_ID=$(_env_get PB_LINKEDIN_AGENT_ID)
FIRECRAWL_KEY=$(_env_get FIRECRAWL_API_KEY)
CONVEX_URL=$(_env_get CONVEX_SITE_URL)

# Construir flags --env-var (solo los que tienen valor)
ENV_VARS=""
[ -n "$GEMINI_KEY" ]    && ENV_VARS="$ENV_VARS --env-var gemini_api_key=${GEMINI_KEY}"
[ -n "$PB_KEY" ]        && ENV_VARS="$ENV_VARS --env-var pb_api_key=${PB_KEY}"
[ -n "$PB_AGENT_ID" ]   && ENV_VARS="$ENV_VARS --env-var pb_agent_id=${PB_AGENT_ID}"
[ -n "$FIRECRAWL_KEY" ] && ENV_VARS="$ENV_VARS --env-var firecrawl_api_key=${FIRECRAWL_KEY}"
[ -n "$CONVEX_URL" ]    && ENV_VARS="$ENV_VARS --env-var convex_url=${CONVEX_URL}"

cd bruno-collections && bru run $FOLDER --env $ENV $ENV_VARS "$@"
