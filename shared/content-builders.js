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
