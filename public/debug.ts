// Debug page TypeScript for WHOOP OAuth troubleshooting

interface Configuration {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    authorizationUrl: string;
    tokenUrl: string;
    apiBaseUrl: string;
    scopes: string;
    scopesArray?: string[];
    sessionState: string;
    accessToken: string;
}

interface SessionStatus {
    sessionId?: string;
    backgroundRefresh: boolean;
    timeUntilExpiry?: number;
}

// Declare global to access whoopAuth
(window as any).whoopAuth = (window as any).whoopAuth || {};

class DebugPage {
    private config: Configuration | null;

    constructor() {
        this.config = null;
        this.init();
    }

    private async init(): Promise<void> {
        await this.loadConfiguration();
        await this.loadSessionStatus();
        this.setupEventListeners();
        
        // Refresh session status every 10 seconds
        setInterval(() => {
            this.loadSessionStatus();
        }, 10000);
    }

    private async loadConfiguration(): Promise<void> {
        try {
            const response = await fetch('/debug/config');
            if (!response.ok) throw new Error('Failed to fetch configuration');
            
            const config = await response.json() as Configuration;
            this.displayConfiguration(config);
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.showError('Failed to load configuration', 'config-status');
        }
    }

    private async loadSessionStatus(): Promise<void> {
        try {
            // Get status from auth endpoint
            const response = await fetch('/auth/status');
            if (!response.ok) throw new Error('Failed to fetch session status');
            
            const status = await response.json() as SessionStatus;
            
            // Also get client-side token info
            const accessToken = localStorage.getItem('whoop_access_token');
            const refreshToken = localStorage.getItem('whoop_refresh_token');
            const tokenExpiry = localStorage.getItem('whoop_token_expiry');
            const backgroundRefreshActive = window.whoopAuth?.isBackgroundRefreshActive() || false;
            
            this.displaySessionStatus(status, {
                accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'NOT SET',
                refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : 'NOT SET',
                tokenExpiry: tokenExpiry ? new Date(parseInt(tokenExpiry)).toLocaleString() : 'NOT SET',
                backgroundRefreshActive
            });
        } catch (error) {
            console.error('Failed to load session status:', error);
        }
    }

    private displaySessionStatus(status: SessionStatus, clientInfo: {
        accessToken: string;
        refreshToken: string;
        tokenExpiry: string;
        backgroundRefreshActive: boolean;
    }): void {
        const sessionInfo = document.getElementById('session-info');
        if (!sessionInfo) return;
        
        const timeUntilExpiry = status.timeUntilExpiry;
        let expiryText = 'N/A';
        let expiryClass = 'status-pending';
        
        if (timeUntilExpiry) {
            const minutes = Math.floor(timeUntilExpiry / (1000 * 60));
            const hours = Math.floor(minutes / 60);
            if (hours > 0) {
                expiryText = `${hours}h ${minutes % 60}m`;
                expiryClass = hours >= 2 ? 'status-scored' : 'status-pending';
            } else {
                expiryText = `${minutes}m`;
                expiryClass = minutes >= 30 ? 'status-pending' : 'error';
            }
        }
        
        const sessionHtml = `
            <div class="profile-info">
                <div class="profile-item">
                    <span class="profile-label">Session ID:</span>
                    <span class="profile-value">${status.sessionId ? status.sessionId.substring(0, 12) + '...' : 'N/A'}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Background Refresh:</span>
                    <span class="profile-value ${clientInfo.backgroundRefreshActive ? 'status-scored' : 'error'}">
                        ${clientInfo.backgroundRefreshActive ? '✅ Active (every 15 min)' : '❌ Inactive'}
                    </span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Token Expires In:</span>
                    <span class="profile-value ${expiryClass}">${expiryText}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Token Expiry Time:</span>
                    <span class="profile-value">${clientInfo.tokenExpiry}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Access Token (Client):</span>
                    <span class="profile-value" style="font-family: monospace; font-size: 0.85em;">${clientInfo.accessToken}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Refresh Token (Client):</span>
                    <span class="profile-value" style="font-family: monospace; font-size: 0.85em;">${clientInfo.refreshToken}</span>
                </div>
            </div>
        `;
        
        sessionInfo.innerHTML = sessionHtml;
    }

    private displayConfiguration(config: Configuration): void {
        const configStatus = document.getElementById('config-status');
        
        if (!configStatus) return;

        const configHtml = `
            <div class="profile-info">
                <div class="profile-item">
                    <span class="profile-label">Client ID:</span>
                    <span class="profile-value ${config.clientId === 'SET' ? 'status-scored' : 'error'}">${config.clientId}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Client Secret:</span>
                    <span class="profile-value ${config.clientSecret === 'SET' ? 'status-scored' : 'error'}">${config.clientSecret}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Redirect URI:</span>
                    <span class="profile-value">${config.redirectUri}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Authorization URL:</span>
                    <span class="profile-value">${config.authorizationUrl}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Token URL:</span>
                    <span class="profile-value">${config.tokenUrl}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">API Base URL:</span>
                    <span class="profile-value">${config.apiBaseUrl}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Scopes:</span>
                    <span class="profile-value">${config.scopes}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Scopes Array:</span>
                    <span class="profile-value">${config.scopesArray ? config.scopesArray.join(', ') : 'N/A'}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">OAuth State (Server):</span>
                    <span class="profile-value ${config.sessionState === 'SET' ? 'status-scored' : 'status-pending'}">${config.sessionState}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Access Token (Server):</span>
                    <span class="profile-value ${config.accessToken === 'SET' ? 'status-scored' : 'status-pending'}">${config.accessToken}</span>
                </div>
            </div>
        `;
        
        configStatus.innerHTML = configHtml;
        
        // Store config for later use
        this.config = config;
    }

    private setupEventListeners(): void {
        const testAuthBtn = document.getElementById('test-auth-btn');
        if (testAuthBtn) {
            testAuthBtn.addEventListener('click', () => this.testAuthorizationUrl());
        }
    }

    private async testAuthorizationUrl(): Promise<void> {
        if (!this.config) {
            this.showError('Configuration not loaded', 'auth-url-display');
            return;
        }
        
        try {
            // Generate a test state parameter
            const testState = Math.random().toString(36).substring(2, 15);
            
            const authUrl = new URL(this.config.authorizationUrl);
            authUrl.searchParams.append('client_id', this.config.clientId === 'SET' ? 'YOUR_CLIENT_ID' : 'NOT_SET');
            authUrl.searchParams.append('redirect_uri', this.config.redirectUri);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('scope', this.config.scopes);
            authUrl.searchParams.append('state', testState);
            
            const authUrlDisplay = document.getElementById('auth-url-display');
            if (!authUrlDisplay) return;

            authUrlDisplay.innerHTML = `
                <div class="cycle-item">
                    <div class="cycle-header">
                        <span class="cycle-date">Generated Authorization URL</span>
                        <span class="cycle-status status-scored">Ready</span>
                    </div>
                    <div style="margin-top: 15px;">
                        <div class="metric">
                            <span class="metric-label">Full URL:</span>
                            <textarea readonly style="width: 100%; height: 100px; margin-top: 10px; padding: 10px; border-radius: 4px; border: 1px solid #444; background: rgba(255,255,255,0.1); color: #fff; font-family: monospace; font-size: 12px;">${authUrl.toString()}</textarea>
                        </div>
                        <div style="margin-top: 15px;">
                            <button onclick="navigator.clipboard.writeText('${authUrl.toString().replace(/'/g, "\\'")}').then(() => alert('URL copied to clipboard!'))" class="logout-btn">
                                Copy URL
                            </button>
                            <button onclick="window.open('${authUrl.toString()}', '_blank')" class="cta-button" style="margin-left: 10px;">
                                Test in New Tab
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Check if configuration looks correct
            const issues: string[] = [];
            if (this.config.clientId !== 'SET') {
                issues.push('Client ID not configured');
            }
            if (this.config.clientSecret !== 'SET') {
                issues.push('Client Secret not configured');
            }
            if (!this.config.redirectUri.startsWith('http')) {
                issues.push('Invalid redirect URI format');
            }
            
            if (issues.length > 0) {
                authUrlDisplay.innerHTML += `
                    <div class="error" style="margin-top: 15px;">
                        <strong>Configuration Issues:</strong><br>
                        ${issues.map(issue => `• ${issue}`).join('<br>')}
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Failed to generate authorization URL:', error);
            this.showError('Failed to generate authorization URL', 'auth-url-display');
        }
    }

    private showError(message: string, containerId: string): void {
        const errorHtml = `<div class="error">${message}</div>`;
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = errorHtml;
        }
    }
}

// Initialize debug page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DebugPage();
});