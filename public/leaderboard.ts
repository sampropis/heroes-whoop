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

function formatWeekRange(startDate: string, endDate: string): string {
    const fmt = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
        const day = getOrdinal(d);
        return `${month} ${day}, ${y}`;
    };
    return `${fmt(startDate)} – ${fmt(endDate)}`;
}

function getOrdinal(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return n + 'th';
    const s: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
    return n + (s[n % 10] || 'th');
}

function formatTodayWithOrdinal(d: Date): string {
    const month = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long' }).format(d);
    const day = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' }).format(d));
    const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(d);
    return `Today, ${month} ${getOrdinal(day)}, ${year}`;
}

async function refresh(force?: string, silent?: boolean) {
    try {
        const spinner = document.getElementById('refresh-spinner') as HTMLElement | null;
        if (spinner && !silent) spinner.style.display = 'inline-block';
        const data = await fetchLeaderboard(force);
        const strain = Array.isArray(data.strain) ? data.strain : [];
        const sleep = Array.isArray(data.sleep) ? data.sleep : [];
        const recovery = Array.isArray(data.recovery) ? data.recovery : [];

        // Weekly champs section
        const weekly = data.weekly || {};
        const weeklySleep = Array.isArray(weekly.sleep) ? weekly.sleep : [];
        const weeklyRecovery = Array.isArray(weekly.recovery) ? weekly.recovery : [];
        const weeklyStrain = Array.isArray(weekly.strain) ? weekly.strain : [];

        const weeklyDateEl = document.getElementById('weekly-date-range');
        if (weeklyDateEl && weekly.weekStart && weekly.weekEnd) {
            weeklyDateEl.textContent = formatWeekRange(weekly.weekStart, weekly.weekEnd);
        }

        const weeklySleepItems = weeklySleep.map((it: any) => {
            const perf = typeof it.value === 'number' ? (it.value % 1 === 0 ? Math.round(it.value) : it.value.toFixed(1)) : it.value;
            return { ...it, _label: `${perf}%` };
        });
        renderList('weekly-sleep-list', weeklySleepItems, (v: any) => typeof v === 'string' ? v : String(v));

        const weeklyRecoveryItems = weeklyRecovery.map((it: any) => {
            const n = Number(it.value);
            const val = n % 1 === 0 ? Math.round(n) : n.toFixed(1);
            let cls = 'recovery-green';
            if (n <= 33) cls = 'recovery-red';
            else if (n <= 66) cls = 'recovery-yellow';
            return { ...it, _label: `<span class="${cls}">${val}%</span>` };
        });
        renderList('weekly-recovery-list', weeklyRecoveryItems, (v) => `${Number(v).toFixed(1)}%`);

        renderList('weekly-strain-list', weeklyStrain, (v) => Number(v).toFixed(1));

        // Today section title
        const todayTitleEl = document.getElementById('today-section-title');
        if (todayTitleEl) todayTitleEl.textContent = formatTodayWithOrdinal(new Date());

        // Sleep: performance % and consistency %
        const sleepItems = sleep.map((it: any) => {
            const perf = Math.round(it.value);
            return { ...it, _label: `${perf}%` };
        });
        renderList('sleep-list', sleepItems, (v: any) => typeof v === 'string' ? v : String(v));

        // Recovery: color-coded buckets (red 0-33, yellow 34-66, green 67-100)
        const recoveryItems = recovery.map((it: any) => {
            const n = Number(it.value);
            const val = Math.round(n);
            let cls = 'recovery-green';
            if (n <= 33) cls = 'recovery-red';
            else if (n <= 66) cls = 'recovery-yellow';
            return { ...it, _label: `<span class="${cls}">${val}%</span>` };
        });
        renderList('recovery-list', recoveryItems, (v) => `${Math.round(Number(v))}%`);
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
    // Set today section title on load
    const todayTitleEl = document.getElementById('today-section-title');
    if (todayTitleEl) todayTitleEl.textContent = formatTodayWithOrdinal(new Date());
    // Immediate fetch so the page is populated right away
    refresh('all');
    // Then schedule background refreshes
    scheduleRefresh();
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            refresh('all'); // force refresh sleep, recovery, and strain (with spinner)
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

function formatEstLongDate(d: Date): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long', day: '2-digit' }).format(d);
}

function getEstHour(): number {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }).format(new Date()));
}

function scheduleRefresh() {
    const hour = getEstHour();
    const minute = getEstMinute();
    const isNight = hour >= 19 || hour <= 4; // 7pm–4am EST
    if (isNight) {
        if (minute === 0) {
            // Top of the hour: refresh everything silently
            refresh('all', true);
        }
    } else {
        // Daytime cadence:
        // - Strain every 3 minutes
        // - Sleep/Recovery every 15 minutes
        if (minute % 3 === 0) {
            refresh('strain', true);
        }
        if (minute % 15 === 0) {
            refresh('sleep', true);
            refresh('recovery', true);
        }
    }
    setTimeout(scheduleRefresh, 60 * 1000);
}

function getEstMinute(): number {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', minute: '2-digit' }).format(new Date()));
}

