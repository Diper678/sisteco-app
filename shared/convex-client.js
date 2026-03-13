/* =============================================================================
   Sisteco Convex Client — shared/convex-client.js
   ConvexHttpClient wrapper con auth refresh automatico

   DASH-07: ONE-SHOT queries solamente — SIN subscripciones reactivas WebSocket.
   Usar ConvexHttpClient (no ConvexReactClient/ConvexClient).

   USO:
     const leads = await queryConvex(api.leads.getLeadsByOrg);
     await mutateConvex(api.leads.updateLeadStatus, { leadId, nuevoEstado });

   REQUERIMIENTOS:
     - Convex CDN via ESM: importa ConvexHttpClient y api en el modulo de la pagina
     - shared/auth.js cargado primero (para getConvexToken)
     - window.CONVEX_URL configurado (desde HTML o config)
   ============================================================================= */

/* ---- Importar ConvexHttpClient via ESM CDN ---- */
/* NOTA: Este archivo es NOT un ES module — se carga como script clasico.
   ConvexHttpClient se inyecta via script type="module" en cada HTML:

   <script type="module">
     import { ConvexHttpClient } from "https://esm.sh/convex@1.33.0/browser";
     window.ConvexHttpClient = ConvexHttpClient;
   </script>

   Una vez window.ConvexHttpClient esta disponible, este archivo lo usa.
*/

(function () {
  'use strict';

  var CONVEX_URL = window.CONVEX_URL || 'https://animated-pika-122.convex.cloud';
  var _convex = null;

  /* --------------------------------------------------------------------------
     Inicializar ConvexHttpClient
     Se llama automaticamente cuando ConvexHttpClient este disponible.
     -------------------------------------------------------------------------- */
  function _initClient() {
    if (_convex) return _convex;
    if (typeof ConvexHttpClient === 'undefined') {
      console.warn('[ConvexClient] ConvexHttpClient no disponible aun. Esperando...');
      return null;
    }
    _convex = new ConvexHttpClient(CONVEX_URL);
    window.CONVEX = _convex;
    return _convex;
  }

  /* --------------------------------------------------------------------------
     _getAuthenticatedClient() — Obtiene cliente con token fresco
     Refresca el token de Clerk antes de cada query (DASH-07 + Pitfall 4).
     -------------------------------------------------------------------------- */
  async function _getAuthenticatedClient() {
    var client = _initClient();
    if (!client) {
      // Reintentar — ConvexHttpClient puede haberse cargado despues
      await _waitForConvex();
      client = _initClient();
      if (!client) throw new Error('ConvexHttpClient no disponible');
    }

    // Refrescar token de Clerk antes de cada query
    if (typeof getConvexToken === 'function') {
      try {
        var token = await getConvexToken();
        if (token) client.setAuth(token);
      } catch (err) {
        console.warn('[ConvexClient] No se pudo obtener token de Clerk:', err);
        // Si falla el token, intentar query sin auth (fallara en servidor si requiere auth)
      }
    }

    return client;
  }

  /* --------------------------------------------------------------------------
     queryConvex(queryName, args) — One-shot query a Convex
     queryName: string como "leads:getLeadsByOrg" o referencia de api.*
     DASH-07 compliant: sin subscripciones, fetch puntual.
     -------------------------------------------------------------------------- */
  async function queryConvex(queryFnOrName, args) {
    args = args || {};
    var client = await _getAuthenticatedClient();

    try {
      var result = await client.query(queryFnOrName, args);
      return result;
    } catch (err) {
      _handleQueryError(err);
      throw err;
    }
  }

  /* --------------------------------------------------------------------------
     mutateConvex(mutationName, args) — One-shot mutation a Convex
     mutationName: string como "leads:updateLeadStatus" o referencia de api.*
     -------------------------------------------------------------------------- */
  async function mutateConvex(mutationFnOrName, args) {
    args = args || {};
    var client = await _getAuthenticatedClient();

    try {
      var result = await client.mutation(mutationFnOrName, args);
      return result;
    } catch (err) {
      _handleQueryError(err);
      throw err;
    }
  }

  /* --------------------------------------------------------------------------
     _handleQueryError — Maneja errores comunes de Convex
     -------------------------------------------------------------------------- */
  function _handleQueryError(err) {
    var msg = err.message || '';

    if (msg.includes('Unauthenticated') || msg.includes('Not authenticated')) {
      console.warn('[ConvexClient] Token expirado o invalido. Redirigiendo a login...');
      if (typeof Clerk !== 'undefined' && Clerk.openSignIn) {
        Clerk.openSignIn();
      } else {
        window.location.href = '/app/login.html';
      }
      return;
    }

    if (msg.includes('Forbidden')) {
      console.error('[ConvexClient] Acceso denegado — organizacion incorrecta.');
      return;
    }

    if (msg.includes('No active organization')) {
      console.warn('[ConvexClient] Sin organizacion activa. Redirigiendo...');
      window.location.href = '/app/login.html';
      return;
    }

    console.error('[ConvexClient] Error en query:', msg);
  }

  /* --------------------------------------------------------------------------
     _waitForConvex — Espera a que ConvexHttpClient se cargue via ESM
     -------------------------------------------------------------------------- */
  function _waitForConvex() {
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      var MAX_ATTEMPTS = 50; // 5 segundos max

      function check() {
        if (typeof ConvexHttpClient !== 'undefined') {
          resolve();
          return;
        }
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          reject(new Error('Timeout esperando ConvexHttpClient'));
          return;
        }
        setTimeout(check, 100);
      }
      check();
    });
  }

  /* ---- API publica ---- */
  window.queryConvex = queryConvex;
  window.mutateConvex = mutateConvex;

  // Intentar inicializar inmediatamente si ya esta disponible
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof ConvexHttpClient !== 'undefined') {
      _initClient();
    }
  });

})();
