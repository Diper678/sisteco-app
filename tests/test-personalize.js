#!/usr/bin/env node
/**
 * test-personalize.js — Tests for personalization engine
 *
 * Tests data loading, template filling, role matching, blacklist detection,
 * validation, post-processing, and tier selection logic.
 *
 * Run: node tests/test-personalize.js
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates', 'outreach');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name} -- ${e.message}`);
    failed++;
    process.exitCode = 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL: ${name} -- ${e.message}`);
    failed++;
    process.exitCode = 1;
  }
}

console.log('Personalization Engine Tests\n');

// =====================================================
// Section 1: Data files exist and parse correctly
// =====================================================
console.log('--- Data Files ---');

test('industry-hooks.json loads and has _default', () => {
  const hooks = require(path.join(TEMPLATES_DIR, 'industry-hooks.json'));
  assert(hooks._default, 'missing _default');
  assert(hooks._default.hook_es, 'missing hook_es');
  assert(hooks['information technology'], 'missing IT industry');
});

test('role-angles.json loads and has _default', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  assert(roles._default, 'missing _default');
  assert(roles.ceo, 'missing ceo');
  assert(roles.ceo.match, 'missing match regex');
});

test('voice-rules.json loads with constraints', () => {
  const voice = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));
  assert(voice.blacklist_phrases.length > 10, 'too few blacklist phrases');
  assert(voice.constraints.linkedin_connection_note_max_chars === 300, 'wrong max chars');
  assert(voice.approved_metrics.length >= 5, 'too few approved metrics');
});

// =====================================================
// Section 2: Template files exist
// =====================================================
console.log('\n--- Template Files ---');

test('LinkedIn templates exist (3 files)', () => {
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'connection-note.md')),
    'missing connection-note.md');
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'follow-up-1.md')),
    'missing follow-up-1.md');
  assert(fs.existsSync(path.join(TEMPLATES_DIR, 'linkedin', 'follow-up-2.md')),
    'missing follow-up-2.md');
});

test('Email templates exist (5 touches)', () => {
  const names = ['intro', 'value', 'casestudy', 'directask', 'breakup'];
  for (let i = 1; i <= 5; i++) {
    const filePath = path.join(TEMPLATES_DIR, 'email', `touch-${i}-${names[i - 1]}.md`);
    assert(fs.existsSync(filePath), `missing touch-${i}-${names[i - 1]}.md`);
  }
});

test('LinkedIn templates contain {variables}', () => {
  const note = fs.readFileSync(path.join(TEMPLATES_DIR, 'linkedin', 'connection-note.md'), 'utf-8');
  assert(note.includes('{firstName}'), 'connection-note missing {firstName}');
  assert(note.includes('{company}'), 'connection-note missing {company}');
});

test('Email templates have subject frontmatter', () => {
  const email1 = fs.readFileSync(path.join(TEMPLATES_DIR, 'email', 'touch-1-intro.md'), 'utf-8');
  assert(email1.includes('subject:'), 'touch-1 missing subject frontmatter');
});

// =====================================================
// Section 3: Role matching regex
// =====================================================
console.log('\n--- Role Matching ---');

test('CEO regex matches expected titles', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  const ceoRegex = new RegExp(roles.ceo.match, 'i');
  assert(ceoRegex.test('CEO y Fundador'), 'should match CEO');
  assert(ceoRegex.test('Gerente General'), 'should match Gerente General');
  assert(ceoRegex.test('Co-Founder de empresa'), 'should match Co-Founder');
  assert(!ceoRegex.test('Analista Junior'), 'should not match Analista');
});

test('CTO regex matches tech leaders', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  const ctoRegex = new RegExp(roles.cto.match, 'i');
  assert(ctoRegex.test('CTO en startup'), 'should match CTO');
  assert(ctoRegex.test('Head of Engineering'), 'should match Head of Engineering');
  assert(ctoRegex.test('VP of Engineering'), 'should match VP of Engineering');
});

test('Sales director regex matches commercial roles', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  const salesRegex = new RegExp(roles.sales_director.match, 'i');
  assert(salesRegex.test('Director Comercial'), 'should match Director Comercial');
  assert(salesRegex.test('VP of Sales'), 'should match VP of Sales');
  assert(salesRegex.test('Head of Sales Chile'), 'should match Head of Sales');
});

test('Digital transformation regex matches innovation roles', () => {
  const roles = require(path.join(TEMPLATES_DIR, 'role-angles.json'));
  const dtRegex = new RegExp(roles.digital_transformation.match, 'i');
  assert(dtRegex.test('Gerencia Transformacion Digital'), 'should match Transformacion Digital');
  assert(dtRegex.test('Director de Innovacion'), 'should match Innovacion');
});

// =====================================================
// Section 4: Blacklist detection
// =====================================================
console.log('\n--- Blacklist Detection ---');

test('detects blacklisted phrases in text', () => {
  const voice = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));
  const text = 'Espero que te encuentres bien, estimado cliente';
  const found = voice.blacklist_phrases.filter(phrase =>
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  assert(found.length >= 1, 'should detect at least 1 blacklisted phrase');
});

test('clean text passes blacklist check', () => {
  const voice = require(path.join(TEMPLATES_DIR, 'voice-rules.json'));
  const text = 'Hola Juan, vi que lideras ventas en Acme. Hablamos?';
  const found = voice.blacklist_phrases.filter(phrase =>
    text.toLowerCase().includes(phrase.toLowerCase())
  );
  assert.strictEqual(found.length, 0, 'clean text should have 0 blacklisted phrases');
});

// =====================================================
// Section 5: Engine module functions (after engine is built)
// =====================================================
console.log('\n--- Engine Functions ---');

let engine;
try {
  engine = require(path.join(__dirname, '..', 'scripts', 'personalize-messages.js'));
} catch (e) {
  console.log('  SKIP: Engine not yet built (run after Task 7)');
}

if (engine) {
  test('matchIndustry returns correct hook for IT', () => {
    const result = engine.matchIndustry('Information Technology & Services');
    assert(result.hook_es, 'missing hook_es');
    assert(result.hook_es.includes('pipeline'), 'IT hook should mention pipeline');
  });

  test('matchIndustry returns _default for unknown industry', () => {
    const result = engine.matchIndustry('Underwater Basket Weaving');
    assert(result.hook_es, 'should have default hook_es');
  });

  test('matchRole identifies CEO from headline', () => {
    const result = engine.matchRole('CEO y Fundador de TechCo');
    assert.strictEqual(result.key, 'ceo', 'should match ceo role');
  });

  test('matchRole falls back to _default for unknown title', () => {
    const result = engine.matchRole('Pasante de verano');
    assert.strictEqual(result.key, '_default', 'should fall back to _default');
  });

  test('fillTemplate replaces all variables', () => {
    const template = 'Hola {firstName}, tu empresa {company} es genial.';
    const result = engine.fillTemplate(template, { firstName: 'Juan', company: 'Acme' });
    assert(!result.includes('{'), 'no unresolved variables should remain');
    assert(result.includes('Juan'), 'should contain replaced firstName');
    assert(result.includes('Acme'), 'should contain replaced company');
  });

  test('fillTemplate handles missing variables gracefully', () => {
    const template = 'Hola {firstName}, {missing} aqui.';
    const result = engine.fillTemplate(template, { firstName: 'Juan' });
    assert(result.includes('Juan'), 'should replace known variable');
    // {missing} remains since no key was provided -- that is expected
  });

  test('validate catches too-long connection note', () => {
    const longText = 'A'.repeat(350);
    const result = engine.validate(longText, 'connection_note');
    assert(!result.valid, 'should be invalid');
    assert(result.issues.some(i => i.includes('Too long')), 'should report length issue');
  });

  test('validate catches blacklisted phrases', () => {
    const text = 'Espero que te encuentres bien amigo';
    const result = engine.validate(text, 'email_body');
    assert(!result.valid, 'should be invalid');
    assert(result.issues.some(i => i.includes('Blacklisted')), 'should report blacklist issue');
  });

  test('validate passes clean short text', () => {
    const text = 'Hola Juan, hablamos sobre automatizar tu pipeline de ventas?';
    const result = engine.validate(text, 'connection_note');
    assert(result.valid, 'should be valid');
  });

  // Test tier selection via personalize function
  testAsync('personalize uses Tier 3 for low score', async () => {
    const lead = {
      firstName: 'Test',
      lastName: 'Lead',
      company: 'TestCo',
      industry: 'Insurance',
      jobTitle: 'Manager',
      score: 30
    };
    const result = await engine.personalize(lead, 'connection_note');
    assert.strictEqual(result.tier, 3, 'score 30 should use Tier 3');
    assert(result.text.length > 0, 'should produce text');
  }).then(() => {
    return testAsync('personalize uses Tier 3 for zero score', async () => {
      const lead = {
        firstName: 'Zero',
        lastName: 'Score',
        company: 'ZeroCo',
        industry: 'Mining',
        jobTitle: 'CEO'
      };
      const result = await engine.personalize(lead, 'connection_note');
      assert.strictEqual(result.tier, 3, 'no score should default to Tier 3');
    });
  }).then(() => {
    return testAsync('personalize generates all 8 message types', async () => {
      const lead = {
        firstName: 'Multi',
        lastName: 'Type',
        company: 'MultiCo',
        industry: 'Financial Services',
        jobTitle: 'Director Comercial',
        score: 30
      };
      const types = [
        'connection_note', 'follow_up_1', 'follow_up_2',
        'email_touch_1', 'email_touch_2', 'email_touch_3',
        'email_touch_4', 'email_touch_5'
      ];
      for (const type of types) {
        const result = await engine.personalize(lead, type);
        assert(result.text.length > 0, `${type} should produce text`);
        assert(result.tier === 3, `${type} should be Tier 3 for score 30`);
      }
    });
  }).then(() => {
    return testAsync('email messages include subject line', async () => {
      const lead = {
        firstName: 'Email',
        lastName: 'Test',
        company: 'EmailCo',
        industry: 'Telecommunications',
        jobTitle: 'CEO',
        score: 25
      };
      const result = await engine.personalize(lead, 'email_touch_1');
      assert(result.subject, 'email should have subject');
      assert(result.subject.length > 0, 'subject should not be empty');
    });
  }).then(() => {
    console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
    if (failed > 0) process.exitCode = 1;
  });
} else {
  console.log(`\n--- Results: ${passed} passed, ${failed} failed (engine tests skipped) ---`);
}
