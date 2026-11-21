export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Health check & status endpoint
    if (url.pathname === '/healthz' || url.pathname === '/api/worker-status') {
      let activeTarget = null;
      if (env.ITHIPOORAM_CONFIG) {
        try {
          activeTarget = await env.ITHIPOORAM_CONFIG.get('ACTIVE_TUNNEL_URL');
        } catch (e) {}
      }
      return new Response(JSON.stringify({ 
        status: 'ONLINE', 
        service: 'Ithi Pooram Customer Table QR Proxy',
        activeTarget: activeTarget || 'NOT_CONFIGURED',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Secret endpoint called by the laptop on startup/watchdog to register live tunnel URL
    if (url.pathname === '/api/update-tunnel') {
      const body = await request.json().catch(() => ({}));
      const secret = body.secret || url.searchParams.get('secret');

      if (secret !== env.AUTH_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const targetUrl = (body.targetUrl || url.searchParams.get('targetUrl') || '').trim().replace(/\/$/, '');
      if (!targetUrl || !targetUrl.startsWith('http')) {
        return new Response('Missing valid targetUrl', { status: 400 });
      }

      if (env.ITHIPOORAM_CONFIG) {
        await env.ITHIPOORAM_CONFIG.put('ACTIVE_TUNNEL_URL', targetUrl);
      }

      return new Response(JSON.stringify({ success: true, activeTarget: targetUrl }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Proxy all customer orders and menu requests to the active laptop tunnel
    let activeTarget = null;
    if (env.ITHIPOORAM_CONFIG) {
      try {
        activeTarget = await env.ITHIPOORAM_CONFIG.get('ACTIVE_TUNNEL_URL');
      } catch (e) {}
    }

    function returnErrorOrConnecting(msg, httpStatus = 503) {
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
          error: 'POS Server is syncing, please retry in 2 seconds...',
          message: msg,
          retry: true
        }), {
          status: httpStatus,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '2',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      return renderConnectingPage(msg);
    }

    if (!activeTarget) {
      return returnErrorOrConnecting('Starting Up Counter Connection...');
    }

    try {
      const destination = new URL(url.pathname + url.search, activeTarget);
      const newHeaders = new Headers(request.headers);
      newHeaders.set('x-forwarded-host', url.host);

      const response = await fetch(new Request(destination.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow',
      }));

      // If upstream Cloudflare Tunnel returns 530 (Origin DNS Error / Error 1016 / Error 1033)
      if (response.status === 530 || response.status === 502 || response.status === 504) {
        return returnErrorOrConnecting('Establishing Fast Counter Tunnel...');
      }

      return response;
    } catch (err) {
      // Caught network/DNS failure - never show raw Error 1016 to customers!
      return returnErrorOrConnecting('Reconnecting to Counter POS...');
    }
  },
};

function renderConnectingPage(statusMessage) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <meta http-equiv="refresh" content="3"/>
  <title>ഇത്തിപ്പൂരം (ITHI POORAM) - Menu</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #fafafa;
      color: #1c1917;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
      text-align: center;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e7e5e4;
      border-radius: 28px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .brand-mal {
      font-size: 26px;
      font-weight: 900;
      color: #0c0a09;
      margin-bottom: 2px;
      letter-spacing: -0.5px;
    }
    .brand-eng {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #78716c;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3.5px solid #f5f5f4;
      border-top-color: #d97706;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px auto;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-title {
      font-size: 15px;
      font-weight: 800;
      color: #292524;
      margin-bottom: 6px;
    }
    .status-desc {
      font-size: 12px;
      color: #78716c;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      color: #92400e;
    }
  </style>
  <script>
    setTimeout(function() { window.location.reload(); }, 2500);
  </script>
</head>
<body>
  <div class="card">
    <div class="brand-mal">ഇത്തിപ്പൂരം</div>
    <div class="brand-eng">ITHI POORAM</div>
    <div class="spinner"></div>
    <div class="status-title">Opening Menu &amp; Ordering...</div>
    <div class="status-desc">Connecting to restaurant counter live server. This screen will automatically open the menu in 2 seconds.</div>
    <div class="badge">Auto-Refreshing live...</div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
