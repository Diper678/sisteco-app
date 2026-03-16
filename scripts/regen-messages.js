#!/usr/bin/env node
/**
 * regen-messages.js — Regenerate messages using template FILES (not hardcoded)
 * Reads templates from templates/outreach/ and fills variables
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

function loadTemplate(filePath) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filePath), 'utf-8').replace(/\r\n/g, '\n');
}

function fillVars(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result.trim();
}

function parseEmailTemplate(raw, vars) {
  const filled = fillVars(raw, vars);
  const subjectMatch = filled.match(/^---\nsubject:\s*"(.+?)"\n---\n*/);
  const subject = subjectMatch ? subjectMatch[1] : '';
  const body = filled.replace(/^---[\s\S]*?---\n*/, '').trim();
  return { subject, text: body };
}

const top20 = require(path.join(ROOT, 'leads-lists', 'top20-smtp-verified.json'));
const results = [];

// Load template files once
const tplConnectionNote = loadTemplate('linkedin/connection-note.md');
const tplFollowUp1 = loadTemplate('linkedin/follow-up-1.md');
const tplFollowUp2 = loadTemplate('linkedin/follow-up-2.md');
const tplEmail1 = loadTemplate('email/touch-1-intro.md');
const tplEmail2 = loadTemplate('email/touch-2-value.md');
const tplEmail3 = loadTemplate('email/touch-3-casestudy.md');
const tplEmail4 = loadTemplate('email/touch-4-directask.md');
const tplEmail5 = loadTemplate('email/touch-5-breakup.md');

for (const lead of top20) {
  const ind = matchIndustry(lead.industry);
  const role = matchRole(lead.headline || lead.jobTitle);

  const vars = {
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    company: lead.company || '',
    jobTitle: lead.jobTitle || lead.headline || '',
    industryName: lead.industry || 'B2B',
    industryContext: ind.pain_es,
    industryHook: ind.hook_es,
    pain: ind.pain_es,
    metric: ind.metric,
    question: ind.question,
    directQuestion: ind.question,
    personalHook: `Vi tu rol como ${lead.jobTitle || lead.headline || 'lider'} en ${lead.company || 'tu empresa'} y me parecio interesante`,
    roleArea: role.angle_es,
    valueProp: role.value_es,
    cta: role.cta_es,
  };

  const email1 = parseEmailTemplate(tplEmail1, vars);
  const email2 = parseEmailTemplate(tplEmail2, vars);
  const email3 = parseEmailTemplate(tplEmail3, vars);
  const email4 = parseEmailTemplate(tplEmail4, vars);
  const email5 = parseEmailTemplate(tplEmail5, vars);

  const msgs = {
    connection_note: { text: fillVars(tplConnectionNote, vars), tier: 3 },
    follow_up_1: { text: fillVars(tplFollowUp1, vars), tier: 3 },
    follow_up_2: { text: fillVars(tplFollowUp2, vars), tier: 3 },
    email_touch_1: { ...email1, tier: 3 },
    email_touch_2: { ...email2, tier: 3 },
    email_touch_3: { ...email3, tier: 3 },
    email_touch_4: { ...email4, tier: 3 },
    email_touch_5: { ...email5, tier: 3 },
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
    ['connection_note', 'LinkedIn Connection Note'],
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
console.log(`Generated ${results.length} leads with COMPLETE messages (from template files)`);
console.log(`Email 1 avg length: ${Math.round(results.reduce((a, r) => a + r.messages.email_touch_1.text.length, 0) / results.length)} chars`);
console.log(`Connection note avg: ${Math.round(results.reduce((a, r) => a + r.messages.connection_note.text.length, 0) / results.length)} chars`);
