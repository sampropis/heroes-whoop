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
    stage_summary?: {
        total_in_bed_time_milli: number;
        total_awake_time_milli: number;
        total_no_data_time_milli: number;
        total_light_sleep_time_milli: number;
        total_slow_wave_sleep_time_milli: number;
        total_rem_sleep_time_milli: number;
        sleep_cycle_count: number;
        disturbance_count: number;
    };
}

interface SleepData {
    records: Array<{
        id: string;
        start: string;
        end: string;
        score_state: string;
        score?: SleepScore;
        timezone_offset?: string;
        cycle_id?: string;
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
            // Session status only shown on debug page
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
        await this.loadSleepByDate();
        await this.loadActivitiesByDate();
    }

    private updateSectionHeadings(): void {
        const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
        const titleCycle = document.querySelector('.today-cycle h2');
        const titleRecovery = document.querySelector('.recovery h2');
        const titleSleep = document.querySelector('.todays-sleep h2');
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
        if (titleSleep) titleSleep.textContent = isToday ? "Today's Sleep" : `Sleep for ${nice}`;
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

    private async loadSleepByDate(): Promise<void> {
        try {
            // For sleep, we want to get sleep that ended around the selected date
            // Sleep typically spans across two calendar days, so we'll look for sleep that ended on or near the selected date
            const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
            const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();
            
            // Look for sleep from 24 hours before to 12 hours after the selected date
            const startTime = new Date(selectedDate.getTime() - (24 * 60 * 60 * 1000)); // 24 hours before
            const endTime = new Date(selectedDate.getTime() + (12 * 60 * 60 * 1000)); // 12 hours after
            
            const params = new URLSearchParams({ 
                start: startTime.toISOString(), 
                end: endTime.toISOString(), 
                limit: '3' 
            });
            const response = await window.whoopAuth.apiRequest(`/api/sleep?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch sleep by date');
            const data = await response.json() as SleepData;
            this.displaySleepData(data);
        } catch (error) {
            console.error('Failed to load sleep by date:', error);
            this.showError('Failed to load sleep data', 'todays-sleep-content');
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

    displayTodaysActivities(data: { records?: Array<{ id: string; sport_id?: number; sport_name?: string; start?: string; end?: string; created_at?: string; score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number; kilojoule?: number; distance_meter?: number; altitude_gain_meter?: number; percent_recorded?: number; }; }>; }): void {
        const container = document.getElementById('todays-activities-content');
        if (!container) return;

        // Get the selected date for filtering
        const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
        const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value + 'T00:00:00') : new Date();

        const records = (data.records || []).filter(r => {
            // Ensure same-day as selected date (local time)
            const dateStr = r.start || r.created_at || '';
            const d = dateStr ? new Date(dateStr) : new Date(NaN);
            if (isNaN(d.getTime())) return false;
            return d.getFullYear() === selectedDate.getFullYear() && 
                   d.getMonth() === selectedDate.getMonth() && 
                   d.getDate() === selectedDate.getDate();
        });

        if (records.length === 0) {
            const dateInput = document.getElementById('dashboard-date') as HTMLInputElement | null;
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;
            const selectedStr = dateInput?.value || todayStr;
            const isToday = selectedStr === todayStr;
            
            const emptyMessage = isToday ? 'No activities recorded today' : `No activities recorded on ${new Date(selectedStr + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
            container.innerHTML = `<div class="empty">${emptyMessage}</div>`;
            return;
        }

        const items = records.slice(0, 6).map(act => {
            // Activity type and icon
            const activityType = act.sport_name || this.getSportName(act.sport_id) || 'Activity';
            const activityIcon = this.getSportIcon(act.sport_id);
            
            // Time information
            const timeSource = act.start || act.created_at || '';
            const dateObj = timeSource ? new Date(timeSource) : new Date(NaN);
            const time = isNaN(dateObj.getTime()) ? '—' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Duration calculation
            const duration = act.start && act.end ? this.formatDurationFromTimes(act.start, act.end) : '—';
            
            // Core metrics
            const strain = act.score?.strain != null ? act.score.strain.toFixed(1) : '—';
            const avgHr = act.score?.average_heart_rate != null ? String(act.score.average_heart_rate) : '—';
            const maxHr = act.score?.max_heart_rate != null ? String(act.score.max_heart_rate) : '—';
            const calories = act.score?.kilojoule != null ? this.formatCalories(act.score.kilojoule) : '—';
            
            // Strain class for color coding
            const strainClass = this.getStrainClass(parseFloat(strain));
            
            return `
                <div class="activity-item-compact">
                    <div class="activity-item-header">
                        <div class="activity-info">
                            <span class="activity-icon">${activityIcon}</span>
                            <div class="activity-meta">
                                <span class="activity-name">${activityType}</span>
                                <span class="activity-time">${time}</span>
                            </div>
                        </div>
                        <div class="activity-duration">
                            <span class="duration-value">${duration}</span>
                            <span class="duration-label">Duration</span>
                        </div>
                    </div>
                    
                    <div class="activity-metrics-compact">
                        <div class="metric-compact metric-strain">
                            <span class="metric-value strain-${strainClass}">${strain}</span>
                            <span class="metric-label">Strain</span>
                        </div>
                        <div class="metric-compact">
                            <span class="metric-value">${avgHr}</span>
                            <span class="metric-label">Avg HR</span>
                        </div>
                        <div class="metric-compact">
                            <span class="metric-value">${maxHr}</span>
                            <span class="metric-label">Max HR</span>
                        </div>
                        <div class="metric-compact">
                            <span class="metric-value">${calories}</span>
                            <span class="metric-label">Calories</span>
                        </div>
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = items;
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
        const userInitials = document.getElementById('user-initials');
        const profileContentHeader = document.getElementById('profile-content-header');
        
        if (userName) {
            userName.textContent = `${profile.first_name} ${profile.last_name}`;
        }
        
        // Generate initials for avatar
        if (userInitials) {
            const initials = `${profile.first_name.charAt(0).toUpperCase()}${profile.last_name.charAt(0).toUpperCase()}`;
            userInitials.textContent = initials;
        }
        
        // Populate the dropdown profile content
        if (profileContentHeader) {
            profileContentHeader.innerHTML = `
                <div class="profile-dropdown-header">
                    <div class="profile-avatar-dropdown">
                        <div class="avatar-circle-dropdown">
                            <span class="avatar-initials-dropdown">${profile.first_name.charAt(0).toUpperCase()}${profile.last_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div class="profile-name-dropdown">
                            <h4>${profile.first_name} ${profile.last_name}</h4>
                            <span class="profile-email-dropdown">${profile.email}</span>
                        </div>
                    </div>
                </div>
                <div class="profile-details-dropdown">
                    <div class="profile-item-dropdown">
                        <span class="profile-label-dropdown">User ID:</span>
                        <span class="profile-value-dropdown">${profile.user_id}</span>
                    </div>
                    <div class="profile-item-dropdown">
                        <span class="profile-label-dropdown">Status:</span>
                        <span class="profile-value-dropdown status-active-dropdown">Active</span>
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
        const cycleTime = new Date(todayCycle.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (!todayCycle.score) {
            content.innerHTML = `
                <div class="compact-header">
                    <span class="compact-date">${cycleDate}</span>
                    <span class="cycle-status ${todayCycle.score_state.toLowerCase() === 'scored' ? 'status-scored' : 'status-pending'}">
                        ${todayCycle.score_state}
                    </span>
                </div>
                <div class="compact-time">Started: ${cycleTime}</div>
                <div class="empty">Cycle data pending</div>
            `;
            return;
        }

        const score = todayCycle.score;

        content.innerHTML = `
            <div class="compact-header">
                <span class="compact-date">${cycleDate}</span>
                <span class="cycle-status ${todayCycle.score_state.toLowerCase() === 'scored' ? 'status-scored' : 'status-pending'}">
                    ${todayCycle.score_state}
                </span>
            </div>
            <div class="compact-time">Started: ${cycleTime}</div>
            <div class="compact-metrics">
                <div class="metric-compact">
                    <span class="metric-value">${score.strain.toFixed(1)}</span>
                    <span class="metric-label">Strain</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${score.average_heart_rate}</span>
                    <span class="metric-label">Avg HR</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${score.max_heart_rate}</span>
                    <span class="metric-label">Max HR</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${this.formatCalories(score.kilojoule)}</span>
                    <span class="metric-label">Calories</span>
                </div>
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
            <div class="recovery-score-compact">
                <span class="recovery-score-value ${scoreClass}">${Math.round(score.recovery_score)}%</span>
                <span class="recovery-score-label">Recovery Score</span>
            </div>
            <div class="compact-metrics">
                <div class="metric-compact">
                    <span class="metric-value">${Math.round(score.resting_heart_rate)}</span>
                    <span class="metric-label">Resting HR</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${Number(score.hrv_rmssd_milli).toFixed(1)} ms</span>
                    <span class="metric-label">HRV</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${Number(score.spo2_percentage).toFixed(1)}%</span>
                    <span class="metric-label">SpO2</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${Number(score.skin_temp_celsius).toFixed(1)}°C</span>
                    <span class="metric-label">Skin Temp</span>
                </div>
            </div>
        `;
    }

    displaySleepData(sleepData: SleepData): void {
        const content = document.getElementById('todays-sleep-content');
        if (!content) return;
        
        if (!sleepData.records || sleepData.records.length === 0) {
            content.innerHTML = '<div class="empty">No sleep data available</div>';
            return;
        }

        // Get the most recent sleep (typically the one that ended most recently)
        const sleep = sleepData.records[0];
        
        if (!sleep.score) {
            content.innerHTML = '<div class="empty">Sleep score pending</div>';
            return;
        }

        const score = sleep.score;
        const startTime = new Date(sleep.start);
        const endTime = new Date(sleep.end);
        
        // Calculate total sleep duration (time in bed minus awake time)
        let sleepHours = 0;
        let sleepMinutes = 0;
        
        if (score.stage_summary) {
            const totalSleepMilli = score.stage_summary.total_in_bed_time_milli - score.stage_summary.total_awake_time_milli;
            const totalMinutes = Math.round(totalSleepMilli / 60000);
            sleepHours = Math.floor(totalMinutes / 60);
            sleepMinutes = totalMinutes % 60;
        } else {
            // Fallback to in_bed_duration_minutes if stage_summary not available
            const totalMinutes = score.in_bed_duration_minutes || 0;
            sleepHours = Math.floor(totalMinutes / 60);
            sleepMinutes = totalMinutes % 60;
        }
        
        // Calculate sleep efficiency class for color coding
        const efficiencyClass = this.getSleepEfficiencyClass(score.sleep_efficiency_percentage);
        
        content.innerHTML = `
            <div class="compact-header">
                <span class="compact-date">${startTime.toLocaleDateString()}</span>
                <span class="compact-duration">${sleepHours}h ${sleepMinutes}m</span>
            </div>
            <div class="compact-time">${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            
            <div class="sleep-efficiency-compact">
                <span class="efficiency-value ${efficiencyClass}">${score.sleep_efficiency_percentage != null ? Math.round(score.sleep_efficiency_percentage) + '%' : '—'}</span>
                <span class="efficiency-label">Sleep Efficiency</span>
            </div>
            
            <div class="compact-metrics" style="margin-top: 12px;">
                <div class="metric-compact">
                    <span class="metric-value">${score.sleep_performance_percentage != null ? Math.round(score.sleep_performance_percentage) + '%' : '—'}</span>
                    <span class="metric-label">Performance</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${score.sleep_consistency_percentage != null ? Math.round(score.sleep_consistency_percentage) + '%' : '—'}</span>
                    <span class="metric-label">Consistency</span>
                </div>
                <div class="metric-compact">
                    <span class="metric-value">${score.respiratory_rate != null ? Number(score.respiratory_rate).toFixed(1) : '—'}</span>
                    <span class="metric-label">Resp Rate</span>
                </div>
            </div>
            
            ${score.stage_summary ? this.renderSleepStagesBar(score.stage_summary) : ''}
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

        // Profile dropdown functionality
        const profileTrigger = document.querySelector('.profile-trigger');
        const profileDropdown = document.getElementById('profile-dropdown');
        
        if (profileTrigger && profileDropdown) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.classList.toggle('show');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!profileTrigger.contains(e.target as Node)) {
                    profileDropdown.classList.remove('show');
                }
            });
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

    // Helper methods for enhanced activity display
    private getSportName(sportId?: number): string {
        if (typeof sportId !== 'number') return 'Activity';
        const sportMap: Record<number, string> = {
            0: 'Running',
            1: 'Cycling', 
            2: 'Swimming',
            3: 'Weightlifting',
            4: 'Yoga',
            5: 'Basketball',
            6: 'Soccer',
            7: 'Tennis',
            8: 'Boxing',
            9: 'Golf',
            10: 'Hiking',
            16: 'Baseball',
            17: 'Climbing',
            18: 'Cross Country Skiing',
            19: 'Elliptical',
            20: 'Football',
            21: 'Functional Fitness',
            22: 'Hockey',
            44: 'Rowing',
            51: 'Track and Field',
            52: 'Walking',
            63: 'Martial Arts',
            71: 'Dance',
            73: 'Outdoor Fitness',
        };
        return sportMap[sportId] || `Sport ${sportId}`;
    }

    private getSportIcon(sportId?: number): string {
        if (typeof sportId !== 'number') return '🏃‍♂️';
        const iconMap: Record<number, string> = {
            0: '🏃‍♂️',
            1: '🚴‍♂️',
            2: '🏊‍♂️',
            3: '🏋️‍♂️',
            4: '🧘‍♂️',
            5: '🏀',
            6: '⚽',
            7: '🎾',
            8: '🥊',
            9: '🏌️‍♂️',
            10: '🥾',
            16: '⚾',
            17: '🧗‍♂️',
            18: '⛷️',
            19: '🏃‍♂️',
            20: '🏈',
            21: '💪',
            22: '🏒',
            44: '🚣‍♂️',
            51: '🏃‍♂️',
            52: '🚶‍♂️',
            63: '🥋',
            71: '💃',
            73: '🏃‍♂️',
        };
        return iconMap[sportId] || '🏃‍♂️';
    }

    private formatDurationFromTimes(start: string, end: string): string {
        const startTime = new Date(start);
        const endTime = new Date(end);
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) return '—';
        
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        
        if (durationMinutes < 60) {
            return `${durationMinutes}m`;
        } else {
            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;
            return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
        }
    }

    private formatDistance(meters: number): string {
        if (meters < 1000) {
            return `${Math.round(meters)}m`;
        } else {
            const km = meters / 1000;
            return `${km.toFixed(1)}km`;
        }
    }

    private formatAltitude(meters: number): string {
        return `${Math.round(meters)}m`;
    }

    private getStrainClass(strain: number): string {
        if (isNaN(strain)) return 'low';
        if (strain >= 18) return 'very-high';
        if (strain >= 14) return 'high';
        if (strain >= 10) return 'moderate';
        return 'low';
    }

    private getSleepEfficiencyClass(efficiency: number): string {
        if (isNaN(efficiency)) return '';
        if (efficiency >= 85) return 'sleep-excellent';
        if (efficiency >= 75) return 'sleep-good';
        if (efficiency >= 65) return 'sleep-fair';
        return 'sleep-poor';
    }

    private formatCalories(kilojoules: number): string {
        // Convert kJ to kcal (1 kJ = 0.239006 kcal)
        const calories = Math.round(kilojoules * 0.239006);
        return `${calories} cal`;
    }

    private renderSleepStagesBar(stageSummary: {
        total_in_bed_time_milli: number;
        total_awake_time_milli: number;
        total_no_data_time_milli: number;
        total_light_sleep_time_milli: number;
        total_slow_wave_sleep_time_milli: number;
        total_rem_sleep_time_milli: number;
        sleep_cycle_count: number;
        disturbance_count: number;
    }): string {
        // Calculate total time and percentages
        const totalTime = stageSummary.total_in_bed_time_milli;
        const remPercent = (stageSummary.total_rem_sleep_time_milli / totalTime) * 100;
        const deepPercent = (stageSummary.total_slow_wave_sleep_time_milli / totalTime) * 100;
        const lightPercent = (stageSummary.total_light_sleep_time_milli / totalTime) * 100;
        const awakePercent = (stageSummary.total_awake_time_milli / totalTime) * 100;

        // Calculate minutes for display
        const remMin = Math.round(stageSummary.total_rem_sleep_time_milli / 60000);
        const deepMin = Math.round(stageSummary.total_slow_wave_sleep_time_milli / 60000);
        const lightMin = Math.round(stageSummary.total_light_sleep_time_milli / 60000);
        const awakeMin = Math.round(stageSummary.total_awake_time_milli / 60000);

        return `
            <div class="sleep-stages-compact">
                <div class="stage-label-header">Sleep Stages</div>
                
                <div class="sleep-stages-bar">
                    <div class="stage-segment stage-rem" style="width: ${remPercent}%"></div>
                    <div class="stage-segment stage-deep" style="width: ${deepPercent}%"></div>
                    <div class="stage-segment stage-light" style="width: ${lightPercent}%"></div>
                    <div class="stage-segment stage-awake" style="width: ${awakePercent}%"></div>
                </div>
                
                <div class="compact-metrics">
                    <div class="metric-compact">
                        <span class="metric-value">${remMin}m</span>
                        <span class="metric-label">REM</span>
                    </div>
                    <div class="metric-compact">
                        <span class="metric-value">${deepMin}m</span>
                        <span class="metric-label">Deep</span>
                    </div>
                    <div class="metric-compact">
                        <span class="metric-value">${lightMin}m</span>
                        <span class="metric-label">Light</span>
                    </div>
                    <div class="metric-compact">
                        <span class="metric-value">${awakeMin}m</span>
                        <span class="metric-label">Awake</span>
                    </div>
                </div>
            </div>
        `;
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