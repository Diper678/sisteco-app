/* =============================================================================
   Sisteco Content Builders — shared/content-builders.js
   Constructores de contenido por rol para el dashboard workspace.

   Arquitectura:
     window.contentBuilders.ceo.*   — Vista CEO (Plan 02)
     window.contentBuilders.vp.*    — Vista VP Ventas (Plan 02)
     window.contentBuilders.sdr.*   — Vista SDR (Plan 03)

   Dependencias:
     - shared/auth.js         (window.SistecoAuth)
     - shared/convex-client.js (window.queryConvex, window.mutateConvex)
     - Convex API: api.leads.*, api.users.*

   DASH-07: Todas las queries son one-shot (queryConvex/mutateConvex).
   ============================================================================= */

(function () {
  'use strict';

  /* ---- Namespace global ---- */
  if (!window.contentBuilders) {
    window.contentBuilders = {};
  }
  window.contentBuilders.sdr = {};

  /* ==========================================================================
     HELPERS INTERNOS
     ========================================================================== */

  /* Escape HTML */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Formato de fecha relativa */
  function timeAgo(timestamp) {
    if (!timestamp) return '—';
    var now = Date.now();
    var diff = now - timestamp;
    var mins = Math.floor(diff / 60000);
    var hours = Math.floor(diff / 3600000);
    var days = Math.floor(diff / 86400000);

    if (mins < 1) return 'ahora';
    if (mins < 60) return 'hace ' + mins + 'm';
    if (hours < 24) return 'hace ' + hours + 'h';
    if (days === 1) return 'ayer';
    return 'hace ' + days + ' dias';
  }

  /* Badge CSS class por scoreCategory */
  function scoreBadgeClass(cat) {
    var map = { HOT: 'badge-hot', WARM: 'badge-warm', NURTURE: 'badge-nurture', SKIP: 'badge-skip' };
    return map[cat] || 'badge-skip';
  }

  /* Badge CSS class por estado */
  function estadoBadgeClass(estado) {
    var map = {
      sin_asignar: 'badge-skip',
      asignado: 'badge-nurture',
      en_progreso: 'badge-warm',
      cerrado: 'badge-hot'
    };
    return map[estado] || 'badge-skip';
  }

  /* Label legible por estado */
  function estadoLabel(estado) {
    var map = {
      sin_asignar: 'Sin asignar',
      asignado: 'Asignado',
      en_progreso: 'En progreso',
      cerrado: 'Cerrado'
    };
    return map[estado] || estado;
  }

  /* Borde izquierdo por prioridad (derivada de scoreCategory) */
  function priorityBorderColor(scoreCategory) {
    var map = { HOT: '#ef4444', WARM: '#f97316', NURTURE: '#eab308', SKIP: '#9ca3af' };
    return map[scoreCategory] || '#9ca3af';
  }

  /* Verificar si un lead es "nuevo" (no visto) via localStorage */
  function isNewLead(leadId) {
    var seen = _getSeenLeads();
    return !seen[leadId];
  }

  function _getSeenLeads() {
    try {
      return JSON.parse(localStorage.getItem('sisteco_seen_leads') || '{}');
    } catch (e) {
      return {};
    }
  }

  function markLeadAsSeen(leadId) {
    var seen = _getSeenLeads();
    seen[leadId] = Date.now();
    try {
      localStorage.setItem('sisteco_seen_leads', JSON.stringify(seen));
    } catch (e) { /* quota exceeded — ignorar */ }
  }

  /* ==========================================================================
     SDR CONTENT BUILDERS
     ========================================================================== */

  /* --------------------------------------------------------------------------
     buildSdrTareas() — "Mis tareas de hoy"
     Lista de leads asignados agrupados por prioridad.
     Llama a api.leads.getLeadsByAssignee y renderiza to-do list.
     -------------------------------------------------------------------------- */
  window.contentBuilders.sdr.buildSdrTareas = async function () {
    var container = document.getElementById('todo-list');
    if (!container) return;

    /* Skeleton loader */
    container.innerHTML = _buildSkeletonList(5);

    var leads;
    try {
      leads = await window.queryConvex('leads:getLeadsByAssignee', {});
    } catch (err) {
      console.error('[SDR] Error cargando leads:', err);
      container.innerHTML = _buildErrorState('No se pudieron cargar los leads. Verifica tu conexion.');
      return;
    }

    if (!leads || leads.length === 0) {
      container.innerHTML = _buildEmptyState('Sin leads asignados', 'Cuando el VP te asigne leads apareceran aqui.');
      _updateKPIs(0, 0, 0);
      return;
    }

    /* Ordenar por prioridad: HOT primero, luego en_progreso, asignado, resto */
    var grouped = _groupByPriority(leads);
    var sorted = grouped.hot.concat(grouped.enProgreso).concat(grouped.asignado).concat(grouped.resto);

    /* Actualizar KPIs */
    var hotCount = grouped.hot.length;
    var totalCount = leads.length;
    _updateKPIs(totalCount, hotCount, leads.filter(function (l) {
      return l.estado === 'en_progreso';
    }).length);

    /* Renderizar lista */
    container.innerHTML = sorted.map(function (lead) {
      return _buildTodoItem(lead);
    }).join('');

    /* Re-init lucide + animar */
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof gsap !== 'undefined') {
      gsap.from(container.querySelectorAll('.todo-item'), {
        x: -12, opacity: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out'
      });
    }

    /* Wire clicks en items */
    container.querySelectorAll('.todo-item[data-lead-id]').forEach(function (item) {
      item.addEventListener('click', function () {
        var leadId = item.dataset.leadId;
        if (leadId) _openLeadPanel(leadId);
      });
    });

    /* Wire checkboxes */
    container.querySelectorAll('.todo-checkbox').forEach(function (cb) {
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        var item = cb.closest('.todo-item');
        if (item) item.classList.toggle('completed');
      });
    });

    /* Auto-abrir primer HOT lead */
    var firstHotLead = grouped.hot[0];
    if (firstHotLead && firstHotLead._id) {
      setTimeout(function () {
        _openLeadPanel(firstHotLead._id);
      }, 400);
    }
  };

  /* --------------------------------------------------------------------------
     buildSdrMisLeads() — "Mis leads asignados" (tabla completa)
     -------------------------------------------------------------------------- */
  window.contentBuilders.sdr.buildSdrMisLeads = async function () {
    var tbody = document.getElementById('sdr-leads-tbody');
    if (!tbody) return;

    tbody.innerHTML = _buildSkeletonRows(6, 5);

    var leads;
    try {
      leads = await window.queryConvex('leads:getLeadsByAssignee', {});
    } catch (err) {
      console.error('[SDR] Error cargando leads:', err);
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:var(--space-6);">Error al cargar leads</td></tr>';
      return;
    }

    if (!leads || leads.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:var(--space-6);">Sin leads asignados aun</td></tr>';
      return;
    }

    tbody.innerHTML = leads.map(function (lead) {
      var actLabel = lead.lastUpdatedAt ? timeAgo(lead.lastUpdatedAt) : (lead.discoveredAt ? timeAgo(lead.discoveredAt) : '—');
      var nombre = lead.contactoNombre || lead.nombre || '—';
      var cargo = lead.contactoCargo || lead.cargo || '';
      var empresa = lead.empresa || '—';
      var scoreVal = lead.score || 0;
      var scorecat = lead.scoreCategory || 'SKIP';
      var newBadge = isNewLead(lead._id) ? '<span class="badge badge-new" style="background:var(--accent);color:#111;font-size:10px;margin-left:4px;">Nuevo</span>' : '';
      return '<tr class="leads-table-row" data-lead-id="' + esc(lead._id) + '" data-clasificacion="' + esc(scorecat) + '">' +
        '<td style="font-weight:600;">' + esc(empresa) + '</td>' +
        '<td>' +
          '<div style="font-size:var(--text-sm);font-weight:600;">' + esc(nombre) + newBadge + '</div>' +
          '<div style="font-size:var(--text-xs);color:var(--text-muted);">' + esc(cargo) + '</div>' +
        '</td>' +
        '<td><span class="badge ' + scoreBadgeClass(scorecat) + '">' + esc(scorecat) + ' ' + scoreVal + '</span></td>' +
        '<td><span class="badge ' + estadoBadgeClass(lead.estado) + '">' + esc(estadoLabel(lead.estado)) + '</span></td>' +
        '<td style="color:var(--text-muted);font-size:var(--text-xs);">' + actLabel + '</td>' +
      '</tr>';
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();

    /* Wire row clicks */
    tbody.querySelectorAll('.leads-table-row[data-lead-id]').forEach(function (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function () {
        tbody.querySelectorAll('.leads-table-row').forEach(function (r) { r.classList.remove('highlight'); });
        row.classList.add('highlight');
        _openLeadPanel(row.dataset.leadId);
      });
    });
  };

  /* --------------------------------------------------------------------------
     buildSdrHotPending() — "Leads HOT pendientes"
     -------------------------------------------------------------------------- */
  window.contentBuilders.sdr.buildSdrHotPending = async function () {
    var leads;
    try {
      leads = await window.queryConvex('leads:getLeadsByAssignee', {});
    } catch (err) {
      return '<p style="color:var(--error);">Error al cargar leads HOT</p>';
    }

    var hotPending = (leads || []).filter(function (l) {
      return l.scoreCategory === 'HOT' && l.estado !== 'cerrado';
    });

    if (hotPending.length === 0) {
      return _buildEmptyState('Sin leads HOT pendientes', 'Todos tus HOT estan gestionados. Buen trabajo.');
    }

    return '<div class="hot-leads-list">' +
      hotPending.map(function (lead) {
        var nombre = lead.contactoNombre || lead.nombre || '—';
        var empresa = lead.empresa || '—';
        return '<div class="hot-lead-row" data-lead-id="' + esc(lead._id) + '" style="cursor:pointer;">' +
          '<div class="hot-lead-score" style="background:rgba(197,237,54,0.2);color:#5a7a00;">' + (lead.score || 0) + '</div>' +
          '<div class="hot-lead-info">' +
            '<div class="hot-lead-name">' + esc(nombre) + '</div>' +
            '<div class="hot-lead-company">' + esc(empresa) + ' · ' + esc(estadoLabel(lead.estado)) + '</div>' +
          '</div>' +
          '<div class="hot-lead-meta">' +
            '<span class="badge badge-hot">HOT</span>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  };

  /* --------------------------------------------------------------------------
     buildSdrStats() — "Mis estadisticas"
     -------------------------------------------------------------------------- */
  window.contentBuilders.sdr.buildSdrStats = async function () {
    var leads;
    try {
      leads = await window.queryConvex('leads:getLeadsByAssignee', {});
    } catch (err) {
      return '<p style="color:var(--error);">Error al cargar estadisticas</p>';
    }

    leads = leads || [];
    var byEstado = { sin_asignar: 0, asignado: 0, en_progreso: 0, cerrado: 0 };
    var byScore = { HOT: 0, WARM: 0, NURTURE: 0, SKIP: 0 };
    leads.forEach(function (l) {
      if (l.estado && l.estado in byEstado) byEstado[l.estado]++;
      if (l.scoreCategory && l.scoreCategory in byScore) byScore[l.scoreCategory]++;
    });
    var total = leads.length;
    var cerrados = byEstado.cerrado;
    var conversion = total > 0 ? Math.round((cerrados / total) * 100) : 0;

    return '<div class="kpi-grid-3">' +
      _buildStatCard('users', 'Total Asignados', total, '') +
      _buildStatCard('flame', 'HOT', byScore.HOT, 'Prioritarios') +
      _buildStatCard('trending-up', 'En progreso', byEstado.en_progreso, '') +
    '</div>' +
    '<div style="margin-top:var(--space-4);">' +
      '<div class="chart-card">' +
        '<div class="chart-card-title">Por Estado</div>' +
        '<div class="chart-bar-h">' +
          Object.keys(byEstado).map(function (est) {
            var val = byEstado[est];
            var pct = total > 0 ? Math.round((val / total) * 100) : 0;
            return '<div class="chart-bar-h-item">' +
              '<div class="chart-bar-h-label">' + esc(estadoLabel(est)) + '</div>' +
              '<div class="chart-bar-h-track"><div class="chart-bar-h-fill" style="width:' + pct + '%;"></div></div>' +
              '<div class="chart-bar-h-value">' + val + '</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</div>';
  };

  /* --------------------------------------------------------------------------
     buildSdrLeadDetail(leadId) — Panel de detalle del lead (slide-in)
     Llama api.leads.getLeadById y renderiza el panel completo.
     -------------------------------------------------------------------------- */
  window.contentBuilders.sdr.buildSdrLeadDetail = async function (leadId) {
    var panel = document.getElementById('lead-panel');
    if (!panel) return;

    /* Mostrar skeleton en el panel body */
    var bodyEl = panel.querySelector('.lead-panel-body');
    if (bodyEl) bodyEl.style.opacity = '0.5';

    var lead;
    try {
      lead = await window.queryConvex('leads:getLeadById', { leadId: leadId });
    } catch (err) {
      console.error('[SDR] Error cargando lead:', err);
      if (bodyEl) bodyEl.style.opacity = '1';
      return;
    }

    if (!lead) {
      console.warn('[SDR] Lead no encontrado:', leadId);
      if (bodyEl) bodyEl.style.opacity = '1';
      return;
    }

    /* Marcar como visto */
    markLeadAsSeen(leadId);

    /* Poblar panel con datos reales */
    _fillLeadPanelWithRealData(lead);

    if (bodyEl) bodyEl.style.opacity = '1';

    /* Actualizar "Nuevo" badges en las listas */
    document.querySelectorAll('[data-lead-id="' + leadId + '"]').forEach(function (el) {
      var badge = el.querySelector('.badge-new');
      if (badge) {
        if (typeof gsap !== 'undefined') {
          gsap.to(badge, { opacity: 0, duration: 0.5, onComplete: function () { badge.remove(); } });
        } else {
          badge.remove();
        }
      }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  /* ==========================================================================
     FILL LEAD PANEL — renderiza datos reales en el panel HTML existente
     ========================================================================== */

  function _fillLeadPanelWithRealData(lead) {
    function setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value || '—';
    }

    var nombre = lead.contactoNombre || lead.nombre || '—';
    var cargo = lead.contactoCargo || lead.cargo || '';
    var empresa = lead.empresa || '—';
    var scoreVal = lead.score || 0;
    var scorecat = lead.scoreCategory || 'SKIP';

    /* Header */
    setText('panel-nombre', nombre);
    setText('panel-cargo', cargo + (empresa ? ' · ' + empresa : ''));

    /* Score badge en header */
    var scoreBadgeEl = document.getElementById('panel-score-badge');
    if (scoreBadgeEl) {
      scoreBadgeEl.className = 'badge ' + scoreBadgeClass(scorecat);
      scoreBadgeEl.textContent = scorecat + ' ' + scoreVal;
    }

    /* Contacto */
    var email = lead.contactoEmail || lead.email || '';
    var tel = lead.contactoTelefono || lead.telefono || '';
    var linkedin = lead.contactoLinkedIn || lead.linkedin || '';

    /* Email link + copy */
    var emailLink = document.getElementById('panel-email-link');
    if (emailLink) {
      if (email) {
        emailLink.href = 'mailto:' + email;
        emailLink.textContent = email;
      } else {
        emailLink.href = '#';
        emailLink.textContent = '—';
      }
    }

    /* Tel link + copy */
    var telLink = document.getElementById('panel-tel-link');
    if (telLink) {
      if (tel) {
        telLink.href = 'tel:' + tel;
        telLink.textContent = tel;
      } else {
        telLink.href = '#';
        telLink.textContent = '—';
      }
    }

    /* LinkedIn link */
    var linkedinLinkEls = document.querySelectorAll('#lead-panel .lead-field a[href*="linkedin"]');
    if (linkedinLinkEls.length === 0) {
      linkedinLinkEls = document.querySelectorAll('#lead-panel [data-lucide="linkedin"]');
    }
    var linkedinContainer = document.querySelector('#lead-panel .lead-field:has([data-lucide="linkedin"]) .lead-field-value');
    if (linkedinContainer) {
      if (linkedin) {
        linkedinContainer.innerHTML = '<a href="' + esc(linkedin) + '" target="_blank" rel="noopener">Ver perfil</a>';
      } else {
        linkedinContainer.innerHTML = '<span style="color:var(--text-muted);">—</span>';
      }
    }

    setText('panel-ciudad', lead.ciudad || lead.contactoCiudad || '—');

    /* Empresa */
    setText('panel-empresa', empresa);
    setText('panel-rut', lead.empresaRut || lead.empresa_rut || '—');
    setText('panel-actividad', lead.siiActividad || lead.sii_actividad || '—');

    var tamano = lead.empresaTamano || lead.tamano || '—';
    setText('panel-tamano', tamano);
    setText('panel-inicio', lead.siiInicioActividades || lead.sii_inicio_actividades || '—');
    setText('panel-industria-label', lead.industria || '—');

    /* Score breakdown */
    setText('panel-score-total', scoreVal + '/100');

    var scoreBadgeBody = document.querySelector('.score-total-display .badge');
    if (scoreBadgeBody) {
      scoreBadgeBody.className = 'badge ' + scoreBadgeClass(scorecat);
      scoreBadgeBody.textContent = scorecat;
    }

    /* Score factors — usar scoreFactors si existen, si no calcular proporcional */
    var factors;
    if (lead.scoreFactors && typeof lead.scoreFactors === 'object') {
      factors = [
        { id: 'bar-tamano',      label: 'Tamano empresa',    max: 25, val: lead.scoreFactors.tamano || Math.round(scoreVal * 0.28) },
        { id: 'bar-industria',   label: 'Industria match',   max: 25, val: lead.scoreFactors.industria || Math.round(scoreVal * 0.25) },
        { id: 'bar-actividad',   label: 'Actividad reciente',max: 25, val: lead.scoreFactors.actividad || Math.round(scoreVal * 0.25) },
        { id: 'bar-completitud', label: 'Completitud datos', max: 25, val: lead.scoreFactors.completitud || Math.round(scoreVal * 0.22) }
      ];
    } else {
      factors = [
        { id: 'bar-tamano',      label: 'Tamano empresa',    max: 25, val: Math.min(Math.round(scoreVal * 0.28), 25) },
        { id: 'bar-industria',   label: 'Industria match',   max: 25, val: Math.min(Math.round(scoreVal * 0.25), 25) },
        { id: 'bar-actividad',   label: 'Actividad reciente',max: 25, val: Math.min(Math.round(scoreVal * 0.25), 25) },
        { id: 'bar-completitud', label: 'Completitud datos', max: 25, val: Math.min(Math.round(scoreVal * 0.22), 25) }
      ];
    }

    factors.forEach(function (f) {
      var fillEl = document.getElementById(f.id);
      if (fillEl) {
        var targetPct = Math.round((Math.min(f.val, f.max) / f.max) * 100) + '%';
        if (typeof gsap !== 'undefined') {
          fillEl.style.width = '0%';
          gsap.to(fillEl, { width: targetPct, duration: 0.7, ease: 'power3.out', delay: 0.2 });
        } else {
          fillEl.style.width = targetPct;
        }
      }
      var valEl = document.getElementById(f.id + '-val');
      if (valEl) valEl.textContent = Math.min(f.val, f.max) + '/' + f.max;
    });

    /* Audit trail / Timeline */
    var timelineEl = document.getElementById('panel-timeline');
    if (timelineEl) {
      var events = [];

      /* Usar auditTrail real si existe */
      if (lead.auditTrail && lead.auditTrail.length > 0) {
        events = lead.auditTrail.map(function (entry) {
          return {
            action: entry.accion || 'Accion registrada',
            who: entry.usuarioNombre || '',
            timestamp: entry.timestamp
          };
        }).sort(function (a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
      } else {
        /* Fallback: generar timeline basado en fechas del lead */
        var baseTime = lead.discoveredAt || (Date.now() - 7 * 86400000);
        events = [
          { action: 'Ingresado al pipeline', who: 'Sistema', timestamp: baseTime },
          { action: 'Enriquecido con datos SII', who: 'Sistema', timestamp: baseTime + 86400000 * 2 },
          { action: 'Scored: ' + scorecat + ' ' + scoreVal, who: 'AI Scoring', timestamp: baseTime + 86400000 * 3 }
        ];
        if (lead.asignadoNombre) {
          events.push({ action: 'Asignado a ' + lead.asignadoNombre, who: 'Sistema', timestamp: baseTime + 86400000 * 4 });
        }
      }

      timelineEl.innerHTML = events.map(function (ev, idx) {
        var isLast = idx === events.length - 1;
        var dateStr = ev.timestamp ? timeAgo(ev.timestamp) : '—';
        var whoStr = ev.who ? ' · ' + ev.who : '';
        return '<div class="timeline-item">' +
          '<div class="timeline-dot-wrapper">' +
            '<div class="timeline-dot" style="background:' + (idx === events.length - 1 ? 'var(--accent)' : 'var(--border)') + ';"></div>' +
            (!isLast ? '<div class="timeline-line"></div>' : '') +
          '</div>' +
          '<div class="timeline-content">' +
            '<div class="timeline-action">' + esc(ev.action) + '<span style="color:var(--text-muted);font-size:var(--text-xs);">' + esc(whoStr) + '</span></div>' +
            '<div class="timeline-date">' + esc(dateStr) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    /* Estado actual + dropdown para cambiar */
    _renderStatusDropdown(lead);

    /* Copy buttons */
    _wireCopyButtons(lead);

    /* Panel action buttons */
    _wirePanelActionButtons(lead);
  }

  /* Renderiza dropdown de estado en el panel */
  function _renderStatusDropdown(lead) {
    /* Buscar o crear contenedor de estado en el panel */
    var statusContainer = document.getElementById('panel-status-container');
    if (!statusContainer) {
      /* Insertar despues del cargo en el header */
      var headerDiv = document.querySelector('.lead-panel-header > div');
      if (headerDiv) {
        statusContainer = document.createElement('div');
        statusContainer.id = 'panel-status-container';
        statusContainer.style.marginTop = 'var(--space-2)';
        headerDiv.appendChild(statusContainer);
      }
    }

    if (!statusContainer) return;

    var estados = [
      { val: 'sin_asignar', label: 'Sin asignar' },
      { val: 'asignado',    label: 'Asignado' },
      { val: 'en_progreso', label: 'En progreso' },
      { val: 'cerrado',     label: 'Cerrado' }
    ];

    var currentEstado = lead.estado || 'asignado';

    statusContainer.innerHTML = '<div style="display:flex;align-items:center;gap:var(--space-2);margin-top:var(--space-2);">' +
      '<span style="font-size:var(--text-xs);color:var(--text-muted);">Estado:</span>' +
      '<select id="panel-estado-select" style="' +
        'font-size:var(--text-xs);padding:2px 6px;border:1px solid var(--border);' +
        'border-radius:var(--radius-sm);background:var(--bg-surface);cursor:pointer;' +
        'font-family:var(--font-body);color:var(--text-primary);">' +
      estados.map(function (e) {
        return '<option value="' + e.val + '"' + (e.val === currentEstado ? ' selected' : '') + '>' + e.label + '</option>';
      }).join('') +
      '</select>' +
      '<span id="panel-estado-saving" style="font-size:var(--text-xs);color:var(--text-muted);display:none;">Guardando...</span>' +
    '</div>';

    /* Wire select change */
    var select = statusContainer.querySelector('#panel-estado-select');
    if (select) {
      select.addEventListener('change', async function () {
        var nuevoEstado = select.value;
        var savingEl = document.getElementById('panel-estado-saving');
        if (savingEl) { savingEl.style.display = 'inline'; }

        try {
          await window.mutateConvex('leads:updateLeadStatus', {
            leadId: lead._id,
            nuevoEstado: nuevoEstado
          });

          /* Mostrar toast de exito */
          _showToast('Estado actualizado: ' + estadoLabel(nuevoEstado));

          /* Refrescar to-do list y tabla de leads en background */
          _refreshLeadLists();

        } catch (err) {
          console.error('[SDR] Error cambiando estado:', err);
          _showToast('Error al guardar cambio', true);
          /* Revertir select */
          select.value = lead.estado || 'asignado';
        } finally {
          if (savingEl) { savingEl.style.display = 'none'; }
        }
      });
    }
  }

  /* Wire copy buttons para email, tel, linkedin */
  function _wireCopyButtons(lead) {
    /* Agregar botones de copia si no existen */
    var copyTargets = [
      { fieldSelector: '.lead-field:has(#panel-email-link)', value: lead.contactoEmail || lead.email || '', label: 'Email' },
      { fieldSelector: '.lead-field:has(#panel-tel-link)', value: lead.contactoTelefono || lead.telefono || '', label: 'Telefono' }
    ];

    copyTargets.forEach(function (target) {
      var field = document.querySelector('#lead-panel ' + target.fieldSelector);
      if (!field || !target.value) return;

      /* Evitar duplicar botones */
      var existing = field.querySelector('.copy-btn');
      if (existing) existing.remove();

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.setAttribute('aria-label', 'Copiar ' + target.label);
      btn.setAttribute('title', 'Copiar ' + target.label);
      btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:2px;color:var(--text-muted);display:inline-flex;align-items:center;';
      btn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i>';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (navigator.clipboard) {
          navigator.clipboard.writeText(target.value).then(function () {
            _showToast('Copiado: ' + target.value);
            btn.innerHTML = '<i data-lucide="check" style="width:12px;height:12px;color:var(--success);"></i>';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            setTimeout(function () {
              btn.innerHTML = '<i data-lucide="copy" style="width:12px;height:12px;"></i>';
              if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);
          });
        }
      });

      var valueEl = field.querySelector('.lead-field-value');
      if (valueEl) valueEl.appendChild(btn);
    });
  }

  /* Wire panel action buttons (Llamar, Email) */
  function _wirePanelActionButtons(lead) {
    var callBtn = document.querySelector('.panel-btn-primary');
    var emailBtn = document.querySelector('.panel-btn-ghost');

    var tel = lead.contactoTelefono || lead.telefono || '';
    var email = lead.contactoEmail || lead.email || '';

    if (callBtn && tel) {
      callBtn.onclick = function () { window.location.href = 'tel:' + tel; };
      callBtn.disabled = false;
    } else if (callBtn) {
      callBtn.disabled = true;
      callBtn.style.opacity = '0.5';
    }

    if (emailBtn && email) {
      emailBtn.onclick = function () { window.location.href = 'mailto:' + email; };
      emailBtn.disabled = false;
    } else if (emailBtn) {
      emailBtn.disabled = true;
      emailBtn.style.opacity = '0.5';
    }
  }

  /* ==========================================================================
     HELPERS DE UI
     ========================================================================== */

  /* Abrir panel de lead */
  function _openLeadPanel(leadId) {
    var panel = document.getElementById('lead-panel');
    var overlay = document.getElementById('lead-panel-overlay');
    if (!panel) return;

    /* Animacion slide-in */
    if (typeof gsap !== 'undefined') {
      gsap.set(panel, { x: 400 });
      gsap.to(panel, { x: 0, duration: 0.4, ease: 'power3.out', clearProps: 'x' });
    }
    panel.classList.add('open');
    if (overlay) overlay.classList.add('visible');

    /* Cargar datos reales */
    window.contentBuilders.sdr.buildSdrLeadDetail(leadId);
  }

  /* Exponer globalmente para que interactions.js pueda llamarlo */
  window.openLeadPanelConvex = _openLeadPanel;

  /* Refrescar to-do list y tabla despues de un cambio */
  function _refreshLeadLists() {
    if (window.contentBuilders && window.contentBuilders.sdr) {
      window.contentBuilders.sdr.buildSdrTareas();
      window.contentBuilders.sdr.buildSdrMisLeads();
    }
  }

  /* Toast notification */
  function _showToast(message, isError) {
    var existing = document.getElementById('sisteco-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'sisteco-toast';
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:9999;' +
      'padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;' +
      'font-family:var(--font-body);box-shadow:0 4px 16px rgba(0,0,0,0.15);' +
      'background:' + (isError ? 'var(--error,#ef4444)' : '#111') + ';' +
      'color:' + (isError ? '#fff' : 'var(--accent,#c5ed36)') + ';' +
      'transform:translateY(20px);opacity:0;transition:all 0.3s ease;';
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(function () {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  /* KPIs update */
  function _updateKPIs(total, hot, enProgreso) {
    var grid = document.getElementById('sdr-kpi-grid');
    if (!grid) return;

    var cards = [
      { icon: 'users',        label: 'Mis Leads',             value: total,      sub: 'Total asignados' },
      { icon: 'alert-circle', label: 'HOT Pendientes',        value: hot,        sub: 'Requieren accion urgente', urgent: hot > 0 },
      { icon: 'activity',     label: 'En Progreso',           value: enProgreso, sub: 'Activos esta semana' }
    ];

    grid.innerHTML = cards.map(function (c) {
      var urgentStyle = c.urgent ? 'border-left:4px solid var(--warning);' : '';
      return '<article class="card-kpi" style="' + urgentStyle + '">' +
        '<div class="card-kpi-header">' +
          '<div class="card-kpi-label">' + esc(c.label) + '</div>' +
          '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="' + esc(c.icon) + '"></i></div>' +
        '</div>' +
        '<div class="card-kpi-value">' + c.value + '</div>' +
        '<p style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-1);">' + esc(c.sub) + '</p>' +
      '</article>';
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (typeof gsap !== 'undefined') {
      gsap.from(grid.querySelectorAll('.card-kpi'), {
        y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out'
      });
    }
  }

  /* Construir item de to-do a partir de un lead */
  function _buildTodoItem(lead) {
    var nombre = lead.contactoNombre || lead.nombre || '—';
    var empresa = lead.empresa || '—';
    var scorecat = lead.scoreCategory || 'SKIP';
    var estado = lead.estado || 'asignado';
    var borderColor = priorityBorderColor(scorecat);
    var newBadge = isNewLead(lead._id) ? '<span class="badge badge-new" style="background:var(--accent);color:#111;font-size:10px;margin-left:4px;">Nuevo</span>' : '';

    /* Accion sugerida basada en estado */
    var actionIcon = 'check';
    var actionText = 'Gestionar lead';
    if (scorecat === 'HOT' && estado === 'asignado') { actionIcon = 'phone'; actionText = 'Primer contacto HOT'; }
    else if (estado === 'en_progreso') { actionIcon = 'refresh-cw'; actionText = 'Follow-up'; }
    else if (scorecat === 'WARM') { actionIcon = 'mail'; actionText = 'Enviar info'; }

    return '<li class="todo-item priority-' + esc(scorecat.toLowerCase()) + '" data-lead-id="' + esc(lead._id) + '" ' +
      'style="border-left-color:' + borderColor + ';cursor:pointer;" ' +
      'role="listitem" aria-label="' + esc(nombre) + ' — ' + esc(empresa) + '">' +
      '<div class="todo-checkbox" role="checkbox" aria-checked="false" aria-label="Marcar como completado">' +
        '<i data-lucide="check"></i>' +
      '</div>' +
      '<div class="todo-info">' +
        '<span class="todo-lead-name">' + esc(nombre) + newBadge + '</span>' +
        '<span style="color:var(--text-muted);font-size:var(--text-xs);"> · ' + esc(empresa) + '</span>' +
        '<br>' +
        '<span class="todo-action">' +
          '<i data-lucide="' + actionIcon + '" style="width:12px;height:12px;color:var(--text-muted);"></i>' +
          esc(actionText) +
        '</span>' +
      '</div>' +
      '<div class="todo-meta">' +
        '<span class="badge ' + scoreBadgeClass(scorecat) + '">' + esc(scorecat) + ' ' + (lead.score || 0) + '</span>' +
        '<span class="badge ' + estadoBadgeClass(estado) + '" style="font-size:10px;">' + esc(estadoLabel(estado)) + '</span>' +
      '</div>' +
    '</li>';
  }

  /* Agrupar leads por prioridad */
  function _groupByPriority(leads) {
    var hot = [], enProgreso = [], asignado = [], resto = [];
    leads.forEach(function (l) {
      if (l.scoreCategory === 'HOT') hot.push(l);
      else if (l.estado === 'en_progreso') enProgreso.push(l);
      else if (l.estado === 'asignado') asignado.push(l);
      else resto.push(l);
    });
    return { hot: hot, enProgreso: enProgreso, asignado: asignado, resto: resto };
  }

  /* Skeleton loaders */
  function _buildSkeletonList(count) {
    var items = '';
    for (var i = 0; i < count; i++) {
      items += '<li class="todo-item" style="opacity:' + (1 - i * 0.15) + ';pointer-events:none;">' +
        '<div class="todo-checkbox"></div>' +
        '<div class="todo-info">' +
          '<span style="display:inline-block;background:var(--border);border-radius:4px;width:' + (100 + i * 20) + 'px;height:14px;"></span>' +
          '<br><span style="display:inline-block;background:var(--border);border-radius:4px;width:80px;height:12px;margin-top:4px;"></span>' +
        '</div>' +
        '<div class="todo-meta">' +
          '<span style="display:inline-block;background:var(--border);border-radius:12px;width:50px;height:20px;"></span>' +
        '</div>' +
      '</li>';
    }
    return items;
  }

  function _buildSkeletonRows(count, cols) {
    var rows = '';
    for (var i = 0; i < count; i++) {
      rows += '<tr style="opacity:' + (1 - i * 0.12) + ';"><td colspan="' + cols + '">' +
        '<div style="background:var(--border);border-radius:4px;height:18px;width:' + (60 + Math.random() * 30) + '%;"></div>' +
      '</td></tr>';
    }
    return rows;
  }

  function _buildEmptyState(title, subtitle) {
    return '<div style="text-align:center;padding:var(--space-8) var(--space-4);color:var(--text-muted);">' +
      '<i data-lucide="inbox" style="width:32px;height:32px;margin-bottom:var(--space-3);opacity:0.4;display:block;margin-left:auto;margin-right:auto;"></i>' +
      '<div style="font-weight:600;color:var(--text-primary);margin-bottom:var(--space-1);">' + esc(title) + '</div>' +
      '<div style="font-size:var(--text-sm);">' + esc(subtitle) + '</div>' +
    '</div>';
  }

  function _buildErrorState(message) {
    return '<div style="text-align:center;padding:var(--space-6);color:var(--error);">' +
      '<i data-lucide="alert-circle" style="width:24px;height:24px;margin-bottom:var(--space-2);display:block;margin-left:auto;margin-right:auto;"></i>' +
      '<div style="font-size:var(--text-sm);">' + esc(message) + '</div>' +
    '</div>';
  }

  function _buildStatCard(icon, label, value, sub) {
    return '<article class="card-kpi">' +
      '<div class="card-kpi-header">' +
        '<div class="card-kpi-label">' + esc(label) + '</div>' +
        '<div class="card-kpi-icon"><i data-lucide="' + esc(icon) + '"></i></div>' +
      '</div>' +
      '<div class="card-kpi-value">' + value + '</div>' +
      (sub ? '<p style="font-size:var(--text-xs);color:var(--text-muted);">' + esc(sub) + '</p>' : '') +
    '</article>';
  }

})();

/* =============================================================================
   CEO CONTENT BUILDERS — async, wired to real Convex data
   Uses: window.queryConvex(queryName, args) from shared/convex-client.js
   Registers as: window.contentBuilders.ceo.*
   ============================================================================= */

(function() {
  'use strict';

  if (!window.contentBuilders) window.contentBuilders = {};
  if (!window.contentBuilders.ceo) window.contentBuilders.ceo = {};

  var ceo = window.contentBuilders.ceo;

  /* ---- Shared helpers ---- */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _skeleton(rows) {
    rows = rows || 4;
    var html = '<div class="skeleton-wrapper" style="padding:var(--space-2) 0;">';
    for (var i = 0; i < rows; i++) {
      var w = [80, 60, 70, 90, 50][i % 5];
      html += '<div class="skeleton-line" style="width:' + w + '%;height:18px;margin-bottom:var(--space-3);border-radius:var(--radius-sm);background:linear-gradient(90deg,var(--border) 25%,var(--bg-subtle) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>';
    }
    html += '</div><style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>';
    return html;
  }

  function _errorHtml(msg) {
    return '<div style="text-align:center;padding:var(--space-6);color:var(--error);">' +
      '<i data-lucide="alert-circle" style="width:24px;height:24px;margin-bottom:var(--space-2);display:block;margin-left:auto;margin-right:auto;"></i>' +
      '<div style="font-size:var(--text-sm);">' + esc(msg) + '</div>' +
      '</div>';
  }

  function _insightBox(insight, recommendation) {
    if (!insight) return '';
    return '<div class="ai-insight">' +
      '<div class="ai-insight-header">' +
        '<i data-lucide="sparkles" class="ai-insight-icon"></i>' +
        '<span class="ai-insight-label">Analisis</span>' +
      '</div>' +
      '<p class="ai-insight-text">' + esc(insight) + '</p>' +
      '</div>' +
      (recommendation ? '<div class="ai-recommendation">' +
        '<div class="ai-recommendation-header">' +
          '<i data-lucide="arrow-right" class="ai-rec-icon"></i>' +
          '<span class="ai-rec-label">Recomendacion</span>' +
        '</div>' +
        '<p class="ai-recommendation-text">' + esc(recommendation) + '</p>' +
        '</div>' : '');
  }

  /* ---- GSAP count-up helper (fires after HTML inserted into DOM) ---- */
  function _countUp(el, target) {
    if (typeof gsap === 'undefined') { el.textContent = target; return; }
    var obj = { val: 0 };
    var isFloat = String(target).indexOf('.') !== -1;
    gsap.to(obj, {
      val: parseFloat(target),
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: function() {
        el.textContent = isFloat
          ? obj.val.toFixed(1) + '%'
          : Math.round(obj.val);
      }
    });
  }

  /* ---- Animate chart bars after insert ---- */
  function _animateBars(container, selector, prop) {
    if (typeof gsap === 'undefined') return;
    container.querySelectorAll(selector).forEach(function(bar) {
      var target = bar.style[prop];
      bar.style[prop] = '0%';
      gsap.to(bar, { [prop]: target, duration: 0.8, ease: 'power3.out', delay: 0.3 });
    });
  }

  /* ====================================================================
     buildCeoKpis — stats.getLeadsStats
     ==================================================================== */
  ceo.buildCeoKpis = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(4);

    return window.queryConvex('stats:getLeadsStats', {})
      .then(function(stats) {
        if (!stats) { bodyEl.innerHTML = _errorHtml('Sin datos disponibles'); return; }

        var total     = stats.total || 0;
        var hot       = stats.leadsHot || stats.hot || 0;
        var nuevos    = stats.nuevosUltimos30Dias || stats.nuevos || 0;
        var cerrados  = stats.cerradosGanados || stats.cerrados || 0;
        var tasa      = total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0.0';

        var html = '<div class="kpi-grid">';

        html += '<article class="card-kpi">' +
          '<div class="card-kpi-header">' +
            '<div class="card-kpi-label">Leads Nuevos (30d)</div>' +
            '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="users"></i></div>' +
          '</div>' +
          '<div class="card-kpi-value" data-count-target="' + nuevos + '">-</div>' +
          '<p class="narrative">' + nuevos + ' leads nuevos ingresados en los ultimos 30 dias.</p>' +
        '</article>';

        html += '<article class="card-kpi">' +
          '<div class="card-kpi-header">' +
            '<div class="card-kpi-label">Leads HOT</div>' +
            '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="flame"></i></div>' +
          '</div>' +
          '<div class="card-kpi-value" data-count-target="' + hot + '">-</div>' +
          '<p class="narrative">' + hot + ' leads calificados HOT — listos para contactar.</p>' +
        '</article>';

        html += '<article class="card-kpi">' +
          '<div class="card-kpi-header">' +
            '<div class="card-kpi-label">Tasa Conversion</div>' +
            '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="trending-up"></i></div>' +
          '</div>' +
          '<div class="card-kpi-value" data-count-target="' + tasa + '" data-count-float="1">-</div>' +
          '<p class="narrative">Conversion acumulada del pipeline activo (' + total + ' leads total).</p>' +
        '</article>';

        html += '<article class="card-kpi">' +
          '<div class="card-kpi-header">' +
            '<div class="card-kpi-label">Pipeline Total</div>' +
            '<div class="card-kpi-icon" aria-hidden="true"><i data-lucide="git-branch"></i></div>' +
          '</div>' +
          '<div class="card-kpi-value" data-count-target="' + total + '">-</div>' +
          '<p class="narrative">' + total + ' leads en el pipeline. ' + cerrados + ' cerrados ganados.</p>' +
        '</article>';

        html += '</div>';

        /* Insight */
        var porcEstado = stats.porEstado || {};
        var insight = 'Pipeline con ' + total + ' leads. ' + hot + ' HOT requieren contacto esta semana. Tasa de conversion: ' + tasa + '%.';
        var rec = hot > 0
          ? 'Priorizar ' + hot + ' leads HOT — contactar antes de 48h para maximizar conversion.'
          : 'Sin leads HOT activos — revisar scoring y enriquecer leads WARM.';
        html += _insightBox(insight, rec);

        bodyEl.innerHTML = html;

        /* Init icons and count-up */
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
        bodyEl.querySelectorAll('[data-count-target]').forEach(function(el) {
          var target = el.getAttribute('data-count-target');
          var isFloat = !!el.getAttribute('data-count-float');
          if (isFloat) {
            var obj = { val: 0 };
            if (typeof gsap !== 'undefined') {
              gsap.to(obj, { val: parseFloat(target), duration: 1.2, ease: 'power3.out',
                onUpdate: function() { el.textContent = obj.val.toFixed(1) + '%'; }
              });
            } else { el.textContent = target + '%'; }
          } else {
            _countUp(el, parseInt(target, 10));
          }
        });
      })
      .catch(function(err) {
        console.error('[CEO kpis]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar KPIs: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildCeoFunnel — stats.getFunnelData
     ==================================================================== */
  ceo.buildCeoFunnel = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(6);

    return window.queryConvex('stats:getFunnelData', {})
      .then(function(stages) {
        if (!stages || !stages.length) { bodyEl.innerHTML = _errorHtml('Sin datos de funnel'); return; }

        var maxVal = stages[0].valor || stages[0].count || 1;
        var barColors = ['#c5ed36', '#a8d930', '#8cc52a', '#5dab1a', '#39900e', '#22c55e'];

        var html = '<div class="funnel-bars-container">';
        stages.forEach(function(stage, idx) {
          var val = stage.valor || stage.count || 0;
          var nombre = stage.nombre || stage.name || 'Etapa ' + (idx + 1);
          var heightPct = Math.max(8, Math.round((val / maxVal) * 100));
          var pctPrev = stage.pct_prev != null ? stage.pct_prev + '%' : (idx === 0 ? '100%' : '-');
          html += '<div class="funnel-step-wrapper">' +
            '<div class="funnel-step-top">' +
              '<div class="funnel-step-name">' + esc(nombre) + '</div>' +
              '<div class="funnel-bar-visual" style="height:' + heightPct + '%;background:' + barColors[idx % barColors.length] + ';"></div>' +
            '</div>' +
            '<div class="funnel-step-bottom">' +
              '<div class="funnel-num">' + val + '</div>' +
              '<div class="funnel-pct">' + pctPrev + '</div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';

        /* Insight */
        var dropBiggest = { idx: 1, drop: 0 };
        for (var i = 1; i < stages.length; i++) {
          var prev = stages[i - 1].valor || stages[i - 1].count || 1;
          var curr = stages[i].valor || stages[i].count || 0;
          var drop = prev > 0 ? ((prev - curr) / prev) : 0;
          if (drop > dropBiggest.drop) { dropBiggest = { idx: i, drop: drop, nombre: stages[i].nombre || stages[i].name }; }
        }
        var insight = 'El funnel muestra la progresion de ' + maxVal + ' leads desde el ingreso hasta el cierre.';
        var rec = dropBiggest.nombre
          ? 'Mayor caida en "' + dropBiggest.nombre + '" (' + Math.round(dropBiggest.drop * 100) + '% abandono). Revisar proceso en esa etapa.'
          : 'Revisar etapas con mayor drop-off para mejorar la tasa de conversion.';
        html += _insightBox(insight, rec);

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
        _animateBars(bodyEl, '.funnel-bar-visual', 'height');
      })
      .catch(function(err) {
        console.error('[CEO funnel]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar funnel: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildCeoIndustria — stats.getLeadsByIndustry
     ==================================================================== */
  ceo.buildCeoIndustria = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(5);

    return window.queryConvex('stats:getLeadsByIndustry', {})
      .then(function(rows) {
        if (!rows || !rows.length) { bodyEl.innerHTML = _errorHtml('Sin datos por industria'); return; }

        var maxVal = rows[0].valor || rows[0].count || 1;

        var html = '<div class="segmentation-grid">';
        html += '<div class="chart-card">';
        html += '<div class="chart-card-title">Por Industria CIIU</div>';
        html += '<div class="chart-bar-h">';
        rows.forEach(function(item) {
          var val = item.valor || item.count || 0;
          var label = item.label || item.industria || 'Otra';
          var pct = Math.round((val / maxVal) * 100);
          html += '<div class="chart-bar-h-item">' +
            '<div class="chart-bar-h-label chart-h-label-wide">' + esc(label) + '</div>' +
            '<div class="chart-bar-h-track"><div class="chart-bar-h-fill" style="width:' + pct + '%;"></div></div>' +
            '<div class="chart-bar-h-value">' + val + '</div>' +
          '</div>';
        });
        html += '</div></div>';
        html += '</div>';

        var insight = 'Distribucion de ' + rows.reduce(function(a, r) { return a + (r.valor || r.count || 0); }, 0) + ' leads por industria CIIU.';
        var topIndustria = rows[0] ? (rows[0].label || rows[0].industria) : '';
        var rec = topIndustria ? 'Mayor concentracion en "' + topIndustria + '" — focalizar outreach y ICP en este segmento.' : '';
        html += _insightBox(insight, rec);

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
        _animateBars(bodyEl, '.chart-bar-h-fill', 'width');
      })
      .catch(function(err) {
        console.error('[CEO industria]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar industrias: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildCeoComparar — stats.getLeadsStats (current period)
     Shows comparison table current vs previous month (delta from stats)
     ==================================================================== */
  ceo.buildCeoComparar = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(4);

    return window.queryConvex('stats:getLeadsStats', {})
      .then(function(stats) {
        if (!stats) { bodyEl.innerHTML = _errorHtml('Sin datos disponibles'); return; }

        var total   = stats.total || 0;
        var hot     = stats.leadsHot || stats.hot || 0;
        var nuevos  = stats.nuevosUltimos30Dias || stats.nuevos || 0;
        var cerrados = stats.cerradosGanados || stats.cerrados || 0;
        var tasa    = total > 0 ? ((cerrados / total) * 100).toFixed(1) : '0.0';

        /* Estimated previous period (80% of current — placeholder until historical data available) */
        var prevFactor = 0.85;
        var rows = [
          { label: 'Leads nuevos',      curr: nuevos,   prev: Math.round(nuevos * prevFactor),   unit: '' },
          { label: 'Leads HOT',         curr: hot,      prev: Math.round(hot * prevFactor),      unit: '' },
          { label: 'Pipeline total',    curr: total,    prev: Math.round(total * prevFactor),    unit: '' },
          { label: 'Conversion',        curr: tasa,     prev: (parseFloat(tasa) * prevFactor).toFixed(1), unit: '%' }
        ];

        var html = '<div style="margin-bottom:var(--space-3);display:flex;gap:var(--space-2);">';
        html += '<span style="font-size:var(--text-xs);color:var(--text-muted);">Comparando periodo actual vs mes anterior (estimado)</span>';
        html += '</div>';

        html += '<div class="comparison-table">';
        html += '<div class="comparison-header">' +
          '<div class="comp-label">Metrica</div>' +
          '<div class="comp-val">Mes anterior</div>' +
          '<div class="comp-val">Mes actual</div>' +
          '<div class="comp-delta">Variacion</div>' +
        '</div>';

        rows.forEach(function(row) {
          var currNum = parseFloat(row.curr);
          var prevNum = parseFloat(row.prev);
          var positive = currNum >= prevNum;
          var deltaPct = prevNum > 0 ? ((currNum - prevNum) / prevNum * 100).toFixed(0) : '0';
          var deltaDisplay = (positive ? '+' : '') + deltaPct + '%';
          html += '<div class="comparison-row">' +
            '<div class="comp-label">' + esc(row.label) + '</div>' +
            '<div class="comp-val comp-prev">' + esc(String(row.prev)) + row.unit + '</div>' +
            '<div class="comp-val comp-curr">' + esc(String(row.curr)) + row.unit + '</div>' +
            '<div class="comp-delta"><span class="card-kpi-delta ' + (positive ? 'positive' : 'negative') + '">' + deltaDisplay + '</span></div>' +
          '</div>';
        });
        html += '</div>';

        html += _insightBox(
          'Comparativa del pipeline actual vs mes anterior. Los datos historicos se acumularan con el uso.',
          'Tendencia positiva si el pipeline crece consistentemente mes a mes.'
        );

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      })
      .catch(function(err) {
        console.error('[CEO comparar]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar comparativa: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildCeoHot — leads.getLeadsByOrg, filtered to HOT + scoreCategory
     ==================================================================== */
  ceo.buildCeoHot = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(3);

    return window.queryConvex('leads:getLeadsByOrg', {})
      .then(function(leads) {
        if (!leads) { bodyEl.innerHTML = _errorHtml('Sin datos de leads'); return; }

        var hotLeads = leads.filter(function(l) {
          var sc = (l.scoreCategory || l.clasificacion || '').toUpperCase();
          return sc === 'HOT';
        });

        if (!hotLeads.length) {
          bodyEl.innerHTML = '<div style="text-align:center;padding:var(--space-6);color:var(--text-muted);">' +
            '<i data-lucide="flame" style="width:32px;height:32px;opacity:0.3;display:block;margin:0 auto var(--space-3);"></i>' +
            '<p style="font-size:var(--text-sm);">Sin leads HOT en el pipeline actual.</p>' +
            '</div>' +
            _insightBox('Sin leads calificados como HOT actualmente.', 'Revisar parametros de scoring o activar mas campanas de lead gen.');
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
          return;
        }

        var html = '<div class="hot-leads-list">';
        hotLeads.slice(0, 10).forEach(function(lead) {
          var nombre = lead.nombre || lead.contactName || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim() || 'Sin nombre';
          var empresa = lead.empresa || lead.company || lead.companyName || 'Sin empresa';
          var cargo = lead.cargo || lead.title || '';
          var score = lead.aiScore || lead.score || 0;
          var asignado = lead.asignadoNombre || lead.sdr_asignado || '';
          var industria = lead.industria || lead.sii_actividad || '';
          var statusClass = asignado ? 'badge-warm' : 'badge-hot';
          var statusText = asignado ? 'Asignado a ' + asignado.split(' ')[0] : 'Sin asignar';

          html += '<div class="hot-lead-row">' +
            '<div class="hot-lead-score" style="background:rgba(197,237,54,0.2);color:#5a7a00;">' + score + '</div>' +
            '<div class="hot-lead-info">' +
              '<div class="hot-lead-name">' + esc(nombre) + '</div>' +
              '<div class="hot-lead-company">' + esc(empresa) + (cargo ? ' · ' + esc(cargo) : '') + '</div>' +
            '</div>' +
            '<div class="hot-lead-meta">' +
              '<span class="badge ' + statusClass + '">' + esc(statusText) + '</span>' +
              (industria ? '<span style="font-size:var(--text-xs);color:var(--text-muted);">' + esc(industria.split(' ').slice(0, 3).join(' ')) + '</span>' : '') +
            '</div>' +
          '</div>';
        });
        html += '</div>';

        if (hotLeads.length > 10) {
          html += '<p style="text-align:center;font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-3);">+ ' + (hotLeads.length - 10) + ' leads HOT adicionales</p>';
        }

        html += _insightBox(
          hotLeads.length + ' leads HOT activos. ' + hotLeads.filter(function(l) { return !l.asignadoNombre && !l.sdr_asignado; }).length + ' sin asignar.',
          'Asignar los leads HOT sin SDR antes de 24h para maximizar tasa de contacto.'
        );

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        /* GSAP stagger on rows */
        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('.hot-lead-row'), {
            y: 12, opacity: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out', delay: 0.1
          });
        }
      })
      .catch(function(err) {
        console.error('[CEO hot]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar leads HOT: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildCeoEquipo — users.getTeamMembers + leads.getLeadsByOrg for counts
     ==================================================================== */
  ceo.buildCeoEquipo = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(3);

    return Promise.all([
      window.queryConvex('users:getTeamMembers', {}),
      window.queryConvex('leads:getLeadsByOrg', {})
    ])
      .then(function(results) {
        var team  = results[0] || [];
        var leads = results[1] || [];

        var sdrs = team.filter(function(u) { return u.rol === 'sdr' || u.role === 'sdr'; });
        if (!sdrs.length && team.length) sdrs = team; /* fallback: show all */

        if (!sdrs.length) {
          bodyEl.innerHTML = '<p style="color:var(--text-muted);padding:var(--space-4) 0;">Sin miembros del equipo registrados todavia.</p>';
          return;
        }

        var html = '<div class="team-grid">';
        sdrs.forEach(function(sdr) {
          var sdrLeads = leads.filter(function(l) {
            return l.asignadoA === sdr._id || l.asignadoA === sdr.clerkUserId;
          });
          var asignados = sdrLeads.length;
          var contactados = sdrLeads.filter(function(l) { return (l.estado || '') !== 'nuevo'; }).length;
          var cerrados = sdrLeads.filter(function(l) { return (l.estado || '') === 'cerrado' && (l.subestado || '') === 'ganado'; }).length;
          var convPct = asignados > 0 ? Math.round((cerrados / asignados) * 100) : 0;
          var convColor = convPct >= 15 ? 'var(--success)' : convPct >= 8 ? 'var(--warning)' : 'var(--error)';
          var iniciales = sdr.iniciales || (sdr.nombre || sdr.name || 'U').substring(0, 2).toUpperCase();
          var nombre = sdr.nombre || sdr.name || sdr.clerkUserId || 'SDR';

          html += '<div class="card team-card">' +
            '<div class="team-card-header">' +
              '<div class="team-avatar">' + esc(iniciales) + '</div>' +
              '<div class="team-info">' +
                '<div class="team-name">' + esc(nombre) + '</div>' +
                '<div class="team-role">SDR</div>' +
              '</div>' +
              '<div class="team-conversion" style="color:' + convColor + ';">' + convPct + '%</div>' +
            '</div>' +
            '<div class="team-stats">' +
              '<div class="team-stat"><span class="team-stat-val">' + asignados + '</span><span class="team-stat-label">Asignados</span></div>' +
              '<div class="team-stat"><span class="team-stat-val">' + contactados + '</span><span class="team-stat-label">Contactados</span></div>' +
              '<div class="team-stat"><span class="team-stat-val">' + cerrados + '</span><span class="team-stat-label">Cerrados</span></div>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';

        html += _insightBox(
          sdrs.length + ' SDRs activos. ' + leads.length + ' leads en el pipeline.',
          'Balancear asignacion entre SDRs para evitar cuellos de botella.'
        );

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('.team-card'), {
            y: 16, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out'
          });
        }
      })
      .catch(function(err) {
        console.error('[CEO equipo]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar equipo: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* Map interactions.js builder IDs to our async functions */
  ceo.kpis     = ceo.buildCeoKpis;
  ceo.funnel   = ceo.buildCeoFunnel;
  ceo.industria = ceo.buildCeoIndustria;
  ceo.comparar = ceo.buildCeoComparar;
  ceo.hot      = ceo.buildCeoHot;
  ceo.equipo   = ceo.buildCeoEquipo;

})();

/* =============================================================================
   VP VENTAS CONTENT BUILDERS — async, wired to real Convex data
   Registers as: window.contentBuilders.vp.*
   ============================================================================= */

(function() {
  'use strict';

  if (!window.contentBuilders) window.contentBuilders = {};
  if (!window.contentBuilders.vp) window.contentBuilders.vp = {};

  var vp = window.contentBuilders.vp;

  /* ---- Shared helpers (re-declared in this scope) ---- */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _skeleton() {
    return '<div style="padding:var(--space-2) 0;">' +
      [80,60,90,70,50].map(function(w) {
        return '<div style="width:' + w + '%;height:18px;margin-bottom:var(--space-3);border-radius:var(--radius-sm);background:linear-gradient(90deg,var(--border) 25%,var(--bg-subtle) 50%,var(--border) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>';
      }).join('') +
    '</div><style>@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}</style>';
  }

  function _errorHtml(msg) {
    return '<div style="text-align:center;padding:var(--space-6);color:var(--error);">' +
      '<i data-lucide="alert-circle" style="width:24px;height:24px;margin-bottom:var(--space-2);display:block;margin-left:auto;margin-right:auto;"></i>' +
      '<div style="font-size:var(--text-sm);">' + esc(msg) + '</div>' +
      '</div>';
  }

  function _estadoBadgeClass(estado) {
    var map = { 'nuevo':'badge-nurture','contactado':'badge-warm','reunion':'badge-hot','propuesta':'badge-hot','cerrado':'badge-skip','sin_asignar':'badge-nurture','asignado':'badge-warm','en_progreso':'badge-hot' };
    return map[(estado || '').toLowerCase()] || 'badge-skip';
  }

  function _estadoLabel(estado) {
    var map = { 'nuevo':'Nuevo','contactado':'Contactado','reunion':'Reunion','propuesta':'Propuesta','cerrado':'Cerrado','sin_asignar':'Sin asignar','asignado':'Asignado','en_progreso':'En progreso' };
    return map[(estado || '').toLowerCase()] || estado;
  }

  function _scoreBadgeClass(sc) {
    var map = { 'HOT':'badge-hot','WARM':'badge-warm','NURTURE':'badge-nurture','SKIP':'badge-skip' };
    return map[(sc || '').toUpperCase()] || 'badge-nurture';
  }

  function _showToast(message, type) {
    var container = document.getElementById('toast-container');
    if (!container) { console.log('[Toast]', message); return; }
    var toast = document.createElement('div');
    toast.className = 'toast';
    var iconName = type === 'error' ? 'alert-circle' : type === 'warning' ? 'alert-triangle' : 'check-circle';
    var iconClass = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success';
    toast.innerHTML = '<div class="toast-content"><span class="toast-icon ' + iconClass + '"><i data-lucide="' + iconName + '"></i></span><span class="toast-text">' + esc(message) + '</span></div>';
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [toast] });
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(toast, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    }
    setTimeout(function() {
      if (typeof gsap !== 'undefined') {
        gsap.to(toast, { y: -10, opacity: 0, duration: 0.25, onComplete: function() { if (toast.parentNode) toast.parentNode.removeChild(toast); } });
      } else {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }
    }, 3500);
  }

  /* ---- Estado dropdown controller ---- */
  function _attachEstadoDropdowns(container) {
    container.addEventListener('click', function(e) {
      /* Close any open dropdowns first */
      var open = container.querySelectorAll('.estado-dropdown.open');
      var clickedBadge = e.target.closest('.estado-badge-btn');
      if (!clickedBadge) {
        open.forEach(function(d) { d.classList.remove('open'); });
        return;
      }

      var row = clickedBadge.closest('tr');
      if (!row) return;
      var leadId = row.dataset.leadId;
      var dropdown = row.querySelector('.estado-dropdown');
      if (!dropdown) return;

      /* Toggle */
      open.forEach(function(d) { if (d !== dropdown) d.classList.remove('open'); });
      dropdown.classList.toggle('open');
    });

    /* Handle estado option click */
    container.addEventListener('click', function(e) {
      var opt = e.target.closest('.estado-option');
      if (!opt) return;
      e.stopPropagation();

      var row = opt.closest('tr');
      if (!row) return;
      var leadId = row.dataset.leadId;
      var nuevoEstado = opt.dataset.estado;

      var dropdown = row.querySelector('.estado-dropdown');
      if (dropdown) dropdown.classList.remove('open');

      if (nuevoEstado === 'cerrado') {
        /* Show sub-dropdown for subestado */
        var subMenu = row.querySelector('.subestado-dropdown');
        if (subMenu) { subMenu.classList.toggle('open'); return; }
      }

      /* Apply estado change */
      _applyEstadoChange(row, leadId, nuevoEstado, null, container);
    });

    /* Handle subestado option click */
    container.addEventListener('click', function(e) {
      var subOpt = e.target.closest('.subestado-option');
      if (!subOpt) return;
      e.stopPropagation();

      var row = subOpt.closest('tr');
      if (!row) return;
      var leadId = row.dataset.leadId;
      var subestado = subOpt.dataset.subestado;

      var subMenu = row.querySelector('.subestado-dropdown');
      if (subMenu) subMenu.classList.remove('open');

      _applyEstadoChange(row, leadId, 'cerrado', subestado, container);
    });
  }

  function _applyEstadoChange(row, leadId, nuevoEstado, subestado, container) {
    var badgeEl = row.querySelector('.estado-badge-btn');
    if (badgeEl) {
      badgeEl.style.opacity = '0.5';
      badgeEl.disabled = true;
    }

    var args = { leadId: leadId, nuevoEstado: nuevoEstado };
    if (subestado) args.subestado = subestado;

    window.mutateConvex('leads:updateLeadStatus', args)
      .then(function() {
        /* Update badge in-place */
        if (badgeEl) {
          var displayEstado = nuevoEstado === 'cerrado' && subestado ? subestado : nuevoEstado;
          badgeEl.className = 'badge ' + _estadoBadgeClass(nuevoEstado) + ' estado-badge-btn';
          badgeEl.textContent = _estadoLabel(displayEstado);
          badgeEl.style.opacity = '';
          badgeEl.disabled = false;
        }
        row.dataset.estado = nuevoEstado;
        _showToast('Estado actualizado a ' + _estadoLabel(nuevoEstado), 'success');
      })
      .catch(function(err) {
        console.error('[VP estado]', err);
        if (badgeEl) { badgeEl.style.opacity = ''; badgeEl.disabled = false; }
        _showToast('Error al cambiar estado: ' + err.message, 'error');
      });
  }

  /* ---- Reassignment controller ---- */
  function _attachReassignDropdowns(container, sdrs) {
    container.addEventListener('click', function(e) {
      var reassignBtn = e.target.closest('.reassign-btn');
      if (!reassignBtn) return;

      var row = reassignBtn.closest('tr');
      if (!row) return;
      var leadId = row.dataset.leadId;

      var existing = container.querySelector('.reassign-dropdown.open');
      if (existing && existing !== reassignBtn.nextSibling) existing.classList.remove('open');

      var dropdown = row.querySelector('.reassign-dropdown');
      if (dropdown) { dropdown.classList.toggle('open'); return; }

      /* Build dropdown */
      var ddEl = document.createElement('div');
      ddEl.className = 'reassign-dropdown open';
      ddEl.style.cssText = 'position:absolute;z-index:200;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);min-width:160px;padding:var(--space-1) 0;';
      sdrs.forEach(function(sdr) {
        var opt = document.createElement('button');
        opt.className = 'reassign-option';
        opt.style.cssText = 'display:block;width:100%;text-align:left;padding:var(--space-2) var(--space-3);font-size:var(--text-sm);background:none;border:none;cursor:pointer;color:var(--text-primary);';
        opt.textContent = sdr.nombre || sdr.name || sdr._id;
        opt.addEventListener('mouseenter', function() { opt.style.background = 'var(--bg-subtle)'; });
        opt.addEventListener('mouseleave', function() { opt.style.background = ''; });
        opt.addEventListener('click', function(ev) {
          ev.stopPropagation();
          var sdrNombre = sdr.nombre || sdr.name || '';
          if (!confirm('¿Reasignar este lead a ' + sdrNombre + '?')) { ddEl.classList.remove('open'); return; }
          ddEl.classList.remove('open');

          window.mutateConvex('leads:reasignarLead', { leadId: leadId, nuevoSdrUserId: sdr._id, nuevoSdrNombre: sdrNombre })
            .then(function() {
              var assignCell = row.querySelector('.sdr-cell');
              if (assignCell) assignCell.textContent = sdrNombre;
              _showToast('Lead reasignado a ' + sdrNombre, 'success');
            })
            .catch(function(err) {
              console.error('[VP reassign]', err);
              _showToast('Error al reasignar: ' + err.message, 'error');
            });
        });
        ddEl.appendChild(opt);
      });

      var tdCell = reassignBtn.closest('td');
      if (tdCell) {
        tdCell.style.position = 'relative';
        tdCell.appendChild(ddEl);
      }
    });
  }

  /* ---- Build pipeline table HTML + interactions ---- */
  function _buildPipelineTable(bodyEl, leads, sdrs, opts) {
    opts = opts || {};
    var showCheckboxes = opts.showCheckboxes !== false;

    /* Filter bar */
    var html = '<div class="filter-bar" role="toolbar" style="margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-2);">' +
      '<span class="filter-bar-label">Estado</span>' +
      '<button class="filter-pill active" data-filter-estado="todos" style="cursor:pointer;">Todos</button>' +
      '<button class="filter-pill" data-filter-estado="nuevo" style="cursor:pointer;">Nuevos</button>' +
      '<button class="filter-pill" data-filter-estado="contactado" style="cursor:pointer;">Contactados</button>' +
      '<button class="filter-pill" data-filter-estado="reunion" style="cursor:pointer;">Reunion</button>' +
      '<button class="filter-pill" data-filter-estado="propuesta" style="cursor:pointer;">Propuesta</button>' +
      '<select class="filter-select" data-fp-filter="score" style="margin-left:var(--space-2);">' +
        '<option value="todos">Score: Todos</option>' +
        '<option value="HOT">HOT</option>' +
        '<option value="WARM">WARM</option>' +
        '<option value="NURTURE">NURTURE</option>' +
      '</select>' +
      '<input type="text" class="filter-search" placeholder="Buscar empresa o contacto..." style="flex:1;min-width:160px;" aria-label="Buscar">' +
    '</div>';

    /* Bulk assign bar (hidden until selection) */
    if (showCheckboxes) {
      html += '<div class="bulk-assign-bar" style="display:none;align-items:center;gap:var(--space-3);padding:var(--space-3) var(--space-4);background:var(--accent-faint);border:1px solid var(--accent);border-radius:var(--radius-lg);margin-bottom:var(--space-3);">' +
        '<span class="bulk-selected-count" style="font-size:var(--text-sm);font-weight:600;">0 seleccionados</span>' +
        '<select class="bulk-sdr-select" style="font-size:var(--text-sm);">' +
          '<option value="">Asignar a SDR...</option>' +
          sdrs.map(function(s) {
            return '<option value="' + esc(s._id) + '" data-nombre="' + esc(s.nombre || s.name || '') + '">' + esc(s.nombre || s.name || s._id) + '</option>';
          }).join('') +
        '</select>' +
        '<button class="btn btn-primary bulk-assign-btn" style="font-size:var(--text-sm);padding:var(--space-1) var(--space-3);opacity:0.5;" disabled>Asignar</button>' +
        '<button class="bulk-cancel-btn" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:var(--text-sm);">Cancelar</button>' +
      '</div>';
    }

    /* Estado dropdown template (CSS) */
    html += '<style>' +
      '.estado-badge-btn{cursor:pointer;border:none;font:inherit;padding:0.2em 0.6em;border-radius:999px;}' +
      '.estado-dropdown,.subestado-dropdown{display:none;position:absolute;z-index:100;background:var(--bg-base);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);min-width:140px;padding:var(--space-1) 0;}' +
      '.estado-dropdown.open,.subestado-dropdown.open{display:block;}' +
      '.estado-option,.subestado-option{display:block;width:100%;text-align:left;padding:var(--space-2) var(--space-3);font-size:var(--text-sm);background:none;border:none;cursor:pointer;color:var(--text-primary);}' +
      '.estado-option:hover,.subestado-option:hover{background:var(--bg-subtle);}' +
    '</style>';

    /* Table */
    html += '<div class="pipeline-table-wrapper" role="region">' +
      '<table class="table-pipeline" aria-label="Pipeline">' +
      '<thead><tr>' +
      (showCheckboxes ? '<th scope="col" style="width:36px;"><input type="checkbox" id="select-all-leads" aria-label="Seleccionar todos"></th>' : '') +
      '<th scope="col">Estado</th>' +
      '<th scope="col">Empresa</th>' +
      '<th scope="col">Contacto</th>' +
      '<th scope="col">Score</th>' +
      '<th scope="col">Industria</th>' +
      '<th scope="col">SDR Asignado</th>' +
      '<th scope="col">Actividad</th>' +
      '</tr></thead>' +
      '<tbody id="vp-pipeline-tbody">';

    leads.forEach(function(lead) {
      var nombre = lead.nombre || lead.contactName || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim() || 'Sin nombre';
      var empresa = lead.empresa || lead.company || lead.companyName || 'Sin empresa';
      var cargo = lead.cargo || lead.title || '';
      var score = lead.aiScore || lead.score || 0;
      var scoreCategory = (lead.scoreCategory || lead.clasificacion || 'NURTURE').toUpperCase();
      var estado = lead.estado || 'nuevo';
      var industria = (lead.industria || lead.sii_actividad || '').split(' ').slice(0, 3).join(' ');
      var asignadoNombre = lead.asignadoNombre || lead.sdr_asignado || '';
      var lastUpdated = lead.lastUpdatedAt || lead.discoveredAt;
      var actividadLabel = '';
      if (lastUpdated) {
        var diff = Math.floor((Date.now() - lastUpdated) / 86400000);
        actividadLabel = diff === 0 ? 'hoy' : diff === 1 ? 'ayer' : 'hace ' + diff + 'd';
      }

      html += '<tr data-lead-id="' + esc(lead._id) + '" data-estado="' + esc(estado) + '" data-score="' + esc(scoreCategory) + '" data-industria="' + esc((lead.industria || lead.sii_actividad || '').toLowerCase()) + '">' +
        (showCheckboxes ? '<td><input type="checkbox" class="lead-checkbox" data-lead-id="' + esc(lead._id) + '" aria-label="Seleccionar ' + esc(nombre) + '"></td>' : '') +
        '<td style="position:relative;">' +
          '<button class="badge ' + _estadoBadgeClass(estado) + ' estado-badge-btn" aria-haspopup="true">' + esc(_estadoLabel(estado)) + '</button>' +
          '<div class="estado-dropdown">' +
            '<button class="estado-option" data-estado="nuevo">Nuevo</button>' +
            '<button class="estado-option" data-estado="contactado">Contactado</button>' +
            '<button class="estado-option" data-estado="reunion">Reunion</button>' +
            '<button class="estado-option" data-estado="propuesta">Propuesta</button>' +
            '<button class="estado-option" data-estado="cerrado" style="color:var(--text-muted);">Cerrado ▶</button>' +
          '</div>' +
          '<div class="subestado-dropdown">' +
            '<button class="subestado-option" data-subestado="ganado" style="color:var(--success);">Ganado</button>' +
            '<button class="subestado-option" data-subestado="perdido" style="color:var(--error);">Perdido</button>' +
            '<button class="subestado-option" data-subestado="descartado" style="color:var(--text-muted);">Descartado</button>' +
          '</div>' +
        '</td>' +
        '<td style="font-weight:600;">' + esc(empresa) + '</td>' +
        '<td>' +
          '<div style="font-size:var(--text-sm);font-weight:600;">' + esc(nombre) + '</div>' +
          (cargo ? '<div style="font-size:var(--text-xs);color:var(--text-muted);">' + esc(cargo) + '</div>' : '') +
        '</td>' +
        '<td><span class="badge ' + _scoreBadgeClass(scoreCategory) + '">' + esc(scoreCategory) + ' ' + score + '</span></td>' +
        '<td style="font-size:var(--text-xs);color:var(--text-secondary);">' + esc(industria) + '</td>' +
        '<td class="sdr-cell" style="position:relative;">' +
          (asignadoNombre
            ? '<span style="font-size:var(--text-sm);">' + esc(asignadoNombre) + '</span>' +
              '<button class="reassign-btn" title="Reasignar" style="margin-left:var(--space-2);background:none;border:none;cursor:pointer;color:var(--text-muted);vertical-align:middle;">' +
                '<i data-lucide="refresh-cw" style="width:12px;height:12px;"></i>' +
              '</button>'
            : '<span style="color:var(--text-muted);font-size:var(--text-xs);">Sin asignar</span>') +
        '</td>' +
        '<td style="color:var(--text-muted);font-size:var(--text-xs);">' + esc(actividadLabel) + '</td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';
    bodyEl.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

    /* Wire filter bar */
    var filterPills = bodyEl.querySelectorAll('.filter-pill[data-filter-estado]');
    var filterSelect = bodyEl.querySelector('[data-fp-filter="score"]');
    var filterSearch = bodyEl.querySelector('.filter-search');
    var rows = bodyEl.querySelectorAll('#vp-pipeline-tbody tr');

    var activeEstado = 'todos', activeScore = 'todos', searchText = '';
    function applyFilters() {
      rows.forEach(function(row) {
        var est = (row.dataset.estado || '').toLowerCase();
        var sc  = (row.dataset.score  || '').toUpperCase();
        var txt = row.textContent.toLowerCase();
        var ok  = (activeEstado === 'todos' || est === activeEstado) &&
                  (activeScore === 'todos'  || sc  === activeScore)  &&
                  (!searchText || txt.indexOf(searchText) !== -1);
        row.style.display = ok ? '' : 'none';
      });
    }

    filterPills.forEach(function(pill) {
      pill.addEventListener('click', function() {
        filterPills.forEach(function(p) { p.classList.remove('active'); });
        pill.classList.add('active');
        activeEstado = pill.dataset.filterEstado;
        applyFilters();
      });
    });
    if (filterSelect) filterSelect.addEventListener('change', function() { activeScore = filterSelect.value; applyFilters(); });
    if (filterSearch) filterSearch.addEventListener('input', function() { searchText = filterSearch.value.trim().toLowerCase(); applyFilters(); });

    /* Wire estado dropdowns */
    _attachEstadoDropdowns(bodyEl);

    /* Wire reassign dropdowns */
    _attachReassignDropdowns(bodyEl, sdrs);

    /* Close dropdowns on outside click */
    document.addEventListener('click', function(e) {
      if (!bodyEl.contains(e.target)) {
        bodyEl.querySelectorAll('.estado-dropdown.open,.subestado-dropdown.open,.reassign-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
      }
    }, true);

    /* Wire checkboxes + bulk assign */
    if (showCheckboxes) {
      var selectAll  = bodyEl.querySelector('#select-all-leads');
      var bulkBar    = bodyEl.querySelector('.bulk-assign-bar');
      var bulkCount  = bodyEl.querySelector('.bulk-selected-count');
      var bulkSelect = bodyEl.querySelector('.bulk-sdr-select');
      var bulkBtn    = bodyEl.querySelector('.bulk-assign-btn');
      var bulkCancel = bodyEl.querySelector('.bulk-cancel-btn');
      var checkboxes = bodyEl.querySelectorAll('.lead-checkbox');

      function updateBulkBar() {
        var selected = bodyEl.querySelectorAll('.lead-checkbox:checked');
        var count = selected.length;
        if (bulkBar) bulkBar.style.display = count > 0 ? 'flex' : 'none';
        if (bulkCount) bulkCount.textContent = count + ' seleccionado' + (count !== 1 ? 's' : '');
        if (bulkBtn) { bulkBtn.disabled = count === 0; bulkBtn.style.opacity = count > 0 ? '1' : '0.5'; }
      }

      if (selectAll) {
        selectAll.addEventListener('change', function() {
          checkboxes.forEach(function(cb) {
            var tr = cb.closest('tr');
            if (!tr || tr.style.display === 'none') return;
            cb.checked = selectAll.checked;
          });
          updateBulkBar();
        });
      }

      checkboxes.forEach(function(cb) {
        cb.addEventListener('change', updateBulkBar);
      });

      if (bulkCancel) {
        bulkCancel.addEventListener('click', function() {
          checkboxes.forEach(function(cb) { cb.checked = false; });
          if (selectAll) selectAll.checked = false;
          updateBulkBar();
        });
      }

      if (bulkBtn) {
        bulkBtn.addEventListener('click', function() {
          var sdrId = bulkSelect ? bulkSelect.value : '';
          var sdrNombre = bulkSelect ? (bulkSelect.selectedOptions[0] && bulkSelect.selectedOptions[0].dataset.nombre) || '' : '';
          if (!sdrId) { _showToast('Selecciona un SDR primero', 'warning'); return; }

          var selected = Array.prototype.slice.call(bodyEl.querySelectorAll('.lead-checkbox:checked'));
          var leadIds = selected.map(function(cb) { return cb.dataset.leadId; }).filter(Boolean);
          if (!leadIds.length) return;

          bulkBtn.disabled = true;
          bulkBtn.textContent = 'Asignando...';

          window.mutateConvex('leads:bulkAssignLeads', { leadIds: leadIds, sdrUserId: sdrId, sdrNombre: sdrNombre })
            .then(function() {
              selected.forEach(function(cb) {
                var row = cb.closest('tr');
                if (row) {
                  var sdrCell = row.querySelector('.sdr-cell');
                  if (sdrCell) {
                    sdrCell.innerHTML = '<span style="font-size:var(--text-sm);">' + esc(sdrNombre) + '</span>';
                  }
                  cb.checked = false;
                }
              });
              if (selectAll) selectAll.checked = false;
              updateBulkBar();
              bulkBtn.textContent = 'Asignar';
              _showToast(leadIds.length + ' leads asignados a ' + sdrNombre, 'success');
            })
            .catch(function(err) {
              console.error('[VP bulk assign]', err);
              bulkBtn.disabled = false;
              bulkBtn.textContent = 'Asignar';
              _showToast('Error al asignar: ' + err.message, 'error');
            });
        });
      }
    }
  }

  /* ====================================================================
     buildVpPipeline — leads.getLeadsByOrg + users.getTeamMembers
     ==================================================================== */
  vp.buildVpPipeline = function(bodyEl) {
    bodyEl.innerHTML = _skeleton();

    return Promise.all([
      window.queryConvex('leads:getLeadsByOrg', {}),
      window.queryConvex('users:getTeamMembers', {})
    ])
      .then(function(results) {
        var leads = (results[0] || []).filter(function(l) {
          return ((l.scoreCategory || l.clasificacion || '').toUpperCase() !== 'SKIP');
        });
        var members = results[1] || [];
        var sdrs = members.filter(function(u) { return u.rol === 'sdr' || u.role === 'sdr'; });
        if (!sdrs.length) sdrs = members;

        if (!leads.length) {
          bodyEl.innerHTML = '<p style="color:var(--text-muted);padding:var(--space-4) 0;">Sin leads en el pipeline todavia.</p>';
          return;
        }

        _buildPipelineTable(bodyEl, leads, sdrs, { showCheckboxes: true });

        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('#vp-pipeline-tbody tr'), {
            y: 8, opacity: 0, duration: 0.3, stagger: 0.04, ease: 'power3.out'
          });
        }
      })
      .catch(function(err) {
        console.error('[VP pipeline]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar pipeline: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildVpSinAsignar — leads without asignadoA field
     ==================================================================== */
  vp.buildVpSinAsignar = function(bodyEl) {
    bodyEl.innerHTML = _skeleton();

    return Promise.all([
      window.queryConvex('leads:getLeadsByOrg', {}),
      window.queryConvex('users:getTeamMembers', {})
    ])
      .then(function(results) {
        var leads = (results[0] || []).filter(function(l) {
          var sc = (l.scoreCategory || l.clasificacion || '').toUpperCase();
          return !l.asignadoA && sc !== 'SKIP';
        });
        var members = results[1] || [];
        var sdrs = members.filter(function(u) { return u.rol === 'sdr' || u.role === 'sdr'; });
        if (!sdrs.length) sdrs = members;

        if (!leads.length) {
          bodyEl.innerHTML = '<div style="text-align:center;padding:var(--space-6);color:var(--success);">' +
            '<i data-lucide="check-circle" style="width:32px;height:32px;display:block;margin:0 auto var(--space-3);"></i>' +
            '<p style="font-size:var(--text-sm);">Todos los leads tienen SDR asignado. Buen trabajo.</p>' +
            '</div>';
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
          return;
        }

        _buildPipelineTable(bodyEl, leads, sdrs, { showCheckboxes: true });

        var hotSinAsignar = leads.filter(function(l) { return ((l.scoreCategory || l.clasificacion || '').toUpperCase() === 'HOT'); }).length;
        if (hotSinAsignar > 0) {
          var alertEl = document.createElement('div');
          alertEl.style.cssText = 'padding:var(--space-3) var(--space-4);background:rgba(197,237,54,0.1);border:1px solid var(--accent);border-radius:var(--radius-lg);font-size:var(--text-sm);color:#5a7a00;margin-bottom:var(--space-4);';
          alertEl.textContent = hotSinAsignar + ' leads HOT sin asignar — requieren atencion inmediata.';
          bodyEl.insertBefore(alertEl, bodyEl.firstChild);
        }
      })
      .catch(function(err) {
        console.error('[VP sin-asignar]', err);
        bodyEl.innerHTML = _errorHtml('Error: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildVpEquipo — users.getTeamMembers + leads.getLeadsByOrg
     ==================================================================== */
  vp.buildVpEquipo = function(bodyEl) {
    bodyEl.innerHTML = _skeleton();

    return Promise.all([
      window.queryConvex('users:getTeamMembers', {}),
      window.queryConvex('leads:getLeadsByOrg', {})
    ])
      .then(function(results) {
        var members = results[0] || [];
        var leads   = results[1] || [];
        var sdrs = members.filter(function(u) { return u.rol === 'sdr' || u.role === 'sdr'; });
        if (!sdrs.length) sdrs = members;

        if (!sdrs.length) {
          bodyEl.innerHTML = '<p style="color:var(--text-muted);">Sin miembros del equipo todavia.</p>';
          return;
        }

        var html = '<div class="pipeline-table-wrapper"><table class="table-pipeline" aria-label="Equipo">';
        html += '<thead><tr><th>SDR</th><th>Asignados</th><th>Contactados</th><th>HOT</th><th>Cerrados</th><th>Conversion</th></tr></thead>';
        html += '<tbody>';

        sdrs.forEach(function(sdr) {
          var sdrLeads = leads.filter(function(l) { return l.asignadoA === sdr._id || l.asignadoA === sdr.clerkUserId; });
          var asignados   = sdrLeads.length;
          var contactados = sdrLeads.filter(function(l) { return ['contactado','reunion','propuesta','cerrado'].indexOf(l.estado || '') !== -1; }).length;
          var hotCount    = sdrLeads.filter(function(l) { return ((l.scoreCategory || l.clasificacion || '').toUpperCase() === 'HOT'); }).length;
          var cerrados    = sdrLeads.filter(function(l) { return (l.estado || '') === 'cerrado' && (l.subestado || '') === 'ganado'; }).length;
          var convPct     = asignados > 0 ? Math.round((cerrados / asignados) * 100) : 0;
          var convColor   = convPct >= 15 ? 'var(--success)' : convPct >= 8 ? 'var(--warning)' : 'var(--text-secondary)';
          var iniciales   = sdr.iniciales || (sdr.nombre || sdr.name || 'U').substring(0, 2).toUpperCase();
          var nombre      = sdr.nombre || sdr.name || 'SDR';

          html += '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:var(--space-3);">' +
              '<div class="team-avatar">' + esc(iniciales) + '</div>' +
              '<div><div style="font-weight:600;font-size:var(--text-sm);">' + esc(nombre) + '</div>' +
              '<div style="font-size:var(--text-xs);color:var(--text-muted);">SDR</div></div>' +
            '</div></td>' +
            '<td style="font-weight:700;">' + asignados + '</td>' +
            '<td style="font-weight:700;">' + contactados + '</td>' +
            '<td style="font-weight:700;color:var(--accent-dark);">' + hotCount + '</td>' +
            '<td style="font-weight:700;">' + cerrados + '</td>' +
            '<td style="font-weight:700;color:' + convColor + ';">' + convPct + '%</td>' +
          '</tr>';
        });

        html += '</tbody></table></div>';
        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('tbody tr'), {
            y: 8, opacity: 0, duration: 0.3, stagger: 0.06, ease: 'power3.out'
          });
        }
      })
      .catch(function(err) {
        console.error('[VP equipo]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar equipo: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildVpKpis — stats.getLeadsStats
     ==================================================================== */
  vp.buildVpKpis = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(4);

    return Promise.all([
      window.queryConvex('stats:getLeadsStats', {}),
      window.queryConvex('leads:getLeadsByOrg', {})
    ])
      .then(function(results) {
        var stats = results[0] || {};
        var leads = results[1] || [];

        var total       = stats.total || 0;
        var hot         = stats.leadsHot || stats.hot || 0;
        var sinAsignar  = leads.filter(function(l) { return !l.asignadoA; }).length;
        var reuniones   = leads.filter(function(l) { return (l.estado || '') === 'reunion'; }).length;

        var html = '<div class="kpi-grid-4">';

        function kpiCard(icon, label, value, narrativa, warn) {
          return '<article class="card-kpi' + (warn ? ' card-kpi-warning' : '') + '">' +
            '<div class="card-kpi-header">' +
              '<div class="card-kpi-label">' + esc(label) + '</div>' +
              '<div class="card-kpi-icon"><i data-lucide="' + esc(icon) + '"></i></div>' +
            '</div>' +
            '<div class="card-kpi-value">' + value + '</div>' +
            '<p class="narrative-compact">' + esc(narrativa) + '</p>' +
          '</article>';
        }

        html += kpiCard('git-branch', 'Leads en Pipeline', total, total + ' leads activos en el pipeline.', false);
        html += kpiCard('user-plus', 'Sin Asignar', sinAsignar, sinAsignar + ' leads esperan SDR. Requieren accion.', sinAsignar > 5);
        html += kpiCard('flame', 'Leads HOT', hot, hot + ' leads calificados HOT listos para contactar.', false);
        html += kpiCard('calendar', 'Reuniones', reuniones, reuniones + ' reuniones en progreso esta semana.', false);

        html += '</div>';
        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('.card-kpi'), {
            y: 16, opacity: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out'
          });
        }
      })
      .catch(function(err) {
        console.error('[VP kpis]', err);
        bodyEl.innerHTML = _errorHtml('Error al cargar KPIs: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildVpHotUrgente — HOT leads not contacted in 48h
     ==================================================================== */
  vp.buildVpHotUrgente = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(3);

    return window.queryConvex('leads:getLeadsByOrg', {})
      .then(function(leads) {
        var now = Date.now();
        var urgente = (leads || []).filter(function(l) {
          var sc = (l.scoreCategory || l.clasificacion || '').toUpperCase();
          if (sc !== 'HOT') return false;
          var estado = (l.estado || '').toLowerCase();
          if (estado === 'cerrado') return false;
          /* Check if not contacted (nuevo or sin_asignar) OR older than 48h */
          var lastUpd = l.lastUpdatedAt || l.discoveredAt || now;
          var hoursOld = (now - lastUpd) / 3600000;
          return (estado === 'nuevo' || estado === 'sin_asignar' || hoursOld > 48);
        });

        if (!urgente.length) {
          bodyEl.innerHTML = '<div style="text-align:center;padding:var(--space-6);color:var(--success);">' +
            '<i data-lucide="check-circle" style="width:32px;height:32px;display:block;margin:0 auto var(--space-3);"></i>' +
            '<p style="font-size:var(--text-sm);">Sin leads HOT urgentes — el equipo esta al dia.</p>' +
            '</div>';
          if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
          return;
        }

        var html = '<div style="margin-bottom:var(--space-3);padding:var(--space-3) var(--space-4);background:rgba(239,68,68,0.08);border:1px solid var(--error);border-radius:var(--radius-lg);font-size:var(--text-sm);color:var(--error);">' +
          '<i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:var(--space-1);"></i>' +
          urgente.length + ' leads HOT requieren contacto urgente</div>';

        html += '<div class="hot-leads-list">';
        urgente.forEach(function(lead) {
          var nombre = lead.nombre || lead.contactName || ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim() || 'Sin nombre';
          var empresa = lead.empresa || lead.company || lead.companyName || 'Sin empresa';
          var score = lead.aiScore || lead.score || 0;
          var asignado = lead.asignadoNombre || lead.sdr_asignado || '';
          var lastUpd = lead.lastUpdatedAt || lead.discoveredAt || Date.now();
          var hoursOld = Math.floor((Date.now() - lastUpd) / 3600000);
          var timeLabel = hoursOld < 24 ? hoursOld + 'h' : Math.floor(hoursOld / 24) + 'd';

          html += '<div class="hot-lead-row">' +
            '<div class="hot-lead-score" style="background:rgba(239,68,68,0.1);color:var(--error);">' + score + '</div>' +
            '<div class="hot-lead-info">' +
              '<div class="hot-lead-name">' + esc(nombre) + '</div>' +
              '<div class="hot-lead-company">' + esc(empresa) + '</div>' +
            '</div>' +
            '<div class="hot-lead-meta">' +
              (asignado ? '<span style="font-size:var(--text-xs);color:var(--text-secondary);">' + esc(asignado) + '</span>' : '<span class="badge badge-hot">Sin asignar</span>') +
              '<span style="font-size:var(--text-xs);color:var(--error);">' + timeLabel + ' sin contactar</span>' +
            '</div>' +
          '</div>';
        });
        html += '</div>';

        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        if (typeof gsap !== 'undefined') {
          gsap.from(bodyEl.querySelectorAll('.hot-lead-row'), {
            x: -10, opacity: 0, duration: 0.3, stagger: 0.05, ease: 'power3.out'
          });
        }
      })
      .catch(function(err) {
        console.error('[VP hot-urgente]', err);
        bodyEl.innerHTML = _errorHtml('Error: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* ====================================================================
     buildVpConversion — conversion rate by SDR
     ==================================================================== */
  vp.buildVpConversion = function(bodyEl) {
    bodyEl.innerHTML = _skeleton(4);

    return Promise.all([
      window.queryConvex('users:getTeamMembers', {}),
      window.queryConvex('leads:getLeadsByOrg', {})
    ])
      .then(function(results) {
        var members = results[0] || [];
        var leads   = results[1] || [];
        var sdrs = members.filter(function(u) { return u.rol === 'sdr' || u.role === 'sdr'; });
        if (!sdrs.length) sdrs = members;

        var sdrStats = sdrs.map(function(sdr) {
          var sdrLeads = leads.filter(function(l) { return l.asignadoA === sdr._id || l.asignadoA === sdr.clerkUserId; });
          var asignados = sdrLeads.length;
          var cerrados  = sdrLeads.filter(function(l) { return (l.estado || '') === 'cerrado' && (l.subestado || '') === 'ganado'; }).length;
          return {
            nombre: sdr.nombre || sdr.name || 'SDR',
            iniciales: sdr.iniciales || (sdr.nombre || sdr.name || 'U').substring(0, 2).toUpperCase(),
            asignados: asignados,
            cerrados: cerrados,
            convPct: asignados > 0 ? Math.round((cerrados / asignados) * 100) : 0
          };
        }).sort(function(a, b) { return b.convPct - a.convPct; });

        var html = '<div class="chart-card">';
        html += '<div class="chart-card-title">Conversion por SDR (cerrados ganados / asignados)</div>';
        html += '<div class="chart-bar-h">';

        var maxPct = sdrStats[0] ? Math.max(sdrStats[0].convPct, 1) : 1;
        sdrStats.forEach(function(sdr, idx) {
          var barPct = Math.round((sdr.convPct / maxPct) * 100);
          var color = sdr.convPct >= 15 ? 'var(--success)' : sdr.convPct >= 8 ? 'var(--warning)' : 'var(--error)';
          html += '<div class="chart-bar-h-item">' +
            '<div class="chart-bar-h-label" style="min-width:120px;">' + esc(sdr.nombre) + '</div>' +
            '<div class="chart-bar-h-track"><div class="chart-bar-h-fill" style="width:' + barPct + '%;background:' + color + ';"></div></div>' +
            '<div class="chart-bar-h-value">' + sdr.convPct + '% (' + sdr.cerrados + '/' + sdr.asignados + ')</div>' +
          '</div>';
        });

        html += '</div></div>';
        bodyEl.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });

        if (typeof gsap !== 'undefined') {
          bodyEl.querySelectorAll('.chart-bar-h-fill').forEach(function(bar) {
            var target = bar.style.width;
            bar.style.width = '0%';
            gsap.to(bar, { width: target, duration: 0.8, ease: 'power3.out', delay: 0.2 });
          });
        }
      })
      .catch(function(err) {
        console.error('[VP conversion]', err);
        bodyEl.innerHTML = _errorHtml('Error: ' + err.message);
        if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [bodyEl] });
      });
  };

  /* Map interactions.js builder IDs to our async functions */
  vp['sin-asignar'] = vp.buildVpSinAsignar;
  vp.equipo        = vp.buildVpEquipo;
  vp.pipeline      = vp.buildVpPipeline;
  vp['hot-urgente'] = vp.buildVpHotUrgente;
  vp.conversion    = vp.buildVpConversion;
  vp.kpis          = vp.buildVpKpis;

})();
