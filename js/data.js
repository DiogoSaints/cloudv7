// ============================================================
// CLOUDFLIX – Xtream Codes API Config + Data Layer
// Credentials are dynamically provided by js/api.js (chatbot).
// Falls back to static credentials if API hasn't loaded yet.
// All requests are routed through the Node.js proxy (/proxy),
// to bypass CORS restrictions on the Xtream streaming server.
// ============================================================

// Static fallback (used if chatbot API is unavailable)
const XTREAM_FALLBACK = {
  host: 'https://anax3.ca',
  user: '840867182',
  pass: '836706147',
};

// ── Proxy configuration (defined in api.js) ────────────────
// Use window.CLOUDFLIX_PROXY

// ── Internal proxy helpers ───────────────────────────────
const _isHosted = location.protocol === 'http:' || location.protocol === 'https:';

// For stream URLs: MUST always go through proxy on HTTPS
function forceProxyUrl(targetUrl) {
  if (!_isHosted || !CLOUDFLIX_PROXY) return targetUrl;
  return CLOUDFLIX_PROXY + '?url=' + encodeURIComponent(targetUrl);
}

// For API calls: use proxy if configured, else try direct
function proxyUrl(targetUrl) {
  const proxy = window.CLOUDFLIX_PROXY;
  const safeUrl = forceHttps(targetUrl);
  if (!_isHosted || !proxy) return safeUrl;
  return proxy + '?url=' + encodeURIComponent(safeUrl);
}

// Global utility to force HTTPS and remove problematic port 80
function forceHttps(url) {
  if (!url) return '';
  // 1. Force https protocol
  let s = url.replace(/^http:\/\//i, 'https://');
  // 2. If it's https, port 80 is invalid and causes ERR_SSL_PROTOCOL_ERROR. Remove it.
  // Matches ":80" or ":80/" at the end of hostname or before the path
  s = s.replace(/([a-zA-Z0-9.-]+):80(\/|$)/, '$1$2');
  return s;
}




// Resolve current creds: dynamic (from chatbot) or static fallback
function getXtreamCreds() {
  const creds = (typeof getCloudflixCreds === 'function') ? getCloudflixCreds() : null;
  if (creds && creds.host && creds.username && creds.password) {
    return { host: creds.host, user: creds.username, pass: creds.password };
  }
  return XTREAM_FALLBACK;
}

// XTREAM object – always resolves current creds on use
const XTREAM = {
  get host() { return getXtreamCreds().host; },
  get user() { return getXtreamCreds().user; },
  get pass() { return getXtreamCreds().pass; },

  api(action, extra = '') {
    const c = getXtreamCreds();
    const raw = `${c.host}/player_api.php?username=${c.user}&password=${c.pass}&action=${action}${extra}`;
    return proxyUrl(raw);
  },
  liveUrl(streamId) {
    const c = getXtreamCreds();
    const raw = `${c.host}/live/${c.user}/${c.pass}/${streamId}.m3u8`;
    return forceProxyUrl(raw);         // always proxy – HTTPS site + HTTP stream
  },
  vodUrl(streamId, ext = 'mp4') {
    const c = getXtreamCreds();
    const raw = `${c.host}/movie/${c.user}/${c.pass}/${streamId}.${ext}`;
    return forceProxyUrl(raw);
  },
  seriesEpUrl(streamId, ext = 'mp4') {
    const c = getXtreamCreds();
    const raw = `${c.host}/series/${c.user}/${c.pass}/${streamId}.${ext}`;
    return forceProxyUrl(raw);
  },
};


// Clean category names (remove emoji/prefix)
function cleanCat(name) {
  return name
    .replace(/^(Canais|Filmes|Series|Séries|Colecao|Coleção)\s*\|?\s*/i, '')
    .replace(/[★⭐✨⚽⛹️🏆📺🎬🎭]/g, '')
    .trim();
}

// ── In-memory cache ──────────────────────────────────────
const CACHE = {
  liveCategories: null,
  vodCategories: null,
  seriesCategories: null,
  liveStreams: {},  // keyed by category_id
  vodStreams: {},
  seriesList: {},
  allSeries: null,
  details: {}, // New: cache for getSeriesInfo/getVodInfo
};

// ── Request throttle (prevent 429 by spacing requests) ───
let _lastRequestTime = 0;
const REQUEST_DELAY = 500; // ms between requests (avoid 429 rate limit)

async function _throttle() {
  const now = Date.now();
  const elapsed = now - _lastRequestTime;
  if (elapsed < REQUEST_DELAY) {
    await new Promise(r => setTimeout(r, REQUEST_DELAY - elapsed));
  }
  _lastRequestTime = Date.now();
}

// ── Fetch helpers (with 429 retry) ───────────────────────
async function apiGet(url, _retries = 3) {
  await _throttle();
  try {
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Accept': 'application/json' },
    });

    // Handle rate limiting with exponential backoff
    if (res.status === 429 && _retries > 0) {
      const wait = (4 - _retries) * 1500; // 1.5s, 3s, 4.5s
      console.warn(`[CLOUDFLIX API] Rate limited (429). Retrying in ${wait}ms... (${_retries} left)`);
      await new Promise(r => setTimeout(r, wait));
      return apiGet(url, _retries - 1);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (text.trimStart().startsWith('<')) {
      throw new Error('O servidor retornou uma página HTML em vez de JSON. Verifique se o backend Node.js está rodando corretamente.');
    }
    return JSON.parse(text);
  } catch (err) {
    console.error('[CLOUDFLIX API] Fetch failed:', url, err.message);
    throw new Error(`Falha ao conectar ao servidor. (${err.message})`);
  }
}


async function getLiveCategories() {
  if (CACHE.liveCategories) return CACHE.liveCategories;
  const data = await apiGet(XTREAM.api('get_live_categories'));
  CACHE.liveCategories = data;
  return data;
}

async function getVodCategories() {
  if (CACHE.vodCategories) return CACHE.vodCategories;
  const data = await apiGet(XTREAM.api('get_vod_categories'));
  CACHE.vodCategories = data;
  return data;
}

async function getSeriesCategories() {
  if (CACHE.seriesCategories) return CACHE.seriesCategories;
  const data = await apiGet(XTREAM.api('get_series_categories'));
  CACHE.seriesCategories = data;
  return data;
}

async function getLiveStreams(categoryId) {
  if (CACHE.liveStreams[categoryId]) return CACHE.liveStreams[categoryId];
  const data = await apiGet(XTREAM.api('get_live_streams', `&category_id=${categoryId}`));
  CACHE.liveStreams[categoryId] = data;
  return data;
}

async function getVodStreams(categoryId) {
  if (CACHE.vodStreams[categoryId]) return CACHE.vodStreams[categoryId];
  const data = await apiGet(XTREAM.api('get_vod_streams', `&category_id=${categoryId}`));
  CACHE.vodStreams[categoryId] = data;
  return data;
}

async function getSeriesList(categoryId) {
  if (CACHE.seriesList[categoryId]) return CACHE.seriesList[categoryId];
  const data = await apiGet(XTREAM.api('get_series', `&category_id=${categoryId}`));
  CACHE.seriesList[categoryId] = data;
  return data;
}

// ── GLOBAL FETCH (for Search) ───────────────────────────
async function getAllLive() {
  if (CACHE.allLive) return CACHE.allLive;
  const data = await apiGet(XTREAM.api('get_live_streams'));
  CACHE.allLive = data;
  return data;
}

async function getAllVod() {
  if (CACHE.allVod) return CACHE.allVod;
  const data = await apiGet(XTREAM.api('get_vod_streams'));
  CACHE.allVod = data;
  return data;
}

async function getAllSeries() {
  if (CACHE.allSeries) return CACHE.allSeries;
  const data = await apiGet(XTREAM.api('get_series'));
  CACHE.allSeries = data;
  return data;
}

async function getSeriesInfo(seriesId) {
  if (CACHE.details[`ser_${seriesId}`]) return CACHE.details[`ser_${seriesId}`];
  const data = await apiGet(XTREAM.api('get_series_info', `&series_id=${seriesId}`));
  CACHE.details[`ser_${seriesId}`] = data;
  return data;
}

async function getVodInfo(vodId) {
  if (CACHE.details[`vod_${vodId}`]) return CACHE.details[`vod_${vodId}`];
  const data = await apiGet(XTREAM.api('get_vod_info', `&vod_id=${vodId}`));
  CACHE.details[`vod_${vodId}`] = data;
  return data;
}

// ── Priority live categories to show on home ─────────────
const PRIORITY_LIVE_CATS = ['1', '119', '118', '8', '21', '3', '23', '10', '111', '4', '19', '15', '149'];
const PRIORITY_VOD_CATS = ['37', '142', '32', '41', '49', '34', '40', '35', '42', '47', '75', '74', '45', '46', '33'];
const PRIORITY_SER_CATS = ['51', '61', '62', '53', '60', '52', '63', '55', '69', '67', '72'];
