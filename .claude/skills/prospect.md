---
name: prospect
description: Dashboard de prospeccion B2B — estado del pipeline, leads por lista, acciones rapidas. Trigger con "prospect", "prospectar", "pipeline", "outreach status".
---

# Skill: Prospect — Dashboard de Prospeccion

Muestra el estado completo del pipeline de prospeccion B2B y ofrece acciones rapidas.

## Al invocar

1. **Mostrar estado del enrichment:**
```bash
node scripts/enrich-emails.js progress
```

2. **Mostrar routing de outreach:**
```bash
node scripts/outreach-router.js summary
```

3. **Mostrar leads con mensajes personalizados:**
```bash
ls -la leads-lists/personalized-messages.json 2>/dev/null && node -e "const m = require('./leads-lists/personalized-messages.json'); console.log('Leads con mensajes:', m.length)"
```

4. **Presentar resumen al usuario:**

```
PIPELINE DE PROSPECCION SISTECO
===============================
Total leads:        [X]
Lista A (verified): [X] → cold email ready
Lista B (guessed):  [X] → try with caution
Lista C (LinkedIn): [X] → LinkedIn outreach

Routing:
  DUAL channel:     [X] leads
  EMAIL only:       [X] leads
  LINKEDIN only:    [X] leads

Mensajes personalizados: [X] leads
Ready to send:           [X] leads
```

5. **Ofrecer acciones rapidas:**
- "Generar mensajes para top N" → `node scripts/personalize-messages.js batch --input pb-leads-enriched.json --limit N`
- "Exportar listas" → `node scripts/enrich-emails.js export`
- "Ver ready-to-send" → leer `leads-lists/ready-to-send.md`
- "Rutear leads" → `node scripts/outreach-router.js route`
- "Enviar batch LinkedIn" → `node scripts/linkedin-outreach.js send-batch`
