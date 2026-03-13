/* =============================================================================
   Sisteco Mock Data — mock-data.js
   Datos ficticios chilenos para los 3 mockups (CEO, VP Ventas, SDR)
   Datos son simulados para propositos de diseno — no representan empresas reales
   ============================================================================= */

/**
 * Formatea un numero como moneda CLP
 * Ejemplo: formatCLP(45600000) → "$45.600.000"
 */
function formatCLP(num) {
  return '$' + num.toLocaleString('es-CL');
}

/**
 * Formatea una fecha relativa para mostrar en UI
 * Ejemplo: relativeDate(3) → "hace 3 dias"
 */
function relativeDate(daysAgo) {
  if (daysAgo === 0) return 'hoy';
  if (daysAgo === 1) return 'ayer';
  return 'hace ' + daysAgo + ' dias';
}

// Exponer helpers en window
window.formatCLP = formatCLP;
window.relativeDate = relativeDate;

/* =============================================================================
   SISTECO_DATA — Estructura completa de datos mock
   ============================================================================= */

window.SISTECO_DATA = {

  /* --- Organizacion (multi-tenant) --- */
  org: {
    nombre: 'TechCorp Chile SpA',
    rut: '76.543.210-K',
    plan: 'Growth',
    industria: 'Desarrollo de programas informaticos',
    ciudad: 'Santiago',
    empleados: 120,
    inicio_actividades: '2018-03-15'
  },

  /* --- Usuario actual (el HTML define el rol via data-role) --- */
  currentUser: {
    ceo: {
      nombre: 'Maria Rodriguez',
      iniciales: 'MR',
      cargo: 'CEO',
      email: 'maria.rodriguez@techcorp.cl'
    },
    vp: {
      nombre: 'Carlos Fuentes',
      iniciales: 'CF',
      cargo: 'VP Ventas',
      email: 'carlos.fuentes@techcorp.cl'
    },
    sdr: {
      nombre: 'Sofia Mendez',
      iniciales: 'SM',
      cargo: 'SDR',
      email: 'sofia.mendez@techcorp.cl'
    }
  },

  /* --- 18 Leads con datos chilenos realistas --- */
  leads: [
    {
      id: 'lead-001',
      nombre: 'Carolina Mendez',
      cargo: 'Gerente Comercial',
      empresa: 'Innova Soluciones SpA',
      empresa_rut: '76.234.567-3',
      email: 'c.mendez@innovasoluciones.cl',
      telefono: '+56 9 8123 4567',
      industria: 'Desarrollo de programas informaticos',
      tamano: 'Mediana (50-199)',
      ciudad: 'Santiago',
      score: 88,
      clasificacion: 'HOT',
      estado: 'contactado',
      sdr_asignado: 'Sofia Mendez',
      fecha_ingreso_dias: 2,
      sii_actividad: 'Desarrollo de programas informaticos y otras actividades informaticas',
      sii_inicio_actividades: '2015-06-01'
    },
    {
      id: 'lead-002',
      nombre: 'Andres Fuentes',
      cargo: 'Director de Operaciones',
      empresa: 'Austral Tech Ltda',
      empresa_rut: '76.891.234-5',
      email: 'a.fuentes@australtech.cl',
      telefono: '+56 9 7234 5678',
      industria: 'Actividades de servicios financieros',
      tamano: 'Mediana (50-199)',
      ciudad: 'Santiago',
      score: 82,
      clasificacion: 'HOT',
      estado: 'reunion',
      sdr_asignado: 'Sofia Mendez',
      fecha_ingreso_dias: 5,
      sii_actividad: 'Actividades de servicios financieros, excepto las de seguros y fondos de pensiones',
      sii_inicio_actividades: '2012-01-15'
    },
    {
      id: 'lead-003',
      nombre: 'Ignacio Valenzuela',
      cargo: 'CEO',
      empresa: 'BioAndes SA',
      empresa_rut: '76.456.789-0',
      email: 'i.valenzuela@bioandes.cl',
      telefono: '+56 9 6345 6789',
      industria: 'Fabricacion de productos alimenticios',
      tamano: 'Grande (200+)',
      ciudad: 'Concepcion',
      score: 79,
      clasificacion: 'HOT',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 1,
      sii_actividad: 'Elaboracion de otros productos alimenticios',
      sii_inicio_actividades: '2008-09-20'
    },
    {
      id: 'lead-004',
      nombre: 'Valentina Torres',
      cargo: 'Jefe de TI',
      empresa: 'Metalurgica del Sur SpA',
      empresa_rut: '76.123.456-7',
      email: 'v.torres@metalsur.cl',
      telefono: '+56 9 5456 7890',
      industria: 'Actividades de arquitectura e ingenieria',
      tamano: 'Grande (200+)',
      ciudad: 'Temuco',
      score: 75,
      clasificacion: 'HOT',
      estado: 'propuesta',
      sdr_asignado: 'Diego Rojas',
      fecha_ingreso_dias: 8,
      sii_actividad: 'Actividades de arquitectura e ingenieria y otras actividades conexas de consultoria tecnica',
      sii_inicio_actividades: '2005-03-10'
    },
    {
      id: 'lead-005',
      nombre: 'Sebastian Herrera',
      cargo: 'VP Ventas',
      empresa: 'Distribuidora Central SA',
      empresa_rut: '76.789.012-1',
      email: 's.herrera@distcentral.cl',
      telefono: '+56 9 4567 8901',
      industria: 'Comercio al por mayor de maquinaria',
      tamano: 'Mediana (50-199)',
      ciudad: 'Santiago',
      score: 73,
      clasificacion: 'HOT',
      estado: 'contactado',
      sdr_asignado: 'Paula Vidal',
      fecha_ingreso_dias: 3,
      sii_actividad: 'Comercio al por mayor de maquinaria, equipo y materiales',
      sii_inicio_actividades: '2010-07-15'
    },
    {
      id: 'lead-006',
      nombre: 'Camila Soto',
      cargo: 'Gerente Comercial',
      empresa: 'Logistica Pacifico SpA',
      empresa_rut: '76.345.678-9',
      email: 'c.soto@logpacifico.cl',
      telefono: '+56 9 3678 9012',
      industria: 'Actividades de servicios financieros',
      tamano: 'Mediana (50-199)',
      ciudad: 'Valparaiso',
      score: 68,
      clasificacion: 'HOT',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 4,
      sii_actividad: 'Actividades de seguros y fondos de pensiones',
      sii_inicio_actividades: '2016-11-01'
    },
    {
      id: 'lead-007',
      nombre: 'Felipe Gutierrez',
      cargo: 'Director Financiero',
      empresa: 'Constructora Andes SpA',
      empresa_rut: '76.678.901-2',
      email: 'f.gutierrez@constandes.cl',
      telefono: '+56 9 2789 0123',
      industria: 'Actividades de arquitectura e ingenieria',
      tamano: 'Mediana (50-199)',
      ciudad: 'Santiago',
      score: 62,
      clasificacion: 'WARM',
      estado: 'contactado',
      sdr_asignado: 'Sofia Mendez',
      fecha_ingreso_dias: 12,
      sii_actividad: 'Construccion de edificios residenciales',
      sii_inicio_actividades: '2014-05-20'
    },
    {
      id: 'lead-008',
      nombre: 'Javiera Morales',
      cargo: 'Gerente de RRHH',
      empresa: 'Agro Sur Ltda',
      empresa_rut: '76.901.234-3',
      email: 'j.morales@agrosur.cl',
      telefono: '+56 9 1890 1234',
      industria: 'Fabricacion de productos alimenticios',
      tamano: 'Grande (200+)',
      ciudad: 'Valparaiso',
      score: 58,
      clasificacion: 'WARM',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 7,
      sii_actividad: 'Cultivo de frutas tropicales y subtropicales',
      sii_inicio_actividades: '2003-02-28'
    },
    {
      id: 'lead-009',
      nombre: 'Nicolas Castillo',
      cargo: 'CEO',
      empresa: 'Digital Ventures SpA',
      empresa_rut: '76.012.345-4',
      email: 'n.castillo@digitalventures.cl',
      telefono: '+56 9 0901 2345',
      industria: 'Desarrollo de programas informaticos',
      tamano: 'Pequena (10-49)',
      ciudad: 'Santiago',
      score: 55,
      clasificacion: 'WARM',
      estado: 'contactado',
      sdr_asignado: 'Diego Rojas',
      fecha_ingreso_dias: 15,
      sii_actividad: 'Actividades de programacion informatica',
      sii_inicio_actividades: '2019-08-15'
    },
    {
      id: 'lead-010',
      nombre: 'Andrea Perez',
      cargo: 'Directora de Tecnologia',
      empresa: 'Salud Online SpA',
      empresa_rut: '76.111.222-5',
      email: 'a.perez@saludonline.cl',
      telefono: '+56 9 9012 3456',
      industria: 'Actividades de servicios financieros',
      tamano: 'Pequena (10-49)',
      ciudad: 'Concepcion',
      score: 51,
      clasificacion: 'WARM',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 9,
      sii_actividad: 'Actividades de hospital',
      sii_inicio_actividades: '2020-01-10'
    },
    {
      id: 'lead-011',
      nombre: 'Matias Espinoza',
      cargo: 'Gerente de Marketing',
      empresa: 'Servicios del Norte SpA',
      empresa_rut: '76.333.444-6',
      email: 'm.espinoza@sernorte.cl',
      telefono: '+56 9 8123 4560',
      industria: 'Comercio al por mayor de maquinaria',
      tamano: 'Mediana (50-199)',
      ciudad: 'Antofagasta',
      score: 48,
      clasificacion: 'WARM',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 6,
      sii_actividad: 'Venta al por mayor de combustibles solidos, liquidos y gaseosos',
      sii_inicio_actividades: '2011-04-05'
    },
    {
      id: 'lead-012',
      nombre: 'Francisca Rojas',
      cargo: 'Jefa de Compras',
      empresa: 'Retail Patagonia SA',
      empresa_rut: '76.555.666-7',
      email: 'f.rojas@retailpatagonia.cl',
      telefono: '+56 9 7234 5671',
      industria: 'Comercio al por mayor de maquinaria',
      tamano: 'Grande (200+)',
      ciudad: 'Santiago',
      score: 44,
      clasificacion: 'NURTURE',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 18,
      sii_actividad: 'Comercio al por menor en almacenes no especializados',
      sii_inicio_actividades: '2007-10-30'
    },
    {
      id: 'lead-013',
      nombre: 'Roberto Munoz',
      cargo: 'Director Comercial',
      empresa: 'Minera Atacama SpA',
      empresa_rut: '76.777.888-8',
      email: 'r.munoz@mineratacama.cl',
      telefono: '+56 9 6345 6782',
      industria: 'Actividades de arquitectura e ingenieria',
      tamano: 'Grande (200+)',
      ciudad: 'Antofagasta',
      score: 40,
      clasificacion: 'NURTURE',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 22,
      sii_actividad: 'Extraccion de minerales de hierro',
      sii_inicio_actividades: '2001-06-12'
    },
    {
      id: 'lead-014',
      nombre: 'Patricia Lagos',
      cargo: 'Gerenta General',
      empresa: 'Clinica del Sur SpA',
      empresa_rut: '76.999.000-9',
      email: 'p.lagos@clinicasur.cl',
      telefono: '+56 9 5456 7893',
      industria: 'Fabricacion de productos alimenticios',
      tamano: 'Mediana (50-199)',
      ciudad: 'Temuco',
      score: 37,
      clasificacion: 'NURTURE',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 14,
      sii_actividad: 'Actividades de clinicas y hospitales privados',
      sii_inicio_actividades: '2009-03-22'
    },
    {
      id: 'lead-015',
      nombre: 'Juan Carlos Vega',
      cargo: 'Jefe de TI',
      empresa: 'Educacion Online Chile',
      empresa_rut: '76.222.333-0',
      email: 'jc.vega@eduonline.cl',
      telefono: '+56 9 4567 8904',
      industria: 'Desarrollo de programas informaticos',
      tamano: 'Pequena (10-49)',
      ciudad: 'Valparaiso',
      score: 33,
      clasificacion: 'NURTURE',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 20,
      sii_actividad: 'Actividades de ensenanza superior privada',
      sii_inicio_actividades: '2017-02-14'
    },
    {
      id: 'lead-016',
      nombre: 'Isabel Contreras',
      cargo: 'CEO',
      empresa: 'Transportes del Pacifico',
      empresa_rut: '76.444.555-1',
      email: 'i.contreras@transpac.cl',
      telefono: '+56 9 3678 9015',
      industria: 'Comercio al por mayor de maquinaria',
      tamano: 'Mediana (50-199)',
      ciudad: 'Santiago',
      score: 28,
      clasificacion: 'SKIP',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 25,
      sii_actividad: 'Transporte de pasajeros por via terrestre urbana e interurbana',
      sii_inicio_actividades: '2000-11-08'
    },
    {
      id: 'lead-017',
      nombre: 'Diego Pinto',
      cargo: 'Gerente Financiero',
      empresa: 'Seguros del Biobio',
      empresa_rut: '76.666.777-2',
      email: 'd.pinto@segbiobio.cl',
      telefono: '+56 9 2789 0126',
      industria: 'Actividades de servicios financieros',
      tamano: 'Pequena (10-49)',
      ciudad: 'Concepcion',
      score: 21,
      clasificacion: 'SKIP',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 28,
      sii_actividad: 'Actividades de seguros de vida',
      sii_inicio_actividades: '2013-07-19'
    },
    {
      id: 'lead-018',
      nombre: 'Ana Beatriz Saavedra',
      cargo: 'Directora Administrativa',
      empresa: 'Inmobiliaria Central SpA',
      empresa_rut: '76.888.999-3',
      email: 'ab.saavedra@inmocentral.cl',
      telefono: '+56 9 1890 1237',
      industria: 'Actividades de arquitectura e ingenieria',
      tamano: 'Pequena (10-49)',
      ciudad: 'Santiago',
      score: 15,
      clasificacion: 'SKIP',
      estado: 'nuevo',
      sdr_asignado: null,
      fecha_ingreso_dias: 30,
      sii_actividad: 'Actividades inmobiliarias realizadas con bienes propios o arrendados',
      sii_inicio_actividades: '2006-05-03'
    }
  ],

  /* --- KPIs por rol --- */
  kpis: {
    ceo: {
      leads_nuevos: {
        valor: 47,
        delta: '+15%',
        positivo: true,
        narrativa: '47 leads nuevos este mes, 15% mas que el anterior. Las busquedas en LinkedIn estan generando mejor volumen.'
      },
      leads_hot: {
        valor: 12,
        delta: '+33%',
        positivo: true,
        narrativa: '12 leads calificados como HOT. Las empresas de tecnologia y servicios financieros lideran el ranking.'
      },
      tasa_conversion: {
        valor: '8.5%',
        delta: '+1.2pp',
        positivo: true,
        narrativa: '8.5% de conversion, mejorando 1.2 puntos. El equipo esta contactando mas rapido que el mes pasado.'
      },
      pipeline_value: {
        valor: 45600000,
        delta: '+12%',
        positivo: true,
        narrativa: 'Pipeline valorado en $45.600.000 CLP. Si se mantiene la conversion, el cierre estimado es $3.876.000.'
      }
    },
    vp: {
      leads_total: {
        valor: 47,
        delta: '+15%',
        positivo: true,
        narrativa: '47 leads nuevos en el pipeline. 12 HOT listos para contactar, 18 en proceso de calificacion.'
      },
      asignados: {
        valor: 28,
        delta: '+8',
        positivo: true,
        narrativa: '28 leads asignados a SDRs. Quedan 19 sin asignar — prioridad HOT: 6 esperando SDR disponible.'
      },
      contactados: {
        valor: 8,
        delta: '+2',
        positivo: true,
        narrativa: '8 leads contactados este mes. Sofia lidera con 4 contactos y 2 reuniones agendadas.'
      },
      reuniones: {
        valor: 3,
        delta: '+1',
        positivo: true,
        narrativa: '3 reuniones agendadas esta semana. Empresas de tecnologia y manufactura muestran mas interes.'
      }
    },
    sdr: {
      mis_leads: {
        valor: 12,
        delta: null,
        positivo: null,
        narrativa: 'Tienes 12 leads asignados. 3 requieren accion urgente hoy (HOT sin contactar en 48h).'
      },
      contactados_hoy: {
        valor: 2,
        delta: null,
        positivo: null,
        narrativa: '2 leads contactados hoy. Meta diaria: 5. Te quedan 3 para alcanzar el objetivo.'
      },
      reuniones_esta_semana: {
        valor: 2,
        delta: '+1',
        positivo: true,
        narrativa: '2 reuniones esta semana. La de manana con Austral Tech tiene alta probabilidad de cierre.'
      },
      tasa_respuesta: {
        valor: '34%',
        delta: '+5pp',
        positivo: true,
        narrativa: 'Tu tasa de respuesta mejoro 5 puntos. Los mensajes personalizados con datos SII estan funcionando.'
      }
    }
  },

  /* --- Funnel de conversion --- */
  funnel: {
    nuevos: { valor: 47, label: 'Nuevos' },
    enriquecidos_sii: { valor: 42, label: 'Enriq. SII', pct_prev: 89 },
    scored: { valor: 42, label: 'Scored', pct_prev: 100 },
    hot: { valor: 12, label: 'HOT', pct_prev: 29 },
    contactados: { valor: 8, label: 'Contactados', pct_prev: 67 },
    convertidos: { valor: 4, label: 'Clientes', pct_prev: 50 }
  },

  /* --- Segmentacion de leads --- */
  segmentation: {
    industria: [
      { label: 'Tecnologia', valor: 14 },
      { label: 'Serv. Financieros', valor: 8 },
      { label: 'Manufactura', valor: 7 },
      { label: 'Ingenieria', valor: 5 },
      { label: 'Comercio', valor: 4 }
    ],
    tamano: [
      { label: 'Mediana (50-199)', valor: 18 },
      { label: 'Pequena (10-49)', valor: 12 },
      { label: 'Grande (200+)', valor: 8 }
    ],
    ciudad: [
      { label: 'Santiago', valor: 22 },
      { label: 'Valparaiso', valor: 6 },
      { label: 'Concepcion', valor: 5 },
      { label: 'Temuco', valor: 4 },
      { label: 'Antofagasta', valor: 3 }
    ]
  },

  /* --- Equipo de SDRs --- */
  team: [
    {
      nombre: 'Sofia Mendez',
      iniciales: 'SM',
      leads_asignados: 12,
      contactados: 8,
      reuniones: 3,
      conversion_pct: 25
    },
    {
      nombre: 'Diego Rojas',
      iniciales: 'DR',
      leads_asignados: 9,
      contactados: 5,
      reuniones: 2,
      conversion_pct: 22
    },
    {
      nombre: 'Paula Vidal',
      iniciales: 'PV',
      leads_asignados: 7,
      contactados: 3,
      reuniones: 1,
      conversion_pct: 14
    }
  ],

  /* --- Analisis IA por rol (CEO) — respuestas on-demand con insights --- */
  analysis: {
    ceo: {
      funnel: {
        title: 'Pipeline Funnel',
        insight: 'De 47 leads nuevos, solo 12 califican como HOT (29%). El cuello de botella esta entre Scored y HOT — la mayoria no cumple el perfil de industria. Tecnologia y Servicios Financieros son los que mejor convierten.',
        recommendation: 'Ajustar el ICP para priorizar Servicios Financieros medianos. Tienen 25% de conversion vs 14% en Tecnologia y 9% en Manufactura. Mayor ROI por lead.'
      },
      kpis: {
        title: 'Metricas del Mes',
        insight: 'Pipeline saludable: +15% en volumen y +33% en leads HOT. La tasa de conversion subio 1.2pp gracias a respuestas mas rapidas del equipo. Si se mantiene este ritmo, el cierre proyectado es $3.876.000 CLP este mes.',
        recommendation: 'Mantener velocidad de contacto. Los leads respondidos en menos de 24h convierten 3x mas que los contactados despues de 48h.'
      },
      industria: {
        title: 'Analisis por Industria',
        insight: 'Tecnologia lidera con 14 leads (30% del pipeline). Pero Servicios Financieros tiene mejor conversion: 25% vs 14% en Tech. Las empresas medianas (50-199) son el sweet spot — 47% del pipeline y 62% de conversiones.',
        recommendation: 'Priorizar Servicios Financieros medianos. Son el segmento con mayor ROI por lead. Reducir esfuerzo en Manufactura (9% conversion).'
      },
      equipo: {
        title: 'Rendimiento del Equipo',
        insight: 'El equipo contacto 8 de 47 leads este mes (17%). Sofia Mendez lidera con 67% de conversion en sus leads. Tiempo promedio de primer contacto: 4.2 horas. Los leads contactados en menos de 2h tienen 3x mas probabilidad de reunion.',
        recommendation: 'Reducir tiempo de primer contacto a menos de 2h para leads HOT. Asignar mas leads HOT a Sofia Mendez — tiene la mayor tasa de conversion del equipo.'
      },
      comparar: {
        title: 'Comparativa Mensual',
        insight: 'Marzo vs Febrero: +15% volumen (47 vs 41 leads), +33% leads HOT (12 vs 9), +1.2pp conversion (8.5% vs 7.3%). El cambio a LinkedIn Search esta generando mejor volumen sin reducir la calidad de los HOT.',
        recommendation: 'Seguir con LinkedIn Search + filtro de scoring agresivo. El volumen compensa la menor calidad promedio porque los leads HOT mantienen la misma calidad que antes.'
      },
      hot: {
        title: 'Leads HOT Ahora',
        insight: '12 leads clasificados como HOT este mes. 6 sin contactar todavia — 3 llevan mas de 48 horas esperando primer contacto. Cada hora de demora reduce 15% la probabilidad de respuesta.',
        recommendation: 'Contactar hoy: Ignacio Valenzuela (BioAndes, score 79), Camila Soto (Logistica Pacifico, score 68), y Sebastian Herrera (Distribuidora Central, score 73). Asignar a Sofia Mendez.'
      }
    }
  },

  /* --- Conversaciones IA (CEO workspace) --- */
  conversations: {
    ceo: [
      {
        query: 'que puedo hacer con los leads hot',
        response: 'Tienes **12 leads HOT** este mes. Recomendaciones:\n\n1. **Contactar en menos de 2h** — los leads respondidos rapido convierten 3x mas\n2. **Priorizar Servicios Financieros** — tienen 67% de conversion en tu pipeline\n3. **Asignar a Sofia** — lidera con 25% de conversion personal en el equipo\n\nTu equipo ha contactado 8 de 12 HOT. Quedan **4 sin contactar** — actua hoy.',
        type: 'recommendation'
      },
      {
        query: 'como mejoro mi conversion',
        response: 'Tu conversion actual: **8.5%** (+1.2pp vs mes anterior). Para mejorar:\n\n1. **Velocidad de contacto** — actualmente 4.2h promedio. Bajar a menos de 2h puede duplicar reuniones\n2. **Ajustar ICP** — Manufactura tiene solo 9% conversion. Redirigir busquedas a Finanzas (67%)\n3. **Seguimiento** — 6 leads en estado "contactado" sin reunion hace mas de 5 dias\n\nSi aplicas los 3 cambios, proyeccion: **12-14% conversion** el proximo mes.',
        type: 'analysis'
      },
      {
        query: 'dame un resumen ejecutivo',
        response: '**Resumen Ejecutivo — Marzo 2026**\n\nPipeline: 47 leads nuevos (+15%), 12 HOT (+33%)\nConversion: 8.5% (+1.2pp)\nPipeline value: $45.600.000 CLP (+12%)\n\n**Lo bueno:** Volumen y calidad subiendo. LinkedIn Search genera buen flujo.\n**Atencion:** Cuello de botella en Scored → HOT (29%). 6 leads sin asignar.\n**Accion:** Ajustar ICP, reducir tiempo de primer contacto, asignar leads pendientes.\n\nProyeccion de cierre: **$3.876.000 CLP** este mes.',
        type: 'summary'
      },
      {
        query: 'quien es el mejor vendedor',
        response: '**Sofia Mendez** lidera el equipo con:\n- 12 leads asignados\n- 8 contactados (67% contacto)\n- 3 reuniones agendadas\n- **25% tasa de conversion** — la mas alta del equipo\n\nDiego Rojas tiene 22% y Paula Vidal 14%. La diferencia clave: Sofia contacta leads HOT en promedio 1.8h vs 5.2h del resto.',
        type: 'analysis'
      },
      {
        query: 'que industrias funcionan mejor',
        response: 'Por tasa de conversion:\n\n1. **Servicios Financieros** — 67% conversion, 8 leads activos\n2. **Tecnologia** — 25% conversion, 14 leads (mayor volumen)\n3. **Ingenieria** — 20% conversion, 5 leads\n4. **Manufactura** — 9% conversion (bajo rendimiento)\n\nRecomendacion: enfocar prospecting en **Servicios Financieros medianos** (50-199 empleados). Son el sweet spot de tu pipeline.',
        type: 'analysis'
      }
    ]
  },

  /* --- To-do list del SDR (Sofia Mendez) --- */
  sdrTodos: [
    {
      id: 'todo-001',
      lead_id: 'lead-001',
      lead_nombre: 'Carolina Mendez',
      empresa: 'Innova Soluciones SpA',
      accion: 'Enviar propuesta comercial',
      prioridad: 'urgente',
      fecha_limite: 'hoy',
      clasificacion: 'HOT',
      score: 88
    },
    {
      id: 'todo-002',
      lead_id: 'lead-002',
      lead_nombre: 'Andres Fuentes',
      empresa: 'Austral Tech Ltda',
      accion: 'Confirmar reunion de manana 10am',
      prioridad: 'alta',
      fecha_limite: 'hoy',
      clasificacion: 'HOT',
      score: 82
    },
    {
      id: 'todo-003',
      lead_id: 'lead-005',
      lead_nombre: 'Sebastian Herrera',
      empresa: 'Distribuidora Central SA',
      accion: 'Primer contacto — llamada o LinkedIn',
      prioridad: 'alta',
      fecha_limite: 'hoy',
      clasificacion: 'HOT',
      score: 73
    },
    {
      id: 'todo-004',
      lead_id: 'lead-007',
      lead_nombre: 'Felipe Gutierrez',
      empresa: 'Constructora Andes SpA',
      accion: 'Follow-up — no respondio en 3 dias',
      prioridad: 'media',
      fecha_limite: 'manana',
      clasificacion: 'WARM',
      score: 62
    },
    {
      id: 'todo-005',
      lead_id: 'lead-009',
      lead_nombre: 'Nicolas Castillo',
      empresa: 'Digital Ventures SpA',
      accion: 'Agendar demo del producto',
      prioridad: 'media',
      fecha_limite: 'esta semana',
      clasificacion: 'WARM',
      score: 55
    },
    {
      id: 'todo-006',
      lead_id: 'lead-001',
      lead_nombre: 'Carolina Mendez',
      empresa: 'Innova Soluciones SpA',
      accion: 'Preparar casos de uso especificos para su industria',
      prioridad: 'media',
      fecha_limite: 'esta semana',
      clasificacion: 'HOT',
      score: 88
    },
    {
      id: 'todo-007',
      lead_id: 'lead-007',
      lead_nombre: 'Felipe Gutierrez',
      empresa: 'Constructora Andes SpA',
      accion: 'Enviar info sobre integracion con ERP',
      prioridad: 'baja',
      fecha_limite: 'proxima semana',
      clasificacion: 'WARM',
      score: 62
    },
    {
      id: 'todo-008',
      lead_id: 'lead-009',
      lead_nombre: 'Nicolas Castillo',
      empresa: 'Digital Ventures SpA',
      accion: 'Revisar perfil LinkedIn y personalizar mensaje',
      prioridad: 'baja',
      fecha_limite: 'proxima semana',
      clasificacion: 'WARM',
      score: 55
    }
  ]

};
