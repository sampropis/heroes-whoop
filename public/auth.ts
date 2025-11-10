// Client-side Authentication Utilities for WHOOP API Test Site

interface TokenData {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    expires_at: number;
}

interface ApiRequestOptions extends RequestInit {
    _retried?: boolean;
}

declare global {
    interface Window {
        whoopAuth: any; // Using any for now as this is a global instance
    }
}

class WhoopAuth {
    private tokenRefreshPromise: Promise<string> | null;
    private refreshIntervalId: number | null;

    constructor() {
        this.tokenRefreshPromise = null;
        this.refreshIntervalId = null;
    }

    // Token management
    private getAccessToken(): string | null {
        return localStorage.getItem('whoop_access_token');
    }

    private getRefreshToken(): string | null {
        return localStorage.getItem('whoop_refresh_token');
    }

    private getTokenExpiry(): number | null {
        const expiry = localStorage.getItem('whoop_token_expiry');
        return expiry ? parseInt(expiry, 10) : null;
    }

    private setTokens(accessToken: string, refreshToken: string, expiresAt: number): void {
        localStorage.setItem('whoop_access_token', accessToken);
        localStorage.setItem('whoop_refresh_token', refreshToken);
        localStorage.setItem('whoop_token_expiry', expiresAt.toString());
    }

    private clearTokens(): void {
        localStorage.removeItem('whoop_access_token');
        localStorage.removeItem('whoop_refresh_token');
        localStorage.removeItem('whoop_token_expiry');
    }

    // Check if user is authenticated
    public isAuthenticated(): boolean {
        const accessToken = this.getAccessToken();
        const refreshToken = this.getRefreshToken();
        
        console.log('Authentication check:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            accessTokenLength: accessToken ? accessToken.length : 0,
            refreshTokenLength: refreshToken ? refreshToken.length : 0
        });
        
        // For now, only require access token since some OAuth flows might not provide refresh tokens
        return !!(accessToken && accessToken !== 'undefined');
    }

    // Check if token is expired or expiring soon (within 5 minutes)
    private isTokenExpired(): boolean {
        const expiry = this.getTokenExpiry();
        if (!expiry) return true;
        return Date.now() > (expiry - 300000); // 5 minutes buffer
    }

    // Refresh access token
    public async refreshToken(): Promise<string> {
        // Prevent multiple simultaneous refresh requests
        if (this.tokenRefreshPromise) {
            console.log('Token refresh already in progress, waiting...');
            return this.tokenRefreshPromise;
        }

        const refreshToken = this.getRefreshToken();
        console.log('Attempting token refresh with refresh token:', refreshToken ? 'SET' : 'NOT SET');
        
        if (!refreshToken || refreshToken === 'undefined') {
            throw new Error('No refresh token available for token refresh');
        }

        this.tokenRefreshPromise = this._performTokenRefresh(refreshToken);
        
        try {
            const result = await this.tokenRefreshPromise;
            return result;
        } finally {
            this.tokenRefreshPromise = null;
        }
    }

    private async _performTokenRefresh(refreshToken: string): Promise<string> {
        try {
            console.log('Performing token refresh request...');
            console.log('Refresh token (first 20 chars):', refreshToken ? refreshToken.substring(0, 20) + '...' : 'undefined');
            
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            console.log('Token refresh response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Token refresh failed with response:', errorText);
                throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
            }

            const tokenData = await response.json() as TokenData;
            console.log('Token refresh response data:', {
                hasAccessToken: !!tokenData.access_token,
                hasRefreshToken: !!tokenData.refresh_token,
                expiresIn: tokenData.expires_in
            });
            
            // Update tokens in localStorage
            this.setTokens(
                tokenData.access_token,
                tokenData.refresh_token || refreshToken, // Keep old refresh token if new one not provided
                tokenData.expires_at
            );

            console.log('Token refresh successful');
            return tokenData.access_token;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            throw error;
        }
    }

    // Get valid access token (refresh if needed)
    public async getValidAccessToken(): Promise<string> {
        const accessToken = this.getAccessToken();
        
        if (!accessToken || accessToken === 'undefined') {
            throw new Error('Not authenticated - no access token available');
        }

        if (this.isTokenExpired()) {
            console.log('Token expired, attempting refresh...');
            const refreshToken = this.getRefreshToken();
            
            if (!refreshToken || refreshToken === 'undefined') {
                console.error('Token expired and no refresh token available - redirecting to login');
                this.clearTokens();
                this.redirectToLogin();
                throw new Error('Token expired and no refresh token available');
            }
            
            try {
                return await this.refreshToken();
            } catch (error) {
                console.error('Token refresh failed:', error);
                this.clearTokens();
                this.redirectToLogin();
                throw error;
            }
        }

        return accessToken;
    }

    // Make authenticated API request with automatic token refresh
    public async apiRequest(url: string, options: ApiRequestOptions = {}): Promise<Response> {
        try {
            const accessToken = await this.getValidAccessToken();
            
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                ...options.headers
            };

            const response = await fetch(url, {
                ...options,
                headers
            });

            // If we get a 401, try to refresh token once and retry
            if (response.status === 401 && !options._retried) {
                console.log('API request failed with 401, attempting token refresh...');
                
                try {
                    await this.refreshToken();
                    const newAccessToken = this.getAccessToken();
                    
                    if (!newAccessToken) {
                        throw new Error('Failed to get new access token after refresh');
                    }

                    return await fetch(url, {
                        ...options,
                        headers: {
                            ...headers,
                            'Authorization': `Bearer ${newAccessToken}`
                        },
                        // Skip _retried property as it's not part of RequestInit
                    });
                } catch (refreshError) {
                    console.error('Token refresh failed during API request:', refreshError);
                    this.redirectToLogin();
                    throw refreshError;
                }
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Logout user
    public async logout(): Promise<void> {
        try {
            // Stop background refresh
            this.stopBackgroundRefresh();
            
            // Call logout endpoint
            await fetch('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            // Always clear local tokens
            this.clearTokens();
            this.redirectToLogin();
        }
    }

    // Redirect to login page
    private redirectToLogin(): void {
        window.location.href = '/';
    }

    // Check authentication on page load
    public checkAuthOnLoad(): boolean {
        console.log('Checking authentication on page load...');
        
        const accessToken = this.getAccessToken();
        const refreshToken = this.getRefreshToken();
        const tokenExpiry = this.getTokenExpiry();
        
        console.log('Token status:', {
            accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'NOT SET',
            refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : 'NOT SET',
            tokenExpiry: tokenExpiry ? new Date(tokenExpiry).toISOString() : 'NOT SET',
            isExpired: this.isTokenExpired()
        });
        
        if (!this.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login...');
            this.redirectToLogin();
            return false;
        }
        
        console.log('User authenticated successfully');
        return true;
    }

    // Initialize authentication (call this on protected pages)
    public async init(): Promise<boolean> {
        const isAuth = this.checkAuthOnLoad();
        if (isAuth) {
            this.startBackgroundRefresh();
        }
        return isAuth;
    }

    // Start background token refresh (every 15 minutes)
    public startBackgroundRefresh(): void {
        // Stop existing interval if any
        this.stopBackgroundRefresh();

        console.log('Starting background token refresh (every 15 minutes)');
        
        // Refresh token every 15 minutes (900000 ms)
        this.refreshIntervalId = window.setInterval(async () => {
            try {
                const refreshToken = this.getRefreshToken();
                if (refreshToken && refreshToken !== 'undefined') {
                    console.log('Background token refresh triggered');
                    await this.refreshToken();
                    console.log('Background token refresh successful');
                } else {
                    console.log('No refresh token available, skipping background refresh');
                }
            } catch (error) {
                console.error('Background token refresh failed:', error);
                // Don't redirect on background refresh failure - user is still working
            }
        }, 15 * 60 * 1000); // 15 minutes
    }

    // Stop background token refresh
    public stopBackgroundRefresh(): void {
        if (this.refreshIntervalId !== null) {
            console.log('Stopping background token refresh');
            window.clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
        }
    }

    // Check if background refresh is active
    public isBackgroundRefreshActive(): boolean {
        return this.refreshIntervalId !== null;
    }
}

// Create global auth instance
window.whoopAuth = new WhoopAuth();

// Export for use in other modules
export default WhoopAuth;