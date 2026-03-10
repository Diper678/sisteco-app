/* =============================================================================
   Sisteco Interactions — interactions.js
   Interactividad compartida: Lucide, GSAP, Command Bar, Query Buttons, On-Demand Content
   Version: 3.0 — Natural Language Workspace (on-demand UX)
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
  ceo: {}
};

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
   5. LOAD CONTENT — on-demand block insertion
   ============================================================================= */

function loadContent(queryId, role, queryLabel) {
  var contentArea = document.getElementById('content-area');
  if (!contentArea) return;

  /* Check if already loaded — if so, scroll to it */
  var existing = document.getElementById('block-' + queryId);
  if (existing) {
    existing.scrollIntoView({ behavior: 'smooth', block: 'start' });
    /* Flash it */
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(existing, { boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 0px transparent', duration: 0.8, ease: 'power2.out' });
    }
    return;
  }

  /* Get content builder */
  var builder = contentBuilders[role] && contentBuilders[role][queryId];
  var innerHtml = '';

  if (builder) {
    innerHtml = builder();
  } else {
    /* Fallback for roles without specific builder */
    innerHtml = '<p style="color:var(--text-secondary);padding:var(--space-4) 0;">Contenido para "' + esc(queryLabel) + '" disponible en la version de produccion.</p>';
  }

  /* Build block */
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
  '<div class="content-block-body">' + innerHtml + '</div>';

  contentArea.appendChild(block);

  /* Close button handler */
  block.querySelector('.content-block-close').addEventListener('click', function() {
    animateBlockOut(block);
    /* Re-activate the query button */
    var btn = document.querySelector('.query-btn[data-query-id="' + queryId + '"]');
    if (btn) btn.classList.remove('active');
  });

  /* Init lucide + animate */
  initLucide();
  animateBlockIn(block);

  /* Animate chart bars if present */
  if (typeof gsap !== 'undefined') {
    var bars = block.querySelectorAll('.chart-bar-h-fill');
    bars.forEach(function(bar) {
      var targetWidth = bar.style.width;
      bar.style.width = '0%';
      gsap.to(bar, {
        width: targetWidth,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.3
      });
    });

    /* Animate funnel bars height */
    var funnelBars = block.querySelectorAll('.funnel-bar-visual');
    funnelBars.forEach(function(bar) {
      var targetH = bar.style.height;
      bar.style.height = '0%';
      gsap.to(bar, {
        height: targetH,
        duration: 0.7,
        ease: 'power3.out',
        delay: 0.2
      });
    });
  }

  block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

  /* Wire click handlers */
  container.querySelectorAll('.query-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var qId = btn.dataset.queryId;
      var qLabel = btn.dataset.queryLabel;
      btn.classList.toggle('active');

      /* If deactivating, close block */
      if (!btn.classList.contains('active')) {
        var block = document.getElementById('block-' + qId);
        if (block) animateBlockOut(block);
        return;
      }

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

  /* Render autocomplete suggestions */
  function renderSuggestions(filter) {
    if (!suggestionsBody) return;
    var filtered = filter
      ? buttons.filter(function(b) { return b.label.toLowerCase().includes(filter.toLowerCase()); })
      : buttons;

    suggestionsBody.innerHTML = filtered.map(function(b) {
      return '<div class="command-suggestion-item" data-query-id="' + b.id + '" data-query-label="' + esc(b.label) + '">' +
        '<i data-lucide="' + b.icon + '"></i>' +
        '<span>' + esc(b.label) + '</span>' +
      '</div>';
    }).join('');
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

  /* Enter key: trigger first matching query */
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

      /* Find first matching button */
      var match = buttons.find(function(b) {
        return b.label.toLowerCase().includes(val.toLowerCase());
      });
      if (match) {
        input.value = '';
        filterQueryButtons('');
        if (suggestionsEl) suggestionsEl.classList.remove('visible');
        /* Activate button */
        var btn = document.querySelector('.query-btn[data-query-id="' + match.id + '"]');
        if (btn) {
          btn.classList.add('active');
          loadContent(match.id, currentRole, match.label);
        }
      }
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

      var btn = document.querySelector('.query-btn[data-query-id="' + qId + '"]');
      if (btn) {
        btn.classList.add('active');
      }
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
   11. DOM CONTENT LOADED — main init
   ============================================================================= */

document.addEventListener('DOMContentLoaded', function() {
  var role = document.body.dataset.role || 'ceo';

  initLucide();
  initDateRange();
  initSidebar();
  initHeroGreeting();
  initQueryButtons(role);

  /* Command bar last so lucide is ready */
  requestAnimationFrame(function() {
    initCommandBar(role);
    initLucide();
  });
});
