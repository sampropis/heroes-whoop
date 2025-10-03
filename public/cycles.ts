// Cycles TypeScript for WHOOP API Test Site

import { WhoopCycle } from './types/whoop';

interface Profile {
    first_name: string;
    last_name: string;
}

interface CycleScore {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    [key: string]: number | string | boolean; // For dynamic score properties
}

interface Cycle {
    id: string;
    start: string;
    end: string;
    score_state: string;
    timezone_offset?: string;
    score?: CycleScore;
}

interface CyclesResponse {
    records: Cycle[];
    next_token?: string;
}

declare global {
    interface Window {
        whoopAuth: any; // TODO: Import WhoopAuth type when module system is set up
        whoopCycles: WhoopCycles;
    }
}

class WhoopCycles {
    private currentPage: number;
    private nextToken: string | null;
    private previousTokens: string[];
    private currentCycles: Cycle[];
    private isLoading: boolean;

    constructor() {
        this.currentPage = 1;
        this.nextToken = null;
        this.previousTokens = [];
        this.currentCycles = [];
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
            await this.loadCycles();
            this.setupEventListeners();
            this.setupModalEventListeners();
        } catch (error) {
            console.error('Cycles initialization failed:', error);
            this.showError('Failed to initialize cycles page');
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
                this.loadCycles();
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
                    this.loadMoreCycles();
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
                this.loadCycles();
            });
        }
    }

    private setupModalEventListeners(): void {
        const modal = document.getElementById('cycle-modal');
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

        // Event delegation for cycle card clicks (updated to use cycles-content)
        const cyclesContent = document.getElementById('cycles-content');
        if (cyclesContent) {
            cyclesContent.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const cycleCard = target.closest('.cycle-card') as HTMLElement;
                if (cycleCard) {
                    const cycleId = cycleCard.dataset.cycleId;
                    if (cycleId) {
                        console.log('Clicked cycle card with ID:', cycleId);
                        console.log('Current cycles:', this.currentCycles);
                        const cycle = this.currentCycles.find(c => c.id === cycleId);
                        console.log('Found cycle:', cycle);
                        this.showCycleDetails(cycleId);
                    }
                }
            });
        }
    }

    private closeModal(): void {
        const modal = document.getElementById('cycle-modal');
        const modalLoading = document.getElementById('modal-loading');
        const modalContent = document.getElementById('modal-content');
        const modalError = document.getElementById('modal-error');

        if (modal) modal.style.display = 'none';
        if (modalLoading) modalLoading.style.display = 'none';
        if (modalContent) modalContent.style.display = 'none';
        if (modalError) modalError.style.display = 'none';
    }

    private async loadCycles(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();
        this.hideError();

        try {
            const params = this.buildApiParams();
            console.log('Loading cycles with params:', params);

            const response = await window.whoopAuth.apiRequest(`/api/cycles?${params}`);
            if (!response.ok) throw new Error('Failed to fetch cycles');

            const data = await response.json() as CyclesResponse;
            console.log('Cycles data received:', data);

            this.currentCycles = data.records || [];
            this.nextToken = data.next_token || null;
            
            this.displayCycles();
            this.updatePaginationControls();
        } catch (error) {
            console.error('Failed to load cycles:', error);
            this.showError(`Failed to load cycles: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    private async loadMoreCycles(): Promise<void> {
        if (!this.nextToken || this.isLoading) return;

        this.isLoading = true;
        this.previousTokens.push(this.nextToken);

        try {
            const params = this.buildApiParams();
            const response = await window.whoopAuth.apiRequest(`/api/cycles?${params}`);
            if (!response.ok) throw new Error('Failed to fetch more cycles');

            const data = await response.json() as CyclesResponse;
            const newCycles = data.records || [];

            // Append new cycles to existing
            this.currentCycles = [...this.currentCycles, ...newCycles];
            this.nextToken = data.next_token || null;

            this.displayCycles();
            this.updatePaginationControls();
        } catch (error) {
            console.error('Failed to load more cycles:', error);
            this.showError(`Failed to load more cycles: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    private displayCycles(): void {
        const container = document.getElementById('cycles-content');
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

        if (!this.currentCycles.length) {
            grid.innerHTML = '<div class="empty">No cycles found for the selected date range.</div>';
            return;
        }

        this.currentCycles.forEach(cycle => {
            const cycleCard = this.createCycleCard(cycle);
            grid.appendChild(cycleCard);
        });
    }

    private createCycleCard(cycle: Cycle): HTMLElement {
        const card = document.createElement('div');
        card.className = 'activity-card cycle-card'; // Reuse activity card styling
        card.dataset.cycleId = cycle.id;

        const startDate = new Date(cycle.start);
        const endDate = new Date(cycle.end);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)); // hours

        card.innerHTML = `
            <div class="activity-header">
                <div class="activity-type">
                    <span class="activity-icon">🔄</span>
                    <span class="activity-name">Cycle</span>
                </div>
                <span class="activity-date">${startDate.toLocaleDateString()}</span>
            </div>
            <div class="activity-metrics">
                <div class="metric">
                    <span class="metric-label">Start</span>
                    <span class="metric-value">${startDate.toLocaleTimeString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">End</span>
                    <span class="metric-value">${endDate.toLocaleTimeString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Duration</span>
                    <span class="metric-value">${duration}h</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Score State</span>
                    <span class="metric-value">${cycle.score_state || 'N/A'}</span>
                </div>
            </div>
            <div class="activity-details">
                <div class="activity-timing">
                    <span class="timing-label">Timezone:</span>
                    <span class="timing-value">${cycle.timezone_offset || 'N/A'}</span>
                </div>
            </div>
        `;

        return card;
    }

    private async showCycleDetails(cycleId: string): Promise<void> {
        console.log('Showing cycle details for ID:', cycleId);
        
        const modal = document.getElementById('cycle-modal');
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
            console.log('Looking for cycle with ID:', cycleId);
            console.log('Available cycles:', this.currentCycles);
            const cycle = this.currentCycles.find(c => String(c.id) === cycleId);
            
            if (!cycle) {
                console.error('Cycle not found in currentCycles array');
                throw new Error('Cycle not found');
            }

            console.log('Found cycle:', cycle);
            // Show cycle details
            content.innerHTML = this.formatCycleDetails(cycle);
            loading.style.display = 'none';
            content.style.display = 'block';
        } catch (err) {
            console.error('Failed to load cycle details:', err);
            
            // Show error
            loading.style.display = 'none';
            error.style.display = 'block';
            error.textContent = `Failed to load cycle details: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
    }

    private formatCycleDetails(cycle: Cycle): string {
        const startDate = new Date(cycle.start);
        const endDate = new Date(cycle.end);
        const duration = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60)); // hours

        let html = `
            <div class="activity-detail-grid">
                <div class="detail-section">
                    <h4>Basic Information</h4>
                    <div class="detail-row">
                        <span class="detail-label">Cycle ID:</span>
                        <span class="detail-value">${cycle.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Start Time:</span>
                        <span class="detail-value">${startDate.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">End Time:</span>
                        <span class="detail-value">${endDate.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration:</span>
                        <span class="detail-value">${duration} hours</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Score State:</span>
                        <span class="detail-value">${cycle.score_state || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Timezone:</span>
                        <span class="detail-value">${cycle.timezone_offset || 'N/A'}</span>
                    </div>
                </div>
        `;

        if (cycle.score) {
            html += `
                <div class="detail-section">
                    <h4>Cycle Scores</h4>
            `;
            
            Object.entries(cycle.score).forEach(([key, value]) => {
                let displayValue: string | number | boolean = value;
                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                if (typeof value === 'number') {
                    displayValue = Number(value).toFixed(2);
                }

                html += `
                    <div class="detail-row">
                        <span class="detail-label">${displayKey}:</span>
                        <span class="detail-value">${displayValue}</span>
                    </div>
                `;
            });
            
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
        
        await this.loadCycles();
    }

    private async loadPreviousPage(): Promise<void> {
        if (this.currentPage <= 1 || this.isLoading) return;

        this.currentPage--;
        
        // Get previous token
        this.nextToken = this.previousTokens.pop() || null;
        
        await this.loadCycles();
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
        const container = document.getElementById('cycles-content');
        if (container) {
            container.innerHTML = '<div class="loading">Loading cycles...</div>';
        }
    }

    private hideLoading(): void {
        // Loading is hidden by displayCycles() creating the grid
    }

    private showError(message: string): void {
        const container = document.getElementById('cycles-content');
        if (container) {
            container.innerHTML = `<div class="error">${message}</div>`;
        }
    }

    private hideError(): void {
        // Error is hidden by displayCycles() replacing content
    }
}

// Initialize the cycles page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.whoopCycles = new WhoopCycles();
});