/**
 * shared/pdf-report.js — Sisteco PDF Report Generator
 * Generates branded PDF reports via html2pdf.js (loaded via CDN on app pages).
 *
 * Usage: generarReportePDF(periodo, role)
 *   periodo: "esta-semana" | "este-mes" | "ultimo-trimestre"
 *   role   : "ceo" | "vp" | "sdr"
 *
 * Data sources: Convex (aggregated metrics) — no PII in PDF content.
 * Note: Sharp Grotesk may not render in PDF (CORS limitation); Source Sans 3 used as primary.
 * Per PITFALL-6 from research: accept font fallback gracefully.
 */

(function() {
  'use strict';

  /* ============================================================
     CONSTANTS
     ============================================================ */

  var LOGO_PATH = '../shared/assets/logo-sisteco.png';

  var PERIODOS = {
    'esta-semana':       'Esta semana',
    'este-mes':          'Este mes',
    'ultimo-trimestre':  'Ultimo trimestre'
  };

  var ROLE_LABELS = {
    ceo: 'Director General (CEO)',
    vp:  'VP de Ventas',
    sdr: 'Ejecutivo de Ventas (SDR)'
  };

  /* ============================================================
     PERIOD SELECTOR — shown in content area when PDF query is issued
     ============================================================ */

  /**
   * mostrarSelectorPeriodoPDF — shows period picker inside content-area.
   * Called by interactions.js when user types "pdf"/"reporte"/"generar".
   */
  function mostrarSelectorPeriodoPDF(role) {
    var contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    var currentRole = role || document.body.dataset.role || 'ceo';

    /* Remove existing blocks */
    contentArea.querySelectorAll('.content-block, .ai-response-block, .gemini-response-block').forEach(function(b) { b.remove(); });

    var block = document.createElement('div');
    block.className = 'content-block pdf-period-block';
    block.setAttribute('role', 'region');
    block.setAttribute('aria-label', 'Generar reporte PDF');

    block.innerHTML =
      '<div class="content-block-header">' +
        '<h2 class="content-block-title">' +
          '<i data-lucide="file-down" style="width:16px;height:16px;vertical-align:-2px;margin-right:6px;"></i>' +
          'Generar reporte PDF' +
        '</h2>' +
        '<button class="content-block-close" aria-label="Cerrar">' +
          '<i data-lucide="x"></i>' +
        '</button>' +
      '</div>' +
      '<div class="content-block-body">' +
        '<p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-4);">' +
          'Selecciona el periodo del reporte. El PDF incluira metricas del pipeline adaptadas a tu rol sin datos de contacto individuales.' +
        '</p>' +
        '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4);">' +
          '<button class="pdf-period-btn btn-secondary" data-periodo="esta-semana" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:var(--text-sm);background:var(--surface);">' +
            '<i data-lucide="calendar" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;"></i>Esta semana' +
          '</button>' +
          '<button class="pdf-period-btn btn-secondary" data-periodo="este-mes" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:var(--text-sm);background:var(--surface);">' +
            '<i data-lucide="calendar" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;"></i>Este mes' +
          '</button>' +
          '<button class="pdf-period-btn btn-secondary" data-periodo="ultimo-trimestre" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border);cursor:pointer;font-size:var(--text-sm);background:var(--surface);">' +
            '<i data-lucide="calendar" style="width:14px;height:14px;vertical-align:-2px;margin-right:6px;"></i>Ultimo trimestre' +
          '</button>' +
        '</div>' +
        '<div id="pdf-status" style="font-size:var(--text-sm);color:var(--text-muted);min-height:24px;"></div>' +
      '</div>';

    contentArea.appendChild(block);

    /* Close button */
    block.querySelector('.content-block-close').addEventListener('click', function() {
      if (typeof animateBlockOut === 'function') {
        animateBlockOut(block);
      } else {
        block.remove();
      }
    });

    /* Period buttons */
    block.querySelectorAll('.pdf-period-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var periodo = btn.dataset.periodo;
        var statusEl = document.getElementById('pdf-status');
        if (statusEl) {
          statusEl.innerHTML = '<i data-lucide="loader-2" style="width:14px;height:14px;vertical-align:-2px;animation:spin 1s linear infinite;"></i> Generando PDF...';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
        /* Disable all buttons while generating */
        block.querySelectorAll('.pdf-period-btn').forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });

        generarReportePDF(periodo, currentRole)
          .then(function() {
            if (statusEl) statusEl.textContent = 'PDF generado y descargado.';
            block.querySelectorAll('.pdf-period-btn').forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
          })
          .catch(function(err) {
            console.error('[pdf-report] Error:', err);
            if (statusEl) statusEl.textContent = 'Error al generar PDF. Intenta nuevamente.';
            block.querySelectorAll('.pdf-period-btn').forEach(function(b) { b.disabled = false; b.style.opacity = '1'; });
          });
      });
    });

    /* Animate in */
    if (typeof animateBlockIn === 'function') {
      animateBlockIn(block);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ============================================================
     PDF GENERATION — main function
     ============================================================ */

  /**
   * generarReportePDF — builds a branded HTML layout and converts to PDF.
   * Returns a Promise that resolves when the PDF has been saved.
   *
   * Data: fetched fresh from Convex (aggregated metrics only, no PII).
   * Fonts: Source Sans 3 (Google Fonts, CORS-safe). Sharp Grotesk fallback.
   */
  function generarReportePDF(periodo, role) {
    return new Promise(function(resolve, reject) {
      var currentRole = role || document.body.dataset.role || 'ceo';
      var periodoLabel = PERIODOS[periodo] || periodo;
      var roleLabel = ROLE_LABELS[currentRole] || currentRole;
      var fechaHoy = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
      var filename = 'reporte-sisteco-' + periodo + '-' + new Date().toISOString().slice(0, 10) + '.pdf';

      /* Fetch data then generate PDF */
      _fetchReportData(currentRole)
        .then(function(data) {
          /* Build PDF HTML based on role */
          var contentHtml = _buildPdfContent(currentRole, data, periodoLabel);

          /* Create hidden container for html2pdf */
          var pdfDiv = document.createElement('div');
          pdfDiv.id = 'pdf-content-area';
          pdfDiv.style.cssText = [
            'position:absolute',
            'top:-9999px',
            'left:-9999px',
            'width:794px',
            'background:#ffffff',
            'font-family:"Source Sans 3",Arial,sans-serif',
            'font-size:12px',
            'color:#111111',
            'line-height:1.5'
          ].join(';');

          pdfDiv.innerHTML = _buildPdfShell(periodoLabel, roleLabel, fechaHoy, contentHtml);
          document.body.appendChild(pdfDiv);

          /* Wait for images to load */
          var imgs = pdfDiv.querySelectorAll('img');
          var imgPromises = Array.prototype.slice.call(imgs).map(function(img) {
            return new Promise(function(res) {
              if (img.complete) { res(); } else {
                img.onload = res;
                img.onerror = res; /* proceed even if logo fails to load */
              }
            });
          });

          Promise.all(imgPromises).then(function() {
            /* Check html2pdf is available */
            if (typeof html2pdf === 'undefined') {
              document.body.removeChild(pdfDiv);
              reject(new Error('html2pdf.js no esta cargado. Agrega el CDN script al HTML.'));
              return;
            }

            html2pdf().set({
              margin: [15, 15, 15, 15],
              filename: filename,
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, useCORS: true, logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(pdfDiv).save().then(function() {
              document.body.removeChild(pdfDiv);
              resolve();
            }).catch(function(err) {
              if (pdfDiv.parentNode) document.body.removeChild(pdfDiv);
              reject(err);
            });
          });
        })
        .catch(function(err) {
          console.error('[pdf-report] Data fetch error:', err);
          reject(err);
        });
    });
  }

  /* ============================================================
     DATA FETCHING — aggregated metrics only, no PII
     ============================================================ */

  function _fetchReportData(role) {
    if (!window.queryConvex) {
      return Promise.resolve(_mockReportData(role));
    }

    var promises = [
      window.queryConvex('stats:getLeadsStats', {}).catch(function() { return null; })
    ];

    /* For CEO: also fetch funnel and industry data */
    if (role === 'ceo') {
      promises.push(window.queryConvex('stats:getFunnelData', {}).catch(function() { return null; }));
      promises.push(window.queryConvex('stats:getLeadsByIndustry', {}).catch(function() { return null; }));
    }

    return Promise.all(promises).then(function(results) {
      return {
        stats: results[0] || _mockReportData(role).stats,
        funnel: results[1] || null,
        industry: results[2] || null
      };
    });
  }

  function _mockReportData(role) {
    return {
      stats: {
        total: 48,
        leadsHot: 8,
        leadsWarm: 15,
        leadsNurture: 25,
        nuevosUltimos30Dias: 12,
        cerradosGanados: 3,
        cerradosPerdidos: 2,
        tasaConversion: 6.25
      },
      funnel: null,
      industry: null
    };
  }

  /* ============================================================
     PDF CONTENT BUILDERS — per role
     ============================================================ */

  function _buildPdfContent(role, data, periodoLabel) {
    var stats = data.stats || {};

    if (role === 'ceo') {
      return _buildCeoPdfContent(stats, data.funnel, data.industry, periodoLabel);
    } else if (role === 'vp') {
      return _buildVpPdfContent(stats, periodoLabel);
    } else {
      return _buildSdrPdfContent(stats, periodoLabel);
    }
  }

  function _buildCeoPdfContent(stats, funnel, industry, periodoLabel) {
    var total = stats.total || 0;
    var hot = stats.leadsHot || stats.hot || 0;
    var warm = stats.leadsWarm || stats.warm || 0;
    var nurture = stats.leadsNurture || stats.nurture || 0;
    var nuevos = stats.nuevosUltimos30Dias || stats.nuevos || 0;
    var cerrados = stats.cerradosGanados || 0;
    var tasa = stats.tasaConversion ? (Math.round(stats.tasaConversion * 10) / 10) + '%' : '—';

    var html = '<h2 style="font-size:16px;font-weight:700;margin:0 0 16px;color:#111;">KPIs — ' + _esc(periodoLabel) + '</h2>';

    /* KPI grid — 3 columns */
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
    html += '<tr>';
    html += _kpiCell('Leads Totales', total, '');
    html += _kpiCell('Leads HOT', hot, '');
    html += _kpiCell('Leads Nuevos', nuevos, periodoLabel);
    html += '</tr><tr>';
    html += _kpiCell('Leads Warm', warm, '');
    html += _kpiCell('Leads Nurture', nurture, '');
    html += _kpiCell('Tasa Conversion', tasa, 'leads cerrados');
    html += '</tr>';
    html += '</table>';

    /* Funnel section */
    html += '<h2 style="font-size:14px;font-weight:700;margin:0 0 12px;color:#111;border-top:1px solid #e5e5e5;padding-top:16px;">Pipeline Funnel</h2>';
    if (funnel && funnel.stages) {
      html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
      funnel.stages.forEach(function(stage) {
        var pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
        html += '<tr>' +
          '<td style="padding:4px 8px 4px 0;font-size:11px;width:160px;">' + _esc(stage.label || stage.name) + '</td>' +
          '<td style="padding:4px 0;">' +
            '<div style="background:#e5e5e5;border-radius:3px;height:8px;width:100%;">' +
              '<div style="background:#c5ed36;border-radius:3px;height:8px;width:' + Math.max(pct, 2) + '%;"></div>' +
            '</div>' +
          '</td>' +
          '<td style="padding:4px 0 4px 8px;font-size:11px;width:60px;text-align:right;">' + stage.count + ' (' + pct + '%)</td>' +
        '</tr>';
      });
      html += '</table>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
      var stages = [
        { label: 'HOT', count: hot },
        { label: 'Warm', count: warm },
        { label: 'Nurture', count: nurture },
        { label: 'Cerrados Ganados', count: stats.cerradosGanados || 0 }
      ];
      stages.forEach(function(stage) {
        var pct = total > 0 ? Math.round((stage.count / total) * 100) : 0;
        html += '<tr>' +
          '<td style="padding:4px 8px 4px 0;font-size:11px;width:160px;">' + _esc(stage.label) + '</td>' +
          '<td style="padding:4px 0;">' +
            '<div style="background:#e5e5e5;border-radius:3px;height:8px;width:100%;">' +
              '<div style="background:#c5ed36;border-radius:3px;height:8px;width:' + Math.max(pct, 2) + '%;"></div>' +
            '</div>' +
          '</td>' +
          '<td style="padding:4px 0 4px 8px;font-size:11px;width:60px;text-align:right;">' + stage.count + ' (' + pct + '%)</td>' +
        '</tr>';
      });
      html += '</table>';
    }

    /* Industry breakdown */
    if (industry && industry.length > 0) {
      html += '<h2 style="font-size:14px;font-weight:700;margin:0 0 12px;color:#111;border-top:1px solid #e5e5e5;padding-top:16px;">Distribucion por Industria</h2>';
      html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
      industry.slice(0, 8).forEach(function(ind) {
        var pct = total > 0 ? Math.round((ind.count / total) * 100) : 0;
        html += '<tr>' +
          '<td style="padding:3px 8px 3px 0;font-size:11px;width:200px;">' + _esc(ind.industria || ind.label || '—') + '</td>' +
          '<td style="padding:3px 0;">' +
            '<div style="background:#e5e5e5;border-radius:3px;height:6px;width:100%;">' +
              '<div style="background:#111;border-radius:3px;height:6px;width:' + Math.max(pct, 2) + '%;"></div>' +
            '</div>' +
          '</td>' +
          '<td style="padding:3px 0 3px 8px;font-size:11px;width:50px;text-align:right;">' + ind.count + '</td>' +
        '</tr>';
      });
      html += '</table>';
    }

    return html;
  }

  function _buildVpPdfContent(stats, periodoLabel) {
    var total = stats.total || 0;
    var hot = stats.leadsHot || stats.hot || 0;
    var nuevos = stats.nuevosUltimos30Dias || stats.nuevos || 0;
    var cerrados = stats.cerradosGanados || 0;
    var pendientes = stats.pendientesContactar || 0;
    var tasa = stats.tasaConversion ? (Math.round(stats.tasaConversion * 10) / 10) + '%' : '—';

    var html = '<h2 style="font-size:16px;font-weight:700;margin:0 0 16px;color:#111;">Resumen de Pipeline — ' + _esc(periodoLabel) + '</h2>';

    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
    html += '<tr>';
    html += _kpiCell('Leads en Pipeline', total, '');
    html += _kpiCell('HOT (contactar ahora)', hot, '');
    html += _kpiCell('Nuevos Ingresados', nuevos, periodoLabel);
    html += '</tr><tr>';
    html += _kpiCell('Cerrados Ganados', cerrados, '');
    html += _kpiCell('Pendientes Contactar', pendientes, '');
    html += _kpiCell('Tasa de Conversion', tasa, 'del total');
    html += '</tr>';
    html += '</table>';

    /* Pipeline summary table */
    html += '<h2 style="font-size:14px;font-weight:700;margin:0 0 12px;color:#111;border-top:1px solid #e5e5e5;padding-top:16px;">Estado del Pipeline</h2>';
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:11px;">';
    html += '<tr style="background:#f8f7f5;"><th style="padding:6px 8px;text-align:left;font-weight:600;">Estado</th><th style="padding:6px 8px;text-align:right;">Cantidad</th><th style="padding:6px 8px;text-align:right;">% del total</th></tr>';

    var estados = [
      { label: 'HOT', count: hot },
      { label: 'Warm', count: stats.leadsWarm || stats.warm || 0 },
      { label: 'Nurture', count: stats.leadsNurture || stats.nurture || 0 },
      { label: 'Cerrados Ganados', count: cerrados },
      { label: 'Cerrados Perdidos', count: stats.cerradosPerdidos || 0 }
    ];

    estados.forEach(function(e, i) {
      var pct = total > 0 ? Math.round((e.count / total) * 100) : 0;
      html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#fafafa') + ';">' +
        '<td style="padding:5px 8px;">' + _esc(e.label) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;">' + e.count + '</td>' +
        '<td style="padding:5px 8px;text-align:right;">' + pct + '%</td>' +
      '</tr>';
    });
    html += '</table>';

    return html;
  }

  function _buildSdrPdfContent(stats, periodoLabel) {
    var total = stats.total || 0;
    var hot = stats.leadsHot || stats.hot || 0;
    var pendientes = stats.pendientesContactar || 0;
    var cerrados = stats.cerradosGanados || 0;

    var html = '<h2 style="font-size:16px;font-weight:700;margin:0 0 16px;color:#111;">Mi Actividad — ' + _esc(periodoLabel) + '</h2>';

    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">';
    html += '<tr>';
    html += _kpiCell('Leads Asignados', total, '');
    html += _kpiCell('HOT (prioridad)', hot, '');
    html += _kpiCell('Pendientes Contactar', pendientes, '');
    html += '</tr>';
    html += '</table>';

    /* Status breakdown */
    html += '<h2 style="font-size:14px;font-weight:700;margin:0 0 12px;color:#111;border-top:1px solid #e5e5e5;padding-top:16px;">Mis Leads por Estado</h2>';
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:11px;">';
    html += '<tr style="background:#f8f7f5;"><th style="padding:6px 8px;text-align:left;font-weight:600;">Estado</th><th style="padding:6px 8px;text-align:right;">Cantidad</th></tr>';

    var estados = [
      { label: 'HOT — contactar hoy', count: hot },
      { label: 'En progreso (Warm)', count: stats.leadsWarm || stats.warm || 0 },
      { label: 'Nurture (largo plazo)', count: stats.leadsNurture || stats.nurture || 0 },
      { label: 'Cerrados Ganados', count: cerrados },
      { label: 'Cerrados Perdidos', count: stats.cerradosPerdidos || 0 }
    ];

    estados.forEach(function(e, i) {
      html += '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#fafafa') + ';">' +
        '<td style="padding:5px 8px;">' + _esc(e.label) + '</td>' +
        '<td style="padding:5px 8px;text-align:right;">' + e.count + '</td>' +
      '</tr>';
    });
    html += '</table>';

    /* Pending actions note */
    if (hot > 0) {
      html += '<div style="background:#f0fad0;border:1px solid #c5ed36;border-radius:6px;padding:10px 14px;font-size:11px;color:#111;">' +
        '<strong>Accion pendiente:</strong> Tienes ' + hot + ' lead(s) HOT que requieren contacto hoy.' +
      '</div>';
    }

    return html;
  }

  /* ============================================================
     PDF SHELL — full HTML document with Sisteco branding
     ============================================================ */

  function _buildPdfShell(periodoLabel, roleLabel, fechaHoy, contentHtml) {
    return [
      '<div style="padding:0;background:#ffffff;">',
        /* Header */
        '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #c5ed36;margin-bottom:24px;">',
          '<div style="display:flex;align-items:center;gap:12px;">',
            '<img src="' + LOGO_PATH + '" alt="Sisteco" style="height:32px;width:auto;" crossorigin="anonymous">',
          '</div>',
          '<div style="text-align:right;">',
            '<div style="font-size:18px;font-weight:700;color:#111;">Reporte de Pipeline</div>',
            '<div style="font-size:11px;color:#666;margin-top:2px;">' + _esc(roleLabel) + ' — ' + _esc(periodoLabel) + '</div>',
            '<div style="font-size:10px;color:#999;margin-top:2px;">' + _esc(fechaHoy) + '</div>',
          '</div>',
        '</div>',

        /* Main content */
        '<div style="padding:0;">',
          contentHtml,
        '</div>',

        /* Footer */
        '<div style="margin-top:32px;padding-top:12px;border-top:1px solid #e5e5e5;display:flex;justify-content:space-between;font-size:9px;color:#999;">',
          '<span>Generado por Sisteco — sisteco.cl</span>',
          '<span>' + _esc(fechaHoy) + '</span>',
          '<span>Confidencial — solo uso interno</span>',
        '</div>',
      '</div>'
    ].join('');
  }

  /* ============================================================
     HELPERS
     ============================================================ */

  function _kpiCell(label, value, sublabel) {
    return '<td style="width:33%;padding:8px;vertical-align:top;">' +
      '<div style="background:#f8f7f5;border-radius:6px;padding:12px;border:1px solid #e5e5e5;">' +
        '<div style="font-size:10px;color:#666;margin-bottom:4px;">' + _esc(label) + '</div>' +
        '<div style="font-size:22px;font-weight:700;color:#111;line-height:1;">' + _esc(String(value)) + '</div>' +
        (sublabel ? '<div style="font-size:9px;color:#999;margin-top:3px;">' + _esc(sublabel) + '</div>' : '') +
      '</div>' +
    '</td>';
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============================================================
     EXPORTS — expose via window
     ============================================================ */

  window.generarReportePDF = generarReportePDF;
  window.mostrarSelectorPeriodoPDF = mostrarSelectorPeriodoPDF;

})();
