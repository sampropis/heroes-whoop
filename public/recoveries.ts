// Recoveries TypeScript for WHOOP API Test Site

import { WhoopRecovery } from './types/whoop';

interface Profile {
    first_name: string;
    last_name: string;
}

interface RecoveryScore {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
    user_calibrating: boolean;
}

interface Recovery {
    id: string;
    cycle_id: string;
    sleep_id?: string;
    user_id: string;
    score_state: string;
    score?: RecoveryScore;
    created_at: string;
    updated_at: string;
}

interface RecoveriesResponse {
    records: Recovery[];
    next_token?: string;
}

declare global {
    interface Window {
        whoopAuth: any; // TODO: Import WhoopAuth type when module system is set up
        whoopRecoveries: WhoopRecoveries;
    }
}

class WhoopRecoveries {
    private currentPage: number;
    private nextToken: string | null;
    private previousTokens: string[];
    private currentRecoveries: Recovery[];
    private isLoading: boolean;

    constructor() {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        this.currentRecoveries = [];
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
            await this.loadRecoveries();
            this.setupEventListeners();
            this.setupModalEventListeners();
        } catch (error) {
            console.error('Recoveries initialization failed:', error);
            this.showError('Failed to initialize recoveries page');
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
        // Set start date to 30 days ago
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Set end date to today
        const endDate = new Date();
        
        const startInput = document.getElementById('start-date') as HTMLInputElement;
        const endInput = document.getElementById('end-date') as HTMLInputElement;
        
        if (startInput) {
            startInput.value = startDate.toISOString().split('T')[0];
        }
        
        if (endInput) {
            endInput.value = endDate.toISOString().split('T')[0];
        }
    }

    private async loadRecoveries(): Promise<void> {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const content = document.getElementById('recoveries-content');
        if (!content) return;
        
        try {
            if (this.currentPage === 1) {
                content.innerHTML = '<div class="loading">Loading recoveries...</div>';
            }
            
            const limitSelect = document.getElementById('limit-select') as HTMLSelectElement;
            const startDateInput = document.getElementById('start-date') as HTMLInputElement;
            const endDateInput = document.getElementById('end-date') as HTMLInputElement;
            
            const limit = limitSelect?.value || '25';
            const startDate = startDateInput?.value;
            const endDate = endDateInput?.value;
            
            let url = `/api/recovery?limit=${limit}`;
            
            if (startDate) {
                url += `&start=${startDate}T00:00:00.000Z`;
            }
            if (endDate) {
                url += `&end=${endDate}T23:59:59.999Z`;
            }
            if (this.nextToken) {
                url += `&nextToken=${this.nextToken}`;
            }
            
            console.log('Fetching recoveries from:', url);
            
            const response = await window.whoopAuth.apiRequest(url);
            if (!response.ok) throw new Error('Failed to fetch recoveries');
            
            const data = await response.json() as RecoveriesResponse;
            console.log('Recoveries response:', data);
            
            this.currentRecoveries = data.records || [];
            this.nextToken = data.next_token || null;
            
            this.renderRecoveries();
            this.updatePaginationControls();
            
        } catch (error) {
            console.error('Failed to load recoveries:', error);
            this.showError(`Failed to load recoveries: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isLoading = false;
        }
    }

    private renderRecoveries(): void {
        const content = document.getElementById('recoveries-content');
        if (!content) return;
        
        if (!this.currentRecoveries || this.currentRecoveries.length === 0) {
            content.innerHTML = '<div class="empty">No recoveries found for the selected date range.</div>';
            return;
        }
        
        let recoveriesHtml = '<div class="activities-grid">';
        
        for (const recovery of this.currentRecoveries) {
            recoveriesHtml += this.renderRecovery(recovery);
        }
        
        recoveriesHtml += '</div>';
        content.innerHTML = recoveriesHtml;
    }

    private renderRecovery(recovery: Recovery): string {
        const createdDate = new Date(recovery.created_at);
        const updatedDate = new Date(recovery.updated_at);
        
        // Recovery scores and metrics
        const recoveryScore = recovery.score?.recovery_score || 'N/A';
        const restingHR = recovery.score?.resting_heart_rate || 'N/A';
        const hrv = recovery.score?.hrv_rmssd_milli ? recovery.score.hrv_rmssd_milli.toFixed(1) + ' ms' : 'N/A';
        const spo2 = recovery.score?.spo2_percentage ? recovery.score.spo2_percentage.toFixed(1) + '%' : 'N/A';
        const skinTemp = recovery.score?.skin_temp_celsius ? recovery.score.skin_temp_celsius.toFixed(1) + '°C' : 'N/A';
        
        // Recovery score classification
        const scoreClass = this.getRecoveryScoreClass(recovery.score?.recovery_score);
        const scoreColor = this.getRecoveryScoreColor(recovery.score?.recovery_score);
        
        return `
            <div class="activity-card" data-cycle-id="${recovery.cycle_id}">
                <div class="activity-header">
                    <div class="activity-type">
                        <span class="activity-icon" style="color: ${scoreColor}">♥</span>
                        <span class="activity-name">Recovery</span>
                    </div>
                    <div class="activity-date">
                        ${this.formatDate(createdDate)}
                    </div>
                </div>
                
                <div class="activity-metrics">
                    <div class="metric">
                        <span class="metric-label">Recovery Score</span>
                        <span class="metric-value ${scoreClass}" style="color: ${scoreColor}">${recoveryScore}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Resting HR</span>
                        <span class="metric-value">${restingHR} bpm</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">HRV</span>
                        <span class="metric-value">${hrv}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">SpO2</span>
                        <span class="metric-value">${spo2}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Skin Temp</span>
                        <span class="metric-value">${skinTemp}</span>
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
                    <div class="activity-timing">
                        <span class="timing-label">State:</span>
                        <span class="timing-value">${recovery.score_state || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    private getRecoveryScoreClass(score?: number): string {
        if (!score) return '';
        if (score >= 67) return 'recovery-green';
        if (score >= 34) return 'recovery-yellow';
        return 'recovery-red';
    }

    private getRecoveryScoreColor(score?: number): string {
        if (!score) return '#ccc';
        if (score >= 67) return '#4CAF50';  // Green
        if (score >= 34) return '#FFC107';  // Yellow
        return '#F44336';  // Red
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
        
        // Recovery card clicks (using event delegation)
        const recoveriesContent = document.getElementById('recoveries-content');
        if (recoveriesContent) {
            recoveriesContent.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const recoveryCard = target.closest('.activity-card');
                if (recoveryCard) {
                    const cycleId = recoveryCard.getAttribute('data-cycle-id');
                    if (cycleId) {
                        this.showRecoveryModal(cycleId);
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
            await this.loadRecoveries();
        }
    }

    private async nextPage(): Promise<void> {
        if (this.nextToken) {
            this.currentPage++;
            await this.loadRecoveries();
        }
    }

    private async loadMore(): Promise<void> {
        // TODO: Implement proper load more functionality
        await this.nextPage();
    }

    private async refresh(): Promise<void> {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        await this.loadRecoveries();
    }

    private async logout(): Promise<void> {
        try {
            await window.whoopAuth.logout();
            // whoopAuth.logout() handles clearing tokens and redirecting
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    private showError(message: string): void {
        const content = document.getElementById('recoveries-content');
        if (content) {
            content.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    // Modal functionality
    private async showRecoveryModal(cycleId: string): Promise<void> {
        const modal = document.getElementById('recovery-modal');
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
        modalTitle.textContent = 'Loading Recovery Details...';

        try {
            const response = await window.whoopAuth.apiRequest(`/api/recoveries/${cycleId}`);
            if (!response.ok) throw new Error('Failed to fetch recovery details');

            const recovery = await response.json() as Recovery;
            
            // Update modal with recovery details
            modalTitle.textContent = `Recovery Details - ${this.formatDate(new Date(recovery.created_at))}`;
            modalContent.innerHTML = this.renderRecoveryDetails(recovery);
            
            // Show content and hide loading
            modalLoading.style.display = 'none';
            modalContent.style.display = 'block';
        } catch (error) {
            console.error('Failed to load recovery details:', error);
            modalError.innerHTML = `<p>Failed to load recovery details: ${error instanceof Error ? error.message : 'Unknown error'}</p>`;
            modalLoading.style.display = 'none';
            modalError.style.display = 'block';
            modalTitle.textContent = 'Error Loading Recovery';
        }
    }

    private closeModal(): void {
        const modal = document.getElementById('recovery-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    private setupModalEventListeners(): void {
        const modal = document.getElementById('recovery-modal');
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

    private renderRecoveryDetails(recovery: Recovery): string {
        const createdTime = new Date(recovery.created_at);
        const updatedTime = new Date(recovery.updated_at);

        // Recovery scores and metrics
        const recoveryScore = recovery.score?.recovery_score || 'N/A';
        const restingHR = recovery.score?.resting_heart_rate || 'N/A';
        const hrv = recovery.score?.hrv_rmssd_milli || 'N/A';
        const spo2 = recovery.score?.spo2_percentage || 'N/A';
        const skinTemp = recovery.score?.skin_temp_celsius || 'N/A';
        const userCalibrating = recovery.score?.user_calibrating ? 'Yes' : 'No';

        const scoreColor = this.getRecoveryScoreColor(recovery.score?.recovery_score);

        return `
            <div class="activity-detail-grid">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Cycle ID:</span>
                        <span class="detail-value">${recovery.cycle_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Sleep ID:</span>
                        <span class="detail-value">${recovery.sleep_id || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">User ID:</span>
                        <span class="detail-value">${recovery.user_id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Score State:</span>
                        <span class="detail-value">${recovery.score_state || 'Unknown'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">User Calibrating:</span>
                        <span class="detail-value">${userCalibrating}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Recovery Metrics</h4>
                    <div class="detail-row">
                        <span class="detail-label">Recovery Score:</span>
                        <span class="detail-value" style="color: ${scoreColor}">${recoveryScore}%</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Resting Heart Rate:</span>
                        <span class="detail-value">${restingHR} bpm</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">HRV (RMSSD):</span>
                        <span class="detail-value">${hrv !== 'N/A' ? hrv.toFixed(2) + ' ms' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">SpO2:</span>
                        <span class="detail-value">${spo2 !== 'N/A' ? spo2.toFixed(1) + '%' : 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Skin Temperature:</span>
                        <span class="detail-value">${skinTemp !== 'N/A' ? skinTemp.toFixed(2) + '°C' : 'N/A'}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Timestamps</h4>
                    <div class="detail-row">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value">${this.formatDateTime(createdTime)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Updated:</span>
                        <span class="detail-value">${this.formatDateTime(updatedTime)}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Recovery Score Guide</h4>
                <div class="recovery-guide">
                    <div class="guide-item">
                        <span class="guide-range" style="background-color: #4CAF50;">67-100%</span>
                        <span class="guide-label">Green - Well Recovered</span>
                    </div>
                    <div class="guide-item">
                        <span class="guide-range" style="background-color: #FFC107;">34-66%</span>
                        <span class="guide-label">Yellow - Adequate</span>
                    </div>
                    <div class="guide-item">
                        <span class="guide-range" style="background-color: #F44336;">0-33%</span>
                        <span class="guide-label">Red - Low Recovery</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize recoveries when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.whoopRecoveries = new WhoopRecoveries();
});