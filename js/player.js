// ============================================================
// CLOUDFLIX – Premium Player JS (Xtream HLS/MP4)
// ============================================================

let hls = null;
let currentUrl = '';
let currentType = '';
let seriesData = null;
let currentSeason = 1;
let currentEpId = null;
let controlsTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();

    // Initialize API credentials
    if (typeof initCloudflixAccess === 'function') {
        try { await initCloudflixAccess(); } catch (e) { }
    }

    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'live';
    const id = params.get('id') || '';
    const title = params.get('title') || 'Conteúdo';
    const ext = params.get('ext') || 'mp4';
    const desc = params.get('desc') || '';
    const epId = params.get('ep') || '';
    const seriesId = params.get('series_id') || '';
    const year = params.get('year') || '2026';
    const genre = params.get('genre') || 'Portal IPTV';

    currentType = type;
    document.title = `${title} – CLOUDFLIX`;

    // Update UI elements
    setLabel('player-title', title);
    setLabel('video-title-display', title || 'TV ao Vivo');
    setLabel('loading-name', title);
    setLabel('player-desc', desc || 'Sem descrição disponível para este conteúdo.');
    setLabel('video-year', year);
    setLabel('video-genre', genre);

    // Manage sidebar visibility
    const sidebar = document.getElementById('player-sidebar');
    if (type !== 'series' && sidebar) {
        sidebar.style.display = 'none';
        document.querySelector('.content-grid').style.gridTemplateColumns = '1fr';
    }

    // Build stream URL
    if (type === 'live') {
        currentUrl = XTREAM.liveUrl(id);
        setLabel('player-badge', 'AO VIVO');
    } else if (type === 'vod') {
        currentUrl = XTREAM.vodUrl(id, ext);
        setLabel('player-badge', 'VOD');
    } else if (type === 'series') {
        if (seriesId) loadSeriesEpisodes(seriesId, title, epId);
        currentUrl = epId ? XTREAM.seriesEpUrl(epId, ext) : '';
        currentEpId = epId;
        setLabel('player-badge', 'SÉRIE');
    }

    if (currentUrl) loadStream(currentUrl, type);

    // Initialize Custom Controls
    initCustomControls();
});

function setLabel(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ── HLS / Video loader ────────────────────────────────────
function loadStream(url, type) {
    const video = document.getElementById('main-video');
    const loading = document.getElementById('loading-overlay');
    const errBox = document.getElementById('error-overlay');

    if (loading) loading.classList.remove('hidden');
    if (errBox) errBox.style.display = 'none';
    currentUrl = url;

    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src');
    video.load();

    const isHls = type === 'live' || url.includes('.m3u8');

    if (isHls && Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            maxBufferSize: 30 * 1000 * 1000, // 30MB
            initialLiveManifestSize: 1,
            manifestLoadingMaxRetry: 10,
            levelLoadingMaxRetry: 10,
            fragLoadingMaxRetry: 10,
            abrEwmaDefaultEstimate: 500000, // Start with lower estimate for fast load (500kbps)
            testBandwidth: false,
            nudgeMaxRetries: 10,
            enableSoftwareAES: true,
            liveSyncDuration: 6,
            liveMaxLatencyDuration: 10,
        });

        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Wait just a tiny bit more for buffer to minimize stutter
            setTimeout(() => {
                if (loading) loading.classList.add('hidden');
                video.play().catch(() => { });
            }, 300);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                } else {
                    showError('Transmissão não disponível no momento.');
                }
            }
        });

    } else {
        _loadVideoSrc(url, video, loading);
    }
}

function _loadVideoSrc(url, video, loading) {
    video.src = url;
    const onCanPlay = () => {
        if (loading) loading.classList.add('hidden');
        video.play().catch(() => { });
        cleanup();
    };
    const onError = () => { showError('Ocorreu um erro ao carregar o vídeo.'); cleanup(); };
    const cleanup = () => {
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('error', onError);
    };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    video.load();
}

function showError(msg) {
    const loading = document.getElementById('loading-overlay');
    if (loading) loading.classList.add('hidden');
    const errBox = document.getElementById('error-overlay');
    const msgEl = document.getElementById('error-msg');
    if (msgEl) msgEl.textContent = msg;
    if (errBox) errBox.style.display = 'flex';
}

function retryPlay() {
    if (currentUrl) {
        const errBox = document.getElementById('error-overlay');
        if (errBox) errBox.style.display = 'none';
        loadStream(currentUrl, currentType);
    }
}

// ── Custom Controls Logic ─────────────────────────────────
function initCustomControls() {
    const video = document.getElementById('main-video');
    const wrapper = document.querySelector('.video-wrapper');
    const progressContainer = document.getElementById('progress-container');
    const progressCurrent = document.getElementById('progress-current');
    const progressLoaded = document.getElementById('progress-loaded');
    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const volSlider = document.getElementById('volume-slider');
    const playPauseBtn = document.getElementById('btn-play-icon');
    const bigPlayIcon = document.getElementById('big-play-icon');

    // Show/Hide controls logic
    const hideControls = () => {
        if (!video.paused && wrapper) {
            wrapper.classList.remove('controls-visible');
        }
    };

    const showControls = () => {
        if (wrapper) wrapper.classList.add('controls-visible');
        clearTimeout(controlsTimeout);
        if (!video.paused) {
            controlsTimeout = setTimeout(hideControls, 3000);
        }
    };

    // User interactions - target the wrapper for better capture in fullscreen
    if (wrapper) {
        wrapper.addEventListener('mousemove', showControls);
        wrapper.addEventListener('touchstart', showControls, { passive: true });
        wrapper.addEventListener('mousedown', showControls);
    }

    // Video events
    video.addEventListener('play', () => {
        setTimeout(hideControls, 1500);
    });
    video.addEventListener('pause', () => {
        if (wrapper) wrapper.classList.add('controls-visible');
        clearTimeout(controlsTimeout);
    });

    // Update Progress & Time
    video.addEventListener('timeupdate', () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        if (progressCurrent) progressCurrent.style.width = pct + '%';
        if (timeCurrent) timeCurrent.textContent = formatTime(video.currentTime);
        if (timeTotal) timeTotal.textContent = formatTime(video.duration);
    });

    video.addEventListener('progress', () => {
        if (video.buffered.length > 0 && video.duration) {
            const bufferedEnd = video.buffered.end(video.buffered.length - 1);
            const pct = (bufferedEnd / video.duration) * 100;
            if (progressLoaded) progressLoaded.style.width = pct + '%';
        }
    });

    video.addEventListener('loadedmetadata', () => {
        if (timeTotal) timeTotal.textContent = formatTime(video.duration);
    });

    // Progress Bar Interaction
    if (progressContainer) {
        progressContainer.addEventListener('mousedown', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        });
    }

    // Volume
    if (volSlider) {
        volSlider.addEventListener('input', (e) => {
            video.volume = e.target.value;
            video.muted = (video.volume === 0);
            updateVolumeIcon();
        });
    }

    // Icons update
    video.addEventListener('play', () => {
        if (playPauseBtn) playPauseBtn.textContent = '⏸';
        if (bigPlayIcon) bigPlayIcon.textContent = '⏸';
    });
    video.addEventListener('pause', () => {
        if (playPauseBtn) playPauseBtn.textContent = '▶';
        if (bigPlayIcon) bigPlayIcon.textContent = '▶';
    });

    // Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
        if (e.code === 'ArrowRight') skip(10);
        if (e.code === 'ArrowLeft') skip(-10);
        if (e.code === 'ArrowUp') { e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); if (volSlider) volSlider.value = video.volume; }
        if (e.code === 'ArrowDown') { e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); if (volSlider) volSlider.value = video.volume; }
        if (e.code === 'KeyF') toggleFullscreen();
        showControls();
    });
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function togglePlayPause() {
    const video = document.getElementById('main-video');
    if (video.paused) video.play().catch(() => { });
    else video.pause();
}

function skip(seconds) {
    const video = document.getElementById('main-video');
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

function toggleMute() {
    const video = document.getElementById('main-video');
    const slider = document.getElementById('volume-slider');
    video.muted = !video.muted;
    if (slider) {
        if (video.muted) slider.value = 0;
        else slider.value = video.volume;
    }
    updateVolumeIcon();
}

function updateVolumeIcon() {
    const video = document.getElementById('main-video');
    const icon = document.getElementById('mute-icon');
    if (!icon) return;
    if (video.muted || video.volume === 0) icon.textContent = '🔇';
    else if (video.volume < 0.5) icon.textContent = '🔉';
    else icon.textContent = '🔊';
}

function toggleFullscreen() {
    const wrapper = document.querySelector('.video-wrapper');
    const video = document.getElementById('main-video');

    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        // Try standard or vendor-specific wrapper fullscreen
        if (wrapper.requestFullscreen) wrapper.requestFullscreen();
        else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
        else if (wrapper.mozRequestFullScreen) wrapper.mozRequestFullScreen();
        else if (wrapper.msRequestFullscreen) wrapper.msRequestFullscreen();
        else if (video && video.webkitEnterFullscreen) {
            // iOS iPhone Fallback: Request fullscreen on the video element directly
            video.webkitEnterFullscreen();
        }
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

// ── Series episodes ────────────────────────────────────────
async function loadSeriesEpisodes(seriesId, title, activeEpId) {
    try {
        seriesData = await getSeriesInfo(seriesId);
        renderSeasons(seriesData, activeEpId);
    } catch (e) {
        console.warn('Could not load series info', e);
    }
}

function renderSeasons(data, activeEpId) {
    const seasons = data.episodes || {};
    const seasonNums = Object.keys(seasons).sort((a, b) => +a - +b);
    const seasonsEl = document.getElementById('ep-seasons');
    if (!seasonsEl) return;
    seasonsEl.innerHTML = '';

    seasonNums.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'ep-season-btn' + (s === '1' ? ' active' : '');
        btn.textContent = `T${s}`;
        btn.onclick = () => {
            document.querySelectorAll('.ep-season-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderEpisodeList(seasons[s], activeEpId);
        };
        seasonsEl.appendChild(btn);
    });

    if (seasonNums.length > 0) renderEpisodeList(seasons[seasonNums[0]], activeEpId);
}

function renderEpisodeList(episodes, activeEpId) {
    const list = document.getElementById('ep-list');
    if (!list) return;
    list.innerHTML = '';
    (episodes || []).forEach(ep => {
        const item = document.createElement('div');
        item.className = 'ep-item' + (String(ep.id) === String(activeEpId) ? ' playing' : '');

        // Try to get a thumbnail if available, otherwise use a placeholder number
        const thumb = forceHttps(ep.info?.movie_image || '');
        const thumbHtml = thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">` : `<span>${ep.episode_num || '?'}</span>`;

        item.innerHTML = `
            <div class="ep-thumb">${thumbHtml}</div>
            <div class="ep-details">
                <div class="ep-title">${ep.title || 'Episódio ' + ep.episode_num}</div>
                <div class="ep-meta">${ep.info?.duration || ''} • Temporada ${ep.season}</div>
            </div>
        `;

        item.onclick = () => {
            const ext = ep.container_extension || 'mp4';
            const url = XTREAM.seriesEpUrl(ep.id, ext);
            document.querySelectorAll('.ep-item').forEach(i => i.classList.remove('playing'));
            item.classList.add('playing');
            currentEpId = ep.id;

            // Update UI for the new episode
            const epTitle = ep.title || `Episódio ${ep.episode_num}`;
            setLabel('video-title-display', epTitle);
            setLabel('player-title', epTitle);

            loadStream(url, 'series');
        };
        list.appendChild(item);
    });
}
