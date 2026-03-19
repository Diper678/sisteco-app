#!/usr/bin/env node
/**
 * n8n-backup.js — Backup automático de workflows n8n vía API REST
 *
 * Uso:
 *   node scripts/n8n-backup.js           # Solo exportar
 *   node scripts/n8n-backup.js --git     # Exportar + commit + push
 *
 * Variables de entorno requeridas:
 *   N8N_HOST      URL de la instancia n8n (ej: https://primary-production-24f87.up.railway.app)
 *   N8N_API_KEY   API key de n8n (Settings → API → Create API Key)
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Configuración ───────────────────────────────────────────────────────────

const N8N_HOST = (process.env.N8N_HOST || 'https://primary-production-24f87.up.railway.app').replace(/\/$/, '');
const N8N_API_KEY = process.env.N8N_API_KEY;
const USE_GIT = process.argv.includes('--git');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'n8n-workflows');
const WORKFLOWS_DIR = path.join(OUTPUT_DIR, 'workflows');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convierte un nombre de workflow en un slug válido para nombre de archivo.
 * Ej: "Lead Generation Pipeline (v2)" → "lead-generation-pipeline-v2"
 */
function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // eliminar tildes
    .replace(/[^a-z0-9\s-]/g, '')    // eliminar caracteres especiales
    .trim()
    .replace(/\s+/g, '-')            // espacios → guiones
    .replace(/-+/g, '-');            // guiones múltiples → uno solo
}

/**
 * Llamada autenticada a la API de n8n.
 */
async function n8nFetch(endpoint) {
  const url = `${N8N_HOST}/api/v1${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`n8n API error ${res.status} en ${endpoint}: ${body}`);
  }

  return res.json();
}

/**
 * Obtiene todos los workflows paginando si es necesario.
 * La API de n8n devuelve { data: [...], nextCursor } para paginación.
 */
async function getAllWorkflows() {
  const workflows = [];
  let cursor = null;

  do {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const page = await n8nFetch(`/workflows${qs}`);

    // La API puede devolver array directo o { data: [...] }
    const items = Array.isArray(page) ? page : (page.data || []);
    workflows.push(...items);
    cursor = page.nextCursor || null;
  } while (cursor);

  return workflows;
}

/**
 * Obtiene la definición completa de un workflow individual.
 */
async function getWorkflow(id) {
  return n8nFetch(`/workflows/${id}`);
}

/**
 * Garantiza que un directorio exista (crea recursivamente si no existe).
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Genera el README.md de restauración dentro de n8n-workflows/.
 */
function writeReadme() {
  const content = `# n8n Workflows Backup

Exportado automáticamente por \`scripts/n8n-backup.js\`

## Cómo restaurar un workflow

1. Abre n8n en ${N8N_HOST}
2. Ir a **Workflows → Import**
3. Seleccionar el archivo \`.json\` correspondiente de la carpeta \`workflows/\`

## Cómo ejecutar el backup

\`\`\`bash
# Solo exportar
node scripts/n8n-backup.js

# Exportar + commit + push a GitHub
node scripts/n8n-backup.js --git

# Via npm scripts
npm run n8n:backup
npm run n8n:backup:git
\`\`\`

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| \`N8N_HOST\` | URL de la instancia n8n (ej: \`https://primary-production-24f87.up.railway.app\`) |
| \`N8N_API_KEY\` | Obtener en n8n → Settings → API → Create API Key |

## Estructura de carpetas

\`\`\`
n8n-workflows/
├── workflows/
│   ├── [workflow-name-slug].json   # Un archivo por workflow
│   └── ...
├── manifest.json                   # Índice de todos los workflows exportados
└── README.md                       # Este archivo
\`\`\`

> Los archivos \`workflows/*.json\` y \`manifest.json\` están en \`.gitignore\` cuando se generan
> automáticamente. Para incluirlos en git, usa el flag \`--git\` que hace commit explícito.
`;
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), content, 'utf8');
}

/**
 * Ejecuta git add + commit + push.
 * Maneja el caso donde no hay cambios (git commit retorna código 1).
 */
function gitCommitAndPush() {
  console.log('\n🚀 Commit y push a GitHub...');

  try {
    // Stage solo la carpeta de backups
    execSync('git add n8n-workflows/', {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });

    const fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const message = `backup(n8n): export ${fecha}`;

    execSync(`git commit -m "${message}"`, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
    });

    execSync('git push', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });

    console.log('✅ Push completado');
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';

    // git commit sale con código 1 cuando no hay nada que commitear
    if (stdout.includes('nothing to commit') || stderr.includes('nothing to commit')) {
      console.log('ℹ️  Sin cambios nuevos — nada que commitear');
    } else {
      console.error('❌ Error en git:', stderr || stdout || err.message);
      process.exit(1);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validar API key antes de hacer cualquier cosa
  if (!N8N_API_KEY) {
    console.error('\n❌  N8N_API_KEY no está definida.\n');
    console.error('Para obtener una API key:');
    console.error(`  1. Abre n8n en ${N8N_HOST}`);
    console.error('  2. Ve a Settings → n8n API');
    console.error('  3. Haz clic en "Create an API key"');
    console.error('  4. Copia la key y agrégala al archivo .env:\n');
    console.error('     N8N_API_KEY=tu_api_key_aqui\n');
    process.exit(1);
  }

  console.log(`🔄 Conectando a n8n en ${N8N_HOST}...`);

  // Obtener lista de workflows
  let workflowList;
  try {
    workflowList = await getAllWorkflows();
  } catch (err) {
    console.error(`\n❌ No se pudo conectar a n8n: ${err.message}`);
    console.error('Verifica que N8N_HOST sea correcto y que la instancia esté activa.');
    process.exit(1);
  }

  console.log(`✅ Encontrados ${workflowList.length} workflows`);

  // Preparar directorios
  ensureDir(OUTPUT_DIR);
  ensureDir(WORKFLOWS_DIR);

  // Exportar cada workflow
  const manifestEntries = [];
  let exported = 0;
  let failed = 0;

  for (const wf of workflowList) {
    const label = wf.name || `workflow-${wf.id}`;
    process.stdout.write(`📥 Exportando: ${label}... `);

    try {
      const fullWorkflow = await getWorkflow(wf.id);
      const slug = slugify(label);
      const filename = `${slug}.json`;
      const filePath = path.join(WORKFLOWS_DIR, filename);

      fs.writeFileSync(filePath, JSON.stringify(fullWorkflow, null, 2), 'utf8');

      manifestEntries.push({
        id: wf.id,
        name: wf.name,
        filename,
        active: wf.active ?? false,
        status: 'ok',
      });

      exported++;
      console.log('✅');
    } catch (err) {
      failed++;
      console.log('❌');
      console.error(`   Error: ${err.message}`);

      manifestEntries.push({
        id: wf.id,
        name: wf.name,
        filename: null,
        active: wf.active ?? false,
        status: 'error',
        error: err.message,
      });
    }
  }

  // Escribir manifest.json
  const manifest = {
    exportedAt: new Date().toISOString(),
    host: N8N_HOST,
    totalWorkflows: workflowList.length,
    exported,
    failed,
    workflows: manifestEntries,
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  // Escribir/actualizar README.md
  writeReadme();

  console.log(`\n📁 Guardado en: n8n-workflows/`);
  console.log(`📋 Manifest: ${exported} workflows exportados${failed > 0 ? `, ${failed} con errores` : ''}`);

  // Git commit + push si se solicitó
  if (USE_GIT) {
    gitCommitAndPush();
  }

  console.log('\n✅ Backup completo');

  if (failed > 0) {
    process.exit(1); // Salir con error si algún workflow falló
  }
}

main().catch((err) => {
  console.error('\n❌ Error inesperado:', err.message);
  process.exit(1);
});
