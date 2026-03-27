# Sisteco / SAASTRE — Knowledge Transfer Hub

> Version 2.0 · Marzo 2026
> Esta carpeta contiene todo el conocimiento institucional de Sisteco y la metodologia SAASTRE.
> Es portable: copiala completa al inicio de cualquier proyecto nuevo.

---

## Indice de carpetas

| Carpeta | Contenido |
|---------|-----------|
| `empresa/` | Identidad, marca, vision, capacidades, contacto |
| `financiero/` | Estrategia de precios, planes, margenes, proyecciones |
| `tech-stack/` | Stack tecnologico, arquitectura, variables de entorno, migraciones |
| `integraciones/` | Workflows n8n construidos, procesadores de pago, terceros |
| `landing-page/` | Estructura de paginas, mejoras realizadas, patrones UI |
| `skills/` | Skills de Claude Code disponibles (GSD, UI/UX, n8n, Claude API, etc.) |
| `mcps/` | MCPs configurados y como usarlos (Firecrawl, Perplexity, Playwright, IDE) |
| `roadmap/` | Estado actual del proyecto, pendientes, proximas fases |
| `docs/` | Metodologia SAASTRE, workflows, compliance, specs |

---

## Contexto esencial (lee esto primero)

**Que es Sisteco:** Empresa B2B que opera con la metodologia **SAASTRE** (Sales-As-A-Service Tailored Runtime Environment). No vendemos un producto fijo — creamos aplicaciones de ventas que se comportan como **arcilla inteligente**, totalmente adaptables a la necesidad de cada cliente dentro del dominio de ventas B2B. Nuestro modelo: bajo volumen de leads, alta conversion.

**Que es SAASTRE:** La metodologia propietaria de Sisteco. 5 capas (Infraestructura → Datos → Workflows → Inteligencia → Experiencia). Cada cliente obtiene su propia instancia configurada a su proceso de ventas, industria y equipo. Ver `docs/SAASTRE-METODOLOGIA.md`.

**Frase clave:** "Menos leads, mas cierres."

**Stack principal:** HTML/CSS/JS frontend · Vercel serverless API · Convex (DB reactiva) · Clerk (auth) · n8n self-hosted · Claude Code (sistemas)

**Deploy:** `npx vercel --prod` desde la raiz del proyecto landing page

**Dev local:** `npm start` → http://localhost:3000

**Contacto empresa:**
- Email: contacto@sisteco.cl
- Tel: +56 9 40065566
- Direccion: Av. Alonso de Cordova 5870 Of. 413, Las Condes, Santiago de Chile
- LinkedIn: https://www.linkedin.com/company/sisteco/

---

## Como usar esta carpeta en un proyecto nuevo

1. Copia toda la carpeta `sisteco-knowledge/` a la raiz del nuevo proyecto
2. Al inicio de la sesion con Claude Code, menciona: "Lee sisteco-knowledge/README.md para contexto completo de la empresa"
3. Segun la tarea, referencia el documento especifico: `@sisteco-knowledge/empresa/IDENTIDAD_MARCA.md`
4. Las skills y MCPs se configuran a nivel de usuario de Claude Code, no por proyecto

---

## Equipo fundador

| Nombre | Rol |
|--------|-----|
| Felipe Martinez | CEO / Fundador — vision estrategica, agentes autonomos |
| Cristian Martinez G. | CTO — arquitectura tecnica |
| Jhonatan Ramirez G. | COO — operaciones y procesos |

---

*Actualizado: 2026-03-04*
