// ============================================================
// CLOUDFLIX – Node.js Proxy Server (native fetch, Node 22+)
// ============================================================

const express = require('express');
const path = require('path');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

process.on('uncaughtException', e => console.error('[!]', e.message));
process.on('unhandledRejection', e => console.error('[!]', e));

// ── Cache for API/JSON only ──────────────────────────────
const cache = new Map();
const TTL_META = 3600000; // 1 hour for metadata/lists
const TTL_LIVE = 120000;  // 2 minutes for manifests (tokens expire)

function cached(k) {
    const e = cache.get(k);
    if (!e) return null;
    const ttl = k.includes('.m3u8') ? TTL_LIVE : TTL_META;
    if (Date.now() - e.t > ttl) { cache.delete(k); return null; }
    return e;
}
function putCache(k, ct, buf) {
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    cache.set(k, { t: Date.now(), ct, buf });
}

// ── Whitelist ────────────────────────────────────────────
const ALLOWED = ['anax3.ca', 'oneplaytop.com.br', 'image.tmdb.org', 'images.tmdb.org', 'api.ipify.org'];
function ok(h) {
    if (!h) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
    return ALLOWED.some(d => h === d || h.endsWith('.' + d));
}

function cors(res) {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': '*',
    });
}

// Detect if URL is a stream segment (even without .ts extension)
function isStreamUrl(url) {
    // .ts files
    if (/\.ts(\?|$)/i.test(url)) return true;
    // HLS auth/segment URLs from streaming IPs (contain /hls/ or /auth/)
    if (/\/(hls|auth)\//i.test(url)) return true;
    return false;
}

// ── Proxy (BEFORE static files) ──────────────────────────
app.options('/proxy', (_, res) => { cors(res); res.sendStatus(204); });

app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    let host;
    try { host = new URL(url).hostname; } catch { return res.status(400).json({ error: 'Bad URL' }); }
    if (!ok(host)) return res.status(403).json({ error: 'Blocked' });

    cors(res);

    const isM3u8 = url.includes('.m3u8');
    const isVideo = /\.(mp4|mkv|avi|mov|wmv)/i.test(url);
    const isSegment = isStreamUrl(url);

    // Only cache API (JSON) responses - never cache streams/segments/images
    const isCacheable = !isM3u8 && !isVideo && !isSegment && url.includes('player_api.php');
    if (isCacheable) {
        const c = cached(url);
        if (c) {
            if (c.ct) res.set('Content-Type', c.ct);
            return res.status(200).send(c.buf);
        }
    }

    const origin = new URL(url).origin;
    const fetchOpts = {
        redirect: 'follow', // Follow redirects for initial manifest/api calls
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Referer': origin + '/',
            'Origin': origin,
            'Connection': 'keep-alive'
        },
        // Increased timeout for media streams/segments
        signal: AbortSignal.timeout(isVideo || isSegment ? 3600000 : 30000),
    };

    if (req.headers.range) fetchOpts.headers['Range'] = req.headers.range;

    try {
        let resp;
        let retries = 2;
        while (retries >= 0) {
            resp = await fetch(url, fetchOpts);
            if (resp.status !== 429 || retries === 0) break;

            const wait = (3 - retries) * 2000;
            console.warn(`[proxy] Upstream 429 for ${host}. Retrying in ${wait}ms...`);
            await new Promise(r => setTimeout(r, wait));
            retries--;
        }

        // ── M3U8: Fast Rewriting ──
        if (isM3u8) {
            const body = await resp.text();
            if (body.trimStart().startsWith('<')) {
                return res.status(404).json({ error: 'Stream offline' });
            }

            const effectiveUrl = resp.url;
            const proxyBase = '/proxy';

            // Optimized regex: target only lines that don't start with '#'
            const rewritten = body.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return line;

                let full;
                try {
                    full = trimmed.startsWith('http') ? trimmed : new URL(trimmed, effectiveUrl).href;
                    return `${proxyBase}?url=${encodeURIComponent(full)}`;
                } catch (e) {
                    return line;
                }
            }).join('\n');

            res.set('Content-Type', 'application/vnd.apple.mpegurl');
            return res.status(200).send(rewritten);
        }

        const ct = (resp.headers.get('content-type') || '').split(';')[0].toLowerCase();
        const isActuallyStream = isSegment || ct.startsWith('video/') || ct.includes('mpegurl') || ct.includes('octet-stream');

        // ── Stream / Segment / Large file: PIPE directly ──
        if (isActuallyStream) {
            // Forward critical headers for VOD/Streaming stability
            if (ct) res.set('Content-Type', ct);
            if (resp.headers.get('content-range')) res.set('Content-Range', resp.headers.get('content-range'));
            if (resp.headers.get('content-length')) res.set('Content-Length', resp.headers.get('content-length'));
            if (resp.headers.get('accept-ranges')) res.set('Accept-Ranges', resp.headers.get('accept-ranges'));
            else if (isVideo) res.set('Accept-Ranges', 'bytes');

            res.status(resp.status);

            if (resp.body) {
                const reader = Readable.fromWeb(resp.body);
                reader.on('error', (e) => {
                    console.error('[proxy] Stream Error:', e.message);
                    reader.destroy();
                });
                reader.pipe(res);
                req.on('close', () => {
                    try { reader.destroy(); } catch (e) { }
                });
            } else {
                res.end();
            }
            return;
        }

        // ── API / JSON / Small assets: buffer and optionally cache ──
        const buf = Buffer.from(await resp.arrayBuffer());

        // Only cache JSON API responses
        if (isCacheable && resp.status === 200) putCache(url, ct, buf);

        res.set('Content-Type', ct || 'application/octet-stream');
        console.log('[proxy] ✓', resp.status, buf.length, 'bytes');
        return res.status(resp.status).send(buf);

    } catch (err) {
        console.error('[proxy] ✗', err.message);
        if (!res.headersSent) res.status(502).json({ error: err.message });
    }

});

// ── Static files ─────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
    extensions: ['html'],
    index: 'index.html',
    setHeaders: (res, p) => {
        if (/\.(js|css)$/i.test(p)) res.set('Cache-Control', 'no-store');
    },
}));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, req.path), err => {
        if (err && !res.headersSent) res.sendFile(path.join(__dirname, 'index.html'));
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`[CLOUDFLIX] Port ${PORT}`));
