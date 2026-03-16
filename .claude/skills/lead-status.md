---
name: lead-status
description: Dashboard rapido del estado de leads — totales, enrichment, outreach, listas A/B/C. Trigger con "lead status", "estado leads", "dashboard leads", "cuantos leads".
---

# Skill: Lead Status — Dashboard de Leads

Muestra un dashboard rapido del estado de toda la base de leads.

## Al invocar

Ejecutar estos comandos y presentar el resultado consolidado:

1. **Enrichment progress:**
```bash
node scripts/enrich-emails.js progress
```

2. **Routing status (si existe):**
```bash
node scripts/outreach-router.js summary 2>/dev/null || echo "Router: no ejecutado aun"
```

3. **Contar leads por lista:**
```bash
node -e "
const fs = require('fs');
const a = JSON.parse(fs.readFileSync('leads-lists/list-a-verified-email.json'));
const b = JSON.parse(fs.readFileSync('leads-lists/list-b-guessed-email.json'));
const c = JSON.parse(fs.readFileSync('leads-lists/list-c-linkedin-only.json'));
console.log('Lista A (verified):', a.length);
console.log('Lista B (guessed):', b.length);
console.log('Lista C (LinkedIn):', c.length);
console.log('Total:', a.length + b.length + c.length);
"
```

4. **Top 5 leads accionables** (SMTP verified, score alto):
```bash
node -e "
const a = require('./leads-lists/list-a-verified-email.json');
const top = a.filter(l => l.emailConfidence === 'smtp-verified').slice(0, 5);
top.forEach((l, i) => console.log((i+1) + '. ' + l.fullName + ' | ' + l.email + ' | ' + l.company));
"
```

5. **Presentar resumen al usuario** en formato tabla limpio.
