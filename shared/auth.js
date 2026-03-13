/* =============================================================================
   Sisteco Auth — shared/auth.js
   Clerk bootstrap para vanilla JS (sin React) + role detection + redirects
   Version: 1.0 — Phase 3 (Dashboard Build)

   USO:
     1. Incluir ANTES de convex-client.js e interactions.js
     2. Llamar initAuth() al inicio de cada pagina del dashboard
     3. Las funciones se exponen en window.SistecoAuth

   REQUERIMIENTOS:
     - Clerk JS SDK cargado via CDN con data-clerk-publishable-key
     - Clerk JWT Template llamado "convex" con custom claim org_id = {{org.id}}
     - Clerk Organizations habilitado en Clerk Dashboard
   ============================================================================= */

(function () {
  'use strict';

  /* ---- Configuracion ---- */
  var CONVEX_URL = window.CONVEX_URL || 'https://animated-pika-122.convex.cloud';
  var LOGIN_URL = '/app/login.html';
  var ROLE_PAGES = {
    ceo: '/app/ceo.html',
    vp_ventas: '/app/vp-ventas.html',
    sdr: '/app/sdr.html',
  };

  /* ---- Estado interno ---- */
  var _initialized = false;
  var _currentRole = null;
  var _initPromise = null;

  /* --------------------------------------------------------------------------
     initAuth() — Bootstrap principal
     Llama esto en el window.load de cada pagina del dashboard.
     Retorna el orgId si el usuario esta autenticado, o redirige a login.
     -------------------------------------------------------------------------- */
  async function initAuth() {
    if (_initPromise) return _initPromise;

    _initPromise = _doInitAuth();
    return _initPromise;
  }

  async function _doInitAuth() {
    // Esperar a que Clerk este listo
    if (typeof Clerk === 'undefined') {
      console.error('[SistecoAuth] Clerk JS SDK no encontrado. Verificar CDN script tag.');
      _redirectToLogin();
      return null;
    }

    try {
      await Clerk.load();
    } catch (err) {
      console.error('[SistecoAuth] Error al cargar Clerk:', err);
      _redirectToLogin();
      return null;
    }

    // Verificar sesion activa
    if (!Clerk.user) {
      _redirectToLogin();
      return null;
    }

    // Verificar organizacion activa
    var orgId = Clerk.session?.lastActiveOrganizationId;
    if (!orgId) {
      _showNoOrgScreen();
      return null;
    }

    // Guardar estado global
    window.CURRENT_ORG_ID = orgId;
    window.CURRENT_USER = Clerk.user;
    _initialized = true;

    // Inicializar Convex client con token
    if (typeof ConvexHttpClient !== 'undefined') {
      var token = await getConvexToken();
      var convex = new ConvexHttpClient(CONVEX_URL);
      convex.setAuth(token);
      window.CONVEX = convex;
    }

    return orgId;
  }

  /* --------------------------------------------------------------------------
     getConvexToken() — Obtiene JWT de Clerk para autenticar Convex
     Clerk cachea el token internamente si no expiro (~60s).
     Llamar antes de CADA query a Convex (no solo al inicio).
     -------------------------------------------------------------------------- */
  async function getConvexToken() {
    if (!Clerk.session) throw new Error('No active Clerk session');
    try {
      var token = await Clerk.session.getToken({ template: 'convex' });
      return token;
    } catch (err) {
      console.error('[SistecoAuth] Error obteniendo token Convex:', err);
      // Token puede haber expirado — intentar refresh
      if (Clerk.session.status === 'expired') {
        await Clerk.session.touch();
        return await Clerk.session.getToken({ template: 'convex' });
      }
      throw err;
    }
  }

  /* --------------------------------------------------------------------------
     getCurrentRole() — Determina el rol del usuario actual
     Estrategia: busca en tabla users de Convex (rol persistente).
     Fallback: usa Clerk org role metadata.
     -------------------------------------------------------------------------- */
  async function getCurrentRole() {
    if (_currentRole) return _currentRole;

    // Intentar obtener rol desde Convex
    if (window.CONVEX && window.queryConvex) {
      try {
        // Importar api de Convex para typed queries
        var role = await window.queryConvex('users:getUserRole', {});
        if (role) {
          _currentRole = role;
          window.CURRENT_ROLE = role;
          return role;
        }
      } catch (err) {
        console.warn('[SistecoAuth] No se pudo obtener rol de Convex, usando fallback:', err);
      }
    }

    // Fallback: usar Clerk org role
    var memberships = Clerk.user?.organizationMemberships || [];
    var activeMembership = memberships.find(function (m) {
      return m.organization.id === window.CURRENT_ORG_ID;
    });

    if (activeMembership) {
      var clerkRole = activeMembership.role;
      // Mapear roles de Clerk a roles de Sisteco
      if (clerkRole === 'org:admin') {
        _currentRole = 'ceo';
      } else if (clerkRole === 'org:member') {
        _currentRole = 'sdr';
      } else {
        // Custom roles — mapeo directo
        _currentRole = clerkRole.replace('org:', '') || 'sdr';
      }
      window.CURRENT_ROLE = _currentRole;
    }

    return _currentRole || 'sdr';
  }

  /* --------------------------------------------------------------------------
     redirectToRolePage() — Redirige segun el rol del usuario
     Llamar despues de login exitoso.
     -------------------------------------------------------------------------- */
  async function redirectToRolePage() {
    var role = await getCurrentRole();
    var page = ROLE_PAGES[role] || ROLE_PAGES.sdr;
    window.location.href = page;
  }

  /* --------------------------------------------------------------------------
     mountUserInfo() — Actualiza el UI con datos del usuario actual
     Llama esto despues de initAuth() para personalizar el header.
     -------------------------------------------------------------------------- */
  function mountUserInfo() {
    if (!Clerk.user) return;

    var user = Clerk.user;
    var orgId = window.CURRENT_ORG_ID;

    // Actualizar avatar/iniciales en sidebar
    var avatarEls = document.querySelectorAll('.sidebar-avatar');
    var fullName = (user.firstName || '') + ' ' + (user.lastName || '');
    fullName = fullName.trim() || user.emailAddresses?.[0]?.emailAddress || 'Usuario';

    var initials = fullName.split(' ').map(function (n) {
      return n[0];
    }).slice(0, 2).join('').toUpperCase();

    avatarEls.forEach(function (el) {
      var tooltip = el.querySelector('.sidebar-avatar-tooltip');
      el.childNodes[0].textContent = initials;
      if (tooltip) tooltip.textContent = fullName + ' — ' + (window.CURRENT_ROLE || '');
    });

    // Actualizar greeting
    var greetingEl = document.querySelector('.hero-greeting');
    if (greetingEl) {
      greetingEl.textContent = 'Buenos dias, ' + (user.firstName || 'Usuario');
    }

    // Actualizar org badge
    var orgBadges = document.querySelectorAll('.org-badge span');
    if (orgBadges.length && Clerk.user?.organizationMemberships?.length) {
      var activeMembership = Clerk.user.organizationMemberships.find(function (m) {
        return m.organization.id === orgId;
      });
      if (activeMembership) {
        orgBadges[0].textContent = activeMembership.organization.name;
      }
    }
  }

  /* --------------------------------------------------------------------------
     signOut() — Cierra sesion y redirige a login
     -------------------------------------------------------------------------- */
  async function signOut() {
    await Clerk.signOut();
    window.location.href = LOGIN_URL;
  }

  /* ---- Funciones internas ---- */

  function _redirectToLogin() {
    var currentPath = window.location.pathname;
    // Evitar bucle de redirect si ya estamos en login
    if (currentPath.endsWith('login.html') || currentPath.endsWith('login')) return;
    window.location.href = LOGIN_URL;
  }

  function _showNoOrgScreen() {
    // Mostrar pantalla de "Selecciona una organizacion"
    var body = document.body;
    body.innerHTML =
      '<div style="' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100vh;background:#F8F7F5;font-family:\'Source Sans 3\',sans-serif;' +
        'color:#111;gap:16px;padding:24px;text-align:center;' +
      '">' +
        '<img src="/shared/assets/icon-sisteco.png" width="48" height="48" alt="Sisteco" style="margin-bottom:8px">' +
        '<h2 style="font-size:20px;font-weight:700;margin:0">Selecciona tu organizacion</h2>' +
        '<p style="color:#666;max-width:360px;margin:0;line-height:1.5">' +
          'Tu cuenta no tiene una organizacion activa. ' +
          'Contacta a contacto@sisteco.cl para que el administrador te invite.' +
        '</p>' +
        '<button onclick="window.SistecoAuth.signOut()" style="' +
          'margin-top:8px;padding:10px 24px;background:#c5ed36;border:none;' +
          'border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;' +
        '">Cerrar sesion</button>' +
      '</div>';
  }

  /* ---- API publica ---- */
  window.SistecoAuth = {
    initAuth: initAuth,
    getConvexToken: getConvexToken,
    getCurrentRole: getCurrentRole,
    redirectToRolePage: redirectToRolePage,
    mountUserInfo: mountUserInfo,
    signOut: signOut,
  };

  // Aliases globales para conveniencia
  window.initAuth = initAuth;
  window.getConvexToken = getConvexToken;
  window.getCurrentRole = getCurrentRole;

})();
