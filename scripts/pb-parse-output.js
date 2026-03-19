#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, '..', 'pb-raw.json');
const outPath = path.join(__dirname, '..', 'pb-leads-latest.json');

if (!fs.existsSync(rawPath)) {
  console.log('No existe pb-raw.json');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
console.log('Status:', data.status);

if (data.status === 'running') {
  console.log('Phantom aun corriendo...');
  if (data.output) console.log(data.output.slice(-400));
  process.exit(0);
}

if (!data.resultObject) {
  console.log('Sin resultObject');
  if (data.output) console.log('Log:', data.output.slice(-400));
  process.exit(0);
}

let profiles;
try {
  profiles = typeof data.resultObject === 'string'
    ? JSON.parse(data.resultObject)
    : data.resultObject;
} catch(e) {
  console.log('Error parse:', e.message);
  process.exit(1);
}

if (!Array.isArray(profiles)) {
  console.log('No es array');
  process.exit(0);
}

console.log('TOTAL perfiles:', profiles.length);
if (profiles[0]) console.log('Campos:', Object.keys(profiles[0]).join(', '));
console.log('');

const show = Math.min(8, profiles.length);
for (let i = 0; i < show; i++) {
  const p = profiles[i];
  console.log('--- Lead ' + (i + 1) + ' ---');
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined && String(v).trim().length > 0) {
      console.log('  ' + k + ': ' + String(v).substring(0, 120));
    }
  }
  console.log('');
}
if (profiles.length > show) console.log('... y ' + (profiles.length - show) + ' mas\n');

fs.writeFileSync(outPath, JSON.stringify(profiles, null, 2));
console.log('Guardado en', outPath);
