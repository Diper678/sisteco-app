/* =============================================================================
   Sisteco Interactions — interactions.js
   Interactividad compartida: Lucide, GSAP, Command Bar, Date Range, Sidebar
   Version: 2.0
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
   2. GSAP ANIMATIONS
   ============================================================================= */

function initAnimations() {
  if (typeof gsap === 'undefined') return;

  // Entrada escalonada de cards KPI
  const kpiCards = document.querySelectorAll('.card-kpi');
  if (kpiCards.length > 0) {
    gsap.from(kpiCards, {
      y: 24,
      opacity: 0,
      duration: 0.6,
      stagger: 0.08,
      ease: 'power3.out',
      delay: 0.1
    });
  }

  // Count-up animado para numeros KPI
  const kpiValues = document.querySelectorAll('[data-countup]');
  kpiValues.forEach(function(el) {
    var target = parseFloat(el.dataset.countup);
    var isPercent = el.dataset.countupType === 'percent';
    var isCurrency = el.dataset.countupType === 'currency';

    if (isNaN(target)) return;

    if (isCurrency) {
      // Para currency, no usar textContent snap (tiene formato CLP)
      var obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.2,
        ease: 'power2.out',
        delay: 0.3,
        onUpdate: function() {
          el.textContent = window.formatCLP ? window.formatCLP(Math.round(obj.val)) : '$' + Math.round(obj.val).toLocaleString('es-CL');
        }
      });
    } else if (isPercent) {
      // Para porcentajes: animar el numero y agregar el simbolo
      var suffix = el.dataset.countupSuffix || '%';
      var obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.0,
        ease: 'power2.out',
        delay: 0.3,
        onUpdate: function() {
          el.textContent = obj.val.toFixed(1) + suffix;
        }
      });
    } else {
      // Para enteros simples
      gsap.from(el, {
        textContent: 0,
        duration: 1.0,
        ease: 'power2.out',
        delay: 0.3,
        snap: { textContent: 1 }
      });
    }
  });

  // Fade-in del funnel
  var funnelEl = document.querySelector('.funnel');
  if (funnelEl) {
    gsap.from(funnelEl, {
      opacity: 0,
      y: 16,
      duration: 0.7,
      ease: 'power3.out',
      delay: 0.4
    });
  }

  // Animacion de barras horizontales del chart
  var chartBars = document.querySelectorAll('.chart-bar-h-fill');
  if (chartBars.length > 0) {
    chartBars.forEach(function(bar) {
      var targetWidth = bar.style.width;
      bar.style.width = '0%';
      gsap.to(bar, {
        width: targetWidth,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.6
      });
    });
  }

  // Entrada general de secciones
  var sections = document.querySelectorAll('.funnel-section, .segmentation-section, .chart-card');
  if (sections.length > 0) {
    gsap.from(sections, {
      opacity: 0,
      y: 16,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.2
    });
  }
}

/* =============================================================================
   3. COMMAND BAR
   ============================================================================= */

// Sugerencias por rol
var commandSuggestions = {
  ceo: [
    { icon: 'git-branch', text: 'Como va mi funnel este mes' },
    { icon: 'flame', text: 'Leads HOT de la ultima semana' },
    { icon: 'users', text: 'Rendimiento del equipo' },
    { icon: 'banknote', text: 'Pipeline value actual' },
    { icon: 'pie-chart', text: 'Leads por industria' },
    { icon: 'bar-chart-3', text: 'Comparar con mes anterior' }
  ],
  vp: [
    { icon: 'users', text: 'Leads sin asignar ahora' },
    { icon: 'flame', text: 'HOT sin contactar en 48h' },
    { icon: 'bar-chart-3', text: 'Rendimiento del equipo esta semana' },
    { icon: 'git-branch', text: 'Estado del pipeline completo' },
    { icon: 'user-check', text: 'Asignaciones pendientes' },
    { icon: 'trending-up', text: 'Conversion por SDR' }
  ],
  sdr: [
    { icon: 'list-todo', text: 'Mis tareas de hoy' },
    { icon: 'flame', text: 'Mis leads HOT pendientes' },
    { icon: 'phone', text: 'Leads para llamar ahora' },
    { icon: 'calendar', text: 'Mis reuniones esta semana' },
    { icon: 'linkedin', text: 'Leads de LinkedIn sin contactar' },
    { icon: 'user', text: 'Detalle de mi proximo lead' }
  ]
};

// Respuestas simuladas para sugerencias
var commandResponses = {
  'Como va mi funnel este mes': 'Mostrando: funnel de conversion de marzo 2026. 47 leads → 42 enriquecidos → 12 HOT → 8 contactados → 4 clientes. Tasa de conversion: 8.5%.',
  'Leads HOT de la ultima semana': 'Mostrando: 6 leads HOT ingresados esta semana — Carolina Mendez (88), Andres Fuentes (82), Ignacio Valenzuela (79), Valentina Torres (75), Sebastian Herrera (73), Camila Soto (68).',
  'Rendimiento del equipo': 'Mostrando: equipo de 3 SDRs. Sofia Mendez lidera: 8 contactados, 3 reuniones (25% conversion). Diego Rojas: 5 contactados, 2 reuniones (22%). Paula Vidal: 3 contactados, 1 reunion (14%).',
  'Pipeline value actual': 'Mostrando: pipeline valorado en $45.600.000 CLP (+12% vs mes anterior). Cierre estimado con conversion actual: $3.876.000.',
  'Leads por industria': 'Mostrando: Tecnologia 14 leads (30%), Serv. Financieros 8 (17%), Manufactura 7 (15%), Ingenieria 5 (11%), Comercio 4 (9%), Otros 9 (19%).',
  'Comparar con mes anterior': 'Mostrando: marzo vs febrero. Leads nuevos: +15% (47 vs 41). HOT: +33% (12 vs 9). Conversion: +1.2pp (8.5% vs 7.3%). Pipeline value: +12%.',
  'Leads sin asignar ahora': 'Mostrando: 19 leads sin asignar. 6 son HOT con prioridad urgente: Ignacio Valenzuela (79), Camila Soto (68), y 4 mas. Recomendado: asignar a Sofia Mendez primero.',
  'HOT sin contactar en 48h': 'Mostrando: 3 leads HOT sin contactar en mas de 48 horas — Ignacio Valenzuela, Camila Soto, y Sebastian Herrera. Accion recomendada: contacto inmediato.',
  'Mis tareas de hoy': 'Mostrando: 3 tareas urgentes para hoy — Enviar propuesta a Carolina Mendez, confirmar reunion con Andres Fuentes (manana 10am), primer contacto con Sebastian Herrera.',
  'Mis leads HOT pendientes': 'Mostrando: tus 3 leads HOT activos — Carolina Mendez (88, propuesta enviada), Andres Fuentes (82, reunion manana), Sebastian Herrera (73, primer contacto pendiente).'
};

function initCommandBar(role) {
  var commandBar = document.querySelector('.command-bar');
  if (!commandBar) return;

  var input = commandBar.querySelector('.command-input');
  var suggestionsEl = commandBar.querySelector('.command-suggestions');
  var suggestionsBody = commandBar.querySelector('.command-suggestions-body');
  var resultEl = commandBar.querySelector('.command-result');
  var sendBtn = commandBar.querySelector('.btn-command-send');

  if (!input || !suggestionsEl) return;

  // Determinar el rol
  var currentRole = role || document.body.dataset.role || 'ceo';
  var suggestions = commandSuggestions[currentRole] || commandSuggestions.ceo;

  // Renderizar sugerencias
  if (suggestionsBody) {
    suggestionsBody.innerHTML = suggestions.map(function(s) {
      return '<div class="command-suggestion-item" data-query="' + s.text + '">' +
        '<i data-lucide="' + s.icon + '"></i>' +
        '<span>' + s.text + '</span>' +
        '</div>';
    }).join('');
  }

  // Mostrar sugerencias al hacer focus
  input.addEventListener('focus', function() {
    suggestionsEl.classList.add('visible');
    initLucide(); // re-init para los nuevos iconos
  });

  // Ocultar al presionar Escape
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      suggestionsEl.classList.remove('visible');
      input.blur();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      processQuery(input.value);
    }
  });

  // Click en sugerencia
  suggestionsEl.addEventListener('click', function(e) {
    var item = e.target.closest('.command-suggestion-item');
    if (!item) return;
    var query = item.dataset.query;
    input.value = query;
    suggestionsEl.classList.remove('visible');
    processQuery(query);
  });

  // Click en boton send
  if (sendBtn) {
    sendBtn.addEventListener('click', function() {
      processQuery(input.value);
    });
  }

  // Cerrar sugerencias al hacer click fuera
  document.addEventListener('click', function(e) {
    if (!commandBar.contains(e.target)) {
      suggestionsEl.classList.remove('visible');
    }
  });

  function processQuery(query) {
    if (!query || !query.trim()) return;

    suggestionsEl.classList.remove('visible');

    if (!resultEl) return;

    // Mostrar spinner loading
    resultEl.classList.add('visible');
    resultEl.innerHTML = '<div class="command-result-label">Procesando...</div>' +
      '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">' +
      '<span class="spinner"></span>' +
      '<span style="font-size:0.875rem;color:#999;">Consultando datos del pipeline...</span>' +
      '</div>';

    // Simular respuesta despues de 500ms
    setTimeout(function() {
      var response = commandResponses[query] ||
        'Mostrando resultados para: "' + query + '". Los datos del pipeline estan actualizados al ' + new Date().toLocaleDateString('es-CL') + '.';

      resultEl.innerHTML = '<div class="command-result-label">Resultado</div>' +
        '<p style="font-size:0.875rem;color:#444;line-height:1.6;">' + response + '</p>';

      // Re-init lucide por si hay nuevos iconos
      initLucide();
    }, 500);
  }
}

/* =============================================================================
   4. DATE RANGE PILLS
   ============================================================================= */

function initDateRange() {
  var pills = document.querySelectorAll('.date-range-pill');
  pills.forEach(function(pill) {
    pill.addEventListener('click', function() {
      // Remover activo de todos en el mismo contenedor
      var siblings = pill.parentElement.querySelectorAll('.date-range-pill');
      siblings.forEach(function(s) { s.classList.remove('active'); });
      // Activar el clickeado
      pill.classList.add('active');
    });
  });
}

/* =============================================================================
   5. SIDEBAR NAVIGATION
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
   6. DOM CONTENT LOADED — Ejecutar todos los inits
   ============================================================================= */

document.addEventListener('DOMContentLoaded', function() {
  var role = document.body.dataset.role || 'ceo';

  // Inicializar en orden
  initLucide();
  initDateRange();
  initSidebar();
  initCommandBar(role);

  // Animaciones al final (despues del render)
  requestAnimationFrame(function() {
    initAnimations();
  });
});
