export default {
  async fetch(request, env) {
    // simple API key
    const key = request.headers.get('X-API-Key');
    if (!key || key !== env.API_KEY) return new Response('Unauthorized', { status: 401 });

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/ingest') {
      try {
        const { device, sensor, value, meta } = await request.json();
        if (!device || !sensor || value === undefined) {
          return new Response('Missing fields', { status: 400 });
        }
        const metaStr = meta ? JSON.stringify(meta) : null;
        await env.DB.prepare(
          'INSERT INTO readings (device, sensor, value, meta) VALUES (?1, ?2, ?3, ?4)'
        ).bind(device, sensor, Number(value), metaStr).run();

        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(`Bad Request: ${e}`, { status: 400 });
      }
    }

    // ใช้ดูข้อมูลล่าสุด
    if (request.method === 'GET' && url.pathname === '/latest') {
      const device = url.searchParams.get('device');
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 500);
      const sql = device
        ? 'SELECT * FROM readings WHERE device = ?1 ORDER BY id DESC LIMIT ?2'
        : 'SELECT * FROM readings ORDER BY id DESC LIMIT ?1';
      const res = device
        ? await env.DB.prepare(sql).bind(device, limit).all()
        : await env.DB.prepare(sql).bind(limit).all();
      return new Response(JSON.stringify(res.results ?? []), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
