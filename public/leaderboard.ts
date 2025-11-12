async function fetchLeaderboard(force?: string) {
    const url = force ? `/api/leaderboard?force=${encodeURIComponent(force)}` : '/api/leaderboard';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load leaderboard');
    return await res.json();
}

function renderList(containerId: string, items: Array<{ name: string; value: number; avatar?: string; _label?: string }>, format: (n: any) => string) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!items || items.length === 0) {
        el.innerHTML = '<div class="muted">No data</div>';
        return;
    }
    const toInitials = (name?: string) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/).slice(0, 2);
        return parts.map(p => p.charAt(0)).join('').toUpperCase();
    };
    const colorFromName = (name?: string) => {
        if (!name) return '#555';
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 45%)`;
    };
    items.forEach((it, idx) => {
        const row = document.createElement('div');
        row.className = 'entry';
        row.innerHTML = `
            <div class="name">
                <span style="opacity:0.7;width:18px;display:inline-block;">${idx + 1}</span>
                ${it.avatar
                    ? `<img class="avatar" src="${it.avatar}" alt="">`
                    : `<div class="avatar avatar-initials" style="background:${colorFromName(it.name)}">${toInitials(it.name)}</div>`}
                <span>${it.name}</span>
            </div>
            <div>${it._label ? it._label : format(it.value)}</div>
        `;
        el.appendChild(row);
    });
}

function renderNames(containerId: string, items: Array<{ name: string; avatar?: string }>) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    if (!items || items.length === 0) {
        el.innerHTML = '<div class="muted">No data</div>';
        return;
    }
    items.forEach((it, idx) => {
        const row = document.createElement('div');
        row.className = 'entry';
        row.innerHTML = `
            <div class="name">
                <span style="opacity:0.7;width:18px;display:inline-block;">${idx + 1}</span>
                ${it.avatar ? `<img class="avatar" src="${it.avatar}" alt="">` : `<div class="avatar"></div>`}
                <span>${it.name}</span>
            </div>
            <div></div>
        `;
        el.appendChild(row);
    });
}

async function refresh(force?: string) {
    try {
        const spinner = document.getElementById('refresh-spinner') as HTMLElement | null;
        if (spinner) spinner.style.display = 'inline-block';
        const data = await fetchLeaderboard(force);
        // Header date (EST)
        const headerDateEl = document.getElementById('header-date');
        if (headerDateEl) headerDateEl.textContent = formatEstDate(new Date());
        const strain = Array.isArray(data.strain) ? data.strain : [];
        const sleep = Array.isArray(data.sleep) ? data.sleep : [];
        const recovery = Array.isArray(data.recovery) ? data.recovery : [];

        // Sleep: performance % and consistency %
        const sleepItems = sleep.map((it: any) => {
            const perf = Math.round(it.value);
            return { ...it, _label: `${perf}%` };
        });
        renderList('sleep-list', sleepItems, (v: any) => typeof v === 'string' ? v : String(v));

        // Recovery: show as percentage without rounding (keep one decimal if present)
        renderList('recovery-list', recovery, (v) => `${Number.isInteger(v) ? v : Number(v).toFixed(1)}%`);
        // Strain: nearest tenth
        renderList('strain-list', strain, (v) => Number(v).toFixed(1));
    } catch (e) {
        console.error(e);
    } finally {
        const spinner = document.getElementById('refresh-spinner') as HTMLElement | null;
        if (spinner) spinner.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Set header date on load (EST)
    const headerDateEl = document.getElementById('header-date');
    if (headerDateEl) headerDateEl.textContent = formatEstDate(new Date());
    refresh();
    setInterval(refresh, 60000);
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            refresh('all'); // force refresh sleep, recovery, and strain
        });
    }
    const themeBtn = document.getElementById('toggle-theme');
    const applyTheme = (t: string) => {
        if (t === 'light') document.body.classList.add('light');
        else document.body.classList.remove('light');
        // Update icon
        const icon = document.getElementById('toggle-theme') as HTMLElement | null;
        if (icon) icon.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    };
    const saved = localStorage.getItem('leaderboard_theme') || 'dark';
    applyTheme(saved);
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const next = document.body.classList.contains('light') ? 'dark' : 'light';
            applyTheme(next);
            localStorage.setItem('leaderboard_theme', next);
        });
    }
});

function formatEstDate(d: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    return `${y}-${m}-${day}`;
}

