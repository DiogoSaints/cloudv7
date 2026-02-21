// ============================================================
// CLOUDFLIX – Home JS (Dynamic Xtream API)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const user = requireAuth();
    if (!user) return;

    // Initialize API access (fetches Xtream credentials via chatbot API)
    if (typeof initCloudflixAccess === 'function') {
        try {
            await initCloudflixAccess();
        } catch (e) {
            console.warn('[Home] API init failed:', e);
        }
    }

    // Set user info
    document.getElementById('user-initial').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;

    // Header solid on scroll
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => header.classList.toggle('solid', window.scrollY > 50));

    // Nav filter clicks
    document.querySelectorAll('.nav-link[data-filter]').forEach(link => {
        link.addEventListener('click', () => {
            document.querySelectorAll('.nav-link[data-filter]').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update mobile chips too
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            const chip = document.querySelector(`.filter-chip[data-filter="${link.dataset.filter}"]`);
            if (chip) chip.classList.add('active');

            setFilter(link.dataset.filter);
        });
    });

    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            // Update desktop nav
            document.querySelectorAll('.nav-link[data-filter]').forEach(l => l.classList.remove('active'));
            const link = document.querySelector(`.nav-link[data-filter="${chip.dataset.filter}"]`);
            if (link) link.classList.add('active');

            setFilter(chip.dataset.filter);
        });
    });

    // Search
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const searchIcon = document.getElementById('search-icon');

    // Search - Click on container to open
    searchBar.addEventListener('click', (e) => {
        if (e.target === searchInput) return; // Don't toggle when clicking input itself

        searchBar.classList.toggle('open');
        if (searchBar.classList.contains('open')) {
            setTimeout(() => searchInput.focus(), 100);
        } else {
            closeSearch();
        }
    });

    searchInput.addEventListener('input', e => {
        const q = e.target.value.trim();
        if (q.length > 1) doSearch(q);
        else closeSearch();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeSearch();
            searchBar.classList.remove('open');
            searchInput.value = '';
        }
    });

    // Avatar menu
    const avatarBtn = document.getElementById('avatar-btn');
    const userMenu = document.getElementById('user-menu');
    avatarBtn.addEventListener('click', e => { e.stopPropagation(); userMenu.classList.toggle('open'); });
    document.addEventListener('click', () => userMenu.classList.remove('open'));

    // Load home
    await loadHome('all');

    // Start Hero Carousel
    initHeroCarousel();

    // Background: Load all data for search (non-blocking)
    initSearchData();
});

async function initSearchData() {
    try {
        // Load search data SEQUENTIALLY with delays to avoid 429
        await new Promise(r => setTimeout(r, 5000));
        await getAllLive();
        await new Promise(r => setTimeout(r, 3000));
        await getAllVod();
        await new Promise(r => setTimeout(r, 3000));
        await getAllSeries();
    } catch (e) {
        console.warn('Search background load failed', e);
    }
}

let currentFilter = 'all';

async function setFilter(filter) {
    currentFilter = filter;
    await loadHome(filter);
    if (filter === 'all') initHeroCarousel();
}

// ── HERO CAROUSEL ──────────────────────────────────────────
let heroInterval = null;
const heroSlides = [
    {
        title: "Deadpool & Wolverine",
        badge: "🔥 Super Lançamento",
        desc: "O mercenário tagarela se une ao mutante mais ranzinza do cinema em uma aventura insana pelo multiverso.",
        bg: "https://image.tmdb.org/t/p/w1280/h8gH9uJaY91vS9uLp9vVqyTSU6w.jpg",
        gradient: "linear-gradient(135deg, #1a0000 0%, #8b0000 50%, #ff6600 85%, #ffcc00 100%)",
        search: "Deadpool",
        type: "vod"
    },
    {
        title: "Gladiador II",
        badge: "⭐ Sucesso Mundial",
        desc: "Anos após presenciar a morte de Maximus, Lucius é forçado a entrar no Coliseu para lutar pelo futuro de Roma.",
        bg: "https://image.tmdb.org/t/p/w1280/6v76YVOS6u2ufoi9Irjqr964S9t.jpg",
        gradient: "linear-gradient(135deg, #0d0800 0%, #5c3d00 50%, #c49a00 80%, #e8c84a 100%)",
        search: "Gladiador",
        type: "vod"
    },
    {
        title: "A Casa do Dragão",
        badge: "🎬 Série Épica",
        desc: "A história da família Targaryen, 200 anos antes dos eventos de Game of Thrones, em uma guerra civil brutal.",
        bg: "https://image.tmdb.org/t/p/w1280/et07S7XW2fNoGbeY3h42y7l78Xy.jpg",
        gradient: "linear-gradient(135deg, #000 0%, #1a0020 40%, #6b0040 75%, #cc0010 100%)",
        search: "Casa do Dragão",
        type: "series"
    },
    {
        title: "Stranger Things",
        badge: "👁️ Suspense & Ficção",
        desc: "Crianças investigam mistérios sobrenaturais em Hawkins. Uma série épica de suspense e ficção científica.",
        bg: "https://image.tmdb.org/t/p/w1280/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg",
        gradient: "linear-gradient(135deg, #000005 0%, #0a0030 45%, #600030 75%, #c00020 100%)",
        search: "Stranger Things",
        type: "series"
    }
];

// Search for content and play the first match, or open search overlay
async function heroSearch(slide) {
    const q = slide.search.toLowerCase();

    // Try to find a direct match in the library
    try {
        let found = null;

        if (slide.type === 'vod') {
            const vod = await getAllVod();
            found = vod && vod.find(s => s.name && s.name.toLowerCase().includes(q));
            if (found) { openPlayer(found, 'vod'); return; }
        } else if (slide.type === 'series') {
            const series = await getAllSeries();
            found = series && series.find(s => (s.name || s.title || '').toLowerCase().includes(q));
            if (found) { openPlayer(found, 'series'); return; }
        }
    } catch (e) {
        console.warn('[Hero] Direct lookup failed, falling back to search overlay', e);
    }

    // Fallback: open the search overlay with the title
    doSearch(slide.search);
}

function initHeroCarousel() {
    if (heroInterval) clearInterval(heroInterval);
    let currentSlide = 0;

    // Detect if we're on a hosted environment (to use proxy)
    const isHosted = location.protocol === 'http:' || location.protocol === 'https:';

    function _heroProxyUrl(url) {
        if (!isHosted) return url; // local dev: try direct
        return '/proxy?url=' + encodeURIComponent(url);
    }

    const updateSlide = () => {
        const slide = heroSlides[currentSlide];
        const hero = document.getElementById('hero-section');
        const bgImg = document.getElementById('hero-bg-img');
        if (!hero) return;

        // Update text content immediately
        hero.querySelector('.hero-title').textContent = slide.title;
        hero.querySelector('.hero-badge').textContent = slide.badge;
        hero.querySelector('.hero-desc').textContent = slide.desc;

        // Buttons – call heroSearch() to find & play from the real library
        const btnPrimary = hero.querySelector('.btn-primary');
        const btnSecondary = hero.querySelector('.btn-secondary');
        if (btnPrimary) {
            btnPrimary.removeAttribute('href');
            btnPrimary.onclick = (e) => { e.preventDefault(); heroSearch(slide); };
        }
        if (btnSecondary) {
            btnSecondary.removeAttribute('href');
            btnSecondary.onclick = (e) => { e.preventDefault(); doSearch(slide.search); };
        }

        // Apply fallback gradient immediately so text is always readable
        hero.style.background = slide.gradient;

        // Then try to load the real banner image
        if (bgImg) {
            bgImg.classList.remove('loaded');

            function _tryLoad(url, onSuccess, onFail) {
                const tmp = new Image();
                tmp.onload = onSuccess;
                tmp.onerror = onFail;
                tmp.src = url;
            }

            const proxied = _heroProxyUrl(slide.bg);

            _tryLoad(proxied, () => {
                bgImg.src = proxied;
                hero.style.background = '';
                requestAnimationFrame(() => requestAnimationFrame(() => bgImg.classList.add('loaded')));
            }, () => {
                // If proxy fails, try direct TMDB (works on local dev / some servers)
                if (proxied !== slide.bg) {
                    _tryLoad(slide.bg, () => {
                        bgImg.src = slide.bg;
                        hero.style.background = '';
                        requestAnimationFrame(() => requestAnimationFrame(() => bgImg.classList.add('loaded')));
                    }, () => {
                        console.warn('[Hero] Banner image unavailable, using gradient:', slide.title);
                    });
                }
            });
        }

        currentSlide = (currentSlide + 1) % heroSlides.length;
    };

    updateSlide(); // Load first slide immediately
    heroInterval = setInterval(updateSlide, 6000);
}


// ── LOAD HOME ─────────────────────────────────────────────
async function loadHome(filter) {
    const main = document.getElementById('content-main');

    // Show spinner
    main.innerHTML = `
    <div style="text-align:center;padding:80px 20px">
      <div class="spinner" style="margin:0 auto 16px;width:40px;height:40px;border:4px solid rgba(229,9,20,0.2);border-top-color:#e50914;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <p style="color:var(--text-secondary)">Carregando...</p>
    </div>
  `;

    try {
        if (filter === 'all') {
            // "Home" View: Show a mix of featured content
            main.innerHTML = ''; // Clear spinner
            // Render Featured Sections (Mixed)
            await renderMixedHome(main);
        } else if (filter === 'canais') {
            // "Channels" View: Show Category Grid
            await renderCategoryGrid(main, 'live');
        } else if (filter === 'filmes') {
            // "Movies" View: Show Category Grid
            await renderCategoryGrid(main, 'vod');
        } else if (filter === 'series') {
            // "Series" View: Show Category Grid
            await renderCategoryGrid(main, 'series');
        }

        // Handle page scroll position on switch
        window.scrollTo({ top: 0, behavior: 'instant' });

    } catch (err) {
        console.error(err);
        main.innerHTML = `<div class="empty-state"><div class="emoji">⚠️</div><h3>Erro ao carregar</h3><p>${err.message}</p></div>`;
    }
}

// ── RENDER MIXED HOME (Featured) ──────────────────────────
async function renderMixedHome(parent) {
    const heroSection = document.getElementById('hero-section');
    const header = document.getElementById('main-header');

    if (heroSection) {
        heroSection.style.display = 'block';
        document.body.classList.remove('hero-hidden');
        header.classList.remove('solid');
    }

    console.log('[Home] Loading live categories...');
    // 1. Live Featured
    const liveCats = await getLiveCategories();
    console.log('[Home] Got', liveCats.length, 'live categories');
    const livePriority = PRIORITY_LIVE_CATS.slice(0, 3);
    for (const id of livePriority) {
        const cat = liveCats.find(c => c.category_id === id);
        if (cat) {
            console.log('[Home] Rendering live:', cat.category_name);
            await renderCategoryRow(parent, cat, 'live');
        }
    }

    console.log('[Home] Loading VOD categories...');
    // 2. Movies Featured
    const vodCats = await getVodCategories();
    console.log('[Home] Got', vodCats.length, 'VOD categories');
    const vodPriority = PRIORITY_VOD_CATS.slice(0, 3);
    for (const id of vodPriority) {
        const cat = vodCats.find(c => c.category_id === id);
        if (cat) {
            console.log('[Home] Rendering VOD:', cat.category_name);
            await renderCategoryRow(parent, cat, 'vod');
        }
    }

    console.log('[Home] Loading series categories...');
    // 3. Series Featured
    const serCats = await getSeriesCategories();
    console.log('[Home] Got', serCats.length, 'series categories');
    const serPriority = PRIORITY_SER_CATS.slice(0, 3);
    for (const id of serPriority) {
        const cat = serCats.find(c => c.category_id === id);
        if (cat) {
            console.log('[Home] Rendering series:', cat.category_name);
            await renderCategoryRow(parent, cat, 'series');
        }
    }

    console.log('[Home] ✓ renderMixedHome complete, children:', parent.children.length);
    if (parent.innerHTML === '') {
        console.log('[Home] Priority cats not found. Using fallback first categories.');
        if (liveCats.length > 0) await renderCategoryRow(parent, liveCats[0], 'live');
        if (vodCats.length > 0) await renderCategoryRow(parent, vodCats[0], 'vod');
        if (serCats.length > 0) await renderCategoryRow(parent, serCats[0], 'series');
    }
}

// ── RENDER CATEGORY GRID (The "Menu" View) ────────────────
async function renderCategoryGrid(parent, type) {
    const heroSection = document.getElementById('hero-section');
    const header = document.getElementById('main-header');

    if (heroSection) {
        heroSection.style.display = 'none';
        document.body.classList.add('hero-hidden');
        header.classList.add('solid');
    }

    parent.innerHTML = ''; // Clear

    let categories = [];
    let title = '';

    if (type === 'live') {
        categories = await getLiveCategories();
        title = 'Canais ao Vivo';
    } else if (type === 'vod') {
        categories = await getVodCategories();
        title = 'Filmes';
    } else if (type === 'series') {
        categories = await getSeriesCategories();
        title = 'Séries';
    }

    // Sort: Priority first, then alphabetical
    // (We implement a simple sort helper)
    categories.sort((a, b) => a.category_name.localeCompare(b.category_name));

    const container = document.createElement('div');
    container.className = 'category-grid-container';

    container.innerHTML = `
        <div class="section-header">
            <h2 class="section-title">${title} <span style="font-size:14px;color:var(--text-muted);font-weight:400">Please selecione uma categoria</span></h2>
        </div>
        <div class="category-grid" id="cat-grid"></div>
    `;

    const grid = container.querySelector('#cat-grid');

    // Add "ALL" Category
    const allCard = document.createElement('div');
    allCard.className = 'category-card all-category';
    allCard.style.background = 'linear-gradient(135deg, var(--accent) 0%, #ff8c00 100%)';
    allCard.innerHTML = `<div class="cat-name">✨ Ver Todos (${title})</div>`;
    allCard.addEventListener('click', () => loadAllTypeContent(parent, type, title));
    grid.appendChild(allCard);

    categories.forEach(cat => {
        const name = cleanCat(cat.category_name);
        // Adult content filter removed by user request

        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `<div class="cat-name">${name}</div>`;
        card.addEventListener('click', () => loadCategoryContent(parent, cat, type));
        grid.appendChild(card);
    });

    parent.appendChild(container);
}

// ── LOAD CONTENT FOR A SINGLE CATEGORY ────────────────────
async function loadCategoryContent(parent, category, type) {
    parent.innerHTML = `
    <div style="padding: 20px 0;">
        <button class="back-btn" id="back-to-cats">← Voltar para Categorias</button>
    </div>
    <div style="text-align:center;padding:80px 20px">
      <div class="spinner" style="margin:0 auto 16px;width:40px;height:40px;border:4px solid rgba(229,9,20,0.2);border-top-color:#e50914;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <p>Carregando ${cleanCat(category.category_name)}...</p>
    </div>
    `;

    document.getElementById('back-to-cats')?.addEventListener('click', () => {
        renderCategoryGrid(parent, type);
    });

    try {
        let items = [];
        if (type === 'live') items = await getLiveStreams(category.category_id);
        else if (type === 'vod') items = await getVodStreams(category.category_id);
        else if (type === 'series') items = await getSeriesList(category.category_id);

        // Clear spinner
        const contentDiv = document.createElement('div');

        // Remove the loading spinner from parent (keep the back button)
        // Actually, let's just re-render the whole structure to be clean
        parent.innerHTML = `
            <div class="category-header-row">
                <button class="back-btn" id="back-to-cats-2">← Voltar</button>
                <h2 class="section-title">${cleanCat(category.category_name)} <span class="result-count">${items.length} resultados</span></h2>
            </div>
            <div class="cards-grid" id="items-grid"></div>
        `;

        document.getElementById('back-to-cats-2').addEventListener('click', () => {
            renderCategoryGrid(parent, type);
        });

        const grid = parent.querySelector('#items-grid');

        if (!items || items.length === 0) {
            grid.innerHTML = '<div class="empty-msg">Nenhum conteúdo encontrado nesta categoria.</div>';
            return;
        }

        // Optimization: Render in chunks to keep UI responsive
        const CHUNK_SIZE = 40;
        let renderedCount = 0;

        function renderNextChunk() {
            const nextBatch = items.slice(renderedCount, renderedCount + CHUNK_SIZE);
            const fragment = document.createDocumentFragment();
            nextBatch.forEach(item => fragment.appendChild(buildCard(item, type)));
            grid.appendChild(fragment);
            renderedCount += nextBatch.length;

            if (renderedCount < items.length) {
                requestAnimationFrame(renderNextChunk);
            }
        }

        renderNextChunk();

    } catch (e) {
        console.error(e);
        parent.innerHTML += `<p style="color:red">Erro ao carregar itens: ${e.message}</p>`;
    }
}

// ── HELPER: Render a Single Row (for Home Mix) ────────────
async function renderCategoryRow(parent, category, type) {
    try {
        let items = [];
        if (type === 'live') items = await getLiveStreams(category.category_id);
        else if (type === 'vod') items = await getVodStreams(category.category_id);
        else if (type === 'series') items = await getSeriesList(category.category_id);

        if (!items || items.length === 0) return;

        appendSection(parent, cleanCat(category.category_name), items, type);
    } catch (e) {
        // Ignore single row errors
    }
}

// ── APPEND SECTION (Row) ──────────────────────────────────
function appendSection(parent, title, items, type) {
    const section = document.createElement('div');
    section.className = 'content-section';
    section.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">${title}</h2>
    </div>
    <div class="cards-row-wrapper">
        <button class="row-arrow arrow-left">❮</button>
        <div class="cards-row"></div>
        <button class="row-arrow arrow-right">❯</button>
    </div>
  `;
    const row = section.querySelector('.cards-row');
    const leftBtn = section.querySelector('.arrow-left');
    const rightBtn = section.querySelector('.arrow-right');

    leftBtn.onclick = () => row.scrollBy({ left: -600, behavior: 'smooth' });
    rightBtn.onclick = () => row.scrollBy({ left: 600, behavior: 'smooth' });

    // Limit to 20 items for horizontal rows performance
    items.slice(0, 20).forEach(item => row.appendChild(buildCard(item, type)));
    parent.appendChild(section);
}

// ── BUILD CARD ────────────────────────────────────────────
function buildCard(item, type) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.tabIndex = 0;

    const isLive = type === 'live';
    const thumb = (item.stream_icon || item.cover || item.backdrop_path || '').replace(/^http:\/\//i, 'https://');
    const name = item.name || item.title || item.movie_name || 'Sem título';
    const info = item.rating ? `⭐ ${item.rating}` : item.releaseDate ? item.releaseDate.split('-')[0] : (item.year || '');

    // Error handler for image
    const iconType = isLive ? '📺' : type === 'series' ? '🎭' : '🎬';

    card.innerHTML = `
    <div style="position:relative; width:100%">
      <img class="${isLive ? 'card-thumb-live' : 'card-thumb'}"
           src="${thumb}" alt="${name}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="fallback-thumb" style="display:none">
        ${iconType}
      </div>
      ${isLive ? '<div class="live-indicator"><div class="live-dot"></div>AO VIVO</div>' : ''}
      <div class="card-overlay">
        <button class="play-btn">▶</button>
        <span class="card-overlay-title">${name}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${name}</div>
      <div class="card-meta"><span class="card-cat">${info}</span></div>
    </div>
  `;

    card.addEventListener('click', () => openPlayer(item, type));
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPlayer(item, type); });
    return card;
}

// ── OPEN PLAYER ───────────────────────────────────────────
function openPlayer(item, type) {
    const name = encodeURIComponent(item.name || item.title || '');
    const desc = encodeURIComponent(item.plot || item.info?.plot || '');
    const year = item.releaseDate ? item.releaseDate.split('-')[0] : (item.year || '');
    const genre = item.genre || '';

    let url = '';
    if (type === 'live') {
        url = `player.html?type=live&id=${item.stream_id}&title=${name}&desc=${desc}`;
    } else if (type === 'vod') {
        const ext = item.container_extension || 'mp4';
        url = `player.html?type=vod&id=${item.stream_id}&title=${name}&desc=${desc}&ext=${ext}&year=${year}&genre=${encodeURIComponent(genre)}`;
    } else if (type === 'series') {
        url = `player.html?type=series&id=${item.series_id}&series_id=${item.series_id}&title=${name}&desc=${desc}&year=${year}&genre=${encodeURIComponent(genre)}`;
    }

    if (url) window.location.href = url;
}

// ── SEARCH ────────────────────────────────────────────────
async function doSearch(query) {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.add('open');
    overlay.innerHTML = `<div style="text-align:center;padding:60px 20px"><div class="spinner" style="margin:0 auto;width:36px;height:36px;border:4px solid rgba(229,9,20,0.2);border-top-color:#e50914;border-radius:50%;animation:spin 0.8s linear infinite"></div></div>`;

    const q = query.toLowerCase();
    const results = [];

    // 1. Live
    const live = await getAllLive();
    if (live) {
        live.forEach(s => {
            if (s.name && s.name.toLowerCase().includes(q)) results.push({ item: s, type: 'live' });
        });
    }

    // 2. VOD
    const vod = await getAllVod();
    if (vod) {
        vod.forEach(s => {
            if (s.name && s.name.toLowerCase().includes(q)) results.push({ item: s, type: 'vod' });
        });
    }

    // 3. Series
    const series = await getAllSeries();
    if (series) {
        series.forEach(s => {
            const name = s.name || s.title || '';
            if (name.toLowerCase().includes(q)) results.push({ item: s, type: 'series' });
        });
    }

    overlay.innerHTML = `
    <div class="search-header">
      <h2>Resultados para "${query}"</h2>
      <p>Encontramos ${results.length} título(s)</p>
    </div>
    <div class="search-results-grid" id="srg"></div>
    ${results.length === 0 ? '<div class="empty-state"><div class="emoji">🔍</div><h3>Nenhum resultado encontrado</h3><p>Tente termos mais genéricos ou verifique a ortografia.</p></div>' : ''}
  `;

    const grid = overlay.querySelector('#srg');
    if (grid) {
        results.slice(0, 50).forEach(({ item, type }) => {
            grid.appendChild(buildCard(item, type));
        });
    }
}

function closeSearch() {
    document.getElementById('search-overlay').classList.remove('open');
}

// ── LOAD ALL OF A TYPE ───────────────────────────────────
async function loadAllTypeContent(parent, type, title) {
    parent.innerHTML = `
    <div style="padding: 20px 0;">
        <button class="back-btn" id="back-to-cats">← Voltar para Categorias</button>
    </div>
    <div style="text-align:center;padding:80px 20px">
      <div class="spinner" style="margin:0 auto 16px;width:40px;height:40px;border:4px solid rgba(229,9,20,0.2);border-top-color:#e50914;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <p>Carregando todos os itens de ${title}...</p>
    </div>
    `;

    document.getElementById('back-to-cats').addEventListener('click', () => {
        renderCategoryGrid(parent, type);
    });

    try {
        let items = [];
        if (type === 'live') items = await getAllLive();
        else if (type === 'vod') items = await getAllVod();
        else if (type === 'series') items = await getAllSeries();

        parent.innerHTML = `
            <div class="category-header-row">
                <button class="back-btn" id="back-to-cats-2">← Voltar</button>
                <h2 class="section-title">Todos: ${title} <span class="result-count">${items.length} resultados</span></h2>
            </div>
            <div class="cards-grid" id="items-grid"></div>
        `;

        document.getElementById('back-to-cats-2').addEventListener('click', () => {
            renderCategoryGrid(parent, type);
        });

        const grid = parent.querySelector('#items-grid');

        // Optimization: Render in chunks
        const CHUNK_SIZE = 50;
        let renderedCount = 0;

        function renderNextChunk() {
            const nextBatch = items.slice(renderedCount, renderedCount + CHUNK_SIZE);
            const fragment = document.createDocumentFragment();
            nextBatch.forEach(item => fragment.appendChild(buildCard(item, type)));
            grid.appendChild(fragment);
            renderedCount += nextBatch.length;

            if (renderedCount < items.length) {
                requestAnimationFrame(renderNextChunk);
            }
        }

        renderNextChunk();

    } catch (e) {
        console.error(e);
        parent.innerHTML += `<p style="color:red">Erro: ${e.message}</p>`;
    }
}
