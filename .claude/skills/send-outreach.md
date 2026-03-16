---
name: send-outreach
description: Generar mensajes personalizados listos para enviar a leads especificos o en batch. Trigger con "send outreach", "enviar outreach", "draft messages", "generar mensajes", "contactar leads".
---

# Skill: Send Outreach — Generar mensajes listos para enviar

Genera mensajes personalizados de outreach (email + LinkedIn) para leads especificos o en batch.

## Modos de uso

### Modo 1: Top N leads por ICP score
Si el usuario dice "send outreach top 10" o "generar mensajes para los mejores 10":

```bash
node scripts/personalize-messages.js batch --input pb-leads-enriched.json --limit 10
```

### Modo 2: Lead especifico
Si el usuario menciona un nombre o empresa:

1. Buscar el lead en `pb-leads-enriched.json`:
```bash
node -e "const l = require('./pb-leads-enriched.json').find(x => x.company.toLowerCase().includes('EMPRESA')); console.log(JSON.stringify(l))"
```

2. Generar mensajes:
```bash
node scripts/personalize-messages.js generate --lead-file [temp file with lead JSON]
```

### Modo 3: Por industria
```bash
node -e "
const leads = require('./pb-leads-enriched.json').filter(l => (l.industry || '').toLowerCase().includes('INDUSTRIA') && l.email);
console.log('Leads en industria:', leads.length);
const fs = require('fs');
fs.writeFileSync('leads-lists/batch-industry.json', JSON.stringify(leads));
" && node scripts/personalize-messages.js batch --input leads-lists/batch-industry.json --limit 20
```

## Despues de generar

1. Crear archivo `leads-lists/ready-to-send.md` formateado para copy-paste:
   - Para cada lead: nombre, email, empresa, cargo
   - Subject line + body de cada email
   - LinkedIn connection note
   - LinkedIn follow-ups

2. Informar al usuario:
   - Cuantos mensajes se generaron
   - Que tier se uso (Claude/Gemini/Templates)
   - Archivo listo para copiar-pegar

## Tiers de personalizacion
- **Score >= 80 (HOT):** Claude Sonnet (si ANTHROPIC_API_KEY set) o Gemini Flash
- **Score 50-79 (WARM):** Gemini 2.5 Flash (reescritura de templates)
- **Score < 50 (NURTURE):** Templates deterministicos (sin API)
