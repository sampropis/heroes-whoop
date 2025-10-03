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

class DebugPage {
    private config: Configuration | null;

    constructor() {
        this.config = null;
        this.init();
    }

    private async init(): Promise<void> {
        await this.loadConfiguration();
        this.setupEventListeners();
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

    private displayConfiguration(config: Configuration): void {
        const configStatus = document.getElementById('config-status');
        const sessionInfo = document.getElementById('session-info');
        
        if (!configStatus || !sessionInfo) return;

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
            </div>
        `;
        
        const sessionHtml = `
            <div class="profile-info">
                <div class="profile-item">
                    <span class="profile-label">OAuth State:</span>
                    <span class="profile-value ${config.sessionState === 'SET' ? 'status-scored' : 'status-pending'}">${config.sessionState}</span>
                </div>
                <div class="profile-item">
                    <span class="profile-label">Access Token:</span>
                    <span class="profile-value ${config.accessToken === 'SET' ? 'status-scored' : 'status-pending'}">${config.accessToken}</span>
                </div>
            </div>
        `;
        
        configStatus.innerHTML = configHtml;
        sessionInfo.innerHTML = sessionHtml;
        
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