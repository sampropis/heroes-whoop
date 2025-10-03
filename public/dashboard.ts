// Dashboard TypeScript for WHOOP API Test Site

import { WhoopUser, WhoopCycle, WhoopRecovery } from './types/whoop';

interface Profile {
    first_name: string;
    last_name: string;
    email: string;
    user_id: string;
}

interface CycleScore {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
}

interface CycleData {
    records: Array<{
        start: string;
        score_state: string;
        score?: CycleScore;
    }>;
}

interface RecoveryScore {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
}

interface RecoveryData {
    records: Array<{
        score?: RecoveryScore;
    }>;
}

interface SessionStatus {
    sessionId?: string;
    backgroundRefresh: boolean;
    timeUntilExpiry?: number;
}

declare global {
    interface Window {
        whoopAuth: any; // TODO: Import WhoopAuth type when module system is set up
    }
}

class WhoopDashboard {
    constructor() {
        this.init();
    }

    async init(): Promise<void> {
        try {
            // Check authentication first
            if (!await window.whoopAuth.init()) {
                return; // Will redirect to login if not authenticated
            }
            
            await this.loadUserProfile();
            await this.loadBySelectedDate();
            await this.loadSessionStatus();
            this.setupEventListeners();
        } catch (error) {
            console.error('Dashboard initialization failed:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    private getSelectedDateRange(): { startIso: string; endIso: string } {
        const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
        const base = dateInput && dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
        const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
    }

    private async loadBySelectedDate(): Promise<void> {
        this.updateSectionHeadings();
        await this.loadCycleByDate();
        await this.loadRecoveryByDate();
        await this.loadActivitiesByDate();
    }

    private updateSectionHeadings(): void {
        const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
        const titleCycle = document.querySelector('.today-cycle h2');
        const titleRecovery = document.querySelector('.recovery h2');
        const titleActivities = document.querySelector('.todays-activities h2');

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const selectedStr = dateInput?.value || todayStr;
        const isToday = selectedStr === todayStr;

        const nice = new Date(selectedStr + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

        if (titleCycle) titleCycle.textContent = isToday ? "Today's Cycle" : `Cycle on ${nice}`;
        if (titleRecovery) titleRecovery.textContent = isToday ? "Today's Recovery" : `Recovery on ${nice}`;
        if (titleActivities) titleActivities.textContent = isToday ? "Today's Activities" : `Activities on ${nice}`;
    }

    async loadUserProfile(): Promise<void> {
        try {
            const response = await window.whoopAuth.apiRequest('/api/profile');
            if (!response.ok) throw new Error('Failed to fetch profile');
            
            const profile = await response.json() as Profile;
            this.displayUserProfile(profile);
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.showError('Failed to load profile', 'profile-content');
        }
    }

    async loadTodaysCycle(): Promise<void> {
        try {
            const response = await window.whoopAuth.apiRequest('/api/cycle/today');
            if (!response.ok) throw new Error('Failed to fetch today\'s cycle');
            
            const cycleData = await response.json() as CycleData;
            this.displayTodaysCycle(cycleData);
        } catch (error) {
            console.error('Failed to load today\'s cycle:', error);
            this.showError('Failed to load today\'s cycle data', 'today-cycle-content');
        }
    }

    private async loadCycleByDate(): Promise<void> {
        try {
            const { startIso, endIso } = this.getSelectedDateRange();
            const params = new URLSearchParams({ start: startIso, end: endIso, limit: '5' });
            const response = await window.whoopAuth.apiRequest(`/api/cycles?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch cycle by date');
            const data = await response.json() as CycleData;
            this.displayTodaysCycle(data);
        } catch (error) {
            console.error('Failed to load cycle by date:', error);
            this.showError('Failed to load cycle data', 'today-cycle-content');
        }
    }

    async loadRecoveryData(): Promise<void> {
        try {
            const response = await window.whoopAuth.apiRequest('/api/recovery?limit=1');
            if (!response.ok) throw new Error('Failed to fetch recovery data');
            
            const recoveryData = await response.json() as RecoveryData;
            this.displayRecoveryData(recoveryData);
        } catch (error) {
            console.error('Failed to load recovery data:', error);
            this.showError('Failed to load recovery data', 'recovery-content');
        }
    }

    private async loadRecoveryByDate(): Promise<void> {
        try {
            const { startIso, endIso } = this.getSelectedDateRange();
            const params = new URLSearchParams({ start: startIso, end: endIso, limit: '1' });
            const response = await window.whoopAuth.apiRequest(`/api/recovery?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch recovery by date');
            const data = await response.json() as RecoveryData;
            this.displayRecoveryData(data);
        } catch (error) {
            console.error('Failed to load recovery by date:', error);
            this.showError('Failed to load recovery data', 'recovery-content');
        }
    }

    async loadRecentCycles(): Promise<void> {
        try {
            const response = await window.whoopAuth.apiRequest('/api/cycles?limit=5');
            if (!response.ok) throw new Error('Failed to fetch recent cycles');
            
            const cyclesData = await response.json() as CycleData;
            this.displayRecentCycles(cyclesData);
        } catch (error) {
            console.error('Failed to load recent cycles:', error);
            this.showError('Failed to load today\'s activities', 'todays-activities-content');
        }
    }

    async loadTodaysActivities(): Promise<void> {
        try {
            // Simpler and robust: fetch recent and filter client-side (same shape as activities.ts)
            const limit = '25';
            const response = await window.whoopAuth.apiRequest(`/api/activities?limit=${limit}`);
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                this.showError(`Failed to load today's activities${text ? `: ${text}` : ''}`, 'todays-activities-content');
                return;
            }
            const data = await response.json() as { records?: Array<{ id: string; sport_id?: number; start?: string; end?: string; created_at?: string; score?: { strain?: number; average_heart_rate?: number; kilojoule?: number; }; }>; next_token?: string };
            this.displayTodaysActivities(data);
        } catch (error) {
            console.error('Failed to load today\'s activities:', error);
            this.showError('Failed to load today\'s activities', 'todays-activities-content');
        }
    }

    private async loadActivitiesByDate(): Promise<void> {
        try {
            const { startIso, endIso } = this.getSelectedDateRange();
            const params = new URLSearchParams({ limit: '25', start: startIso, end: endIso });
            const response = await window.whoopAuth.apiRequest(`/api/activities?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch activities by date');
            const data = await response.json() as { records?: Array<{ id: string; sport_id?: number; start?: string; end?: string; created_at?: string; score?: { strain?: number; average_heart_rate?: number; kilojoule?: number; }; }>; };
            this.displayTodaysActivities(data);
        } catch (error) {
            console.error('Failed to load activities by date:', error);
            this.showError('Failed to load today\'s activities', 'todays-activities-content');
        }
    }

    displayTodaysActivities(data: { records?: Array<{ id: string; sport_id?: number; start?: string; end?: string; created_at?: string; score?: { strain?: number; average_heart_rate?: number; kilojoule?: number; }; }>; }): void {
        const container = document.getElementById('todays-activities-content');
        if (!container) return;

        const records = (data.records || []).filter(r => {
            // Ensure same-day as today (local time)
            const dateStr = r.start || r.created_at || '';
            const d = dateStr ? new Date(dateStr) : new Date(NaN);
            const now = new Date();
            if (isNaN(d.getTime())) return false;
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        });

        if (records.length === 0) {
            container.innerHTML = '<div class="empty">No activities recorded today</div>';
            return;
        }

        const gridOpen = '<div class="dashboard-grid">';
        const items = records.slice(0, 6).map(act => {
            const timeSource = act.start || act.created_at || '';
            const dateObj = timeSource ? new Date(timeSource) : new Date(NaN);
            const time = isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleTimeString();
            const strain = act.score?.strain != null ? act.score.strain.toFixed(1) : '—';
            const avgHr = act.score?.average_heart_rate != null ? String(act.score.average_heart_rate) : '—';
            const kj = act.score?.kilojoule != null ? String(Math.round(act.score.kilojoule)) : '—';
            return `
                <section class="card">
                    <div class="cycle-header">
                        <span class="cycle-date">${time}</span>
                        <span class="cycle-status status-scored">Activity</span>
                    </div>
                    <div class="cycle-metrics">
                        <div class="metric">
                            <span class="metric-value">${strain}</span>
                            <span class="metric-label">Strain</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${avgHr}</span>
                            <span class="metric-label">Avg HR</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${kj}</span>
                            <span class="metric-label">kJ</span>
                        </div>
                    </div>
                </section>`;
        }).join('');

        container.innerHTML = gridOpen + items + '</div>';
    }

    async loadSessionStatus(): Promise<void> {
        try {
            const response = await fetch('/auth/status');
            if (!response.ok) throw new Error('Failed to fetch session status');
            
            const status = await response.json() as SessionStatus;
            this.displaySessionStatus(status);
        } catch (error) {
            console.error('Failed to load session status:', error);
        }
    }

    displayUserProfile(profile: Profile): void {
        const userName = document.getElementById('user-name');
        const profileContent = document.getElementById('profile-content');
        
        if (userName) {
            userName.textContent = `${profile.first_name} ${profile.last_name}`;
        }
        
        if (profileContent) {
            profileContent.innerHTML = `
                <div class="profile-info">
                    <div class="profile-item">
                        <span class="profile-label">Name:</span>
                        <span class="profile-value">${profile.first_name} ${profile.last_name}</span>
                    </div>
                    <div class="profile-item">
                        <span class="profile-label">Email:</span>
                        <span class="profile-value">${profile.email}</span>
                    </div>
                    <div class="profile-item">
                        <span class="profile-label">User ID:</span>
                        <span class="profile-value">${profile.user_id}</span>
                    </div>
                </div>
            `;
        }
    }

    displayTodaysCycle(cycleData: CycleData): void {
        const content = document.getElementById('today-cycle-content');
        if (!content) return;
        
        if (!cycleData.records || cycleData.records.length === 0) {
            content.innerHTML = '<div class="empty">No cycle data available for today</div>';
            return;
        }

        const todayCycle = cycleData.records[0];
        const cycleDate = new Date(todayCycle.start).toLocaleDateString();
        const cycleTime = new Date(todayCycle.start).toLocaleTimeString();

        content.innerHTML = `
            <div class="cycle-item">
                <div class="cycle-header">
                    <span class="cycle-date">${cycleDate}</span>
                    <span class="cycle-status ${todayCycle.score_state.toLowerCase() === 'scored' ? 'status-scored' : 'status-pending'}">
                        ${todayCycle.score_state}
                    </span>
                </div>
                <div class="cycle-time">
                    <small>Started: ${cycleTime}</small>
                </div>
                ${todayCycle.score ? this.renderCycleMetrics(todayCycle.score) : '<div class="empty">Cycle data pending</div>'}
            </div>
        `;
    }

    displayRecoveryData(recoveryData: RecoveryData): void {
        const content = document.getElementById('recovery-content');
        if (!content) return;
        
        if (!recoveryData.records || recoveryData.records.length === 0) {
            content.innerHTML = '<div class="empty">No recovery data available</div>';
            return;
        }

        const recovery = recoveryData.records[0];
        
        if (!recovery.score) {
            content.innerHTML = '<div class="empty">Recovery score pending</div>';
            return;
        }

        const score = recovery.score;
        const scoreClass = this.getRecoveryScoreClass(score.recovery_score);

        content.innerHTML = `
            <div class="recovery-score">
                <span class="recovery-score-value ${scoreClass}">${Math.round(score.recovery_score)}%</span>
                <div class="metric-label">Recovery Score</div>
            </div>
            <div class="recovery-metrics">
                <div class="metric">
                    <span class="metric-value">${Math.round(score.resting_heart_rate)}</span>
                    <span class="metric-label">Resting HR</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${Number(score.hrv_rmssd_milli).toFixed(1)} ms</span>
                    <span class="metric-label">HRV</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${Number(score.spo2_percentage).toFixed(1)}%</span>
                    <span class="metric-label">SpO2</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${Number(score.skin_temp_celsius).toFixed(1)}°C</span>
                    <span class="metric-label">Skin Temp</span>
                </div>
            </div>
        `;
    }

    private getRecoveryScoreClass(score?: number): string {
        if (typeof score !== 'number') return '';
        if (score >= 67) return 'recovery-green';
        if (score >= 34) return 'recovery-yellow';
        return 'recovery-red';
    }

    displayRecentCycles(cyclesData: CycleData): void {
        const content = document.getElementById('recent-cycles-content');
        if (!content) return;
        
        if (!cyclesData.records || cyclesData.records.length === 0) {
            content.innerHTML = '<div class="empty">No recent cycles available</div>';
            return;
        }

        const cyclesHtml = cyclesData.records.map(cycle => {
            const cycleDate = new Date(cycle.start).toLocaleDateString();
            const cycleTime = new Date(cycle.start).toLocaleTimeString();
            
            return `
                <div class="cycle-item">
                    <div class="cycle-header">
                        <span class="cycle-date">${cycleDate}</span>
                        <span class="cycle-status ${cycle.score_state.toLowerCase() === 'scored' ? 'status-scored' : 'status-pending'}">
                            ${cycle.score_state}
                        </span>
                    </div>
                    <div class="cycle-time">
                        <small>Started: ${cycleTime}</small>
                    </div>
                    ${cycle.score ? this.renderCycleMetrics(cycle.score) : '<div class="empty">Cycle data pending</div>'}
                </div>
            `;
        }).join('');

        content.innerHTML = cyclesHtml;
    }

    displaySessionStatus(status: SessionStatus): void {
        const userInfo = document.querySelector('.user-info');
        if (!userInfo) return;

        // Remove existing session info if present
        const existingInfo = userInfo.querySelector('.session-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        // Create session info display
        const sessionInfo = document.createElement('div');
        sessionInfo.className = 'session-info';
        sessionInfo.style.fontSize = '0.8rem';
        sessionInfo.style.color = '#666';
        sessionInfo.style.marginBottom = '10px';
        
        const timeUntilExpiry = status.timeUntilExpiry;
        let expiryText = '';
        if (timeUntilExpiry) {
            const minutes = Math.floor(timeUntilExpiry / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            if (hours > 0) {
                expiryText = `Token expires in ${hours}h ${minutes % 60}m`;
            } else {
                expiryText = `Token expires in ${minutes}m`;
            }
        }
        
        sessionInfo.innerHTML = `
            <div>Session: ${status.sessionId ? status.sessionId.substring(0, 8) + '...' : 'N/A'}</div>
            <div>Background Refresh: ${status.backgroundRefresh ? '✅ Active' : '❌ Inactive'}</div>
            ${expiryText ? `<div>${expiryText}</div>` : ''}
        `;
        
        userInfo.insertBefore(sessionInfo, userInfo.firstChild);
    }

    renderCycleMetrics(score: CycleScore): string {
        return `
            <div class="cycle-metrics">
                <div class="metric">
                    <span class="metric-value">${score.strain.toFixed(1)}</span>
                    <span class="metric-label">Strain</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${score.average_heart_rate}</span>
                    <span class="metric-label">Avg HR</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${score.max_heart_rate}</span>
                    <span class="metric-label">Max HR</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${Math.round(score.kilojoule)}</span>
                    <span class="metric-label">Kilojoules</span>
                </div>
            </div>
        `;
    }

    showError(message: string, containerId: string | null = null): void {
        const errorHtml = `<div class="error">${message}</div>`;
        
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = errorHtml;
            }
        } else {
            // Show global error
            console.error(message);
        }
    }

    async logout(): Promise<void> {
        try {
            await window.whoopAuth.logout();
            // whoopAuth.logout() handles clearing tokens and redirecting
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Logout failed. Please try again.');
        }
    }

    setupEventListeners(): void {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Date and refresh controls
        const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
        const refreshBtn = document.getElementById('dashboard-refresh-btn');
        const openDateBtn = document.getElementById('open-date-picker-btn');
        const apply = () => this.loadBySelectedDate();
        if (dateInput) {
            // Default to today on first load
            if (!dateInput.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                dateInput.value = `${yyyy}-${mm}-${dd}`;
            }
            dateInput.addEventListener('change', apply);
        }
        if (refreshBtn) refreshBtn.addEventListener('click', apply);
        if (openDateBtn && dateInput) {
            openDateBtn.addEventListener('click', () => {
                try {
                    (dateInput as any).showPicker();
                } catch {
                    dateInput.focus();
                    dateInput.click();
                }
            });
        }

        // Add refresh functionality
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                location.reload();
            }
        });

        // Refresh session status every 30 seconds
        setInterval(() => {
            this.loadSessionStatus();
        }, 30000);
    }

    // Utility function to format dates
    formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Utility function to format time
    formatTime(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhoopDashboard();
});

// Handle authentication errors
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (event.reason && event.reason.message && event.reason.message.includes('401')) {
        // Redirect to login on authentication error
        window.location.href = '/';
    }
});