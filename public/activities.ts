// Activities TypeScript for WHOOP API Test Site

import { WhoopActivity } from './types/whoop';

interface Profile {
    first_name: string;
    last_name: string;
    email: string;
}

interface ActivityScore {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
    percent_recorded: number;
    distance_meter?: number;
    altitude_gain_meter?: number;
    altitude_change_meter?: number;
    zone_durations?: ZoneDurations;
}

interface ZoneDurations {
    zone_zero_milli: number;
    zone_one_milli: number;
    zone_two_milli: number;
    zone_three_milli: number;
    zone_four_milli: number;
    zone_five_milli: number;
}

interface Activity {
    id: string;
    sport_id: number;
    sport_name?: string;
    score_state: string;
    score?: ActivityScore;
    start?: string;
    end?: string;
    created_at: string;
    updated_at: string;
    timezone_offset?: string;
}

interface ActivitiesResponse {
    records: Activity[];
    next_token?: string;
}

declare global {
    interface Window {
        whoopAuth: any; // TODO: Import WhoopAuth type when module system is set up
        whoopActivities: WhoopActivities;
    }
}

class WhoopActivities {
    private currentPage: number;
    private nextToken: string | null;
    private previousTokens: string[];
    private currentActivities: Activity[];
    private isLoading: boolean;
    private previousLength: number;

    constructor() {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        this.currentActivities = [];
        this.isLoading = false;
        this.previousLength = 0;
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
            await this.loadActivities();
            this.setupEventListeners();
            this.setupModalEventListeners();
        } catch (error) {
            console.error('Activities initialization failed:', error);
            this.showError('Failed to initialize activities page');
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

    private async loadActivities(nextToken: string | null = null, append = false): Promise<void> {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.updateLoadingState(true);

        try {
            const limitSelect = document.getElementById('limit-select') as HTMLSelectElement;
            const startDateInput = document.getElementById('start-date') as HTMLInputElement;
            const endDateInput = document.getElementById('end-date') as HTMLInputElement;
            
            const limit = limitSelect?.value || '10';
            const startDate = startDateInput?.value;
            const endDate = endDateInput?.value;
            
            let url = `/api/activities?limit=${limit}`;
            
            if (startDate) {
                url += `&start=${startDate}T00:00:00.000Z`;
            }
            if (endDate) {
                url += `&end=${endDate}T23:59:59.999Z`;
            }
            if (nextToken) {
                url += `&nextToken=${nextToken}`;
            }
            
            console.log('Loading activities from:', url);
            
            const response = await window.whoopAuth.apiRequest(url);
            if (!response.ok) throw new Error('Failed to fetch activities');
            
            const activitiesData = await response.json() as ActivitiesResponse;
            
            if (append) {
                this.currentActivities = [...this.currentActivities, ...activitiesData.records];
            } else {
                this.currentActivities = activitiesData.records;
            }
            
            this.nextToken = activitiesData.next_token || null;
            
            this.displayActivities(append);
            this.updatePaginationControls();
            
        } catch (error) {
            console.error('Failed to load activities:', error);
            this.showError('Failed to load activities');
        } finally {
            this.isLoading = false;
            this.updateLoadingState(false);
        }
    }

    private displayActivities(append = false): void {
        const content = document.getElementById('activities-content');
        if (!content) return;
        
        if (!this.currentActivities || this.currentActivities.length === 0) {
            content.innerHTML = '<div class="empty">No activities found</div>';
            return;
        }

        let activitiesHtml = '';
        
        if (!append) {
            activitiesHtml = '<div class="activities-grid">';
        }
        
        this.currentActivities.forEach((activity, index) => {
            if (append && index < this.currentActivities.length - (this.currentActivities.length - this.previousLength)) {
                return; // Skip already displayed activities
            }
            
            activitiesHtml += this.renderActivity(activity);
        });
        
        if (!append) {
            activitiesHtml += '</div>';
            content.innerHTML = activitiesHtml;
        } else {
            const grid = content.querySelector('.activities-grid');
            if (grid) {
                grid.innerHTML += activitiesHtml;
            }
        }
    }

    private renderActivity(activity: Activity): string {
        const createdDate = new Date(activity.created_at);
        const updatedDate = new Date(activity.updated_at);
        
        // Activity type and icon - using sport_name from API or sport_id as fallback
        const activityType = activity.sport_name || this.getSportName(activity.sport_id) || 'Activity';
        const activityIcon = this.getSportIcon(activity.sport_id);
        
        // Duration formatting - using start/end times
        const duration = activity.start && activity.end ? this.formatDurationFromTimes(activity.start, activity.end) : 'N/A';
        
        // Scores
        const strain = activity.score?.strain || 'N/A';
        const kilojoules = activity.score?.kilojoule || 'N/A';
        const averageHeartRate = activity.score?.average_heart_rate || 'N/A';
        const maxHeartRate = activity.score?.max_heart_rate || 'N/A';
        
        return `
            <div class="activity-card" data-activity-id="${activity.id}">
                <div class="activity-header">
                    <div class="activity-type">
                        <span class="activity-icon">${activityIcon}</span>
                        <span class="activity-name">${activityType}</span>
                    </div>
                    <div class="activity-date">
                        ${this.formatDate(createdDate)}
                    </div>
                </div>
                
                <div class="activity-metrics">
                    <div class="metric">
                        <span class="metric-label">Strain</span>
                        <span class="metric-value strain-${this.getStrainClass(strain)}">${strain}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Duration</span>
                        <span class="metric-value">${duration}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Kilojoules</span>
                        <span class="metric-value">${kilojoules}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Avg HR</span>
                        <span class="metric-value">${averageHeartRate}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Max HR</span>
                        <span class="metric-value">${maxHeartRate}</span>
                    </div>
                </div>
                
                <div class="activity-details">
                    <div class="activity-timing">
                        <span class="timing-label">Created:</span>
                        <span class="timing-value">${this.formatDateTime(createdDate)}</span>
                    </div>
                    <div class="activity-timing">
                        <span class="timing-label">Updated:</span>
                        <span class="timing-value">${this.formatDateTime(updatedDate)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    private getSportName(sportId: number): string {
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
        };
        return sportMap[sportId] || `Sport ${sportId}`;
    }

    private getSportIcon(sportId: number): string {
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
        };
        return iconMap[sportId] || '🏃‍♂️';
    }

    private getStrainClass(strain: number | string): string {
        if (strain === 'N/A') return 'pending';
        const strainValue = typeof strain === 'string' ? parseFloat(strain) : strain;
        if (strainValue < 10) return 'low';
        if (strainValue < 15) return 'moderate';
        if (strainValue < 18) return 'high';
        return 'very-high';
    }

    private formatDurationFromTimes(startTime: string, endTime: string): string {
        if (!startTime || !endTime) return 'N/A';
        
        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationMs = end.getTime() - start.getTime();
        
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    private formatDate(date: Date): string {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    private formatDateTime(date: Date): string {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    private updatePaginationControls(): void {
        const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
        const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
        const pageInfo = document.getElementById('page-info');
        const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;
        
        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = !this.nextToken;
        
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage}`;
        
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.nextToken ? 'block' : 'none';
        }
    }

    private updateLoadingState(isLoading: boolean): void {
        const loadMoreBtn = document.getElementById('load-more-btn') as HTMLButtonElement;
        const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
        
        if (loadMoreBtn) {
            loadMoreBtn.textContent = isLoading ? 'Loading...' : 'Load More Activities';
            loadMoreBtn.disabled = isLoading;
        }
        
        if (refreshBtn) {
            refreshBtn.textContent = isLoading ? 'Loading...' : 'Refresh';
            refreshBtn.disabled = isLoading;
        }
    }

    private setupEventListeners(): void {
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Pagination controls
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const loadMoreBtn = document.getElementById('load-more-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousPage());
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextPage());
        if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => this.loadMore());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh());
        
        // Filter controls
        const limitSelect = document.getElementById('limit-select');
        if (limitSelect) {
            limitSelect.addEventListener('change', () => this.refresh());
        }
        
        // Activity card clicks (using event delegation)
        const activitiesContent = document.getElementById('activities-content');
        if (activitiesContent) {
            activitiesContent.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const activityCard = target.closest('.activity-card');
                if (activityCard) {
                    const activityId = activityCard.getAttribute('data-activity-id');
                    if (activityId) {
                        this.showActivityModal(activityId);
                    }
                }
            });
        }
    }

    private async previousPage(): Promise<void> {
        if (this.currentPage > 1) {
            this.currentPage--;
            // For simplicity, reload from the beginning
            // In a full implementation, you'd store previous tokens
            this.nextToken = null;
            await this.loadActivities();
        }
    }

    private async nextPage(): Promise<void> {
        if (this.nextToken) {
            this.previousTokens.push(this.nextToken);
            this.currentPage++;
            await this.loadActivities(this.nextToken);
        }
    }

    private async loadMore(): Promise<void> {
        if (this.nextToken) {
            this.previousLength = this.currentActivities.length;
            await this.loadActivities(this.nextToken, true);
        }
    }

    private async refresh(): Promise<void> {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        await this.loadActivities();
    }

    private async logout(): Promise<void> {
        try {
            await window.whoopAuth.logout();
            // whoopAuth.logout() handles clearing tokens and redirecting
        } catch (error) {
            console.error('Logout failed:', error);
            alert('Logout failed. Please try again.');
        }
    }

    private showError(message: string): void {
        const content = document.getElementById('activities-content');
        if (content) {
            content.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    // Modal functionality
    private async showActivityModal(activityId: string): Promise<void> {
        const modal = document.getElementById('activity-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalLoading = document.getElementById('modal-loading');
        const modalContent = document.getElementById('modal-content');
        const modalError = document.getElementById('modal-error');

        if (!modal || !modalTitle || !modalLoading || !modalContent || !modalError) return;

        // Show modal and loading state
        modal.style.display = 'block';
        modalLoading.style.display = 'block';
        modalContent.style.display = 'none';
        modalError.style.display = 'none';
        modalTitle.textContent = 'Loading Activity Details...';

        try {
            const response = await window.whoopAuth.apiRequest(`/api/activities/${activityId}`);
            if (!response.ok) throw new Error('Failed to fetch activity details');

            const activity = await response.json() as Activity;
            
            // Update modal with activity details
            modalTitle.textContent = `${activity.sport_name || 'Activity'} Details`;
            modalContent.innerHTML = this.renderActivityDetails(activity);
            
            // Show content and hide loading
            modalLoading.style.display = 'none';
            modalContent.style.display = 'block';
        } catch (error) {
            console.error('Failed to load activity details:', error);
            modalError.innerHTML = `<p>Failed to load activity details: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
            modalLoading.style.display = 'none';
            modalError.style.display = 'block';
            modalTitle.textContent = 'Error Loading Activity';
        }
    }

    private closeModal(): void {
        const modal = document.getElementById('activity-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    private setupModalEventListeners(): void {
        const modal = document.getElementById('activity-modal');
        const closeBtn = document.querySelector('.close-modal');

        if (!modal) return;

        // Close modal when clicking the X
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        // Close modal when clicking outside of it
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    private renderActivityDetails(activity: Activity): string {
        const startTime = activity.start ? new Date(activity.start) : null;
        const endTime = activity.end ? new Date(activity.end) : null;
        const createdTime = new Date(activity.created_at);
        const updatedTime = new Date(activity.updated_at);

        // Duration calculation
        const duration = startTime && endTime ? 
            this.formatDurationFromTimes(activity.start!, activity.end!) : 'N/A';

        // Zone durations
        const zoneHtml = activity.score?.zone_durations ? 
            this.renderZoneDurations(activity.score.zone_durations) : '';

        return `
            <div class="activity-detail-grid">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Activity ID:</span>
                        <span class="detail-value">${activity.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sport:</span>
                        <span class="detail-value">${activity.sport_name || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sport ID:</span>
                        <span class="detail-value">${activity.sport_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">${activity.score_state || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration:</span>
                        <span class="detail-value">${duration}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Performance Metrics</h4>
                    <div class="detail-row">
                        <span class="detail-label">Strain:</span>
                        <span class="detail-value strain-${this.getStrainClass(activity.score?.strain || 0)}">${activity.score?.strain?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Kilojoules:</span>
                        <span class="detail-value">${activity.score?.kilojoule?.toFixed(0) || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Avg Heart Rate:</span>
                        <span class="detail-value">${activity.score?.average_heart_rate || 'N/A'} bpm</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Max Heart Rate:</span>
                        <span class="detail-value">${activity.score?.max_heart_rate || 'N/A'} bpm</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Percent Recorded:</span>
                        <span class="detail-value">${activity.score?.percent_recorded ? (activity.score.percent_recorded * 100).toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Distance & Elevation</h4>
                    <div class="detail-row">
                        <span class="detail-label">Distance:</span>
                        <span class="detail-value">${activity.score?.distance_meter ? (activity.score.distance_meter / 1000).toFixed(2) + ' km' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Altitude Gain:</span>
                        <span class="detail-value">${activity.score?.altitude_gain_meter ? activity.score.altitude_gain_meter + ' m' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Altitude Change:</span>
                        <span class="detail-value">${activity.score?.altitude_change_meter ? activity.score.altitude_change_meter + ' m' : 'N/A'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Timestamps</h4>
                    <div class="detail-row">
                        <span class="detail-label">Start Time:</span>
                        <span class="detail-value">${startTime ? this.formatDateTime(startTime) : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">End Time:</span>
                        <span class="detail-value">${endTime ? this.formatDateTime(endTime) : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value">${this.formatDateTime(createdTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Updated:</span>
                        <span class="detail-value">${this.formatDateTime(updatedTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${activity.timezone_offset || 'N/A'}</span>
                    </div>
                </div>
            </div>

            ${zoneHtml}
        `;
    }

    private renderZoneDurations(zoneDurations: ZoneDurations): string {
        if (!zoneDurations) return '';

        const zones = [
            { name: 'Zone 0 (Recovery)', key: 'zone_zero_milli', class: 'zone-0' },
            { name: 'Zone 1 (Light)', key: 'zone_one_milli', class: 'zone-1' },
            { name: 'Zone 2 (Moderate)', key: 'zone_two_milli', class: 'zone-2' },
            { name: 'Zone 3 (Vigorous)', key: 'zone_three_milli', class: 'zone-3' },
            { name: 'Zone 4 (Hard)', key: 'zone_four_milli', class: 'zone-4' },
            { name: 'Zone 5 (All Out)', key: 'zone_five_milli', class: 'zone-5' }
        ];

        const zoneItems = zones.map(zone => {
            const duration = zoneDurations[zone.key as keyof ZoneDurations] || 0;
            const formattedDuration = this.formatMilliseconds(duration);
            
            return `
                <div class="zone-item ${zone.class}">
                    <span class="zone-name">${zone.name}</span>
                    <span class="zone-duration">${formattedDuration}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="detail-section">
                <h4>Heart Rate Zone Durations</h4>
                <div class="zone-duration-grid">
                    ${zoneItems}
                </div>
            </div>
        `;
    }

    private formatMilliseconds(ms: number): string {
        if (!ms || ms === 0) return '0s';
        
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Initialize activities when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.whoopActivities = new WhoopActivities();
});