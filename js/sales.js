/**
 * CLOUDFLIX - Sales Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initCountdownTimer();
    initViewerCounter();
    initScrollReveal();
    initSalesNotifications();
});

// ── COUNTDOWN TIMER ──────────────────────────────────────
function initCountdownTimer() {
    const timerEl = document.getElementById('promo-timer');
    if (!timerEl) return;

    // Use a fixed value for Carnival Promo feel, or keep it dynamic
    // The user requested 14:58 in the copy, so let's set it around that 
    // but keep it ticking for urgency.
    let remaining = 14 * 60 + 58; // 14:58

    function tick() {
        if (remaining <= 0) remaining = 14 * 60 + 58;

        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');

        timerEl.textContent = `${m}:${s}`;
        remaining--;
    }

    tick();
    setInterval(tick, 1000);
}

// ── FAKE VIEWER COUNTER ──────────────────────────────────
function initViewerCounter() {
    const el = document.getElementById('viewer-count');
    if (!el) return;

    let count = 14800 + Math.floor(Math.random() * 150);

    function update() {
        const delta = Math.floor(Math.random() * 20) - 8;
        count = Math.max(14500, Math.min(15200, count + delta));
        el.textContent = count.toLocaleString('pt-BR');
    }

    setInterval(update, 3000 + Math.random() * 4000);
}

// ── SALES NOTIFICATIONS ──────────────────────────────────
function initSalesNotifications() {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const names = [
        "Marcos S.", "Ana B.", "Carlos M.", "Juliana F.", "Ricardo T.",
        "Fernanda O.", "Lucas G.", "Patrícia R.", "Bruno W.", "Camila L.",
        "Rodrigo A.", "Sabrina P.", "Gabriel C.", "Vanessa H.", "Thiago D."
    ];

    function showNotification() {
        const name = names[Math.floor(Math.random() * names.length)];
        const notif = document.createElement('div');
        notif.className = 'sales-notification';

        notif.innerHTML = `
            <div class="notif-icon">💰</div>
            <div class="notif-content">
                <div class="notif-title">Pagamento Aprovado via Pix</div>
                <div class="notif-text"><strong>${name}</strong> acaba de liberar acesso vitalício.</div>
            </div>
        `;

        container.appendChild(notif);

        // Remove from DOM after animation
        setTimeout(() => {
            notif.remove();
        }, 5500);
    }

    // Initial notification after 3s
    setTimeout(showNotification, 3000);

    // Periodic notifications every 8-15 seconds
    function scheduleNext() {
        const delay = 8000 + Math.random() * 7000;
        setTimeout(() => {
            showNotification();
            scheduleNext();
        }, delay);
    }

    scheduleNext();
}

// ── SCROLL REVEAL ────────────────────────────────────────
function initScrollReveal() {
    const revealEls = document.querySelectorAll('.reveal');

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    observer.unobserve(e.target);
                }
            });
        }, { threshold: 0.12 });

        revealEls.forEach(el => observer.observe(el));
    } else {
        // Fallback for older browsers
        revealEls.forEach(el => el.classList.add('visible'));
    }
}
