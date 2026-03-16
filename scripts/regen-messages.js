#!/usr/bin/env node
/**
 * regen-messages.js — Regenerate complete messages for top 20 leads using Tier 3 (templates)
 * Fixes truncated Gemini output by using deterministic templates only
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATES_DIR = path.join(ROOT, 'templates', 'outreach');
const industryHooks = require(path.join(TEMPLATES_DIR, 'industry-hooks.json'));
const roleAngles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));

function matchIndustry(industry) {
  const key = (industry || '').toLowerCase();
  for (const [k, v] of Object.entries(industryHooks)) {
    if (k !== '_default' && key.includes(k)) return v;
  }
  return industryHooks._default;
}

function matchRole(headline) {
  const text = (headline || '').toLowerCase();
  for (const [k, v] of Object.entries(roleAngles)) {
    if (k === '_default') continue;
    try { if (new RegExp(v.match, 'i').test(text)) return { key: k, ...v }; } catch {}
  }
  return { key: '_default', ...roleAngles._default };
}

const top20 = require(path.join(ROOT, 'leads-lists', 'top20-smtp-verified.json'));
const results = [];

for (const lead of top20) {
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);
  const firstName = lead.firstName || '';
  const company = lead.company || '';
  const jobTitle = lead.jobTitle || lead.headline || '';
  const industry = lead.industry || 'B2B';

  const msgs = {
    connection_note: {
      text: `Hola ${firstName}, vi que lideras ${role.angle_es} en ${company}. En Sisteco ayudamos a equipos de ventas B2B a ${ind.hook_es}. ${ind.question} — hablamos?`,
      tier: 3
    },
    follow_up_1: {
      text: `${firstName}, gracias por conectar.\n\nTe comparto un dato: ${ind.metric}.\n\nEn Sisteco estamos ayudando a empresas en ${industry} a automatizar su prospeccion B2B — ${role.value_es}.\n\nSi te interesa, te cuento mas en 15 min.\n\nFelipe`,
      tier: 3
    },
    follow_up_2: {
      text: `${firstName}, se que el tiempo es limitado. Solo queria saber: ${ind.question}\n\nSi tiene sentido, ${role.cta_es}. Si no, sin problema — quedo como contacto por si en algun momento te sirve.\n\nFelipe`,
      tier: 3
    },
    email_touch_1: {
      subject: `${company} + automatizacion B2B`,
      text: `${firstName}, te escribo porque vi tu perfil en LinkedIn y me llamo la atencion lo que estan haciendo en ${company}.\n\nMe llamo la atencion tu rol como ${jobTitle} en ${company}.\n\nEn Sisteco automatizamos la prospeccion B2B para que tu equipo de ventas solo hable con los leads que realmente quieren comprar. ${ind.metric}.\n\n${role.cta_es}?\n\nFelipe Martinez\nSisteco — Santiago, Chile`,
      tier: 3
    },
    email_touch_2: {
      subject: `dato rapido sobre ${industry}`,
      text: `${firstName}, un dato que me parecio relevante para ${company}:\n\n${ind.metric}\n\nLa mayoria de los equipos de ventas en ${industry} pierden tiempo en leads frios. ${role.value_es}.\n\nSi te interesa ver como funciona, ${role.cta_es}.\n\nFelipe`,
      tier: 3
    },
    email_touch_3: {
      subject: `${ind.metric.split(' ').slice(0, 4).join(' ')} en 30 dias`,
      text: `${firstName}, corto y al punto:\n\nEmpresas B2B en Chile que automatizan su pipeline de ventas estan viendo ${ind.metric}. La diferencia: responder rapido y solo a los leads correctos.\n\n${ind.pain_es}.\n\n15 minutos para mostrarte como? ${role.cta_es}.\n\nFelipe`,
      tier: 3
    },
    email_touch_4: {
      subject: `${firstName}, una pregunta`,
      text: `${firstName}, te lo pregunto directo: ${ind.question}\n\nSi la respuesta es si, te muestro en 15 minutos como lo resolvemos. Si no, todo bien — no insisto mas.\n\n${role.cta_es}?\n\nFelipe`,
      tier: 3
    },
    email_touch_5: {
      subject: `ultima vez que escribo`,
      text: `${firstName}, entiendo que no es el momento o que esto no te interesa. Sin drama.\n\nSolo queria dejarte el dato: ${ind.metric}. Si en algun momento quieres explorar como automatizar ventas B2B, estoy a un mensaje de distancia.\n\nExito con ${company}.\n\nFelipe`,
      tier: 3
    }
  };

  results.push({
    leadId: lead.linkedinProfileUrl || lead.profileUrl || '',
    fullName: lead.fullName,
    company: lead.company,
    email: lead.email,
    jobTitle: lead.jobTitle || lead.headline || '',
    industry: lead.industry || '',
    linkedinUrl: lead.linkedinProfileUrl || lead.profileUrl || '',
    score: lead.score || 0,
    tier: 3,
    messages: msgs
  });
}

// Save JSON
fs.writeFileSync(path.join(ROOT, 'leads-lists', 'personalized-messages.json'), JSON.stringify(results, null, 2));

// Generate ready-to-send.md
let md = '# Outreach Ready-to-Send — Top 20 Leads SMTP Verified\n\n';
md += '> Generado: 2026-03-16\n';
md += `> Total: ${results.length} leads, priorizados por ICP score\n\n---\n\n`;

for (let i = 0; i < results.length; i++) {
  const r = results[i];
  md += `## ${i + 1}. ${r.fullName} — ${r.company} (Score: ${r.score})\n\n`;
  md += `**Email:** ${r.email}\n`;
  md += `**Cargo:** ${r.jobTitle}\n`;
  md += `**Industria:** ${r.industry}\n`;
  md += `**LinkedIn:** ${r.linkedinUrl}\n\n`;

  const order = [
    ['email_touch_1', 'Email 1: Intro (Day 0)'],
    ['email_touch_2', 'Email 2: Value (Day 3)'],
    ['email_touch_3', 'Email 3: Case Study (Day 7)'],
    ['email_touch_4', 'Email 4: Direct Ask (Day 12)'],
    ['email_touch_5', 'Email 5: Breakup (Day 18)'],
    ['connection_note', 'LinkedIn Connection Note (max 300 chars)'],
    ['follow_up_1', 'LinkedIn Follow-up 1 (Value)'],
    ['follow_up_2', 'LinkedIn Follow-up 2 (CTA)'],
  ];

  for (const [key, label] of order) {
    const msg = r.messages[key];
    md += `### ${label}\n`;
    if (msg.subject) md += `**Subject:** ${msg.subject}\n\n`;
    md += msg.text + '\n\n';
  }
  md += '---\n\n';
}

fs.writeFileSync(path.join(ROOT, 'leads-lists', 'ready-to-send.md'), md);
console.log(`Generated ${results.length} leads with COMPLETE messages`);
console.log(`Email 1 avg length: ${Math.round(results.reduce((a, r) => a + r.messages.email_touch_1.text.length, 0) / results.length)} chars`);
console.log(`Connection note avg: ${Math.round(results.reduce((a, r) => a + r.messages.connection_note.text.length, 0) / results.length)} chars`);
console.log(`Files: leads-lists/personalized-messages.json + leads-lists/ready-to-send.md`);
