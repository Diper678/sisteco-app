---
name: lead-status
description: Dashboard rápido del estado de leads y pipeline n8n. Trigger con "lead status", "estado leads", "dashboard leads", "cuantos leads", "como va el pipeline".
---

# Skill: Lead Status — Dashboard de Leads

Muestra estado completo del pipeline usando `sisteco-cli.js`.

## Al invocar

Ejecutar:
```bash
node scripts/sisteco-cli.js leads status
```

Esto muestra automáticamente:
- Últimas 5 ejecuciones de n8n (con estado ✅/❌/🔄)
- Estado actual de PhantomBuster (último run, créditos)
- Conteo de leads en listas locales (Lista A verified, Lista B guessed)

Luego, si se quiere detalle de n8n:
```bash
node scripts/sisteco-cli.js workflow list
node scripts/sisteco-cli.js workflow status
```

## Presentar al usuario

```
ESTADO DEL PIPELINE — SISTECO
==============================
[output de leads status]

Para acciones:
  sisteco leads prospect           → Nuevo scrape LinkedIn
  sisteco leads enqueue --dry-run  → Preview HOT leads listos para enviar
  sisteco workflow list            → Ver workflows activos/inactivos
```

## Referencia completa

Ver skill: `.claude/skills/cli-tooling.md`
