async function fetchLeaderboard() {
    const res = await fetch('/api/leaderboard');
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

async function refresh() {
    try {
        const data = await fetchLeaderboard();
        const dateEl = document.getElementById('board-date');
        if (dateEl) dateEl.textContent = `Date: ${data.date}`;
        // Sleep: performance % with hours (h m)
        const sleepItems = (data.sleep || []).map((it: any) => {
            const seconds = typeof it.seconds === 'number' ? it.seconds : 0;
            const hours = Math.floor(seconds / 3600);
            const mins = Math.round((seconds % 3600) / 60);
            return { ...it, _label: `${Math.round(it.value)}% (${hours}h ${mins}m)` };
        });
        renderList('sleep-list', sleepItems, (v: any) => typeof v === 'string' ? v : String(v));
        renderList('recovery-list', data.recovery, (v) => `${Math.round(v)}`);
        renderList('strain-list', data.strain, (v) => v.toFixed(2));
    } catch (e) {
        console.error(e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refresh();
    setInterval(refresh, 60000);
});


