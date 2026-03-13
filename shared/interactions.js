/* =============================================================================
   Sisteco Interactions — interactions.js
   Interactividad compartida: Lucide, GSAP, Command Bar, Query Buttons, On-Demand Content
   Version: 4.0 — Gemini NL Fallback + PDF Report + Command Bar History
   ============================================================================= */

/* =============================================================================
   1. INIT LUCIDE ICONS
   ============================================================================= */

function initLucide() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/* =============================================================================
   2. GSAP — Animate content block in
   ============================================================================= */

function animateBlockIn(el) {
  if (typeof gsap === 'undefined') {
    el.style.opacity = '1';
    return;
  }
  gsap.fromTo(el,
    { y: 20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }
  );
}

function animateBlockOut(el, onComplete) {
  if (typeof gsap === 'undefined') {
    el.remove();
    if (onComplete) onComplete();
    return;
  }
  gsap.to(el, {
    y: -10,
    opacity: 0,
    duration: 0.25,
    ease: 'power2.in',
    onComplete: function() {
      el.remove();
      if (onComplete) onComplete();
    }
  });
}

/* =============================================================================
   3. QUERY BUTTONS CONFIG — per role
   ============================================================================= */

var queryButtonConfig = {
  ceo: [
    { id: 'kpis',     icon: 'bar-chart-3',   label: 'Metricas del mes',         desc: 'KPIs y conversion' },
    { id: 'funnel',   icon: 'git-branch',     label: 'Pipeline funnel',          desc: 'Visualizar embudo' },
    { id: 'industria',icon: 'building-2',     label: 'Analisis por industria',   desc: 'Segmentacion CIIU' },
    { id: 'equipo',   icon: 'users',          label: 'Rendimiento equipo',       desc: 'SDRs y conversion' },
    { id: 'comparar', icon: 'trending-up',    label: 'Comparar con mes anterior',desc: 'Evolucion mensual' },
    { id: 'hot',      icon: 'flame',          label: 'Leads HOT ahora',          desc: 'Listos para contactar' }
  ],
  vp: [
    { id: 'sin-asignar', icon: 'user-plus',  label: 'Leads sin asignar',        desc: 'Pendientes de asignacion' },
    { id: 'equipo',      icon: 'users',      label: 'Estado del equipo',         desc: 'SDRs activos' },
    { id: 'pipeline',    icon: 'git-branch', label: 'Pipeline completo',         desc: 'Vista completa' },
    { id: 'hot-urgente', icon: 'flame',      label: 'HOT sin contactar 48h',    desc: 'Atencion urgente' },
    { id: 'conversion',  icon: 'trending-up',label: 'Conversion por SDR',       desc: 'Ranking del equipo' },
    { id: 'kpis',        icon: 'bar-chart-3',label: 'Metricas del mes',         desc: 'Agregadas del equipo' }
  ],
  sdr: [
    { id: 'mis-tareas',  icon: 'list-todo',  label: 'Mis tareas de hoy',        desc: 'Pendientes urgentes' },
    { id: 'mis-leads',   icon: 'users',      label: 'Mis leads asignados',      desc: 'Ver todos' },
    { id: 'hot-pending', icon: 'flame',      label: 'Leads HOT pendientes',     desc: 'Prioritarios' },
    { id: 'reuniones',   icon: 'calendar',   label: 'Mis reuniones',            desc: 'Esta semana' },
    { id: 'contactar',   icon: 'phone',      label: 'A quien contactar ahora',  desc: 'Siguiente accion' },
    { id: 'stats',       icon: 'bar-chart-3',label: 'Mis estadisticas',         desc: 'Mi rendimiento' }
  ]
};

/* =============================================================================
   4. CONTENT BUILDERS — build HTML for each query result
   ============================================================================= */

var contentBuilders = {
  ceo: {},
  vp: {},
  sdr: {}
};

/* Note: SDR builders are in shared/content-builders.js (window.contentBuilders.sdr)
   They are merged into this map after DOMContentLoaded.
   CEO builders remain inline here for backward compat with ceo.html mock data. */

/* Helper: escape HTML */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Helper: AI insight callout */
function buildInsightBox(insight, recommendation) {
  return '<div class="ai-insight">' +
    '<div class="ai-insight-header">' +
      '<i data-lucide="sparkles" class="ai-insight-icon"></i>' +
      '<span class="ai-insight-label">Analisis</span>' +
    '</div>' +
    '<p class="ai-insight-text">' + esc(insight) + '</p>' +
  '</div>' +
  '<div class="ai-recommendation">' +
    '<div class="ai-recommendation-header">' +
      '<i data-lucide="arrow-right" class="ai-rec-icon"></i>' +
      '<span class="ai-rec-label">Recomendacion</span>' +
    '</div>' +
    '<p class="ai-recommendation-text">' + esc(recommendation) + '</p>' +
  '</div>';
}

/* Helper: KPI card */
function buildKPICard(icon, label, value, delta, positive, narrativa) {
  var deltaClass = positive ? 'positive' : 'negative';
  var deltaIcon = positive ? 'trending-up' : 'trending-down';
  return '<article class="card-kpi">' +
    '<div class="card-kpi-header">' +
      '<div class="card-kpi-label">' + esc(label) + '</div>' +
      '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="' + esc(icon) + '"></i></div>' +
    '</div>' +
    '<div class="card-kpi-value">' + esc(String(value)) + '</div>' +
    (delta ? '<div class="card-kpi-footer">' +
      '<span class="card-kpi-delta ' + deltaClass + '">' +
        '<i data-lucide="' + deltaIcon + '"></i>' +
        esc(delta) +
      '</span>' +
      '<span style="font-size:0.75rem;color:var(--text-muted);">vs mes anterior</span>' +
    '</div>' : '') +
    '<p class="narrative">' + esc(narrativa) + '</p>' +
  '</article>';
}

/* CEO: kpis */
contentBuilders.ceo.kpis = function() {
  var D = window.SISTECO_DATA;
  var k = D.kpis.ceo;
  var a = D.analysis.ceo.kpis;

  var html = '<div class="kpi-grid">';
  html += buildKPICard('users', 'Leads Nuevos', k.leads_nuevos.valor, k.leads_nuevos.delta, k.leads_nuevos.positivo, k.leads_nuevos.narrativa);
  html += buildKPICard('flame', 'Leads HOT', k.leads_hot.valor, k.leads_hot.delta, k.leads_hot.positivo, k.leads_hot.narrativa);
  html += buildKPICard('trending-up', 'Tasa Conversion', '8.5%', k.tasa_conversion.delta, k.tasa_conversion.positivo, k.tasa_conversion.narrativa);
  html += buildKPICard('banknote', 'Pipeline Value', window.formatCLP ? window.formatCLP(k.pipeline_value.valor) : '$45.600.000', k.pipeline_value.delta, k.pipeline_value.positivo, k.pipeline_value.narrativa);
  html += '</div>';
  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* CEO: funnel */
contentBuilders.ceo.funnel = function() {
  var D = window.SISTECO_DATA;
  var f = D.funnel;
  var a = D.analysis.ceo.funnel;

  var steps = [
    { label: f.nuevos.label, valor: f.nuevos.valor, pct: null },
    { label: f.enriquecidos_sii.label, valor: f.enriquecidos_sii.valor, pct: f.enriquecidos_sii.pct_prev },
    { label: f.scored.label, valor: f.scored.valor, pct: f.scored.pct_prev },
    { label: f.hot.label, valor: f.hot.valor, pct: f.hot.pct_prev },
    { label: f.contactados.label, valor: f.contactados.valor, pct: f.contactados.pct_prev },
    { label: f.convertidos.label, valor: f.convertidos.valor, pct: f.convertidos.pct_prev }
  ];

  var maxValor = steps[0].valor;
  var barColors = ['#c5ed36', '#a8d930', '#8cc52a', '#5dab1a', '#39900e', '#22c55e'];

  var html = '<div class="funnel-bars-container">';
  steps.forEach(function(step, idx) {
    var heightPct = Math.max(8, Math.round((step.valor / maxValor) * 100));
    var pctDisplay = step.pct !== null ? step.pct + '%' : '100%';
    html += '<div class="funnel-step-wrapper">' +
      '<div class="funnel-step-top">' +
        '<div class="funnel-step-name">' + esc(step.label) + '</div>' +
        '<div class="funnel-bar-visual" style="height:' + heightPct + '%;background:' + barColors[idx] + ';"></div>' +
      '</div>' +
      '<div class="funnel-step-bottom">' +
        '<div class="funnel-num">' + step.valor + '</div>' +
        '<div class="funnel-pct">' + pctDisplay + '</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* CEO: industria */
contentBuilders.ceo.industria = function() {
  var D = window.SISTECO_DATA;
  var a = D.analysis.ceo.industria;
  var industria = D.segmentation.industria;
  var tamano = D.segmentation.tamano;
  var maxInd = industria[0].valor;
  var maxTam = tamano[0].valor;

  var html = '<div class="segmentation-grid">';

  /* Industry chart */
  html += '<div class="chart-card">';
  html += '<div class="chart-card-title">Por Industria CIIU</div>';
  html += '<div class="chart-bar-h">';
  industria.forEach(function(item) {
    var pct = Math.round((item.valor / maxInd) * 100);
    html += '<div class="chart-bar-h-item">' +
      '<div class="chart-bar-h-label chart-h-label-wide">' + esc(item.label) + '</div>' +
      '<div class="chart-bar-h-track"><div class="chart-bar-h-fill" style="width:' + pct + '%;"></div></div>' +
      '<div class="chart-bar-h-value">' + item.valor + '</div>' +
    '</div>';
  });
  html += '</div></div>';

  /* Size chart */
  html += '<div class="chart-card">';
  html += '<div class="chart-card-title">Por Tamano Empresa</div>';
  html += '<div class="chart-bar-h">';
  tamano.forEach(function(item) {
    var pct = Math.round((item.valor / maxTam) * 100);
    html += '<div class="chart-bar-h-item">' +
      '<div class="chart-bar-h-label">' + esc(item.label) + '</div>' +
      '<div class="chart-bar-h-track"><div class="chart-bar-h-fill" style="width:' + pct + '%;background:var(--chart-blue);"></div></div>' +
      '<div class="chart-bar-h-value">' + item.valor + '</div>' +
    '</div>';
  });
  html += '</div></div>';

  html += '</div>';

  /* City pills */
  html += '<div class="city-pills" style="margin-bottom:var(--space-4);">';
  D.segmentation.ciudad.forEach(function(item) {
    html += '<div class="city-pill"><span>' + esc(item.label) + '</span><span class="city-pill-count">' + item.valor + '</span></div>';
  });
  html += '</div>';

  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* CEO: equipo */
contentBuilders.ceo.equipo = function() {
  var D = window.SISTECO_DATA;
  var a = D.analysis.ceo.equipo;
  var team = D.team;

  var html = '<div class="team-grid">';
  team.forEach(function(sdr) {
    var convColor = sdr.conversion_pct >= 25 ? 'var(--success)' : sdr.conversion_pct >= 20 ? 'var(--warning)' : 'var(--error)';
    html += '<div class="card team-card">' +
      '<div class="team-card-header">' +
        '<div class="team-avatar">' + esc(sdr.iniciales) + '</div>' +
        '<div class="team-info">' +
          '<div class="team-name">' + esc(sdr.nombre) + '</div>' +
          '<div class="team-role">SDR</div>' +
        '</div>' +
        '<div class="team-conversion" style="color:' + convColor + ';">' + sdr.conversion_pct + '%</div>' +
      '</div>' +
      '<div class="team-stats">' +
        '<div class="team-stat"><span class="team-stat-val">' + sdr.leads_asignados + '</span><span class="team-stat-label">Asignados</span></div>' +
        '<div class="team-stat"><span class="team-stat-val">' + sdr.contactados + '</span><span class="team-stat-label">Contactados</span></div>' +
        '<div class="team-stat"><span class="team-stat-val">' + sdr.reuniones + '</span><span class="team-stat-label">Reuniones</span></div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* CEO: comparar */
contentBuilders.ceo.comparar = function() {
  var D = window.SISTECO_DATA;
  var a = D.analysis.ceo.comparar;

  var comparisons = [
    { label: 'Leads nuevos', mar: 47, feb: 41, pct: '+15%', positive: true },
    { label: 'Leads HOT', mar: 12, feb: 9, pct: '+33%', positive: true },
    { label: 'Tasa conversion', mar: '8.5%', feb: '7.3%', pct: '+1.2pp', positive: true },
    { label: 'Pipeline value', mar: '$45.6M', feb: '$40.7M', pct: '+12%', positive: true }
  ];

  var html = '<div class="comparison-table">';
  html += '<div class="comparison-header">' +
    '<div class="comp-label">Metrica</div>' +
    '<div class="comp-val">Febrero</div>' +
    '<div class="comp-val">Marzo</div>' +
    '<div class="comp-delta">Variacion</div>' +
  '</div>';

  comparisons.forEach(function(row) {
    var deltaClass = row.positive ? 'positive' : 'negative';
    html += '<div class="comparison-row">' +
      '<div class="comp-label">' + esc(row.label) + '</div>' +
      '<div class="comp-val comp-prev">' + esc(String(row.feb)) + '</div>' +
      '<div class="comp-val comp-curr">' + esc(String(row.mar)) + '</div>' +
      '<div class="comp-delta"><span class="card-kpi-delta ' + deltaClass + '">' + esc(row.pct) + '</span></div>' +
    '</div>';
  });
  html += '</div>';
  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* CEO: hot leads */
contentBuilders.ceo.hot = function() {
  var D = window.SISTECO_DATA;
  var a = D.analysis.ceo.hot;
  var hotLeads = D.leads.filter(function(l) { return l.clasificacion === 'HOT'; });

  var html = '<div class="hot-leads-list">';
  hotLeads.forEach(function(lead) {
    var statusClass = lead.sdr_asignado ? 'badge-warm' : 'badge-hot';
    var statusText = lead.sdr_asignado ? 'Asignado a ' + lead.sdr_asignado.split(' ')[0] : 'Sin asignar';
    html += '<div class="hot-lead-row">' +
      '<div class="hot-lead-score" style="background:' + (lead.score >= 80 ? 'rgba(197,237,54,0.2)' : 'rgba(197,237,54,0.1)') + ';color:#5a7a00;">' + lead.score + '</div>' +
      '<div class="hot-lead-info">' +
        '<div class="hot-lead-name">' + esc(lead.nombre) + '</div>' +
        '<div class="hot-lead-company">' + esc(lead.empresa) + ' · ' + esc(lead.cargo) + '</div>' +
      '</div>' +
      '<div class="hot-lead-meta">' +
        '<span class="badge ' + statusClass + '">' + esc(statusText) + '</span>' +
        '<span style="font-size:var(--text-xs);color:var(--text-muted);">' + esc(lead.industria.split(' ')[0]) + '</span>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  html += buildInsightBox(a.insight, a.recommendation);
  return html;
};

/* =============================================================================
   5. LOAD CONTENT — on-demand block insertion (ONE at a time)
   ============================================================================= */

/* Track currently active query id */
var currentActiveQueryId = null;

/* =============================================================================
   QUERY HISTORY — localStorage persistence (last 5 queries per role)
   ============================================================================= */

var _HISTORY_KEY_PREFIX = 'sisteco_query_history_';
var _LAST_QUERY_KEY_PREFIX = 'sisteco_last_query_';

function _saveQueryToHistory(role, queryId, queryLabel) {
  try {
    var key = _HISTORY_KEY_PREFIX + role;
    var history = JSON.parse(localStorage.getItem(key) || '[]');
    /* Remove existing entry with same id */
    history = history.filter(function(h) { return h.id !== queryId; });
    /* Prepend new entry */
    history.unshift({ id: queryId, label: queryLabel, ts: Date.now() });
    /* Keep only last 5 */
    history = history.slice(0, 5);
    localStorage.setItem(key, JSON.stringify(history));
    /* Save as last active query */
    localStorage.setItem(_LAST_QUERY_KEY_PREFIX + role, queryId);
  } catch (e) { /* localStorage not available */ }
}

function _getQueryHistory(role) {
  try {
    return JSON.parse(localStorage.getItem(_HISTORY_KEY_PREFIX + role) || '[]');
  } catch (e) { return []; }
}

function _getLastQuery(role) {
  try {
    return localStorage.getItem(_LAST_QUERY_KEY_PREFIX + role) || null;
  } catch (e) { return null; }
}

/* =============================================================================
   QUERY BADGE COUNTS — refresh badges with real data on load
   ============================================================================= */

function refreshQueryBadges(role) {
  /* Only fetch for CEO and VP roles */
  if (role !== 'ceo' && role !== 'vp') return;
  if (!window.queryConvex) return;

  window.queryConvex('stats:getLeadsStats', {})
    .then(function(stats) {
      if (!stats) return;
      var hot = stats.leadsHot || stats.hot || 0;
      var total = stats.total || 0;
      var nuevos = stats.nuevosUltimos30Dias || stats.nuevos || 0;

      /* Update badge text on specific query buttons */
      var btnHot = document.querySelector('.query-btn[data-query-id="hot"]');
      if (btnHot && hot > 0) {
        var descEl = btnHot.querySelector('.query-btn-desc');
        if (descEl) descEl.textContent = hot + ' leads HOT activos';
      }

      var btnKpis = document.querySelector('.query-btn[data-query-id="kpis"]');
      if (btnKpis && nuevos > 0) {
        var descElK = btnKpis.querySelector('.query-btn-desc');
        if (descElK) descElK.textContent = nuevos + ' nuevos este mes';
      }

      /* VP-specific */
      if (role === 'vp') {
        window.queryConvex('leads:getLeadsByOrg', {})
          .then(function(leads) {
            if (!leads) return;
            var sinAsignar = (leads || []).filter(function(l) { return !l.asignadoA; }).length;
            var btnSin = document.querySelector('.query-btn[data-query-id="sin-asignar"]');
            if (btnSin && sinAsignar > 0) {
              var descElS = btnSin.querySelector('.query-btn-desc');
              if (descElS) descElS.textContent = sinAsignar + ' pendientes de asignacion';
            }
          })
          .catch(function() {});
      }
    })
    .catch(function() { /* silently fail — badges are optional enhancement */ });
}

/* =============================================================================
   LOAD CONTENT (updated) — routes CEO/VP to async content-builders.js
   ============================================================================= */

function loadContent(queryId, role, queryLabel) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  /* SDR role: delegate to content-builders.js SDR builders (async, render into DOM directly) */
  if (role === 'sdr') {
    _loadContentSdr(queryId, queryLabel);
    return;
  }

  /* If same block is already showing, do nothing (already active) */
  if (currentActiveQueryId === queryId) {
    var existingBlock = document.getElementById('block-' + queryId);
    if (existingBlock) {
      existingBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }

  /* Save to query history */
  _saveQueryToHistory(role, queryId, queryLabel);

  /* Build and insert new block (after removing old one) */
  function insertNewBlock() {
    currentActiveQueryId = queryId;

    /* Resolve builder — prefer async builders from content-builders.js (CEO/VP) */
    var asyncBuilder = window.contentBuilders && window.contentBuilders[role] && window.contentBuilders[role][queryId];

    /* Fallback: sync mock builders for any role not yet migrated */
    if (!asyncBuilder) {
      /* Merge mock builders from local contentBuilders map */
      if (contentBuilders[role] && contentBuilders[role][queryId]) {
        asyncBuilder = null; /* will fall through to sync path below */
      }
    }

    /* Build block container */
    var block = document.createElement('div');
    block.className = 'content-block';
    block.id = 'block-' + queryId;
    block.setAttribute('role', 'region');
    block.setAttribute('aria-label', queryLabel);

    block.innerHTML = '<div class="content-block-header">' +
      '<h2 class="content-block-title">' + esc(queryLabel) + '</h2>' +
      '<button class="content-block-close" aria-label="Cerrar ' + esc(queryLabel) + '" data-block-id="' + queryId + '">' +
        '<i data-lucide="x"></i>' +
      '</button>' +
    '</div>' +
    '<div class="content-block-body"></div>';

    contentArea.appendChild(block);
    var bodyEl = block.querySelector('.content-block-body');

    /* Close button handler */
    block.querySelector('.content-block-close').addEventListener('click', function() {
      currentActiveQueryId = null;
      document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
      animateBlockOut(block);
    });

    initLucide();
    animateBlockIn(block);

    /* Route to async builder (content-builders.js CEO/VP) */
    if (asyncBuilder) {
      var promise = asyncBuilder(bodyEl);
      if (promise && typeof promise.then === 'function') {
        promise.then(function() {
          /* Animate bars that may have been inserted by async builder */
          if (typeof gsap !== 'undefined') {
            var bars = bodyEl.querySelectorAll('.chart-bar-h-fill');
            bars.forEach(function(bar) {
              if (bar.style.width && !bar._animated) {
                bar._animated = true;
                var tw = bar.style.width;
                bar.style.width = '0%';
                gsap.to(bar, { width: tw, duration: 0.8, ease: 'power3.out', delay: 0.2 });
              }
            });
          }
        }).catch(function(err) { console.error('[loadContent]', err); });
      }
    } else {
      /* Sync path for mock builders (backward compat) */
      var syncBuilder = contentBuilders[role] && contentBuilders[role][queryId];
      var innerHtml = '';
      if (syncBuilder) {
        var result = syncBuilder();
        if (result && typeof result.then === 'function') {
          bodyEl.innerHTML = '<p style="color:var(--text-muted);">Cargando...</p>';
          result.then(function(html) { if (bodyEl && html) { bodyEl.innerHTML = html; initLucide(); } });
        } else {
          innerHtml = result || '';
        }
      } else {
        innerHtml = '<p style="color:var(--text-secondary);padding:var(--space-4) 0;">Contenido para "' + esc(queryLabel) + '" disponible pronto.</p>';
      }
      if (innerHtml) {
        bodyEl.innerHTML = innerHtml;

        /* Animate chart bars */
        if (typeof gsap !== 'undefined') {
          bodyEl.querySelectorAll('.chart-bar-h-fill').forEach(function(bar) {
            var tw = bar.style.width;
            bar.style.width = '0%';
            gsap.to(bar, { width: tw, duration: 0.8, ease: 'power3.out', delay: 0.3 });
          });
          bodyEl.querySelectorAll('.funnel-bar-visual').forEach(function(bar) {
            var th = bar.style.height;
            bar.style.height = '0%';
            gsap.to(bar, { height: th, duration: 0.7, ease: 'power3.out', delay: 0.2 });
          });
        }
      }
    }

    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* Remove any existing content blocks first, then insert new one */
  var existingBlocks = contentArea.querySelectorAll('.content-block, .ai-response-block');
  if (existingBlocks.length > 0) {
    var blocksArray = Array.prototype.slice.call(existingBlocks);
    var removed = 0;
    blocksArray.forEach(function(existingBlock) {
      animateBlockOut(existingBlock, function() {
        removed++;
        if (removed === blocksArray.length) {
          insertNewBlock();
        }
      });
    });
  } else {
    insertNewBlock();
  }
}

/* =============================================================================
   5b. SDR CONTENT LOADER — async builders that render directly into DOM
   Routes SDR query button clicks to content-builders.js SDR builders.
   SDR builders render into page DOM (todo-list, sdr-leads-tbody) instead of
   injecting a content block, so we scroll the user to the relevant section.
   ============================================================================= */

function _loadContentSdr(queryId, queryLabel) {
  var sdr = window.contentBuilders && window.contentBuilders.sdr;
  if (!sdr) {
    console.warn('[SDR] SDR content builders not loaded yet');
    return;
  }

  /* Map query button IDs to SDR builder methods + target scroll element */
  var builderMap = {
    'mis-tareas':  { fn: sdr.buildSdrTareas,    scrollTo: 'todo-list' },
    'mis-leads':   { fn: sdr.buildSdrMisLeads,   scrollTo: 'sdr-leads-tbody' },
    'hot-pending': { fn: sdr.buildSdrHotPending, scrollTo: 'todo-list' },
    'stats':       { fn: sdr.buildSdrStats,      scrollTo: 'sdr-kpi-grid' },
    'reuniones':   { fn: null,                   scrollTo: 'todo-list' },
    'contactar':   { fn: null,                   scrollTo: 'todo-list' }
  };

  var entry = builderMap[queryId];
  if (!entry) return;

  if (entry.fn) {
    /* For hot-pending and stats, show in a content block */
    if (queryId === 'hot-pending' || queryId === 'stats') {
      var contentArea = document.getElementById('content-area');
      if (!contentArea) return;

      var block = document.createElement('div');
      block.className = 'content-block';
      block.id = 'block-' + queryId;
      block.setAttribute('role', 'region');
      block.setAttribute('aria-label', queryLabel);
      block.innerHTML = '<div class="content-block-header">' +
        '<h2 class="content-block-title">' + esc(queryLabel) + '</h2>' +
        '<button class="content-block-close" aria-label="Cerrar ' + esc(queryLabel) + '" data-block-id="' + queryId + '">' +
          '<i data-lucide="x"></i>' +
        '</button>' +
      '</div>' +
      '<div class="content-block-body"><p style="color:var(--text-muted);">Cargando...</p></div>';

      /* Remove existing blocks */
      var existing = contentArea.querySelectorAll('.content-block, .ai-response-block');
      existing.forEach(function(b) { b.remove(); });

      contentArea.appendChild(block);

      block.querySelector('.content-block-close').addEventListener('click', function() {
        document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
        animateBlockOut(block);
      });

      initLucide();
      animateBlockIn(block);

      /* Call async builder and inject result */
      entry.fn().then(function(html) {
        var bodyEl = block.querySelector('.content-block-body');
        if (bodyEl && html) {
          bodyEl.innerHTML = html;
          initLucide();
          if (typeof gsap !== 'undefined') {
            var bars = bodyEl.querySelectorAll('.chart-bar-h-fill');
            bars.forEach(function(bar) {
              var targetWidth = bar.style.width;
              bar.style.width = '0%';
              gsap.to(bar, { width: targetWidth, duration: 0.8, ease: 'power3.out', delay: 0.3 });
            });
          }
        }
      }).catch(function(err) {
        console.error('[SDR] Builder error:', err);
      });

      block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    /* For mis-tareas and mis-leads, just call the builder (renders into existing DOM) */
    entry.fn().then(function() {
      /* Scroll to section */
      var target = entry.scrollTo && document.getElementById(entry.scrollTo);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      initLucide();
    }).catch(function(err) {
      console.error('[SDR] Builder error:', err);
    });
  } else {
    /* No builder yet — scroll to relevant section */
    var target = entry.scrollTo && document.getElementById(entry.scrollTo);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* =============================================================================
   5c. CONVERSATIONAL AI RESPONSE — format markdown-like text
   ============================================================================= */

function formatConversationResponse(text) {
  /* Convert **bold** to <strong> */
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  /* Split by newline and build paragraphs / lists */
  var lines = text.split('\n');
  var html = '';
  var inList = false;

  lines.forEach(function(line) {
    line = line.trim();
    if (!line) {
      if (inList) { html += '</ul>'; inList = false; }
      return;
    }
    /* Numbered list item: 1. 2. 3. */
    if (/^\d+\.\s/.test(line)) {
      if (!inList) { html += '<ul class="ai-response-list">'; inList = true; }
      html += '<li>' + line.replace(/^\d+\.\s/, '') + '</li>';
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<p>' + line + '</p>';
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function showAIResponse(query, responseText, type) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  /* Deactivate all query buttons */
  document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
  currentActiveQueryId = null;

  function insertAIBlock() {
    var typeLabels = { recommendation: 'Recomendacion', analysis: 'Analisis', summary: 'Resumen Ejecutivo' };
    var typeLabel = typeLabels[type] || 'Respuesta';

    var block = document.createElement('div');
    block.className = 'ai-response-block';
    block.setAttribute('role', 'region');
    block.setAttribute('aria-label', 'Respuesta del asistente');

    block.innerHTML =
      '<div class="ai-response-header">' +
        '<div class="ai-response-avatar" aria-hidden="true"><i data-lucide="sparkles"></i></div>' +
        '<div class="ai-response-meta">' +
          '<span class="ai-response-label">' + esc(typeLabel) + '</span>' +
          '<span class="ai-response-query">"' + esc(query) + '"</span>' +
        '</div>' +
        '<button class="content-block-close ai-response-close" aria-label="Cerrar respuesta">' +
          '<i data-lucide="x"></i>' +
        '</button>' +
      '</div>' +
      '<div class="ai-response-message">' + formatConversationResponse(responseText) + '</div>';

    contentArea.appendChild(block);

    block.querySelector('.ai-response-close').addEventListener('click', function() {
      animateBlockOut(block);
    });

    initLucide();
    animateBlockIn(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* Remove any existing content blocks */
  var existingBlocks = contentArea.querySelectorAll('.content-block, .ai-response-block');
  if (existingBlocks.length > 0) {
    var blocksArray = Array.prototype.slice.call(existingBlocks);
    var removed = 0;
    blocksArray.forEach(function(existingBlock) {
      animateBlockOut(existingBlock, function() {
        removed++;
        if (removed === blocksArray.length) {
          insertAIBlock();
        }
      });
    });
  } else {
    insertAIBlock();
  }
}

function showNoMatchResponse(query) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  function insertNoMatchBlock() {
    var block = document.createElement('div');
    block.className = 'ai-response-block ai-response-nomatch';
    block.setAttribute('role', 'region');

    block.innerHTML =
      '<div class="ai-response-header">' +
        '<div class="ai-response-avatar" aria-hidden="true"><i data-lucide="help-circle"></i></div>' +
        '<div class="ai-response-meta">' +
          '<span class="ai-response-label">Sin resultados</span>' +
          '<span class="ai-response-query">"' + esc(query) + '"</span>' +
        '</div>' +
        '<button class="content-block-close ai-response-close" aria-label="Cerrar">' +
          '<i data-lucide="x"></i>' +
        '</button>' +
      '</div>' +
      '<div class="ai-response-message">' +
        '<p>No tengo informacion sobre eso todavia. Prueba con una de las consultas sugeridas abajo o reformula tu pregunta.</p>' +
      '</div>';

    contentArea.appendChild(block);
    block.querySelector('.ai-response-close').addEventListener('click', function() { animateBlockOut(block); });
    initLucide();
    animateBlockIn(block);

    /* Highlight query buttons to guide user */
    var allBtns = document.querySelectorAll('.query-btn');
    allBtns.forEach(function(btn) {
      btn.style.borderColor = 'var(--accent)';
      setTimeout(function() { btn.style.borderColor = ''; }, 2000);
    });
  }

  var existingBlocks = contentArea.querySelectorAll('.content-block, .ai-response-block');
  if (existingBlocks.length > 0) {
    var blocksArray = Array.prototype.slice.call(existingBlocks);
    var removed = 0;
    blocksArray.forEach(function(existingBlock) {
      animateBlockOut(existingBlock, function() {
        removed++;
        if (removed === blocksArray.length) { insertNoMatchBlock(); }
      });
    });
  } else {
    insertNoMatchBlock();
  }
}

/* =============================================================================
   5d. GEMINI NL FALLBACK — call serverless proxy for unrecognized queries
   ============================================================================= */

/**
 * showGeminiCard — renders a Gemini-powered mini-card with titulo + valor + narrativa.
 * Called when user types a free-text query that doesn't match any predefined button.
 * IMPORTANT: only aggregated metrics are sent to Gemini — never individual lead PII.
 */
function showGeminiCard(query, geminiResult) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  function insertGeminiBlock() {
    var block = document.createElement('div');
    block.className = 'content-block gemini-response-block';
    block.setAttribute('role', 'region');
    block.setAttribute('aria-label', 'Respuesta de IA');

    block.innerHTML =
      '<div class="content-block-header">' +
        '<h2 class="content-block-title">' +
          '<i data-lucide="sparkles" style="width:16px;height:16px;vertical-align:-2px;margin-right:6px;color:var(--accent);"></i>' +
          esc(geminiResult.titulo || 'Respuesta') +
        '</h2>' +
        '<button class="content-block-close" aria-label="Cerrar">' +
          '<i data-lucide="x"></i>' +
        '</button>' +
      '</div>' +
      '<div class="content-block-body">' +
        '<div style="padding:var(--space-4) 0;">' +
          '<div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-2);">' +
            '"' + esc(query) + '"' +
          '</div>' +
          '<div style="display:flex;align-items:baseline;gap:var(--space-2);margin-bottom:var(--space-3);">' +
            '<span style="font-size:2.5rem;font-weight:700;color:var(--text-primary);line-height:1;">' +
              esc(geminiResult.valor || '—') +
            '</span>' +
            (geminiResult.unidad ? '<span style="font-size:var(--text-sm);color:var(--text-muted);">' + esc(geminiResult.unidad) + '</span>' : '') +
          '</div>' +
          '<p style="font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;margin:0;">' +
            esc(geminiResult.narrativa || '') +
          '</p>' +
          '<div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border-subtle);font-size:var(--text-xs);color:var(--text-muted);display:flex;align-items:center;gap:4px;">' +
            '<i data-lucide="sparkles" style="width:12px;height:12px;"></i>' +
            'Generado por IA — solo metricas agregadas' +
          '</div>' +
        '</div>' +
      '</div>';

    contentArea.appendChild(block);
    block.querySelector('.content-block-close').addEventListener('click', function() {
      currentActiveQueryId = null;
      document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
      animateBlockOut(block);
    });
    initLucide();
    animateBlockIn(block);
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  var existingBlocks = contentArea.querySelectorAll('.content-block, .ai-response-block, .gemini-response-block');
  if (existingBlocks.length > 0) {
    var blocksArr = Array.prototype.slice.call(existingBlocks);
    var removed = 0;
    blocksArr.forEach(function(b) {
      animateBlockOut(b, function() {
        removed++;
        if (removed === blocksArr.length) insertGeminiBlock();
      });
    });
  } else {
    insertGeminiBlock();
  }
}

/**
 * showGeminiLoading — shows a loading card in the content area while Gemini responds.
 * Returns the block element so it can be removed/replaced.
 */
function showGeminiLoading(query) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return null;

  var block = document.createElement('div');
  block.className = 'content-block gemini-loading-block';
  block.setAttribute('role', 'region');
  block.setAttribute('aria-label', 'Cargando respuesta');

  block.innerHTML =
    '<div class="content-block-body">' +
      '<div style="padding:var(--space-4) 0;display:flex;align-items:center;gap:var(--space-3);color:var(--text-muted);">' +
        '<i data-lucide="loader-2" style="width:18px;height:18px;animation:spin 1s linear infinite;"></i>' +
        '<span style="font-size:var(--text-sm);">Pensando sobre "' + esc(query.slice(0, 50)) + '"...</span>' +
      '</div>' +
    '</div>';

  /* Remove existing blocks */
  contentArea.querySelectorAll('.content-block, .ai-response-block, .gemini-response-block').forEach(function(b) { b.remove(); });
  contentArea.appendChild(block);
  initLucide();
  animateBlockIn(block);
  return block;
}

/**
 * callGeminiFallback — fetches aggregated metrics (no PII) and calls /api/gemini-query.
 * On success: renders Gemini mini-card. On error: shows friendly error.
 */
function callGeminiFallback(query, role) {
  var loadingBlock = showGeminiLoading(query);

  /* Build aggregated metrics payload (NEVER PII) */
  function doGeminiCall(metricas) {
    var orgId = window.CURRENT_ORG_ID || '';

    fetch('/api/gemini-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userQuery: query,
        roleContext: role,
        metricas: metricas,
        orgId: orgId
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(result) {
      /* Remove loading block */
      if (loadingBlock && loadingBlock.parentNode) loadingBlock.parentNode.removeChild(loadingBlock);

      if (result && result.error && !result.titulo) {
        /* Show error card */
        showNoMatchResponse(query);
        return;
      }

      showGeminiCard(query, result);
    })
    .catch(function() {
      if (loadingBlock && loadingBlock.parentNode) loadingBlock.parentNode.removeChild(loadingBlock);
      showNoMatchResponse(query);
    });
  }

  /* Fetch aggregated stats if queryConvex is available */
  if (window.queryConvex) {
    window.queryConvex('stats:getLeadsStats', {})
      .then(function(stats) {
        /* Only pass numeric/string aggregate fields — no arrays of lead objects */
        var metricas = {};
        if (stats && typeof stats === 'object') {
          var allowed = ['total','leadsHot','leadsWarm','leadsNurture','nuevosUltimos30Dias',
            'pendientesContactar','cerradosGanados','cerradosPerdidos','tasaConversion',
            'tiempoPromedioRespuesta','hot','warm','nurture','nuevos'];
          allowed.forEach(function(k) {
            if (stats[k] !== undefined) metricas[k] = stats[k];
          });
        }
        doGeminiCall(metricas);
      })
      .catch(function() { doGeminiCall({}); });
  } else {
    doGeminiCall({});
  }
}

/* =============================================================================
   5e. COPY RESUMEN — copy current content area text to clipboard
   ============================================================================= */

function copiarResumen() {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  var text = contentArea.innerText || contentArea.textContent || '';
  text = text.trim();

  if (!text) {
    _showToastInteractions('No hay contenido para copiar');
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(function() { _showToastInteractions('Resumen copiado al portapapeles'); })
      .catch(function() { _fallbackCopy(text); });
  } else {
    _fallbackCopy(text);
  }
}

function _fallbackCopy(text) {
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    _showToastInteractions('Resumen copiado al portapapeles');
  } catch (e) {
    _showToastInteractions('No se pudo copiar. Intenta manualmente.');
  }
}

function _showToastInteractions(message) {
  var container = document.getElementById('toast-container');
  if (!container) {
    /* Create toast container if missing */
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = 'background:var(--surface-raised,#fff);border:1px solid var(--border,#e5e5e5);padding:10px 16px;border-radius:8px;font-size:0.875rem;box-shadow:0 4px 12px rgba(0,0,0,0.1);animation:none;max-width:300px;';
  toast.textContent = message;
  container.appendChild(toast);

  if (typeof gsap !== 'undefined') {
    gsap.fromTo(toast, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 });
    gsap.to(toast, { opacity: 0, y: -5, duration: 0.3, delay: 2.5, onComplete: function() { toast.remove(); } });
  } else {
    setTimeout(function() { toast.remove(); }, 3000);
  }
}

/* =============================================================================
   6. QUERY BUTTONS — render and wire up
   ============================================================================= */

function initQueryButtons(role) {
  var container = document.getElementById('query-buttons');
  if (!container) return;

  var buttons = queryButtonConfig[role] || queryButtonConfig.ceo;

  container.innerHTML = buttons.map(function(btn) {
    return '<button class="query-btn" data-query-id="' + btn.id + '" data-query-label="' + esc(btn.label) + '" aria-label="' + esc(btn.label) + '">' +
      '<div class="query-btn-icon"><i data-lucide="' + btn.icon + '"></i></div>' +
      '<div class="query-btn-text">' +
        '<div class="query-btn-label">' + esc(btn.label) + '</div>' +
        '<div class="query-btn-desc">' + esc(btn.desc) + '</div>' +
      '</div>' +
    '</button>';
  }).join('');

  /* Wire click handlers — ONE content at a time */
  container.querySelectorAll('.query-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var qId = btn.dataset.queryId;
      var qLabel = btn.dataset.queryLabel;

      /* If this button is already active, deactivate and close */
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        currentActiveQueryId = null;
        var block = document.getElementById('block-' + qId);
        if (block) animateBlockOut(block);
        return;
      }

      /* Deactivate all other buttons — only one can be active */
      container.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');

      loadContent(qId, role, qLabel);
    });
  });

  /* Animate buttons in on page load */
  if (typeof gsap !== 'undefined') {
    gsap.from(container.querySelectorAll('.query-btn'), {
      y: 16,
      opacity: 0,
      duration: 0.5,
      stagger: 0.07,
      ease: 'power3.out',
      delay: 0.15
    });
  }

  /* Refresh dynamic badge counts from real Convex data */
  refreshQueryBadges(role);

  /* Restore last active query from localStorage */
  var lastQueryId = _getLastQuery(role);
  if (lastQueryId) {
    var matchBtn = container.querySelector('.query-btn[data-query-id="' + lastQueryId + '"]');
    if (matchBtn) {
      /* Restore after a small delay to let auth settle */
      setTimeout(function() {
        container.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
        matchBtn.classList.add('active');
        var qLabel = matchBtn.dataset.queryLabel || lastQueryId;
        loadContent(lastQueryId, role, qLabel);
      }, 600);
    }
  }
}

/* =============================================================================
   7. COMMAND BAR — filter/highlight + autocomplete
   ============================================================================= */

function initCommandBar(role) {
  var commandBar = document.querySelector('.command-bar');
  if (!commandBar) return;

  var input = commandBar.querySelector('.command-input');
  var suggestionsEl = commandBar.querySelector('.command-suggestions');
  var suggestionsBody = commandBar.querySelector('.command-suggestions-body');
  var sendBtn = commandBar.querySelector('.btn-command-send');

  if (!input) return;

  var currentRole = role || document.body.dataset.role || 'ceo';
  var buttons = queryButtonConfig[currentRole] || queryButtonConfig.ceo;

  /* Render autocomplete suggestions (with history on empty filter) */
  function renderSuggestions(filter) {
    if (!suggestionsBody) return;

    var html = '';

    if (!filter || !filter.trim()) {
      /* Show query history first */
      var history = _getQueryHistory(currentRole);
      if (history.length > 0) {
        html += '<div style="font-size:var(--text-xs);color:var(--text-muted);padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border-subtle);">Recientes</div>';
        html += history.map(function(h) {
          return '<div class="command-suggestion-item" data-query-id="' + esc(h.id) + '" data-query-label="' + esc(h.label) + '">' +
            '<i data-lucide="clock"></i>' +
            '<span>' + esc(h.label) + '</span>' +
          '</div>';
        }).join('');
        html += '<div style="font-size:var(--text-xs);color:var(--text-muted);padding:var(--space-2) var(--space-3);border-bottom:1px solid var(--border-subtle);margin-top:var(--space-1);">Todas las consultas</div>';
      }
      html += buttons.map(function(b) {
        return '<div class="command-suggestion-item" data-query-id="' + b.id + '" data-query-label="' + esc(b.label) + '">' +
          '<i data-lucide="' + b.icon + '"></i>' +
          '<span>' + esc(b.label) + '</span>' +
        '</div>';
      }).join('');
    } else {
      var filtered = buttons.filter(function(b) { return b.label.toLowerCase().includes(filter.toLowerCase()); });
      html += filtered.map(function(b) {
        return '<div class="command-suggestion-item" data-query-id="' + b.id + '" data-query-label="' + esc(b.label) + '">' +
          '<i data-lucide="' + b.icon + '"></i>' +
          '<span>' + esc(b.label) + '</span>' +
        '</div>';
      }).join('');
    }

    suggestionsBody.innerHTML = html;
    initLucide();
  }

  /* Filter query buttons in grid by typing */
  function filterQueryButtons(text) {
    var allBtns = document.querySelectorAll('.query-btn');
    if (!text || !text.trim()) {
      allBtns.forEach(function(b) { b.style.opacity = '1'; b.style.pointerEvents = ''; });
      return;
    }
    allBtns.forEach(function(b) {
      var label = b.dataset.queryLabel || '';
      var matches = label.toLowerCase().includes(text.toLowerCase());
      b.style.opacity = matches ? '1' : '0.3';
      b.style.pointerEvents = matches ? '' : 'none';
    });
  }

  /* Show suggestions on focus */
  input.addEventListener('focus', function() {
    renderSuggestions('');
    if (suggestionsEl) suggestionsEl.classList.add('visible');
  });

  /* Filter on input */
  input.addEventListener('input', function() {
    var val = input.value.trim();
    renderSuggestions(val);
    filterQueryButtons(val);
    if (suggestionsEl && val) {
      suggestionsEl.classList.add('visible');
    }
  });

  /* Enter key: trigger matching query OR conversational AI */
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (suggestionsEl) suggestionsEl.classList.remove('visible');
      filterQueryButtons('');
      input.blur();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;

      input.value = '';
      filterQueryButtons('');
      if (suggestionsEl) suggestionsEl.classList.remove('visible');

      var valLower = val.toLowerCase();

      /* 0. Special commands: copiar resumen */
      if (valLower === 'copiar resumen' || valLower === 'copiar' || valLower === 'copy') {
        copiarResumen();
        _saveQueryToHistory(currentRole, '__copiar', 'Copiar resumen');
        return;
      }

      /* 0b. Special commands: generar reporte PDF */
      if (valLower.includes('pdf') || valLower.includes('reporte') || valLower.includes('generar')) {
        if (typeof window.mostrarSelectorPeriodoPDF === 'function') {
          window.mostrarSelectorPeriodoPDF(currentRole);
        } else {
          /* pdf-report.js not loaded yet — show friendly message */
          _showToastInteractions('Modulo de PDF cargando...');
        }
        _saveQueryToHistory(currentRole, '__pdf', 'Generar reporte PDF');
        return;
      }

      /* 1. Try to match a query button first */
      var match = buttons.find(function(b) {
        return b.label.toLowerCase().includes(valLower);
      });
      if (match) {
        /* Deactivate all, activate matched */
        document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
        var matchBtn = document.querySelector('.query-btn[data-query-id="' + match.id + '"]');
        if (matchBtn) matchBtn.classList.add('active');
        loadContent(match.id, currentRole, match.label);
        _saveQueryToHistory(currentRole, match.id, match.label);
        return;
      }

      /* 2. Try to match conversational patterns */
      var conversations = window.SISTECO_DATA && window.SISTECO_DATA.conversations && window.SISTECO_DATA.conversations[currentRole];
      if (conversations) {
        var valNorm = valLower
          .replace(/[aeiou]/g, function(c) { return { 'a':'a','e':'e','i':'i','o':'o','u':'u','á':'a','é':'e','í':'i','ó':'o','ú':'u','ü':'u' }[c] || c; })
          .replace(/[^a-z0-9 ]/g, '');

        var convMatch = null;
        var bestScore = 0;

        conversations.forEach(function(conv) {
          var queryNorm = conv.query.toLowerCase().replace(/[^a-z0-9 ]/g, '');
          /* Check word overlap */
          var queryWords = queryNorm.split(/\s+/).filter(function(w) { return w.length > 2; });
          var inputWords = valNorm.split(/\s+/).filter(function(w) { return w.length > 2; });
          var matches = 0;
          queryWords.forEach(function(qw) {
            inputWords.forEach(function(iw) {
              if (qw.indexOf(iw) !== -1 || iw.indexOf(qw) !== -1) matches++;
            });
          });
          var score = queryWords.length > 0 ? matches / queryWords.length : 0;
          if (score > bestScore && score >= 0.3) {
            bestScore = score;
            convMatch = conv;
          }
        });

        if (convMatch) {
          showAIResponse(val, convMatch.response, convMatch.type);
          _saveQueryToHistory(currentRole, '__conv_' + Date.now(), val);
          return;
        }
      }

      /* 3. Gemini NL fallback — call serverless proxy with aggregated metrics only */
      _saveQueryToHistory(currentRole, '__gemini_' + Date.now(), val);
      callGeminiFallback(val, currentRole);
    }
  });

  /* Click suggestion */
  if (suggestionsEl) {
    suggestionsEl.addEventListener('click', function(e) {
      var item = e.target.closest('.command-suggestion-item');
      if (!item) return;
      var qId = item.dataset.queryId;
      var qLabel = item.dataset.queryLabel;
      input.value = '';
      filterQueryButtons('');
      suggestionsEl.classList.remove('visible');

      /* Deactivate all buttons, activate clicked one */
      document.querySelectorAll('.query-btn').forEach(function(b) { b.classList.remove('active'); });
      var btn = document.querySelector('.query-btn[data-query-id="' + qId + '"]');
      if (btn) btn.classList.add('active');
      loadContent(qId, currentRole, qLabel);
    });
  }

  /* Send button */
  if (sendBtn) {
    sendBtn.addEventListener('click', function() {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  }

  /* Close suggestions on outside click */
  document.addEventListener('click', function(e) {
    if (!commandBar.contains(e.target)) {
      if (suggestionsEl) suggestionsEl.classList.remove('visible');
      filterQueryButtons('');
    }
  });
}

/* =============================================================================
   8. DATE RANGE PILLS
   ============================================================================= */

function initDateRange() {
  var pills = document.querySelectorAll('.date-range-pill');
  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      var siblings = pill.parentElement.querySelectorAll('.date-range-pill');
      siblings.forEach(function(s) { s.classList.remove('active'); });
      pill.classList.add('active');
    });
  });
}

/* =============================================================================
   9. SIDEBAR NAVIGATION
   ============================================================================= */

function initSidebar() {
  var navItems = document.querySelectorAll('.sidebar-nav-item');
  navItems.forEach(function(item) {
    item.addEventListener('click', function() {
      navItems.forEach(function(i) { i.classList.remove('active'); });
      item.classList.add('active');
    });
  });
}

/* =============================================================================
   10. HERO GREETING — animate in
   ============================================================================= */

function initHeroGreeting() {
  var greeting = document.querySelector('.hero-greeting');
  var subtitle = document.querySelector('.hero-subtitle');
  if (!greeting) return;

  if (typeof gsap !== 'undefined') {
    gsap.from([greeting, subtitle].filter(Boolean), {
      y: 12,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out'
    });
  }
}

/* =============================================================================
   11. INIT FILTERS — VP Ventas pipeline filter pills
   ============================================================================= */

function initFilters() {
  /* Filter pills (estado) */
  var filterPills = document.querySelectorAll('.filter-pill[data-filter-state]');
  var tableRows = document.querySelectorAll('.table-pipeline tbody tr');
  var filterSelects = document.querySelectorAll('.filter-select');
  var filterSearch = document.querySelector('.filter-search');

  var activeState = 'todos';
  var activeIndustria = 'todas';
  var activeScore = 'todos';
  var searchText = '';

  function applyFilters() {
    tableRows.forEach(function(row) {
      var estado = (row.dataset.estado || '').toLowerCase();
      var industria = (row.dataset.industria || '').toLowerCase();
      var score = (row.dataset.score || '').toLowerCase();
      var text = row.textContent.toLowerCase();

      var matchState = (activeState === 'todos') || (estado === activeState);
      var matchInd = (activeIndustria === 'todas') || (industria.indexOf(activeIndustria) !== -1);
      var matchScore = (activeScore === 'todos') || (score === activeScore);
      var matchSearch = !searchText || (text.indexOf(searchText) !== -1);

      if (matchState && matchInd && matchScore && matchSearch) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  /* State pills */
  filterPills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      filterPills.forEach(function(p) { p.classList.remove('active'); });
      pill.classList.add('active');
      activeState = pill.dataset.filterState;
      applyFilters();
    });
  });

  /* Dropdowns */
  filterSelects.forEach(function(sel) {
    sel.addEventListener('change', function() {
      if (sel.dataset.filterType === 'industria') {
        activeIndustria = sel.value;
      } else if (sel.dataset.filterType === 'score') {
        activeScore = sel.value;
      }
      applyFilters();
    });
  });

  /* Search input */
  if (filterSearch) {
    filterSearch.addEventListener('input', function() {
      searchText = filterSearch.value.trim().toLowerCase();
      applyFilters();
    });
  }
}

/* =============================================================================
   12. INIT PIPELINE TABLE — row highlight on click (VP)
   ============================================================================= */

function initPipelineTable() {
  var tableRows = document.querySelectorAll('.table-pipeline tbody tr');
  tableRows.forEach(function(row) {
    row.addEventListener('click', function() {
      tableRows.forEach(function(r) { r.classList.remove('highlight'); });
      row.classList.add('highlight');
    });
  });
}

/* =============================================================================
   13. INIT LEAD PANEL — slide-in panel with lead data (SDR)
   ============================================================================= */

function initLeadPanel() {
  var panel = document.getElementById('lead-panel');
  var overlay = document.getElementById('lead-panel-overlay');
  var closeBtn = document.getElementById('lead-panel-close');

  if (!panel) return;

  /* Use Convex-backed panel opener if available (content-builders.js SDR plan) */
  var _openPanelFn = typeof window.openLeadPanelConvex === 'function'
    ? window.openLeadPanelConvex
    : openPanelMockData;

  function openPanelMockData(leadId) {
    var lead = null;
    if (window.SISTECO_DATA && window.SISTECO_DATA.leads) {
      window.SISTECO_DATA.leads.forEach(function(l) {
        if (l.id === leadId) lead = l;
      });
    }
    if (!lead) return;

    /* Populate panel with mock data */
    fillLeadPanel(lead);

    /* Animate open */
    if (typeof gsap !== 'undefined') {
      gsap.set(panel, { x: 400 });
      gsap.to(panel, { x: 0, duration: 0.4, ease: 'power3.out', clearProps: 'x' });
    }
    panel.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    initLucide();
  }

  function closePanel() {
    if (typeof gsap !== 'undefined') {
      gsap.to(panel, {
        x: 400,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: function() {
          panel.classList.remove('open');
          gsap.set(panel, { clearProps: 'x' });
        }
      });
    } else {
      panel.classList.remove('open');
    }
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }

  /* Wire close button */
  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  /* Wire overlay click */
  if (overlay) {
    overlay.addEventListener('click', closePanel);
  }

  /* Wire table row clicks */
  var leadRows = document.querySelectorAll('.leads-table-row[data-lead-id]');
  leadRows.forEach(function(row) {
    row.style.cursor = 'pointer';
    row.addEventListener('click', function() {
      leadRows.forEach(function(r) { r.classList.remove('highlight'); });
      row.classList.add('highlight');
      _openPanelFn(row.dataset.leadId);
    });
  });

  /* Wire todo-list lead name clicks */
  var todoLeadLinks = document.querySelectorAll('.todo-lead-name[data-lead-id]');
  todoLeadLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.stopPropagation();
      _openPanelFn(link.dataset.leadId);
    });
  });

  /* Open first HOT lead by default — prefer Convex opener */
  /* Note: when Convex builders run (async), they auto-open first HOT via buildSdrTareas.
     This fallback handles the mock-data path only. */
  if (typeof window.openLeadPanelConvex !== 'function') {
    var firstHotRow = document.querySelector('.leads-table-row[data-clasificacion="HOT"]');
    if (firstHotRow) {
      firstHotRow.classList.add('highlight');
      openPanelMockData(firstHotRow.dataset.leadId);
    }
  }
}

/* Fill lead panel with data */
function fillLeadPanel(lead) {
  /* Helper to set text safely */
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }
  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value || '—';
  }

  setText('panel-nombre', lead.nombre || '');
  setText('panel-cargo', (lead.cargo || '') + ' · ' + (lead.empresa || ''));

  /* Score badge */
  var scoreBadgeEl = document.getElementById('panel-score-badge');
  if (scoreBadgeEl) {
    var cls = lead.clasificacion === 'HOT' ? 'badge-hot' : lead.clasificacion === 'WARM' ? 'badge-warm' : 'badge-nurture';
    scoreBadgeEl.className = 'badge ' + cls;
    scoreBadgeEl.textContent = lead.clasificacion + ' ' + lead.score;
  }

  /* Contact */
  setText('panel-email', lead.email);
  setText('panel-tel', lead.telefono);
  setText('panel-ciudad', lead.ciudad);

  /* Email link */
  var emailLink = document.getElementById('panel-email-link');
  if (emailLink && lead.email) {
    emailLink.href = 'mailto:' + lead.email;
    emailLink.textContent = lead.email;
  }

  /* Tel link */
  var telLink = document.getElementById('panel-tel-link');
  if (telLink && lead.telefono) {
    telLink.href = 'tel:' + lead.telefono;
    telLink.textContent = lead.telefono;
  }

  /* Empresa */
  setText('panel-empresa', lead.empresa);
  setText('panel-rut', lead.empresa_rut);
  setText('panel-actividad', lead.sii_actividad);
  setText('panel-tamano', lead.tamano);
  setText('panel-inicio', lead.sii_inicio_actividades);
  setText('panel-industria-label', lead.industria);

  /* Score breakdown bars */
  var scoreTotal = lead.score || 0;
  setText('panel-score-total', scoreTotal + '/100');

  /* Fill factor bars based on total score (normalized) */
  var factors = [
    { id: 'bar-tamano', label: 'Tamano empresa', max: 25, pct: Math.min(Math.round(scoreTotal * 0.28), 25) },
    { id: 'bar-industria', label: 'Industria match', max: 25, pct: Math.min(Math.round(scoreTotal * 0.25), 25) },
    { id: 'bar-actividad', label: 'Actividad reciente', max: 25, pct: Math.min(Math.round(scoreTotal * 0.25), 25) },
    { id: 'bar-completitud', label: 'Completitud datos', max: 25, pct: Math.min(Math.round(scoreTotal * 0.22), 25) }
  ];

  factors.forEach(function(f) {
    var fillEl = document.getElementById(f.id);
    if (fillEl) {
      fillEl.style.width = Math.round((f.pct / f.max) * 100) + '%';
    }
    var valEl = document.getElementById(f.id + '-val');
    if (valEl) {
      valEl.textContent = f.pct + '/' + f.max;
    }
  });

  /* Timeline — generate based on lead data */
  var timelineEl = document.getElementById('panel-timeline');
  if (timelineEl) {
    var events = [
      { action: 'Ingresado al pipeline', days: lead.fecha_ingreso_dias + 5 },
      { action: 'Enriquecido con datos SII', days: lead.fecha_ingreso_dias + 3 },
      { action: 'Scored: ' + lead.clasificacion + ' ' + lead.score, days: lead.fecha_ingreso_dias + 2 },
      { action: lead.sdr_asignado ? ('Asignado a ' + lead.sdr_asignado.split(' ')[0]) : 'Sin asignar', days: lead.fecha_ingreso_dias }
    ];

    timelineEl.innerHTML = events.map(function(ev, idx) {
      var dateLabel = ev.days === 0 ? 'hoy' : ev.days === 1 ? 'ayer' : 'hace ' + ev.days + ' dias';
      return '<div class="timeline-item">' +
        '<div class="timeline-dot-wrapper">' +
          '<div class="timeline-dot" style="background:' + (idx === 0 ? 'var(--accent)' : 'var(--border)') + ';"></div>' +
          (idx < events.length - 1 ? '<div class="timeline-line"></div>' : '') +
        '</div>' +
        '<div class="timeline-content">' +
          '<div class="timeline-action">' + esc(ev.action) + '</div>' +
          '<div class="timeline-date">' + dateLabel + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
}

/* =============================================================================
   14. INIT TODO LIST — checkbox toggle (SDR)
   ============================================================================= */

function initTodoList() {
  var todoItems = document.querySelectorAll('.todo-item');
  todoItems.forEach(function(item) {
    var checkbox = item.querySelector('.todo-checkbox');
    if (!checkbox) return;
    checkbox.addEventListener('click', function(e) {
      e.stopPropagation();
      item.classList.toggle('completed');
    });
  });
}

/* =============================================================================
   15. DOM CONTENT LOADED — main init
   ============================================================================= */

document.addEventListener('DOMContentLoaded', function() {
  var role = document.body.dataset.role || 'ceo';

  initLucide();
  initDateRange();
  initSidebar();
  initHeroGreeting();
  initQueryButtons(role);

  /* Role-specific inits */
  if (role === 'vp' || role === 'vp-ventas') {
    initFilters();
    initPipelineTable();
  }

  if (role === 'sdr') {
    initTodoList();
    initLeadPanel();
  }

  /* Command bar last so lucide is ready */
  requestAnimationFrame(function() {
    initCommandBar(role);
    initLucide();
  });
});
