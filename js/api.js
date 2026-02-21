// ============================================================
// CLOUDFLIX – Chatbot API Manager
// Generates temporary Xtream credentials (4h) via chatbot API.
// Auto-renews before expiry. Primary + fallback endpoints.
// Linked to user IP for security and session consistency.
// ============================================================

const CHATBOT_API = {
    primary: 'https://oneplaytop.com.br/api/chatbot/rdqLkVg1AE/bOxLAQLZ7a',
    fallback: 'https://oneplaytop.com.br/api/chatbot/rdqLkVg1AE/bOxLAQLZ7a',
    ttl: 4 * 60 * 60 * 1000, // 4 hours in ms
    renewBefore: 5 * 60 * 1000,   // renew 5 min before expiry
};

// Global Proxy Configuration (used by api.js and data.js)
window.CLOUDFLIX_PROXY = 'https://cloudflix.verticemkt.site/proxy';

// The active renew timer
let _renewTimer = null;

// ── Fetch User IP ──────────────────────────────────────────
async function _getUserIP() {
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip || '0.0.0.0';
    } catch (e) {
        console.warn('[CLOUDFLIX API] IP detection failed:', e.message);
        return '0.0.0.0';
    }
}

// ── Parse API response into { host, username, password } ──
function _parseCreds(data) {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) data = data[0];
    if (!data) return null;

    let host = data.host || data.url || data.server || data.server_url || data.base_url || null;
    const username = data.username || data.user || data.login || data.usuario || null;
    const password = data.password || data.pass || data.senha || data.passwd || null;

    if (!host || !username || !password) {
        console.warn('[CLOUDFLIX API] Incomplete creds in response:', JSON.stringify(data).slice(0, 200));
        return null;
    }

    // Force HTTPS when site is on HTTPS to avoid Mixed Content errors.
    // Most Xtream servers support HTTPS on the same host/port.
    if (location.protocol === 'https:') {
        host = host.replace(/^http:\/\//i, 'https://');
    }

    return {
        host: host.replace(/\/+$/, ''),
        username,
        password,
    };
}


// ── Fetch creds from one endpoint ─────────────────────────
// Routes through the Node.js proxy to bypass CORS restrictions.
const _apiIsHosted = location.protocol === 'http:' || location.protocol === 'https:';

function _proxyApiUrl(rawUrl) {
    const proxy = window.CLOUDFLIX_PROXY;
    const safeUrl = typeof forceHttps === 'function' ? forceHttps(rawUrl) : rawUrl.replace(/^http:\/\//i, 'https://');
    if (!_apiIsHosted || !proxy) return safeUrl;
    return proxy + '?url=' + encodeURIComponent(safeUrl);
}

async function _fetchFromEndpoint(rawUrl) {
    const url = _proxyApiUrl(rawUrl);
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('<')) throw new Error('Proxy returned HTML – possible backend error');
    return _parseCreds(JSON.parse(text));
}




// ── Fetch creds (primary, then fallback) ──────────────────
async function _fetchCreds() {
    try {
        const creds = await _fetchFromEndpoint(CHATBOT_API.primary);
        if (creds) return creds;
    } catch (e) {
        console.warn('[CLOUDFLIX API] Primary failed:', e.message);
    }
    try {
        const creds = await _fetchFromEndpoint(CHATBOT_API.fallback);
        if (creds) return creds;
    } catch (e) {
        console.warn('[CLOUDFLIX API] Fallback failed:', e.message);
    }
    return null;
}

// ── Store creds in sessionStorage + window ─────────────────
function _storeCreds(creds, ip) {
    const record = {
        ...creds,
        userIp: ip,
        expiresAt: Date.now() + CHATBOT_API.ttl,
    };
    sessionStorage.setItem('cloudflix_creds', JSON.stringify(record));
    window.CLOUDFLIX_CREDS = record;
    console.log(`[CLOUDFLIX API] Credentials linked to IP ${ip}. Expires: ${new Date(record.expiresAt).toLocaleTimeString()}`);
}

// ── Load creds from sessionStorage (if still valid) ────────
function _loadStoredCreds(currentIp) {
    try {
        const raw = sessionStorage.getItem('cloudflix_creds');
        if (!raw) return null;
        const record = JSON.parse(raw);

        // 1. Check IP mismatch
        if (currentIp !== '0.0.0.0' && record.userIp !== currentIp) {
            console.log('[CLOUDFLIX API] IP change detected. Requesting new credentials.');
            return null;
        }

        // 2. Check not expired (with 5min buffer)
        if (record.expiresAt - Date.now() > CHATBOT_API.renewBefore) {
            window.CLOUDFLIX_CREDS = record;
            return record;
        }
        return null;
    } catch (e) { return null; }
}

// ── Schedule the next renewal ──────────────────────────────
function _scheduleRenewal(creds) {
    if (_renewTimer) clearTimeout(_renewTimer);

    const msUntilRenew = Math.max(0, (creds.expiresAt - Date.now()) - CHATBOT_API.renewBefore);
    console.log(`[CLOUDFLIX API] Next auto-renewal in ${Math.round(msUntilRenew / 60000)} min for IP ${creds.userIp}.`);

    _renewTimer = setTimeout(async () => {
        console.log('[CLOUDFLIX API] Periodic 4h renewal started...');
        if (typeof CACHE !== 'undefined') {
            Object.keys(CACHE).forEach(k => CACHE[k] = null); // Reset all cache
            CACHE.liveStreams = {}; CACHE.vodStreams = {}; CACHE.seriesList = {};
        }
        await initCloudflixAccess();
    }, msUntilRenew);
}

// ── Public: Initialize access ──────────────────────────────
window.initCloudflixAccess = async function () {
    // Chatbot API is offline (405). Skip entirely – fallback creds in data.js handle it.
    console.log('[CLOUDFLIX] Sistema de acesso pronto (modo estático ativado).');
    return null;
};

// ── Public: Get active creds ───────────────────────────────
window.getCloudflixCreds = function () {
    return window.CLOUDFLIX_CREDS || (sessionStorage.getItem('cloudflix_creds') ? JSON.parse(sessionStorage.getItem('cloudflix_creds')) : null);
};

