#!/usr/bin/env node
/**
 * google-auth.js — OAuth2 flow for Google Workspace
 * Stores credentials as plain JSON that works in any environment.
 *
 * Usage: node scripts/google-auth.js
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/documents',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email'
];

const CONFIG_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'gws');
const CREDS_FILE = path.join(CONFIG_DIR, 'credentials.json');

function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)); }
        catch { resolve(responseData); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Start local server to receive OAuth callback
  const server = http.createServer();

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const port = server.address().port;
  const redirectUri = `http://localhost:${port}`;

  const authUrl = `https://accounts.google.com/o/oauth2/auth?` +
    `scope=${encodeURIComponent(SCOPES.join(' '))}` +
    `&access_type=offline` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&client_id=${CLIENT_ID}` +
    `&prompt=select_account+consent`;

  console.log('\n=== Google Workspace Auth ===\n');

  // Write HTML redirect file and open it (avoids URL encoding issues with Windows shells)
  const htmlPath = path.join(__dirname, '..', 'google-auth-redirect.html');
  fs.writeFileSync(htmlPath, `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${authUrl}"></head><body><p>Redirigiendo a Google...</p><a href="${authUrl}">Click aqui si no redirige</a></body></html>`);

  const { exec } = require('child_process');
  exec(`cmd.exe /c start "" "${htmlPath.replace(/\//g, '\\')}"`, (err) => {
    if (err) {
      console.log('No se pudo abrir el navegador. Abre este archivo manualmente:');
      console.log(htmlPath);
    }
  });
  console.log('Navegador abierto. Esperando autorizacion (5 min max)...\n');

  // Wait for callback
  const code = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timeout esperando autorizacion (3 minutos)'));
    }, 300000);

    server.on('request', async (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      const authCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Error: ${error}</h1><p>Cierra esta ventana.</p>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (authCode) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#F8F7F5;">
            <h1 style="color:#111;">Autorizado correctamente</h1>
            <p style="color:#666;">Puedes cerrar esta ventana.</p>
            <div style="font-size:48px;margin:20px;">✓</div>
          </body></html>
        `);
        clearTimeout(timeout);
        server.close();
        resolve(authCode);
      }
    });
  });

  console.log('Codigo recibido. Intercambiando por tokens...');

  // Exchange code for tokens
  const tokenResponse = await postRequest('https://oauth2.googleapis.com/token', {
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  if (tokenResponse.error) {
    console.error('Error al obtener tokens:', tokenResponse.error_description || tokenResponse.error);
    process.exit(1);
  }

  // Save credentials
  const credentials = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    token_type: tokenResponse.token_type,
    expiry_date: Date.now() + (tokenResponse.expires_in * 1000),
    scope: SCOPES.join(' '),
    created_at: new Date().toISOString()
  };

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(credentials, null, 2));

  console.log('\n=== Autenticacion exitosa ===');
  console.log(`Credenciales guardadas en: ${CREDS_FILE}`);
  console.log(`Scopes: ${SCOPES.length} servicios autorizados`);
  console.log(`Token expira en: ${tokenResponse.expires_in}s`);
  console.log(`Refresh token: ${tokenResponse.refresh_token ? 'SI' : 'NO'}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
