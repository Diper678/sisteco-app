# Sisteco AutoResearch — Design Spec

> Framework de auto-optimización continua inspirado en karpathy/autoresearch, adaptado a ventas y marketing B2B Chile.

**Fecha:** 2026-03-12
**Estado:** Draft → Reviewed
**Autor:** Claude Code + Usuario

---

## 0. Prerequisitos

Antes de implementar, deben completarse estos pasos:

### 0.1 Crear repo en GitHub

El proyecto actual no tiene git remote. Crear repo `sisteco-autoresearch` en GitHub:
```bash
gh repo create sisteco-autoresearch --private --source=. --push
```
Este es un repo **nuevo y separado** del proyecto principal de Sisteco. Solo contiene el framework de autoresearch.

### 0.2 Configurar Instantly.ai

Instantly es una dependencia nueva (no está en el stack actual):
1. Crear cuenta en instantly.ai ($30/mo plan Growth)
2. Agregar dominio de envío (NO usar sisteco.cl principal — usar un subdominio como `mail.sisteco.cl` o dominio secundario)
3. **Domain warming: 2-4 semanas** antes de enviar a volumen. Instantly tiene warmup automático.
4. Obtener API key: Settings → Integrations → API Keys
5. Agregar `INSTANTLY_API_KEY` a los secrets del repo GitHub

### 0.3 Configurar Claude Code en GitHub Actions

Autenticación de Claude Code en CI via `anthropics/claude-code-action@beta`:
```yaml
- uses: anthropics/claude-code-action@beta
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      Read modules/cold-email/program.md and generate a challenger...
    max_tokens: 4096
```
**Alternativa si Max plan no soporta CI:** Usar Anthropic API directamente ($15/MTok Opus, ~$0.30/run estimado). Agregar `ANTHROPIC_API_KEY` como secret del repo.

### 0.4 Secrets requeridos en GitHub repo

| Secret | Fuente |
|--------|--------|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `GEMINI_API_KEY` | Ya configurado en .env |
| `INSTANTLY_API_KEY` | Instantly → Settings → API |
| `DISCORD_WEBHOOK_URL` | Ya configurado |
| `N8N_API_KEY` | n8n → Settings → API |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens |
| `CONVEX_DEPLOY_KEY` | Convex dashboard |

## 1. Problema

Sisteco necesita optimizar continuamente su pipeline de ventas B2B — cold email copy, scoring de leads, y landing page copy — sin intervención humana. Hoy, todas las iteraciones de copy y prompts son manuales, sin medición sistemática de impacto.

## 2. Solución

Un framework de experimentación autónoma que corre 24/7 vía GitHub Actions. Sigue un ciclo de control cerrado: **Harvest → Analyze → Generate → Deploy → Notify**, donde Claude Code genera challengers que compiten contra baselines y el conocimiento se acumula entre iteraciones.

## 3. Decisiones de Diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Ejecución | GitHub Actions (cron) | Gratis hasta 2,000 min/mo, versionado con git |
| AI Challenger | Claude Code CLI (plan Max $100/mo) | Costo incluido en suscripción existente, mejor copy |
| AI Análisis | Gemini 2.5 Flash | Barato ($0.15/MTok), suficiente para comparar métricas |
| Cold Email | Instantly.ai | API robusta, A/B nativo, métricas por campaña |
| Notificaciones | Discord webhook | Ya configurado, zero setup |
| Operaciones diarias | n8n (se mantiene) | UI visual, webhooks, workflows existentes |
| Arquitectura | Híbrido framework + Claude Code como agente | Framework ligero, Claude razona sobre historia completa |

## 4. Arquitectura

### 4.1 Lazo de Control Cerrado

```
┌─────────────────────────────────────────────────────────┐
│                  CICLO CADA 4 HORAS                      │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ HARVEST  │──▶│ ANALYZE  │──▶│ GENERATE │            │
│  │ (metrics)│   │ (winner?)│   │ (Claude) │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│       ▲                              │                   │
│       │         ┌──────────┐   ┌──────────┐            │
│       └─────────│  NOTIFY  │◀──│  DEPLOY  │            │
│                 │ (Discord)│   │ (APIs)   │            │
│                 └──────────┘   └──────────┘            │
│                                                          │
│  Setpoint:    baseline.md (copy/prompt actual)           │
│  Controlador: Claude Code (genera challenger)            │
│  Actuador:    Instantly / Vercel / n8n                   │
│  Planta:      Leads pool / Visitors / Scored leads       │
│  Sensor:      Instantly Analytics / Vercel / Convex      │
│  Comparador:  Gemini Flash (significancia estadística)   │
│  Memoria:     results.tsv + knowledge/*.md               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Estructura del Repo

```
sisteco-autoresearch/
├── framework/
│   ├── harvest.js           # Recoge métricas (Instantly/Vercel/Convex APIs)
│   ├── analyze.js           # Gemini Flash: compara baseline vs challenger
│   ├── deploy.js            # Despliega variantes a cada plataforma
│   ├── notify.js            # Discord webhook con resultados
│   └── utils.js             # Logger, TSV parser, git helpers
│
├── modules/
│   ├── cold-email/
│   │   ├── program.md       # Brief para Claude (goal, constraints, examples)
│   │   ├── baseline.md      # Copy email actual (el "campeón")
│   │   ├── challenger.md    # Copy generado por Claude (el "retador")
│   │   ├── config.json      # Instantly API, audiencia, split %, leads pool
│   │   └── results.tsv      # commit | reply_rate | open_rate | status | desc
│   │
│   ├── lead-scoring/
│   │   ├── program.md       # Brief para optimizar prompt de scoring
│   │   ├── baseline-prompt.md   # Prompt Gemini actual
│   │   ├── challenger-prompt.md # Prompt challenger
│   │   ├── config.json      # Convex queries, sample leads, ground truth
│   │   └── results.tsv      # commit | precision | recall | f1 | status | desc
│   │
│   └── landing-copy/
│       ├── program.md       # Brief para optimizar landing
│       ├── baseline/        # HTML sections actuales (hero, CTA, social proof)
│       ├── challenger/      # Variantes generadas por Claude
│       ├── config.json      # Vercel project, analytics endpoint
│       └── results.tsv      # commit | conv_rate | bounce | status | desc
│
├── knowledge/
│   ├── global-learnings.md  # Patrones cross-módulo
│   └── per-module/
│       ├── cold-email.md    # "Subject ≤ 5 palabras → +12% open rate"
│       ├── lead-scoring.md  # "Revenue weight > headcount → +8% precision"
│       └── landing-copy.md  # "Social proof above fold → +5% conv"
│
├── data/
│   └── leads-pool.csv       # Pool de leads para cold email experiments
│
├── .github/workflows/
│   ├── harvest-analyze.yml  # Cron cada 4h: recoger + analizar + commit
│   ├── generate-challenger.yml  # Post-harvest: Claude Code genera
│   └── deploy-experiment.yml    # Post-generate: despliega + notifica
│
├── package.json
├── .env.example
└── README.md
```

### 4.3 Diferencia Clave vs Karpathy

Karpathy usa `git reset --hard` para descartar challengers perdedores. Nosotros **no revertimos** — mantenemos ambas versiones como archivos separados (`baseline.md` + `challenger.md`) porque ambas campañas deben correr simultáneamente como A/B test. Cuando el challenger gana, se promueve a `baseline.md` y Claude genera un nuevo `challenger.md`.

## 5. Módulos

### 5.1 Cold Email (Instantly)

**Objetivo:** Maximizar reply_rate de emails fríos B2B a empresas chilenas (50+ empleados).

**Flujo:**
1. **Harvest:** Instantly API → reply_rate, open_rate, bounce_rate por campaña (baseline vs challenger)
2. **Analyze:** Gemini Flash compara métricas via z-test para proporciones (p < 0.05). Min 200 leads por variante. Espera mínima 72h post-envío (replies B2B Chile pueden tardar 3-5 días). Si datos insuficientes → skip, log "INSUFFICIENT_DATA"
3. **Generate:** Claude Code lee `program.md` + `results.tsv` + `knowledge/per-module/cold-email.md` → genera nuevo challenger modificando UNA variable (subject, hook, body, CTA, o PS line)
4. **Deploy:** Instantly API → crear nueva campaña A/B, 50/50 split, 100 leads por variante del `leads-pool.csv`
5. **Notify:** Discord embed con resultado, métricas, cambio realizado, progreso acumulado

**Métricas:**
- Primary: `reply_rate` (higher is better)
- Secondary: `open_rate`
- Constraint: `bounce_rate` < 5%

**Constraints del program.md:**
- Máximo 100 palabras por email
- Subject line ≤ 8 palabras
- DEBE incluir CTA con día/hora específica
- NUNCA inventar métricas o testimonios
- Idioma: español Chile
- Respetar Ley 21.719 (opt-out visible)

**results.tsv schema:**
```
run_id	reply_rate	open_rate	bounce_rate	sample_size	status	description
```
> Nota: Se usa `run_id` (no `commit`) porque los challengers son archivos, no git resets.

### 5.2 Lead Scoring (Prompt Optimizer)

**Objetivo:** Maximizar precision del prompt de Gemini que clasifica leads como HOT/WARM/NURTURE/SKIP.

**Flujo:**
1. **Harvest:** Convex DB → leads scored + ground truth (¿se contactó? ¿respondió? ¿convirtió?)
2. **Analyze:** Gemini Flash calcula precision/recall/F1 del baseline-prompt vs challenger-prompt
3. **Generate:** Claude Code optimiza el prompt — pesos de criterios, thresholds, señales nuevas
4. **Deploy:** Actualiza prompt en el workflow n8n `saan-leads-score-ai` vía n8n API
5. **Notify:** Discord con resultados de precision/recall

**Métricas:**
- Primary: `precision` (HOT leads que realmente convierten)
- Secondary: `recall`, `f1_score`

**Nota:** Feedback loop lento (~1-2 semanas). El cron corre cada 4h pero solo genera nuevo challenger cuando hay ≥50 leads con ground truth disponible.

**results.tsv schema:**
```
run_id	precision	recall	f1	sample_size	status	description
```

### 5.3 Landing Copy (Vercel)

**Objetivo:** Maximizar conversion_rate de sisteco.cl (visita → signup/demo request).

**Flujo:**
1. **Harvest:** Vercel Analytics API → conversion_rate, bounce_rate, time_on_page por variante
2. **Analyze:** Gemini Flash aplica chi-squared test (p < 0.05), min 200 visitas por variante
3. **Generate:** Claude Code genera nuevas variantes de hero text, CTA copy, o social proof sections respetando brand guidelines de Sisteco
4. **Deploy:** Vercel deploy con A/B split via cookie `ab_variant=baseline|challenger`
5. **Notify:** Discord con resultados

**Métricas:**
- Primary: `conversion_rate` (higher is better)
- Secondary: `bounce_rate` (lower is better), `time_on_page`

**A/B Split Implementation:**
- Cookie `ab_variant` asignada en primera visita (50/50)
- Middleware JS en Vercel Edge rutea según cookie
- Variante persiste durante toda la sesión del visitor

**results.tsv schema:**
```
run_id	conv_rate	bounce_rate	avg_time	visitors	status	description
```

**Nota cross-proyecto:** La landing page vive en `C:/Users/Dell 5520/Documents/AgenticWorkflows/Landing Page/` (repo separado). El `deploy.js` del módulo landing-copy debe:
1. Copiar variantes generadas al proyecto Landing Page
2. Crear/actualizar `middleware.js` en raíz del landing project (Vercel Edge Middleware para A/B routing)
3. Ejecutar `npx vercel --prod` desde el directorio del landing project

## 6. Knowledge Base

### 6.1 Estructura

Dos niveles de conocimiento:

- **`knowledge/per-module/<module>.md`** — Learnings específicos de cada módulo. Ej: "Subject lines < 5 palabras → +12% open rate en cold email Chile B2B"
- **`knowledge/global-learnings.md`** — Patrones cross-módulo. Ej: "Brevedad gana en todos los canales", "Personalización > genérico siempre"

### 6.2 Actualización

| Trigger | Acción |
|---------|--------|
| Después de cada harvest | Claude actualiza `per-module/<module>.md` con resultado |
| Cada 10 experimentos | Claude revisa cross-module y actualiza `global-learnings.md` |
| Cada 50 experimentos | Claude consolida: resume learnings similares, elimina redundancias, mantiene max ~100 líneas por archivo. El archivo pre-consolidación se guarda como `<module>.archive-<date>.md` |

### 6.3 Cross-Pollination

Los learnings de un módulo informan a otros:
- Cold email hooks exitosos → candidatos para landing hero text
- Scoring signals efectivos → criterios de segmentación de email
- Landing CTA copy ganador → email CTA copy

Claude tiene acceso a TODOS los knowledge files al generar challengers, permitiendo transferencia de conocimiento entre módulos.

## 7. GitHub Actions

### 7.1 harvest-analyze.yml

**Trigger:** Cron `0 */4 * * *` (cada 4 horas)

**Steps:**
1. Checkout repo
2. Setup Node.js 20
3. Para cada módulo, harvest.js verifica primero si hay datos nuevos suficientes:
   - **Cold email:** ¿Han pasado ≥72h desde último deploy Y ≥200 leads con resultados? Si no → skip
   - **Lead scoring:** ¿Hay ≥50 leads con ground truth desde último análisis? Si no → skip
   - **Landing copy:** ¿Hay ≥200 visitas por variante desde último análisis? Si no → skip
4. Solo los módulos con datos suficientes pasan a `analyze.js` (Gemini Flash)
5. Git commit results.tsv changes (si hubo cambios)
6. Trigger `generate-challenger.yml` solo para módulos que analizaron

**Guard clause:** Si ningún módulo tiene datos suficientes, el workflow termina sin acción (ahorra Actions minutes).

### 7.2 generate-challenger.yml

**Trigger:** `workflow_dispatch` (post-harvest) o manual

**Steps:**
1. Checkout repo
2. Setup Claude Code CLI (anthropics/claude-code-action@beta)
3. Para cada módulo con harvest reciente:
   - Claude Code lee `modules/<module>/program.md` + `results.tsv` + `knowledge/`
   - Claude Code escribe nuevo `challenger.md` (o `challenger-prompt.md` o `challenger/`)
   - Git commit con descripción del cambio
4. Trigger `deploy-experiment.yml`

### 7.3 deploy-experiment.yml

**Trigger:** `workflow_dispatch` (post-generate) o manual

**Steps:**
1. Checkout repo
2. Setup Node.js 20
3. `node framework/deploy.js --module cold-email` (Instantly API)
4. `node framework/deploy.js --module lead-scoring` (n8n API)
5. `node framework/deploy.js --module landing-copy` (Vercel CLI)
6. `node framework/notify.js --all` (Discord webhook)
7. Git commit deploy state

## 8. Discord Notifications

### 8.1 Formato de Notificación

Cada run envía un embed por módulo con:
- Resultado: CHALLENGER WINS / BASELINE HOLDS / INSUFFICIENT DATA
- Métricas: baseline vs challenger con delta
- Cambio realizado: descripción del challenger
- Acción tomada: promovido / descartado / esperando datos
- Progreso acumulado: mejora total desde primer baseline

### 8.2 Resumen Diario

Una vez al día (8:00 AM Chile), un embed resumen con:
- Estado de cada módulo (experiments run, win rate, mejora total)
- Knowledge base highlights (top 3 learnings recientes)
- Próximos experimentos planeados

## 9. Costos

| Componente | Costo mensual |
|------------|---------------|
| GitHub Actions | ~$0 (free tier) o ~$4/mo (privado) |
| Claude Code | $0 extra (incluido en plan Max $100/mo) |
| Gemini Flash | ~$0.50/mo (análisis ligero) |
| Instantly.ai | $30/mo |
| Vercel | $0 (free tier) |
| Discord | $0 |
| **Total incremental** | **~$30-35/mo** |

> El costo es trivial comparado con el valor de un 1% más de reply rate o conversion rate.

## 10. Métricas de Éxito del Framework

| Métrica | Target (3 meses) |
|---------|-------------------|
| Cold email reply rate | 2.4% → 5%+ (+100%) |
| Lead scoring precision | 62% → 80%+ |
| Landing conversion rate | baseline → +30% mejora |
| Experiments/week | 42 (6/día × 7 días) |
| Knowledge entries | 50+ learnings documentados |

## 11. Módulos Futuros (Post-MVP)

Estos módulos se pueden agregar al framework una vez los 3 iniciales estén validados:

1. **TikTok/Instagram Scripts** — hook + estructura + CTA optimization via TikTok API
2. **YouTube Titles** — CTR optimization via YouTube Data API v3
3. **Prospección ICP** — LinkedIn search queries optimization via PhantomBuster
4. **SEO Pages** — meta tags + copy via Google Search Console API
5. **Newsletter Subject Lines** — open rate optimization via Resend API

Cada módulo nuevo requiere solo: `program.md` + `config.json` + adapter en `framework/harvest.js` y `framework/deploy.js`.

### 11.1 Estrategia de Implementación

**Implementar secuencialmente, no en paralelo.** Empezar con Cold Email (mayor impacto revenue), probar el loop end-to-end, y solo entonces agregar Lead Scoring y Landing Copy. Esto reduce complejidad para un solo founder y permite validar que el framework funciona antes de escalar.

## 12. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Claude genera copy inapropiado | program.md con constraints explícitos + brand guidelines |
| Instantly rate limits | Max 2 campañas activas simultáneas, batch de 25 leads |
| Falsos positivos (challenger "gana" por ruido) | Min sample size + test de significancia estadística |
| Knowledge base crece infinito | Consolidación cada 50 experimentos |
| API keys expiran | Health check en harvest, alerta Discord si falla |
| Leads pool se agota | Alerta Discord cuando < 100 leads. Refill: trigger n8n workflow `saan-leads-discover-phantombuster` via API |
| Un módulo falla repetidamente | Circuit breaker: 3 fallos consecutivos → pausar módulo + alerta Discord. Los otros módulos continúan independientes |
| Challenger promovido resulta peor a escala | Rollback automático: si nuevo baseline underperforms vs anterior por 2 ciclos consecutivos → revertir a baseline previo (guardado como `baseline.prev.md`) |
| Deploy parcial (un módulo falla, otros ok) | Cada módulo se despliega independientemente. Fallo en uno no bloquea los otros. Log de fallo en results.tsv como `deploy_error` |
| Challenger viola constraints de program.md | Paso de validación entre Generate y Deploy: script verifica word count, CTA presente, idioma, etc. Si falla → rechazar y re-generar |
