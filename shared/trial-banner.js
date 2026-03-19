/* =============================================================================
   Sisteco Trial Banner — shared/trial-banner.js
   Muestra el estado del trial/suscripcion en la parte superior del dashboard.

   Estados soportados:
     trial   — verde, dias restantes + CTA "Contratar ahora" (→ DPA modal)
     grace   — naranja, advertencia pago fallido
     expired — rojo, trial vencido, dashboard opacado
     active  — sin banner (usuario pagando)
     paused  — gris, cuenta pausada

   USO:
     1. Incluir despues de convex-client.js y dpa-acceptance.js
     2. Llamar en window.load DESPUES de initAuth():
        if (window.SistecoTrialBanner) window.SistecoTrialBanner.init();

   REQUERIMIENTOS:
     - shared/auth.js cargado (window.CURRENT_ORG_ID disponible)
     - shared/convex-client.js cargado (window.queryConvex disponible)
     - shared/dpa-acceptance.js cargado (window.SistecoDPA disponible)
   ============================================================================= */

(function () {
  'use strict';

  // ── Checkout links de Reveniu (sincronizados con convex/onboardingEmail.ts) ──
  var REVENIU_LINKS = {
    base: 'https://app.reveniu.com/checkout-custom-link/DQ3MuizcwIXplfgDk7z2Mq5nthVjgH6j',
    crecimiento: 'https://app.reveniu.com/checkout-custom-link/k3Gp19rB3jede89nHDY9PklmJxaiTfU2',
    enterprise: 'https://app.reveniu.com/checkout-custom-link/HOxbQ8ILI2jRiH2Ps6tSo6nMUenIsHlN',
  };

  var PLAN_PRICES = {
    base: '$99.990 CLP/mes',
    crecimiento: '$249.990 CLP/mes',
    enterprise: 'Personalizado',
  };

  var DAY_MS = 24 * 60 * 60 * 1000;

  // ── Estilos base del banner ────────────────────────────────────────────────
  var BASE_BANNER_STYLE = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'padding: 10px 24px',
    'font-family: "Source Sans 3", -apple-system, sans-serif',
    'font-size: 14px',
    'font-weight: 600',
    'color: #111111',
    'position: relative',
    'z-index: 100',
    'gap: 12px',
  ].join(';');

  var CTA_BUTTON_BASE = [
    'display: inline-block',
    'padding: 6px 16px',
    'border-radius: 5px',
    'font-size: 13px',
    'font-weight: 700',
    'cursor: pointer',
    'border: none',
    'white-space: nowrap',
    'font-family: "Source Sans 3", -apple-system, sans-serif',
  ].join(';');

  // ── Configuracion de estados ──────────────────────────────────────────────

  function getBannerConfig(sub) {
    var daysRemaining = sub.trialEndsAt
      ? Math.ceil((sub.trialEndsAt - Date.now()) / DAY_MS)
      : 0;
    var plan = sub.plan || 'base';
    var reveniuLink = REVENIU_LINKS[plan] || REVENIU_LINKS.base;

    switch (sub.status) {
      case 'trial':
        if (daysRemaining <= 0) {
          return {
            bg: '#fff0f0',
            border: '2px solid #f44336',
            text: 'Tu trial vencio — Activa tu plan para seguir usando Sisteco',
            ctaText: 'Ver planes',
            ctaBg: '#f44336',
            ctaColor: '#ffffff',
            onCta: function () { window.open(reveniuLink, '_blank'); },
            dimContent: true,
          };
        }
        return {
          bg: '#f0ffd9',
          border: '2px solid #c5ed36',
          text: 'Trial gratuito — Quedan ' + daysRemaining + (daysRemaining === 1 ? ' dia' : ' dias'),
          ctaText: 'Contratar ahora',
          ctaBg: '#c5ed36',
          ctaColor: '#111111',
          onCta: function () {
            if (window.SistecoDPA) {
              window.SistecoDPA.showAcceptanceModal(plan, function () {
                window.open(reveniuLink, '_blank');
              });
            } else {
              window.open(reveniuLink, '_blank');
            }
          },
          dimContent: false,
        };

      case 'grace':
        return {
          bg: '#fff3e0',
          border: '2px solid #ff9800',
          text: 'Tu pago fallo — Pipeline pausado en 7 dias si no se actualiza',
          ctaText: 'Actualizar pago',
          ctaBg: '#ff9800',
          ctaColor: '#ffffff',
          onCta: function () { window.open(reveniuLink, '_blank'); },
          dimContent: false,
        };

      case 'expired':
        return {
          bg: '#fff0f0',
          border: '2px solid #f44336',
          text: 'Tu trial vencio — Activa tu plan para seguir usando Sisteco',
          ctaText: 'Ver planes',
          ctaBg: '#f44336',
          ctaColor: '#ffffff',
          onCta: function () { window.open(reveniuLink, '_blank'); },
          dimContent: true,
        };

      case 'paused':
        return {
          bg: '#f5f5f5',
          border: '1px solid #e5e5e5',
          text: 'Tu cuenta esta pausada — contacta a contacto@sisteco.cl',
          ctaText: null,
          dimContent: false,
        };

      case 'active':
      default:
        return null; // Sin banner
    }
  }

  // ── Crear banner DOM ──────────────────────────────────────────────────────

  function createBanner(config) {
    var banner = document.createElement('div');
    banner.id = 'sisteco-trial-banner';
    banner.setAttribute('style', [
      BASE_BANNER_STYLE,
      'background:' + config.bg,
      'border-bottom:' + config.border,
    ].join(';'));

    var textSpan = document.createElement('span');
    textSpan.textContent = config.text;
    banner.appendChild(textSpan);

    if (config.ctaText) {
      var btn = document.createElement('button');
      btn.textContent = config.ctaText;
      btn.setAttribute('style', CTA_BUTTON_BASE + ';background:' + config.ctaBg + ';color:' + config.ctaColor);
      btn.addEventListener('click', config.onCta);
      // Hover effect
      btn.addEventListener('mouseenter', function () {
        btn.style.opacity = '0.85';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.opacity = '1';
      });
      banner.appendChild(btn);
    }

    return banner;
  }

  // ── Opacar contenido del dashboard si trial vencido ───────────────────────

  function dimDashboardContent() {
    // Esperar a que el DOM este listo
    requestAnimationFrame(function () {
      // Opacar el contenido principal sin afectar el banner
      var main = document.querySelector('main') ||
                 document.querySelector('.workspace') ||
                 document.querySelector('.dashboard-content') ||
                 document.querySelector('.page-content');

      if (main) {
        main.style.opacity = '0.5';
        main.style.pointerEvents = 'none';
      } else {
        // Fallback: opacar todos los hijos del body excepto el banner
        Array.from(document.body.children).forEach(function (el) {
          if (el.id !== 'sisteco-trial-banner' && el.tagName !== 'SCRIPT') {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
          }
        });
      }
    });
  }

  // ── Funcion principal init() ──────────────────────────────────────────────

  async function init() {
    var orgId = window.CURRENT_ORG_ID;
    if (!orgId) {
      console.warn('[TrialBanner] CURRENT_ORG_ID no disponible — omitiendo banner');
      return;
    }

    if (typeof window.queryConvex !== 'function') {
      console.warn('[TrialBanner] queryConvex no disponible — omitiendo banner');
      return;
    }

    var sub;
    try {
      sub = await window.queryConvex('subscriptions:getByOrgId', { orgId: orgId });
    } catch (err) {
      console.warn('[TrialBanner] Error al obtener subscription:', err.message);
      return; // No mostrar banner si falla — no bloquear el dashboard
    }

    if (!sub) {
      // Sin subscription — probablemente admin o cuenta sin trial aun
      return;
    }

    var config = getBannerConfig(sub);
    if (!config) return; // Status "active" — sin banner

    var banner = createBanner(config);

    // Insertar al tope del body
    if (document.body.firstChild) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.body.appendChild(banner);
    }

    if (config.dimContent) {
      dimDashboardContent();
    }
  }

  // ── API publica ────────────────────────────────────────────────────────────
  window.SistecoTrialBanner = { init: init };

})();
