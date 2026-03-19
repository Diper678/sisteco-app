/* =============================================================================
   Sisteco DPA Acceptance — shared/dpa-acceptance.js
   Modal de aceptacion del Acuerdo de Procesamiento de Datos (Ley 21.719)
   que se muestra antes de redirigir al usuario al checkout de Reveniu.

   USO:
     window.SistecoDPA.showAcceptanceModal(plan, onAccepted)
       plan       — "base" | "crecimiento" | "enterprise"
       onAccepted — callback ejecutado tras aceptar DPA y registrar en Convex

   REQUERIMIENTOS:
     - shared/convex-client.js cargado (window.mutateConvex disponible)
   ============================================================================= */

(function () {
  'use strict';

  var DPA_VERSION = 'v1.0-2026-03-15';

  var PLAN_PRICES = {
    base: '$99.990 CLP/mes',
    crecimiento: '$249.990 CLP/mes',
    enterprise: 'Personalizado',
  };

  // ── Mostrar modal de aceptacion DPA ───────────────────────────────────────

  function showAcceptanceModal(plan, onAccepted) {
    // Prevenir duplicados
    var existing = document.getElementById('sisteco-dpa-modal');
    if (existing) existing.remove();

    var planPrice = PLAN_PRICES[plan] || PLAN_PRICES.base;

    // ── Overlay ──────────────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'sisteco-dpa-modal';
    overlay.setAttribute('style', [
      'position: fixed',
      'inset: 0',
      'background: rgba(0,0,0,0.5)',
      'z-index: 10000',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'padding: 24px',
      'font-family: "Source Sans 3", -apple-system, sans-serif',
    ].join(';'));

    // ── Modal card ───────────────────────────────────────────────────────────
    var modal = document.createElement('div');
    modal.setAttribute('style', [
      'background: #ffffff',
      'border-radius: 12px',
      'padding: 32px',
      'max-width: 560px',
      'width: 100%',
      'box-shadow: 0 20px 60px rgba(0,0,0,0.2)',
      'position: relative',
    ].join(';'));

    modal.innerHTML = [
      // Título
      '<h2 style="font-size:20px;font-weight:700;color:#111111;margin:0 0 4px 0;line-height:1.3">',
        'Acuerdo de Procesamiento de Datos (DPA)',
      '</h2>',
      // Barra acento
      '<div style="width:28px;height:3px;background:#c5ed36;margin:0 0 24px 0"></div>',
      // Descripción
      '<p style="font-size:15px;color:#444444;line-height:1.6;margin:0 0 16px 0">',
        'Al contratar Sisteco, aceptas nuestro Acuerdo de Procesamiento de Datos ',
        'conforme a la <strong>Ley 21.719</strong> de Proteccion de Datos Personales de Chile.',
      '</p>',
      // Link política
      '<p style="font-size:14px;color:#444444;margin:0 0 16px 0">',
        '<a href="/privacidad" target="_blank" ',
        'style="color:#111111;font-weight:600;text-decoration:underline">',
          'Ver politica de privacidad completa →',
        '</a>',
      '</p>',
      // Info plan
      '<div style="background:#F8F7F5;border:1px solid #e5e5e5;border-radius:6px;padding:14px 18px;margin:0 0 20px 0">',
        '<p style="font-size:14px;color:#555555;margin:0">',
          '<strong>Plan seleccionado:</strong> ', planPrice, ' (IVA incluido)',
        '</p>',
      '</div>',
      // Checkbox DPA
      '<label id="dpa-label" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin:0 0 24px 0">',
        '<input type="checkbox" id="dpa-checkbox" ',
        'style="width:16px;height:16px;margin-top:3px;accent-color:#c5ed36;cursor:pointer;flex-shrink:0">',
        '<span style="font-size:14px;color:#333333;line-height:1.5">',
          'Acepto el Acuerdo de Procesamiento de Datos y la Politica de Privacidad de Sisteco',
        '</span>',
      '</label>',
      // Botones
      '<div style="display:flex;flex-direction:column;gap:12px">',
        '<button id="dpa-continue-btn" disabled ',
        'style="width:100%;padding:14px;background:#e5e5e5;color:#888888;',
        'font-size:15px;font-weight:700;border:none;border-radius:6px;cursor:not-allowed;',
        'font-family:\'Source Sans 3\',sans-serif;transition:background 0.2s,color 0.2s">',
          'Continuar al pago',
        '</button>',
        '<button id="dpa-cancel-btn" ',
        'style="background:none;border:none;font-size:14px;color:#888888;',
        'cursor:pointer;text-decoration:underline;font-family:\'Source Sans 3\',sans-serif">',
          'Cancelar',
        '</button>',
      '</div>',
    ].join('');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ── Lógica interactiva ────────────────────────────────────────────────────
    var checkbox = document.getElementById('dpa-checkbox');
    var continueBtn = document.getElementById('dpa-continue-btn');
    var cancelBtn = document.getElementById('dpa-cancel-btn');

    // Activar botón cuando checkbox marcado
    checkbox.addEventListener('change', function () {
      if (checkbox.checked) {
        continueBtn.disabled = false;
        continueBtn.style.background = '#c5ed36';
        continueBtn.style.color = '#111111';
        continueBtn.style.cursor = 'pointer';
      } else {
        continueBtn.disabled = true;
        continueBtn.style.background = '#e5e5e5';
        continueBtn.style.color = '#888888';
        continueBtn.style.cursor = 'not-allowed';
      }
    });

    // Hover en boton continuar
    continueBtn.addEventListener('mouseenter', function () {
      if (!continueBtn.disabled) continueBtn.style.background = '#b3d82f';
    });
    continueBtn.addEventListener('mouseleave', function () {
      if (!continueBtn.disabled) continueBtn.style.background = '#c5ed36';
    });

    // Cerrar con cancelar
    cancelBtn.addEventListener('click', function () {
      overlay.remove();
    });

    // Cerrar al hacer click fuera del modal
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // Continuar al pago
    continueBtn.addEventListener('click', async function () {
      if (!checkbox.checked) return;

      continueBtn.disabled = true;
      continueBtn.textContent = 'Registrando...';

      try {
        // Registrar aceptación DPA en Convex
        if (typeof window.mutateConvex === 'function') {
          await window.mutateConvex('subscriptions:acceptDpa', {
            dpaVersion: DPA_VERSION,
          });
        }
      } catch (err) {
        console.warn('[DPA] Error al registrar aceptacion en Convex:', err.message);
        // No bloquear — continuar al pago de todas formas
      }

      overlay.remove();

      // Ejecutar callback (redireccion a Reveniu)
      if (typeof onAccepted === 'function') {
        onAccepted();
      }
    });
  }

  // ── API publica ────────────────────────────────────────────────────────────
  window.SistecoDPA = { showAcceptanceModal: showAcceptanceModal };

})();
