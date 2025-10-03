// Sleep TypeScript for WHOOP API Test Site

import { WhoopSleep as WhoopSleepType } from './types/whoop';

interface Profile {
    first_name: string;
    last_name: string;
}

interface SleepScore {
    sleep_efficiency_percentage: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_need_minutes: number;
    average_heart_rate: number;
    slow_wave_sleep_minutes: number;
    rem_sleep_minutes: number;
    light_sleep_minutes: number;
    awake_time_minutes: number;
    in_bed_duration_minutes: number;
    no_data_duration_minutes: number;
    sleep_debt_minutes: number;
    sleep_debt_running_total_minutes: number;
    kilojoule: number;
    max_heart_rate: number;
    respiratory_rate: number;
    [key: string]: number | string | boolean | object | null; // For dynamic properties
}

interface Sleep {
    id: string;
    start: string;
    end: string;
    score_state: string;
    timezone_offset?: string;
    score?: SleepScore;
    cycle_id?: string;
}

interface SleepResponse {
    records: Sleep[];
    next_token?: string;
}

declare global {
    interface Window {
        whoopAuth: any; // TODO: Import WhoopAuth type when module system is set up
        whoopSleep: WhoopSleep;
    }
}

class WhoopSleep {
    private currentPage: number;
    private nextToken: string | null;
    private previousTokens: string[];
    private currentSleep: Sleep[];
    private isLoading: boolean;

    constructor() {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        this.currentSleep = [];
        this.isLoading = false;
        this.init();
    }

    private async init(): Promise<void> {
        try {
            // Check authentication first
            if (!await window.whoopAuth.init()) {
                return; // Will redirect to login if not authenticated
            }
            
            await this.loadUserProfile();
            this.setDefaultDates();
            await this.loadSleep();
            this.setupEventListeners();
            this.setupModalEventListeners();
        } catch (error) {
            console.error('Sleep initialization failed:', error);
            this.showError('Failed to initialize sleep page');
        }
    }

    private async loadUserProfile(): Promise<void> {
        try {
            const response = await window.whoopAuth.apiRequest('/api/profile');
            if (!response.ok) throw new Error('Failed to fetch profile');
            
            const profile = await response.json() as Profile;
            this.displayUserName(profile);
        } catch (error) {
            console.error('Failed to load profile:', error);
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = 'User';
            }
        }
    }

    private displayUserName(profile: Profile): void {
        const userNameElement = document.getElementById('user-name');
        if (!userNameElement) return;

        if (profile.first_name && profile.last_name) {
            userNameElement.textContent = `${profile.first_name} ${profile.last_name}`;
        } else if (profile.first_name) {
            userNameElement.textContent = profile.first_name;
        } else {
            userNameElement.textContent = 'User';
        }
    }

    private setDefaultDates(): void {
        // Set start date to 30 days ago (last month)
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        const startDateString = startDate.toISOString().split('T')[0];
        
        // Set end date to today
        const today = new Date();
        const endDateString = today.toISOString().split('T')[0];
        
        // Set the input values
        const startDateInput = document.getElementById('start-date') as HTMLInputElement;
        const endDateInput = document.getElementById('end-date') as HTMLInputElement;
        
        if (startDateInput) startDateInput.value = startDateString;
        if (endDateInput) endDateInput.value = endDateString;
        
        console.log('Default dates set to last 30 days:', { start: startDateString, end: endDateString });
    }

    private setupEventListeners(): void {
        // Refresh button (updated ID)
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.resetPagination();
                this.loadSleep();
            });
        }

        // Pagination (updated IDs)
        const nextBtn = document.getElementById('next-btn');
        const prevBtn = document.getElementById('prev-btn');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const logoutBtn = document.getElementById('logout-btn');
        const limitSelect = document.getElementById('limit-select');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.nextToken && !this.isLoading) {
                    this.loadNextPage();
                }
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1 && !this.isLoading) {
                    this.loadPreviousPage();
                }
            });
        }

        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                if (this.nextToken && !this.isLoading) {
                    this.loadMoreSleep();
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.whoopAuth.logout();
            });
        }

        if (limitSelect) {
            limitSelect.addEventListener('change', () => {
                this.resetPagination();
                this.loadSleep();
            });
        }
    }

    private setupModalEventListeners(): void {
        const modal = document.getElementById('sleep-modal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.close-modal');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Keyboard support
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });

        // Event delegation for sleep card clicks (updated to use sleeps-content)
        const sleepsContent = document.getElementById('sleeps-content');
        if (sleepsContent) {
            sleepsContent.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const sleepCard = target.closest('.sleep-card');
                if (sleepCard instanceof HTMLElement) {
                    const sleepId = sleepCard.dataset.sleepId;
                    if (sleepId) {
                        this.showSleepDetails(sleepId);
                    }
                }
            });
        }
    }

    private closeModal(): void {
        const modal = document.getElementById('sleep-modal');
        const modalLoading = document.getElementById('modal-loading');
        const modalContent = document.getElementById('modal-content');
        const modalError = document.getElementById('modal-error');

        if (modal) modal.style.display = 'none';
        if (modalLoading) modalLoading.style.display = 'none';
        if (modalContent) modalContent.style.display = 'none';
        if (modalError) modalError.style.display = 'none';
    }

    private async loadSleep(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();
        this.hideError();

        try {
            const params = this.buildApiParams();
            console.log('Loading sleep with params:', params);

            const response = await window.whoopAuth.apiRequest(`/api/sleep?${params}`);
            if (!response.ok) throw new Error('Failed to fetch sleep data');

            const data = await response.json() as SleepResponse;
            console.log('Sleep data received:', data);

            this.currentSleep = data.records || [];
            this.nextToken = data.next_token || null;
            
            this.displaySleep();
            this.updatePaginationControls();
        } catch (error) {
            console.error('Failed to load sleep:', error);
            this.showError(`Failed to load sleep data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    private async loadMoreSleep(): Promise<void> {
        if (!this.nextToken || this.isLoading) return;

        this.isLoading = true;
        this.previousTokens.push(this.nextToken);

        try {
            const params = this.buildApiParams();
            const response = await window.whoopAuth.apiRequest(`/api/sleep?${params}`);
            if (!response.ok) throw new Error('Failed to fetch more sleep data');

            const data = await response.json() as SleepResponse;
            const newSleep = data.records || [];

            // Append new sleep to existing
            this.currentSleep = [...this.currentSleep, ...newSleep];
            this.nextToken = data.next_token || null;

            this.displaySleep();
            this.updatePaginationControls();
        } catch (error) {
            console.error('Failed to load more sleep:', error);
            this.showError(`Failed to load more sleep data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isLoading = false;
        }
    }

    private buildApiParams(): string {
        const limitSelect = document.getElementById('limit-select') as HTMLSelectElement;
        const startDateInput = document.getElementById('start-date') as HTMLInputElement;
        const endDateInput = document.getElementById('end-date') as HTMLInputElement;

        const limit = limitSelect?.value || '10';
        const startDate = startDateInput?.value;
        const endDate = endDateInput?.value;

        const params = new URLSearchParams({ limit });
        
        if (startDate) {
            params.append('start', `${startDate}T00:00:00.000Z`);
        }
        if (endDate) {
            params.append('end', `${endDate}T23:59:59.999Z`);
        }
        if (this.nextToken) {
            params.append('nextToken', this.nextToken);
        }

        return params.toString();
    }

    private displaySleep(): void {
        const container = document.getElementById('sleeps-content');
        if (!container) return;
        
        // Create or get the grid
        let grid = container.querySelector('.activities-grid');
        if (!grid) {
            container.innerHTML = ''; // Clear loading message
            grid = document.createElement('div');
            grid.className = 'activities-grid'; // Reuse activities grid styling
            container.appendChild(grid);
        } else {
            grid.innerHTML = ''; // Clear existing content
        }

        if (!this.currentSleep.length) {
            grid.innerHTML = '<div class="empty">No sleep data found for the selected date range.</div>';
            return;
        }

        this.currentSleep.forEach(sleep => {
            const sleepCard = this.createSleepCard(sleep);
            grid.appendChild(sleepCard);
        });
    }

    private createSleepCard(sleep: Sleep): HTMLElement {
        const card = document.createElement('div');
        card.className = 'activity-card sleep-card'; // Reuse activity card styling
        card.dataset.sleepId = sleep.id;

        const startDate = new Date(sleep.start);
        const endDate = new Date(sleep.end);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)); // hours
        const durationMinutes = Math.round(((endDate.getTime() - startDate.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

        // Get sleep efficiency or quality if available
        const efficiency = sleep.score?.sleep_efficiency_percentage;

        card.innerHTML = `
            <div class="activity-header">
                <div class="activity-type">
                    <span class="activity-icon">😴</span>
                    <span class="activity-name">Sleep</span>
                </div>
                <span class="activity-date">${startDate.toLocaleDateString()}</span>
            </div>
            <div class="activity-metrics">
                <div class="metric">
                    <span class="metric-label">Bedtime</span>
                    <span class="metric-value">${startDate.toLocaleTimeString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Wake Time</span>
                    <span class="metric-value">${endDate.toLocaleTimeString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Duration</span>
                    <span class="metric-value">${duration}h ${durationMinutes}m</span>
                </div>
                ${efficiency ? `
                    <div class="metric">
                        <span class="metric-label">Sleep Efficiency</span>
                        <span class="metric-value">${Math.round(efficiency)}%</span>
                    </div>
                ` : ''}
            </div>
            <div class="activity-details">
                <div class="activity-timing">
                    <span class="timing-label">Score State:</span>
                    <span class="timing-value">${sleep.score_state || 'N/A'}</span>
                </div>
            </div>
        `;

        return card;
    }

    private async showSleepDetails(sleepId: string): Promise<void> {
        console.log('Showing sleep details for ID:', sleepId);
        
        const modal = document.getElementById('sleep-modal');
        const loading = document.getElementById('modal-loading');
        const content = document.getElementById('modal-content');
        const error = document.getElementById('modal-error');

        if (!modal || !loading || !content || !error) return;

        // Show modal with loading state
        modal.style.display = 'block';
        loading.style.display = 'block';
        content.style.display = 'none';
        error.style.display = 'none';
        
        try {
            // Try to get detailed sleep data
            const response = await window.whoopAuth.apiRequest(`/api/sleep/${sleepId}`);
            let sleep: Sleep;
            
            if (response.ok) {
                sleep = await response.json() as Sleep;
                console.log('Detailed sleep data received:', sleep);
            } else {
                // Fallback to current sleep data
                const foundSleep = this.currentSleep.find(s => s.id === sleepId);
                if (!foundSleep) {
                    throw new Error('Sleep not found');
                }
                sleep = foundSleep;
            }

            // Show sleep details
            content.innerHTML = this.formatSleepDetails(sleep);
            loading.style.display = 'none';
            content.style.display = 'block';
        } catch (error) {
            console.error('Failed to load sleep details:', error);
            
            // Show error
            loading.style.display = 'none';
            if (error instanceof HTMLElement) {
                error.style.display = 'block';
                error.textContent = `Failed to load sleep details: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        }
    }

    private formatSleepDetails(sleep: Sleep): string {
        const startDate = new Date(sleep.start);
        const endDate = new Date(sleep.end);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)); // hours
        const durationMinutes = Math.round(((endDate.getTime() - startDate.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

        // Prepare stage data if available, supporting many schema variants
        const score = sleep.score as any;
        const toMinutesSmart = (value: any, keyHint?: string): number => {
            const raw = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(raw) || raw <= 0) return 0;
            const k = (keyHint || '').toLowerCase();
            // If key suggests milliseconds or value looks like ms (> 24h in minutes)
            if (k.includes('milli') || raw > 24 * 60) {
                return Math.round(raw / 60000);
            }
            // Otherwise assume minutes
            return Math.round(raw);
        };

        const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const pickFrom = (obj: any, candidates: string[]): number => {
            if (!obj || typeof obj !== 'object') return 0;
            // Exact key hit
            for (const c of candidates) {
                if (c in obj) {
                    return toMinutesSmart((obj as any)[c], c);
                }
            }
            // Fuzzy search by substring if exact keys not found
            const entries = Object.entries(obj) as Array<[string, any]>;
            for (const [k, v] of entries) {
                const nk = normalizeKey(k);
                if (candidates.some(c => nk.includes(normalizeKey(c)))) {
                    const minutes = toMinutesSmart(v, k);
                    if (minutes > 0) return minutes;
                }
            }
            return 0;
        };

        let deep = Number(score?.slow_wave_sleep_minutes) || 0;
        let rem = Number(score?.rem_sleep_minutes) || 0;
        let light = Number(score?.light_sleep_minutes) || 0;
        let awake = Number(score?.awake_time_minutes) || 0;

        const ss = score?.stage_summary || (sleep as any)?.stage_summary || (sleep as any)?.stages;
        if ((deep + rem + light + awake) === 0 && ss) {
            deep = pickFrom(ss, ['total_slow_wave_sleep_time_milli', 'total_slow_wave_sleep_milli', 'slow_wave_sleep_time_milli', 'slow_wave_sleep_milli', 'slow_wave_sleep', 'deep_sleep', 'deep']);
            rem = pickFrom(ss, ['total_rem_sleep_time_milli', 'total_rem_sleep_milli', 'rem_sleep_time_milli', 'rem_sleep_milli', 'rem_sleep', 'rem']);
            light = pickFrom(ss, ['total_light_sleep_time_milli', 'total_light_sleep_milli', 'light_sleep_time_milli', 'light_sleep_milli', 'light_sleep', 'light']);
            awake = pickFrom(ss, ['total_awake_time_milli', 'awake_time_milli', 'awake_time', 'awake']);
        }

        let totalStageMinutes = deep + rem + light + awake;
        if (totalStageMinutes === 0) {
            // Fallback to duration if stages are missing
            totalStageMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60)));
        }

        const pct = (m: number) => Math.max(0, Math.min(100, Math.round((m / totalStageMinutes) * 100)));

        const performance = typeof score?.sleep_performance_percentage === 'number' ? Math.round(score!.sleep_performance_percentage) : null;
        const efficiency = typeof score?.sleep_efficiency_percentage === 'number' ? Math.round(score!.sleep_efficiency_percentage) : null;

        // Sleep need may be nested or flat
        const sleepNeedMinutes = typeof score?.sleep_need_minutes === 'number'
            ? Math.round(score.sleep_need_minutes)
            : (score?.sleep_need?.need_minutes ? Math.round(score.sleep_need.need_minutes) : (score?.sleep_need?.need_milli ? Math.round(score.sleep_need.need_milli / 60000) : null));

        let html = `
            <div class="sleep-summary">
                <div class="summary-header">
                    <div>
                        <div class="summary-title">Sleep on ${startDate.toLocaleDateString()}</div>
                        <div class="summary-subtitle">${startDate.toLocaleTimeString()} → ${endDate.toLocaleTimeString()} • ${duration}h ${durationMinutes}m</div>
                    </div>
                    <div class="summary-badges">
                        ${performance !== null ? `<span class="badge">Performance ${performance}%</span>` : ''}
                        ${efficiency !== null ? `<span class="badge badge-outline">Efficiency ${efficiency}%</span>` : ''}
                    </div>
                </div>
                ${score ? `
                <div class="sleep-stages">
                    <div class="stage-bar">
                        <div class="stage-segment stage-deep" style="width:${pct(deep)}%" title="Deep: ${deep}m"></div>
                        <div class="stage-segment stage-rem" style="width:${pct(rem)}%" title="REM: ${rem}m"></div>
                        <div class="stage-segment stage-light" style="width:${pct(light)}%" title="Light: ${light}m"></div>
                        <div class="stage-segment stage-awake" style="width:${pct(awake)}%" title="Awake: ${awake}m"></div>
                    </div>
                    <div class="stage-legend">
                        <div class="legend-item"><span class="dot stage-deep"></span> Deep ${deep}m</div>
                        <div class="legend-item"><span class="dot stage-rem"></span> REM ${rem}m</div>
                        <div class="legend-item"><span class="dot stage-light"></span> Light ${light}m</div>
                        <div class="legend-item"><span class="dot stage-awake"></span> Awake ${awake}m</div>
                    </div>
                </div>
                <div class="sleep-kpis">
                    ${typeof score.average_heart_rate === 'number' ? `
                        <div class="kpi-card">
                            <div class="kpi-label">Avg HR</div>
                            <div class="kpi-value">${Math.round(score.average_heart_rate)}</div>
                        </div>` : ''}
                    ${typeof score.max_heart_rate === 'number' ? `
                        <div class="kpi-card">
                            <div class="kpi-label">Max HR</div>
                            <div class="kpi-value">${Math.round(score.max_heart_rate)}</div>
                        </div>` : ''}
                    ${typeof score.respiratory_rate === 'number' ? `
                        <div class="kpi-card">
                            <div class="kpi-label">Resp Rate</div>
                            <div class="kpi-value">${Number(score.respiratory_rate).toFixed(1)}</div>
                        </div>` : ''}
                    ${sleepNeedMinutes !== null ? `
                        <div class="kpi-card">
                            <div class="kpi-label">Sleep Need</div>
                            <div class="kpi-value">${Math.floor((sleepNeedMinutes as number) / 60)}h ${Math.round((sleepNeedMinutes as number) % 60)}m</div>
                        </div>` : ''}
                    ${typeof score.in_bed_duration_minutes === 'number' ? `
                        <div class="kpi-card">
                            <div class="kpi-label">In Bed</div>
                            <div class="kpi-value">${Math.floor(score.in_bed_duration_minutes / 60)}h ${Math.round(score.in_bed_duration_minutes % 60)}m</div>
                        </div>` : ''}
                    ${typeof score.sleep_debt_minutes === 'number' ? `
                        <div class="kpi-card">
                            <div class="kpi-label">Sleep Debt</div>
                            <div class="kpi-value">${Math.floor(score.sleep_debt_minutes / 60)}h ${Math.round(score.sleep_debt_minutes % 60)}m</div>
                        </div>` : ''}
                </div>
                ` : ''}
            </div>

            <div class="activity-detail-grid">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Sleep ID:</span>
                        <span class="detail-value">${sleep.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Cycle ID:</span>
                        <span class="detail-value">${sleep.cycle_id || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Bedtime:</span>
                        <span class="detail-value">${startDate.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Wake Time:</span>
                        <span class="detail-value">${endDate.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Duration:</span>
                        <span class="detail-value">${duration}h ${durationMinutes}m</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Score State:</span>
                        <span class="detail-value">${sleep.score_state || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${sleep.timezone_offset || 'N/A'}</span>
                    </div>
                </div>
        `;

        if (sleep.score) {
            html += `
                <div class="detail-section">
                    <h4>Sleep Metrics</h4>
            `;
            
            // Key sleep metrics
            const keyMetrics: Record<string, string> = {
                'sleep_efficiency_percentage': 'Sleep Efficiency (%)',
                'sleep_performance_percentage': 'Sleep Performance (%)',
                'sleep_consistency_percentage': 'Sleep Consistency (%)',
                'sleep_need_minutes': 'Sleep Need (minutes)',
                'average_heart_rate': 'Average Heart Rate',
                'slow_wave_sleep_minutes': 'Deep Sleep (minutes)',
                'rem_sleep_minutes': 'REM Sleep (minutes)',
                'light_sleep_minutes': 'Light Sleep (minutes)',
                'awake_time_minutes': 'Awake Time (minutes)',
                'in_bed_duration_minutes': 'Time in Bed (minutes)',
                'no_data_duration_minutes': 'No Data Time (minutes)',
                'sleep_debt_minutes': 'Sleep Debt (minutes)',
                'sleep_debt_running_total_minutes': 'Sleep Debt Total (minutes)',
                'kilojoule': 'Energy Burned (kJ)',
                'max_heart_rate': 'Max Heart Rate',
                'respiratory_rate': 'Respiratory Rate'
            };
            
            const renderScalar = (label: string, value: any) => {
                let displayValue: string = '';
                if (typeof value === 'number') {
                    displayValue = Number.isInteger(value) ? String(value) : Number(value).toFixed(2);
                } else if (typeof value === 'boolean') {
                    displayValue = value ? 'Yes' : 'No';
                } else if (value instanceof Date) {
                    displayValue = value.toLocaleString();
                } else {
                    displayValue = String(value);
                }
                html += `
                    <div class="detail-row">
                        <span class="detail-label">${label}:</span>
                        <span class="detail-value">${displayValue}</span>
                    </div>
                `;
            };

            const humanLabel = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            const renderObject = (title: string, obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                html += `<div class="detail-section"><h4>${title}</h4>`;
                Object.entries(obj).forEach(([k, v]) => {
                    if (v === null || v === undefined) return;
                    if (typeof v === 'object' && !Array.isArray(v)) {
                        // Nested subsection
                        html += `<div class="kv-subsection"><div class="kv-subtitle">${humanLabel(k)}</div>`;
                        Object.entries(v as any).forEach(([kk, vv]) => {
                            if (vv === null || vv === undefined) return;
                            const label = humanLabel(kk);
                            if (typeof vv === 'number' && kk.includes('milli')) {
                                const minutes = Math.round((vv as number) / 60000);
                                renderScalar(label.replace(/_milli/i, ''), minutes + 'm');
                            } else if (typeof vv === 'number' && kk.includes('minutes')) {
                                const hours = Math.floor((vv as number) / 60);
                                const mins = Math.round((vv as number) % 60);
                                renderScalar(label, (hours > 0 ? `${hours}h ` : '') + `${mins}m`);
                            } else {
                                renderScalar(label, vv);
                            }
                        });
                        html += `</div>`;
                    } else {
                        const label = humanLabel(k);
                        if (typeof v === 'number' && k.includes('milli')) {
                            const minutes = Math.round((v as number) / 60000);
                            renderScalar(label.replace(/_milli/i, ''), minutes + 'm');
                        } else if (typeof v === 'number' && k.includes('minutes')) {
                            const hours = Math.floor((v as number) / 60);
                            const mins = Math.round((v as number) % 60);
                            renderScalar(label, (hours > 0 ? `${hours}h ` : '') + `${mins}m`);
                        } else {
                            renderScalar(label, v);
                        }
                    }
                });
                html += `</div>`;
            };

            // Render known scalar metrics first
            Object.entries(sleep.score).forEach(([key, value]) => {
                if (value === null || value === undefined) return;
                if (typeof value === 'object') return; // skip for object rendering below
                const displayKey = keyMetrics[key] || humanLabel(key);
                if (typeof value === 'number' && key.includes('percentage')) {
                    renderScalar(displayKey, Math.round(value) + '%');
                } else if (typeof value === 'number' && key.includes('minutes')) {
                    const hours = Math.floor(value / 60);
                    const mins = Math.round(value % 60);
                    renderScalar(displayKey, (hours > 0 ? `${hours}h ` : '') + `${mins}m`);
                } else {
                    renderScalar(displayKey, value);
                }
            });

            // Render specific nested objects with nicer layouts if present
            if (score?.stage_summary) {
                renderObject('Stage Summary', score.stage_summary);
            }
            if (score?.sleep_need) {
                renderObject('Sleep Need', score.sleep_need);
            }
            if (score?.quality_duration) {
                // In case API nests quality details under quality_duration
                renderObject('Quality Duration', score.quality_duration);
            }
            
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }

    private async loadNextPage(): Promise<void> {
        if (!this.nextToken || this.isLoading) return;

        // Store current token for previous page
        this.previousTokens.push(this.nextToken);
        this.currentPage++;
        
        await this.loadSleep();
    }

    private async loadPreviousPage(): Promise<void> {
        if (this.currentPage <= 1 || this.isLoading) return;

        this.currentPage--;
        
        // Get previous token
        this.nextToken = this.previousTokens.pop() || null;
        
        await this.loadSleep();
    }

    private resetPagination(): void {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
    }

    private updatePaginationControls(): void {
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const pageInfo = document.getElementById('page-info');
        const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;

        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = !this.nextToken;
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage}`;

        // Show/hide load more button
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.nextToken ? 'block' : 'none';
        }
    }

    private showLoading(): void {
        const container = document.getElementById('sleeps-content');
        if (container) {
            container.innerHTML = '<div class="loading">Loading sleep data...</div>';
        }
    }

    private hideLoading(): void {
        // Loading is hidden by displaySleep() creating the grid
    }

    private showError(message: string): void {
        const container = document.getElementById('sleeps-content');
        if (container) {
            container.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    private hideError(): void {
        // Error is hidden by displaySleep() replacing content
    }
}

// Initialize the sleep page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.whoopSleep = new WhoopSleep();
});