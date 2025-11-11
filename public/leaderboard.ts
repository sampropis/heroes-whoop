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
    items.forEach((it, idx) => {
        const row = document.createElement('div');
        row.className = 'entry';
        row.innerHTML = `
            <div class="name">
                <span style="opacity:0.7;width:18px;display:inline-block;">${idx + 1}</span>
                ${it.avatar ? `<img class="avatar" src="${it.avatar}" alt="">` : `<div class="avatar"></div>`}
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
        const data = await fetchLeaderboard(force);
        const dateEl = document.getElementById('board-date');
        if (dateEl) dateEl.textContent = `Date: ${data.date}`;
        // Build name order based on strain; fallback to sleep, then recovery
        const strain = Array.isArray(data.strain) ? data.strain : [];
        const sleep = Array.isArray(data.sleep) ? data.sleep : [];
        const recovery = Array.isArray(data.recovery) ? data.recovery : [];
        const nameOrder = (strain.length ? strain : (sleep.length ? sleep : recovery)).map((x: any) => ({ name: x.name, avatar: x.avatar }));
        renderNames('name-list', nameOrder);

        // Sleep: performance % and consistency %
        const sleepItems = sleep.map((it: any) => {
            const perf = Math.round(it.value);
            const cons = typeof it.consistency === 'number' ? Math.round(it.consistency) : undefined;
            return { ...it, _label: cons !== undefined ? `Perf ${perf}% | Cons ${cons}%` : `Perf ${perf}%` };
        });
        renderList('sleep-list', sleepItems, (v: any) => typeof v === 'string' ? v : String(v));

        // Recovery: show as percentage, do not add decimals (display integer)
        renderList('recovery-list', recovery, (v) => `${Math.round(v)}%`);
        // Strain: nearest tenth
        renderList('strain-list', strain, (v) => Number(v).toFixed(1));
    } catch (e) {
        console.error(e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refresh();
    setInterval(refresh, 60000);
    const btn = document.getElementById('refresh-strain');
    if (btn) {
        btn.addEventListener('click', () => {
            refresh('strain');
        });
    }
});

