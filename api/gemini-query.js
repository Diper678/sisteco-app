/**
 * api/gemini-query.js — Vercel Serverless Function
 * Gemini NL fallback proxy for the Sisteco command bar.
 *
 * Accepts: POST { userQuery, roleContext, metricas }
 *   - userQuery    : string  — free-text query from the user
 *   - roleContext  : string  — "ceo" | "vp" | "sdr"
 *   - metricas     : object  — AGGREGATED metrics only (counts, %, dates)
 *                              NEVER include PII (email, telefono, nombre, RUT)
 *
 * Returns: { titulo, valor, unidad, narrativa } | { error }
 *
 * Rate limit: max 20 calls/hour per org (in-memory, resets on cold start).
 */

// Sentry error monitoring
require("../instrument");
const Sentry = require("@sentry/node");

// In-memory rate limit store: orgId -> { count, windowStart }
const rateLimitStore = {};
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(orgId) {
  const now = Date.now();
  const entry = rateLimitStore[orgId];

  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore[orgId] = { count: 1, windowStart: now };
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[gemini-query] GEMINI_API_KEY not set');
    return res.status(500).json({ error: 'Servicio de IA no configurado. Contacta al administrador.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Solicitud invalida.' });
  }

  const { userQuery, roleContext, metricas, orgId } = body || {};

  if (!userQuery || typeof userQuery !== 'string' || userQuery.trim().length === 0) {
    return res.status(400).json({ error: 'La consulta no puede estar vacia.' });
  }

  // Validate roleContext
  const validRoles = ['ceo', 'vp', 'sdr'];
  const safeRole = validRoles.includes(roleContext) ? roleContext : 'ceo';

  // Rate limit check (use orgId if provided, fallback to role as key)
  const rateLimitKey = orgId || safeRole;
  if (!checkRateLimit(rateLimitKey)) {
    return res.status(429).json({
      error: 'Limite de consultas alcanzado. Intenta en unos minutos.',
      titulo: 'Limite alcanzado',
      valor: '20/hora',
      unidad: 'consultas',
      narrativa: 'Has alcanzado el maximo de 20 consultas por hora. Intenta nuevamente mas tarde.'
    });
  }

  // Sanitize metricas: only allow aggregated numeric/string fields
  // NEVER forward individual lead data (PII: nombre, email, telefono, rut)
  const PII_FIELDS = ['nombre', 'email', 'telefono', 'tel', 'rut', 'empresa_rut', 'linkedin', 'cargo', 'ciudad'];
  let safeMetricas = {};
  if (metricas && typeof metricas === 'object') {
    for (const [key, value] of Object.entries(metricas)) {
      const lowerKey = key.toLowerCase();
      const isPII = PII_FIELDS.some(pii => lowerKey.includes(pii));
      // Only include simple numeric or short string values (not arrays of objects)
      if (!isPII && (typeof value === 'number' || typeof value === 'boolean' ||
          (typeof value === 'string' && value.length < 100))) {
        safeMetricas[key] = value;
      }
    }
  }

  // Role label for prompt
  const roleLabels = { ceo: 'CEO / Director General', vp: 'VP de Ventas', sdr: 'Ejecutivo de Ventas (SDR)' };
  const roleLabel = roleLabels[safeRole] || safeRole;

  // Build Gemini prompt
  const prompt = `Eres un asistente de ventas B2B chileno para el rol de ${roleLabel}.
Solo tienes acceso a metricas agregadas del pipeline de ventas. Nunca tienes datos de contacto individuales.
Metricas del pipeline: ${JSON.stringify(safeMetricas)}
Pregunta del usuario: "${userQuery.trim()}"
Responde en JSON con este formato exacto (sin texto adicional fuera del JSON):
{ "titulo": "string (titulo corto de la respuesta, maximo 6 palabras)",
  "valor": "string (dato duro principal, ej: '42%' o '18 leads' o 'Construccion')",
  "unidad": "string (unidad del valor, ej: '%', 'leads', 'CLP', 'empresas', 'dias')",
  "narrativa": "string (1-2 oraciones interpretativas en espanol chileno, basadas en las metricas)" }`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let geminiResponse;
  try {
    geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 512
        }
      })
    });
  } catch (fetchErr) {
    Sentry.captureException(fetchErr);
    console.error('[gemini-query] Fetch error:', fetchErr.message);
    return res.status(502).json({ error: 'No pude conectar con el servicio de IA. Intenta nuevamente.' });
  }

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text().catch(() => '');
    console.error('[gemini-query] Gemini API error:', geminiResponse.status, errText.slice(0, 200));
    return res.status(502).json({ error: 'El servicio de IA no pudo procesar tu consulta. Intenta reformular.' });
  }

  let data;
  try {
    data = await geminiResponse.json();
  } catch (e) {
    return res.status(502).json({ error: 'Respuesta inesperada del servicio de IA.' });
  }

  // Extract text from Gemini response
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error('[gemini-query] Empty Gemini response:', JSON.stringify(data).slice(0, 200));
    return res.status(502).json({ error: 'No pude procesar tu consulta. Intenta reformular.' });
  }

  // Parse structured JSON response
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    // Try to extract JSON from the text if it contains extra content
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error('[gemini-query] JSON parse error:', rawText.slice(0, 300));
        return res.status(200).json({ error: 'No pude procesar tu consulta. Intenta reformular.' });
      }
    } else {
      return res.status(200).json({ error: 'No pude procesar tu consulta. Intenta reformular.' });
    }
  }

  // Validate response shape
  const { titulo, valor, unidad, narrativa } = parsed;
  if (!titulo || !valor || !narrativa) {
    return res.status(200).json({ error: 'No pude procesar tu consulta. Intenta reformular.' });
  }

  // Return clean structured response
  return res.status(200).json({
    titulo: String(titulo).slice(0, 80),
    valor: String(valor).slice(0, 50),
    unidad: String(unidad || '').slice(0, 30),
    narrativa: String(narrativa).slice(0, 300)
  });
};
