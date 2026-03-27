# SAASTRE — Metodología de Arcilla Inteligente para Ventas B2B

> **SAASTRE** es la metodología propietaria de Sisteco para crear aplicaciones de ventas
> que se adaptan completamente a la necesidad de cada cliente. No es un producto fijo —
> es un sistema vivo que se moldea como arcilla inteligente.

---

## Qué es SAASTRE

**SAASTRE** (Sales-As-A-Service Tailored Runtime Environment) es el framework metodológico
de Sisteco para construir aplicaciones de ventas B2B que se comportan como **arcilla inteligente**:
totalmente adaptables a la necesidad específica de cada cliente dentro del dominio de ventas.

### La metáfora de la arcilla

| Arcilla tradicional | SAASTRE |
|---------------------|---------|
| Material bruto sin forma | Stack tecnológico base (Convex + n8n + Clerk) |
| El artesano moldea a mano | La configuración del cliente define la forma |
| Cada pieza es única | Cada instancia es única para el negocio |
| Se endurece al hornear | Se estabiliza al ir a producción |
| Puede re-moldearse antes | Se adapta continuamente con datos reales |

### Diferencia con SaaS tradicional

```
SaaS tradicional:    Un producto → muchos clientes idénticos
                     "Toma o déjalo"

SAASTRE:             Una metodología → cada cliente tiene SU aplicación
                     "Se moldea a tu negocio"
```

---

## Principios Fundamentales

### 1. Adaptabilidad sobre rigidez
No hay un "producto Sisteco" genérico. Cada cliente obtiene una aplicación moldeada
a su proceso de ventas, su industria, su equipo y sus métricas.

### 2. Configuración sobre código
La personalización se logra por configuración (ICP, workflows, roles, dashboards),
no reescribiendo código para cada cliente.

### 3. Datos locales como alma
Los datos chilenos (SII, LinkedIn Chile, industrias locales, Ley 21.719) son el
diferenciador que ningún competidor internacional puede replicar.

### 4. Inteligencia progresiva
La aplicación aprende del uso: scoring se ajusta, templates se refinan, alertas
se optimizan. La arcilla se vuelve más inteligente con el tiempo.

### 5. Revenue-first
Cada componente de la metodología debe contribuir directamente a que el cliente
cierre más ventas. Sin features decorativas.

---

## Capas de SAASTRE

La metodología se estructura en 5 capas, de base a superficie:

```
┌─────────────────────────────────────────────┐
│  5. EXPERIENCIA — Dashboard adaptado al rol │
├─────────────────────────────────────────────┤
│  4. INTELIGENCIA — Scoring + IA contextual  │
├─────────────────────────────────────────────┤
│  3. WORKFLOWS — Automatizaciones a medida   │
├─────────────────────────────────────────────┤
│  2. DATOS — Pipeline de enriquecimiento     │
├─────────────────────────────────────────────┤
│  1. INFRAESTRUCTURA — Convex + Clerk + n8n  │
└─────────────────────────────────────────────┘
```

### Capa 1: Infraestructura (inmutable)
- **Convex** como base de datos reactiva multi-tenant
- **Clerk** para autenticación y organizaciones
- **n8n** para orquestación de workflows
- **Vercel** para deploy serverless

> Esta capa NO cambia entre clientes. Es el "torno del alfarero".

### Capa 2: Datos (configurable por industria)
- Pipeline de leads con fuentes ajustadas al vertical del cliente
- Enriquecimiento SII (RUT, actividad económica, tamaño)
- LinkedIn Search configurado para el ICP específico
- Fuentes adicionales según industria (ej: CMF para fintech, SAG para agro)

> Se configura el QUÉ buscar, no el CÓMO buscar.

### Capa 3: Workflows (componibles)
- Catálogo de workflows n8n que se activan/desactivan por cliente
- Lead Scoring personalizado (pesos por industria, cargo, tamaño)
- Secuencias de outreach con templates por vertical
- Integraciones CRM (HubSpot, Pipedrive, Salesforce) según lo que use el cliente

> Cada cliente elige sus "piezas de Lego" del catálogo.

### Capa 4: Inteligencia (aprende del cliente)
- ICP Engine con criterios específicos del negocio
- Scoring Gemini con contexto de la industria
- Personalización de mensajes por tono y vertical
- Alertas inteligentes (HOT leads, churn signals, oportunidades)

> La IA se entrena con los datos y feedback del cliente específico.

### Capa 5: Experiencia (moldeable por rol)
- Dashboard CEO: KPIs de negocio, ROI, pipeline value
- Dashboard VP Ventas: gestión de equipo, asignaciones, forecasting
- Dashboard SDR: leads del día, acciones pendientes, scripts
- Vistas custom por industria (métricas específicas del vertical)

> Cada persona ve exactamente lo que necesita, nada más.

---

## Proceso de Implementación SAASTRE

### Fase 1: Descubrimiento (Semana 1)
```
INPUT:  Reunión con el cliente
OUTPUT: Documento de configuración SAASTRE

- Cuál es su proceso de ventas actual?
- Qué CRM usan (o no)?
- Cuál es su ICP (cliente ideal)?
- Qué industrias atacan?
- Cuántos vendedores tienen?
- Qué métricas les importan?
- Qué compliance necesitan?
```

### Fase 2: Moldeado (Semana 2)
```
INPUT:  Documento de configuración
OUTPUT: Instancia SAASTRE configurada

- Crear organización en Clerk
- Configurar ICP Engine con criterios del cliente
- Activar workflows relevantes del catálogo
- Personalizar templates de outreach
- Configurar dashboard por roles del cliente
- Conectar fuentes de datos de su industria
```

### Fase 3: Horneado (Semana 3)
```
INPUT:  Instancia configurada
OUTPUT: Aplicación en producción con datos reales

- Cargar leads iniciales (importación o scraping)
- Ejecutar primer ciclo de scoring
- Validar datos con el cliente
- Ajustar pesos y thresholds
- Go-live con equipo completo
```

### Fase 4: Refinamiento (Continuo)
```
INPUT:  Uso real + feedback
OUTPUT: Aplicación cada vez más precisa

- Analizar tasas de conversión por score
- Ajustar scoring con resultados reales
- Agregar/quitar workflows según necesidad
- Evolucionar dashboard con métricas que emergen
- Reportes mensuales de impacto
```

---

## Diferenciadores Competitivos de SAASTRE

| vs. Competidor | Ventaja SAASTRE |
|----------------|-----------------|
| HubSpot/Salesforce | Se adapta al proceso, no al revés. Datos chilenos nativos. |
| Apollo/ZoomInfo | Datos locales (SII, LinkedIn Chile). Ley 21.719 nativa. |
| Consultoras de ventas | Software vivo, no un PDF de recomendaciones. |
| Desarrollo custom | Semanas, no meses. Metodología probada, no reinvención. |
| Otros SaaS de ventas | No es "one-size-fits-all". Cada instancia es única. |

---

## Modelo de Negocio SAASTRE

```
Setup:        $0 (trial 14 días con datos reales del cliente)
Plan Base:    Pipeline + Dashboard + 3 workflows → $X CLP/mes
Plan Growth:  + Scoring IA + Outreach automatizado → $Y CLP/mes
Plan Enterprise: + Integraciones CRM + API + SLA → $Z CLP/mes

Valor para el cliente: "Menos leads, más cierres"
Valor para Sisteco:    Cada cliente es una instancia configurable, no código custom
```

---

## Stack Técnico de SAASTRE

```
Infraestructura:  Convex (DB reactiva) + Vercel (serverless) + n8n (workflows)
Auth:             Clerk (multi-tenant, multi-rol)
IA:               Gemini (scoring) + Claude (desarrollo)
Datos Chile:      SII + LinkedIn + fuentes por vertical
Compliance:       Ley 21.719 nativa
Frontend:         HTML/CSS/JS vanilla + GSAP + Lucide
Pagos:            Reveniu (CLP)
```

---

## Visión a Largo Plazo

```
2026 H1:  Metodología SAASTRE definida + primeros 3-10 clientes Chile
2026 H2:  Catálogo de 20+ workflows componibles + refinamiento con datos reales
2027 H1:  SAASTRE como plataforma self-service (clientes configuran solos)
2027 H2:  Expansión LATAM (Colombia, Perú, México)
2028+:    API SAASTRE — terceros construyen sobre nuestra capa de datos
```

---

*"No vendemos software. Vendemos la capacidad de moldear ventas inteligentes
a la medida exacta de tu negocio."*

---
*Creado: 2026-03-27 — Pivote estratégico a SAASTRE*
