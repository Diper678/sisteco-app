---
name: prospect
description: Dashboard de prospección B2B — lanzar scrape LinkedIn, ver estado del pipeline, encolar leads HOT. Usar el sisteco-cli.js para todas las operaciones. Trigger con "prospect", "prospectar", "pipeline", "outreach status", "lanzar scrape".
---

# Skill: Prospect — Prospección B2B desde Terminal

Controla el pipeline de prospección completo usando `sisteco-cli.js`.

## Al invocar

1. **Ver estado del pipeline:**
```bash
node scripts/sisteco-cli.js leads status
```

2. **Lanzar scrape LinkedIn (si necesita más leads):**
```bash
node scripts/sisteco-cli.js leads prospect
# Con URL personalizada:
node scripts/sisteco-cli.js leads prospect --url "https://linkedin.com/search/..." --count 30
```

3. **Ver ejecuciones recientes de n8n:**
```bash
node scripts/sisteco-cli.js workflow status
```

4. **Encolar HOT leads para email sequences:**
```bash
# Preview primero
node scripts/sisteco-cli.js leads enqueue --dry-run
# Encolar real
node scripts/sisteco-cli.js leads enqueue --min-score 70
```

5. **Presentar resumen al usuario:**

```
PIPELINE DE PROSPECCIÓN SISTECO
================================
[output de leads status]

Workflows n8n activos:
[output de workflow list]

Acciones disponibles:
→ sisteco leads prospect        → Nuevo scrape LinkedIn
→ sisteco leads enqueue         → Encolar HOT leads
→ sisteco workflow run score    → Forzar scoring ahora
→ sisteco api test gemini       → Verificar APIs
```

## Referencia rápida

Ver skill completa: `.claude/skills/cli-tooling.md`
Workflows disponibles: `node scripts/sisteco-cli.js workflow list`
