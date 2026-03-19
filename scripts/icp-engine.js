#!/usr/bin/env node
/**
 * icp-engine.js — Reusable ICP (Ideal Customer Profile) Scoring Engine
 *
 * Sisteco's deterministic lead scoring engine for multi-client pipelines.
 * No external dependencies. Works as CLI or importable module.
 *
 * CLI:
 *   cat leads.json | node scripts/icp-engine.js
 *   cat leads.json | node scripts/icp-engine.js --config sisteco
 *   cat leads.json | node scripts/icp-engine.js --config path/to/custom.json
 *
 * Module:
 *   const { scoreLead, scoreLeads, DEFAULT_CONFIGS, loadConfig } = require('./icp-engine');
 *   const scored = scoreLeads(leads, DEFAULT_CONFIGS.sisteco);
 */

'use strict';

// ---------------------------------------------------------------------------
// DEFAULT CONFIGS
// ---------------------------------------------------------------------------

const DEFAULT_CONFIGS = {
  sisteco: {
    id: 'sisteco',
    name: 'Sisteco',
    titles: {
      hot: [
        'gerente de ventas', 'director comercial', 'vp sales', 'vp ventas',
        'chief revenue', 'cro', 'head of sales', 'director de ventas',
        'sales director', 'regional sales manager', 'vp of sales'
      ],
      warm: [
        'gerente comercial', 'sales manager', 'jefe de ventas', 'country manager',
        'gerente general', 'ceo', 'director general', 'business development',
        'desarrollo de negocios', 'gerente de operaciones', 'managing director',
        'cofundador', 'co-founder', 'founder'
      ]
    },
    industries: {
      hot: [
        'information technology', 'computer software', 'internet',
        'financial services', 'management consulting', 'marketing',
        'staffing', 'human resources', 'insurance', 'telecommunications'
      ],
      warm: [
        'logistics', 'mechanical', 'automotive', 'retail', 'wholesale',
        'food', 'pharmaceutical', 'consumer goods', 'banking'
      ]
    },
    locations: {
      premium: ['santiago', 'las condes', 'providencia', 'vitacura'],
      standard: ['chile']
    },
    weights: {
      title: 40,
      industry: 25,
      location: 15,
      dataQuality: 10,
      warmRatio: 0.625
    },
    thresholds: {
      hot: 80,
      warm: 50,
      nurture: 20
    }
  }
};

// ---------------------------------------------------------------------------
// SCORING FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Normalize a string for case-insensitive matching.
 * @param {string} str
 * @returns {string}
 */
function normalize(str) {
  return (str || '').toLowerCase().trim();
}

/**
 * Check if any keyword from a list appears in the text.
 * @param {string} text - Normalized text to search in
 * @param {string[]} keywords - List of keywords to match
 * @returns {string|null} The matched keyword, or null
 */
function findMatch(text, keywords) {
  if (!text) return null;
  for (const kw of keywords) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

/**
 * Score a single lead's title against the config.
 * @param {string} title - Normalized job title / headline
 * @param {object} config - Client ICP config
 * @returns {{ points: number, signal: string|null, matchType: string|null }}
 */
function scoreTitle(title, config) {
  const { weights, titles } = config;
  const maxPoints = weights.title;

  if (!title) {
    return { points: 0, signal: null, matchType: null };
  }

  // Check hot titles first
  const hotMatch = findMatch(title, titles.hot);
  if (hotMatch) {
    return {
      points: maxPoints,
      signal: `Cargo ideal: ${hotMatch}`,
      matchType: 'hot'
    };
  }

  // Check warm titles
  const warmMatch = findMatch(title, titles.warm);
  if (warmMatch) {
    return {
      points: Math.round(maxPoints * weights.warmRatio),
      signal: `Cargo relevante: ${warmMatch}`,
      matchType: 'warm'
    };
  }

  // Fallback: generic senior title detection
  const seniorRe = /\b(vp|vice\s*president|director)\b/;
  if (seniorRe.test(title)) {
    return {
      points: Math.round(maxPoints * 0.375),
      signal: `Cargo senior detectado`,
      matchType: 'generic'
    };
  }

  return { points: 0, signal: null, matchType: null };
}

/**
 * Score a single lead's industry against the config.
 * @param {string} industry - Normalized industry string
 * @param {object} config - Client ICP config
 * @returns {{ points: number, signal: string|null, risk: string|null }}
 */
function scoreIndustry(industry, config) {
  const { weights, industries } = config;
  const maxPoints = weights.industry;

  if (!industry) {
    return { points: 0, signal: null, risk: 'Sin industria reportada' };
  }

  // Hot industry
  const hotMatch = findMatch(industry, industries.hot);
  if (hotMatch) {
    return {
      points: maxPoints,
      signal: `Industria ideal: ${hotMatch}`,
      risk: null
    };
  }

  // Warm industry
  const warmMatch = findMatch(industry, industries.warm);
  if (warmMatch) {
    return {
      points: Math.round(maxPoints * weights.warmRatio),
      signal: `Industria relevante: ${warmMatch}`,
      risk: null
    };
  }

  // Has industry but no match
  return {
    points: 5,
    signal: null,
    risk: null
  };
}

/**
 * Score a single lead's location against the config.
 * @param {string} location - Normalized location string
 * @param {object} config - Client ICP config
 * @returns {{ points: number, signal: string|null, risk: string|null }}
 */
function scoreLocation(location, config) {
  const { weights, locations } = config;
  const maxPoints = weights.location;

  if (!location) {
    return { points: 0, signal: null, risk: 'Ubicacion desconocida' };
  }

  // Premium location
  const premiumMatch = findMatch(location, locations.premium);
  if (premiumMatch) {
    return {
      points: maxPoints,
      signal: `${premiumMatch.charAt(0).toUpperCase() + premiumMatch.slice(1)} zona premium`,
      risk: null
    };
  }

  // Standard location
  const standardMatch = findMatch(location, locations.standard);
  if (standardMatch) {
    return {
      points: Math.round(maxPoints * 0.667),
      signal: `Ubicacion ${standardMatch}`,
      risk: null
    };
  }

  // No location match
  return { points: 0, signal: null, risk: 'Ubicacion fuera de zona objetivo' };
}

/**
 * Score data quality (company name + company URL).
 * @param {object} lead - Raw lead object
 * @returns {{ points: number, hasCompany: boolean, hasUrl: boolean }}
 */
function scoreDataQuality(lead) {
  let points = 0;
  const hasCompany = !!(lead.company || lead.companyName);
  const hasUrl = !!(lead.companyUrl);

  if (hasCompany) points += 5;
  if (hasUrl) points += 5;

  return { points, hasCompany, hasUrl };
}

/**
 * Compute confidence level for a scored lead.
 * @param {object} lead - Raw lead object
 * @param {string} titleMatchType - 'hot', 'warm', 'generic', or null
 * @returns {number} Confidence between 0 and 1
 */
function computeConfidence(lead, titleMatchType) {
  let confidence = 0.5;

  const hasCompany = !!(lead.company || lead.companyName);
  const hasIndustry = !!(lead.industry);
  const hasUrl = !!(lead.companyUrl);

  // +0.3 if has company + industry + URL
  if (hasCompany && hasIndustry && hasUrl) {
    confidence += 0.3;
  }

  // +0.1 if title matched
  if (titleMatchType) {
    confidence += 0.1;
  }

  return Math.round(confidence * 100) / 100;
}

/**
 * Determine category based on score and thresholds.
 * @param {number} score
 * @param {object} thresholds - { hot, warm, nurture }
 * @returns {string} 'HOT' | 'WARM' | 'NURTURE' | 'SKIP'
 */
function categorize(score, thresholds) {
  if (score >= thresholds.hot) return 'HOT';
  if (score >= thresholds.warm) return 'WARM';
  if (score >= thresholds.nurture) return 'NURTURE';
  return 'SKIP';
}

/**
 * Extract a normalized field from a PhantomBuster lead object.
 * Handles field name variations across PB export formats.
 * @param {object} lead - Raw lead
 * @returns {{ fullName: string, jobTitle: string, company: string, industry: string, location: string, linkedinUrl: string, companyUrl: string }}
 */
function extractFields(lead) {
  return {
    fullName: lead.fullName
      || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim()
      || '',
    jobTitle: lead.jobTitle || lead.headline || '',
    company: lead.company || lead.companyName || '',
    industry: lead.industry || '',
    location: lead.location || '',
    linkedinUrl: lead.linkedinProfileUrl || lead.profileUrl || lead.linkedinUrl || '',
    companyUrl: lead.companyUrl || ''
  };
}

/**
 * Score a single lead against an ICP config.
 *
 * @param {object} lead - Raw lead object (PhantomBuster format)
 * @param {object} config - ICP config object
 * @returns {object} Scored lead with original fields + scoring results
 */
function scoreLead(lead, config) {
  const fields = extractFields(lead);
  const titleNorm = normalize(fields.jobTitle);
  const industryNorm = normalize(fields.industry);
  const locationNorm = normalize(fields.location);

  // Score each dimension
  const titleResult = scoreTitle(titleNorm, config);
  const industryResult = scoreIndustry(industryNorm, config);
  const locationResult = scoreLocation(locationNorm, config);
  const dataResult = scoreDataQuality(lead);

  // Total score (capped at 100)
  const rawScore = titleResult.points
    + industryResult.points
    + locationResult.points
    + dataResult.points;
  const score = Math.min(rawScore, 100);

  // Collect signals and risks
  const signals = [];
  const risks = [];

  if (titleResult.signal) signals.push(titleResult.signal);
  if (industryResult.signal) signals.push(industryResult.signal);
  if (locationResult.signal) signals.push(locationResult.signal);

  if (industryResult.risk) risks.push(industryResult.risk);
  if (locationResult.risk) risks.push(locationResult.risk);

  // Category and confidence
  const category = categorize(score, config.thresholds);
  const confidence = computeConfidence(lead, titleResult.matchType);

  return {
    // Original fields (normalized)
    fullName: fields.fullName,
    jobTitle: fields.jobTitle,
    company: fields.company,
    industry: fields.industry,
    location: fields.location,
    linkedinUrl: fields.linkedinUrl,
    companyUrl: fields.companyUrl,

    // Scoring results
    score,
    category,
    signals,
    risks,
    confidence,
    scoredAt: new Date().toISOString(),
    configId: config.id
  };
}

/**
 * Score an array of leads and return them sorted by score descending.
 *
 * @param {object[]} leads - Array of raw lead objects
 * @param {object} config - ICP config object
 * @returns {object[]} Array of scored leads, sorted by score desc
 */
function scoreLeads(leads, config) {
  return leads
    .map(lead => scoreLead(lead, config))
    .sort((a, b) => b.score - a.score);
}

/**
 * Load a config by built-in ID or from a JSON file path.
 *
 * @param {string} pathOrId - Built-in config ID (e.g. "sisteco") or path to JSON file
 * @returns {object} ICP config object
 * @throws {Error} If config not found or file unreadable
 */
function loadConfig(pathOrId) {
  // Check built-in configs first
  if (DEFAULT_CONFIGS[pathOrId]) {
    return DEFAULT_CONFIGS[pathOrId];
  }

  // Try loading from file
  const fs = require('fs');
  const path = require('path');
  const resolved = path.resolve(pathOrId);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Config "${pathOrId}" not found. Built-in configs: ${Object.keys(DEFAULT_CONFIGS).join(', ')}`
    );
  }

  const raw = fs.readFileSync(resolved, 'utf8');
  const config = JSON.parse(raw);

  // Validate required fields
  const required = ['id', 'titles', 'industries', 'locations', 'weights', 'thresholds'];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`Config missing required field: ${field}`);
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// MODULE EXPORTS
// ---------------------------------------------------------------------------

module.exports = { scoreLead, scoreLeads, DEFAULT_CONFIGS, loadConfig };

// ---------------------------------------------------------------------------
// CLI MODE
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse --config flag
  let configId = 'sisteco';
  const configIdx = args.indexOf('--config');
  if (configIdx !== -1 && args[configIdx + 1]) {
    configId = args[configIdx + 1];
  }

  // Load config
  let config;
  try {
    config = loadConfig(configId);
  } catch (err) {
    process.stderr.write(`Error loading config: ${err.message}\n`);
    process.exit(1);
  }

  // Read JSON from stdin
  let inputData = '';
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk) => {
    inputData += chunk;
  });

  process.stdin.on('end', () => {
    if (!inputData.trim()) {
      process.stderr.write('Error: No input received on stdin. Usage: cat leads.json | node scripts/icp-engine.js\n');
      process.exit(1);
    }

    let leads;
    try {
      leads = JSON.parse(inputData);
      if (!Array.isArray(leads)) {
        leads = [leads];
      }
    } catch (err) {
      process.stderr.write(`Error parsing JSON input: ${err.message}\n`);
      process.exit(1);
    }

    // Score all leads
    const scored = scoreLeads(leads, config);

    // Group by category
    const hot = scored.filter(l => l.category === 'HOT');
    const warm = scored.filter(l => l.category === 'WARM');
    const nurture = scored.filter(l => l.category === 'NURTURE');
    const skip = scored.filter(l => l.category === 'SKIP');

    // Summary to stderr
    process.stderr.write(`\n=== ICP Scoring Engine — Config: ${config.name || config.id} ===\n\n`);
    process.stderr.write(`Total leads scored: ${scored.length}\n\n`);
    process.stderr.write(`  HOT     (>=${config.thresholds.hot}):  ${hot.length}\n`);
    process.stderr.write(`  WARM    (>=${config.thresholds.warm}):  ${warm.length}\n`);
    process.stderr.write(`  NURTURE (>=${config.thresholds.nurture}):  ${nurture.length}\n`);
    process.stderr.write(`  SKIP    (<${config.thresholds.nurture}):   ${skip.length}\n\n`);

    // Top 10 HOT leads table
    if (hot.length > 0) {
      const topHot = hot.slice(0, 10);
      process.stderr.write(`--- Top ${topHot.length} HOT Leads ---\n\n`);
      process.stderr.write(
        padRight('Score', 6)
        + padRight('Name', 30)
        + padRight('Title', 35)
        + padRight('Company', 25)
        + 'Signals\n'
      );
      process.stderr.write('-'.repeat(120) + '\n');

      for (const lead of topHot) {
        process.stderr.write(
          padRight(String(lead.score), 6)
          + padRight(truncate(lead.fullName, 28), 30)
          + padRight(truncate(lead.jobTitle, 33), 35)
          + padRight(truncate(lead.company, 23), 25)
          + lead.signals.join('; ')
          + '\n'
        );
      }
      process.stderr.write('\n');
    }

    // Full JSON to stdout
    process.stdout.write(JSON.stringify(scored, null, 2) + '\n');
  });
}

// ---------------------------------------------------------------------------
// CLI HELPERS
// ---------------------------------------------------------------------------

/**
 * Pad string to a fixed width (right-padded with spaces).
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function padRight(str, width) {
  if (str.length >= width) return str.substring(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Truncate string with ellipsis if needed.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 1) + '\u2026';
}
