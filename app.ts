import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import session from 'express-session';
import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { getPublicDir, getDistPublicDir } from './paths';
import dotenv from 'dotenv';
import { getDb } from './db';
import { encryptSecret, decryptSecret } from './crypto';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.prod'
    : process.env.NODE_ENV === 'development'
    ? '.env.dev'
    : '.env';

dotenv.config({ path: envFile });

// Augment express-session
declare module 'express-session' {
    interface SessionData {
      oauthState?: string;
      accessToken?: string;
      refreshToken?: string;
      tokenExpiry?: number;
    }
}

// Custom request properties
interface AuthenticatedRequest extends Request {
    accessToken?: string;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(getPublicDir(__dirname)));
app.use('/dist-public', express.static(getDistPublicDir(__dirname)));

// Session configuration
// Use SECURE_COOKIES env var to control secure cookie setting
// Set to 'true' only if you're actually serving over HTTPS
// Default to false for local development, even in production mode
const useSecureCookies = process.env.SECURE_COOKIES === 'true';

// Behind a reverse proxy (Render, Heroku, etc.) secure cookies require trust proxy
// This ensures req.secure is set correctly so the session cookie is set
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: useSecureCookies,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Help with OAuth redirects
  }
}));

// Interfaces
interface ActiveSessionData {
    interval: NodeJS.Timeout;
    accessToken: string | null;
    refreshToken: string;
    tokenExpiry: number | null;
}

interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
}

// Store for active sessions and their refresh intervals
const activeSessions = new Map<string, ActiveSessionData>();

// Background token refresh functionality
function startTokenRefreshForSession(sessionId: string, refreshToken: string) {
  console.log(`Starting background token refresh for session: ${sessionId}`);

  // Clear existing interval if any
  if (activeSessions.has(sessionId)) {
    const existingSession = activeSessions.get(sessionId);
    if(existingSession) {
        clearInterval(existingSession.interval);
    }
  }

  // Set up refresh every 15 minutes (900,000 ms)
  const refreshInterval = setInterval(async () => {
    try {
      console.log(`Background token refresh for session: ${sessionId}`);
      const newTokens = await refreshAccessToken(refreshToken);

      // Store the new tokens for this session
      const sessionData: ActiveSessionData = {
        interval: refreshInterval,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || refreshToken,
        tokenExpiry: Date.now() + ((newTokens.expires_in || 1800) * 1000)
      };

      activeSessions.set(sessionId, sessionData);

      console.log(`Token refreshed successfully for session: ${sessionId}, expires in ${newTokens.expires_in || 1800} seconds`);

      // Update the refresh token if a new one was provided
      if (newTokens.refresh_token) {
        refreshToken = newTokens.refresh_token;
      }

    } catch (error) {
      console.error(`Background token refresh failed for session ${sessionId}:`, error);
      // Clear the interval on failure
      stopTokenRefreshForSession(sessionId);
    }
  }, 15 * 60 * 1000); // 15 minutes

  activeSessions.set(sessionId, {
    interval: refreshInterval,
    accessToken: null,
    refreshToken: refreshToken,
    tokenExpiry: null
  });
}

function stopTokenRefreshForSession(sessionId: string) {
  if (activeSessions.has(sessionId)) {
    const sessionData = activeSessions.get(sessionId);
    if(sessionData) {
        clearInterval(sessionData.interval);
    }
    activeSessions.delete(sessionId);
    console.log(`Stopped background token refresh for session: ${sessionId}`);
  }
}

// Clean up intervals when sessions expire
function cleanupExpiredSessions() {
  // This would be more robust with a proper session store
  // For now, we'll rely on the session middleware to handle cleanup
  console.log(`Active background refresh sessions: ${activeSessions.size}`);
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Middleware to update session with refreshed tokens
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.sessionID && activeSessions.has(req.sessionID)) {
    const sessionData = activeSessions.get(req.sessionID);

    if (sessionData && req.session) {
        // Update session with latest tokens from background refresh
        if (sessionData.accessToken && sessionData.accessToken !== req.session.accessToken) {
          console.log(`Updating session ${req.sessionID} with refreshed token`);
          req.session.accessToken = sessionData.accessToken;
        }
        if (sessionData.refreshToken && sessionData.refreshToken !== req.session.refreshToken) {
          req.session.refreshToken = sessionData.refreshToken;
        }
        if (sessionData.tokenExpiry && sessionData.tokenExpiry !== req.session.tokenExpiry) {
          req.session.tokenExpiry = sessionData.tokenExpiry;
        }
    }
  }
  next();
});

// Configuration
const config = {
  clientId: process.env.WHOOP_CLIENT_ID,
  clientSecret: process.env.WHOOP_CLIENT_SECRET,
  redirectUri: process.env.WHOOP_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`,
  authorizationUrl: process.env.WHOOP_AUTHORIZATION_URL || 'https://api.prod.whoop.com/oauth/oauth2/auth',
  tokenUrl: process.env.WHOOP_TOKEN_URL || 'https://api.prod.whoop.com/oauth/oauth2/token',
  apiBaseUrl: process.env.WHOOP_API_BASE_URL || 'https://api.prod.whoop.com/developer',
  // Flexible scope parsing: handles both space-separated and comma-separated formats
  // Examples (all work):
  //   "read:cycles read:recovery"
  //   "read:cycles,read:recovery"
  //   "read:cycles, read:recovery"
  scopes: (process.env.WHOOP_SCOPES || 'read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline')
    .replace(/,/g, ' ')   // Convert any commas to spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
    .trim()               // Remove leading/trailing spaces
};

// Helper function to generate random state for OAuth
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

function buildStateWithPurpose(baseState: string, purpose: 'personal' | 'enroll'): string {
  return `${baseState}|${purpose}`;
}

// Helper function to refresh access token
async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  try {
    console.log('Refreshing access token...');

    const tokenData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId!,
      client_secret: config.clientSecret!
    });

    console.log(`Making WHOOP Token Refresh request to: ${config.tokenUrl}`);
    const tokenResponse = await axios.post<TokenResponse>(config.tokenUrl!, tokenData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    console.log('Token refresh successful');
    return tokenResponse.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Token refresh failed:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
      message: axiosError.message
    });
    throw error;
  }
}

// Helper function to make authenticated API requests
async function makeWhoopApiRequest<T>(endpoint: string, accessToken: string): Promise<T> {
  const fullUrl = `${config.apiBaseUrl}${endpoint}`;
  try {
    console.log(`[WHOOP API REQUEST] Making request to: ${fullUrl}`);
    console.log(`[WHOOP API REQUEST] Base URL: ${config.apiBaseUrl}`);
    console.log(`[WHOOP API REQUEST] Endpoint: ${endpoint}`);

    const response = await axios.get<T>(fullUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[WHOOP API RESPONSE] Request successful - Status: ${response.status}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error(`[WHOOP API ERROR] Request failed for: ${fullUrl}`, {
      endpoint: endpoint,
      fullUrl: fullUrl,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
      message: axiosError.message
    });
    throw error;
  }
}

function deleteMemberByWhoopUserId(db: any, whoopUserId: string) {
  db.prepare('DELETE FROM members WHERE whoop_user_id = ?').run(whoopUserId);
}

// Try to robustly extract a recovery score (0-100) from arbitrary objects
function extractRecoveryScore(obj: any, maxDepth = 4): number | null {
  if (!obj || typeof obj !== 'object' || maxDepth < 0) return null;
  const candidates: number[] = [];
  const visit = (o: any, depth: number) => {
    if (!o || typeof o !== 'object' || depth < 0) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number') {
        const key = k.toLowerCase();
        if (key.includes('recovery')) {
          // Normalize to 0-100 if it's 0-1
          const val = v <= 1 ? v * 100 : v;
          if (val >= 0 && val <= 100) candidates.push(val);
        }
        if (key === 'score') {
          // Some payloads use plain "score" under a recovery object – handled by recursion too
          const val = v <= 1 ? v * 100 : v;
          if (val >= 0 && val <= 100) candidates.push(val);
        }
      } else if (v && typeof v === 'object') {
        visit(v, depth - 1);
      }
    }
  };
  visit(obj, maxDepth);
  if (candidates.length === 0) return null;
  // Prefer the highest plausible score (commonly 0-100)
  return Math.max(...candidates);
}

// Routes
// Home route
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'index.html'));
});

// Join (enrollment) route - starts OAuth with enroll purpose
app.get('/join', (req: Request, res: Response) => {
  const state = generateState();
  req.session.oauthState = state;

  const cleanScopes = config.scopes
    .split(' ')
    .filter(scope => scope.trim() !== '')
    .join(' ');

  const authUrl = new URL(config.authorizationUrl!);
  authUrl.searchParams.append('client_id', config.clientId!);
  authUrl.searchParams.append('redirect_uri', config.redirectUri!);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', cleanScopes);
  authUrl.searchParams.append('state', buildStateWithPurpose(state, 'enroll'));

  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Failed to save session' });
    }
    res.redirect(authUrl.toString());
  });
});

// Start OAuth flow
app.get('/auth/login', (req: Request, res: Response) => {
  const state = generateState();
  req.session.oauthState = state;

  console.log('Starting OAuth flow...');
  console.log('Authorization URL:', config.authorizationUrl);
  console.log('Client ID:', config.clientId);
  console.log('Redirect URI:', config.redirectUri);
  console.log('Scopes (raw):', config.scopes);
  console.log('Scopes (individual):', config.scopes.split(' '));
  console.log('State:', state);
  console.log('Session ID:', req.sessionID);
  console.log('Session oauthState set to:', req.session.oauthState);

  // Clean and validate scopes
  const cleanScopes = config.scopes
    .split(' ')
    .filter(scope => scope.trim() !== '') // Remove empty strings
    .join(' ');

  console.log('Cleaned scopes:', cleanScopes);

  const authUrl = new URL(config.authorizationUrl!);
  authUrl.searchParams.append('client_id', config.clientId!);
  authUrl.searchParams.append('redirect_uri', config.redirectUri!);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', cleanScopes);
  authUrl.searchParams.append('state', buildStateWithPurpose(state, 'personal'));

  console.log('Full authorization URL:', authUrl.toString());
  
  // Save session before redirect
  req.session.save((err) => {
    if (err) {
      console.error('Session save error:', err);
      return res.status(500).json({ error: 'Failed to save session' });
    }
    console.log('Session saved successfully, redirecting to OAuth provider');
    res.redirect(authUrl.toString());
  });
});

// OAuth callback
app.get('/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  console.log('OAuth callback received:');
  console.log('Session ID:', req.sessionID);
  console.log('Session oauthState:', req.session.oauthState);
  console.log('Received state:', state);
  console.log('Received code:', code ? 'SET' : 'NOT SET');

  // Check for OAuth errors
  if (error) {
    console.error('OAuth error:', error, error_description);
    return res.status(400).json({
      error: 'OAuth authorization failed',
      details: error_description as string || error
    });
  }

  // Verify state parameter
  const stateStr = String(state || '');
  const [returnedState, purpose = 'personal'] = stateStr.split('|');
  if (returnedState !== req.session.oauthState) {
    console.error('State mismatch. Expected:', req.session.oauthState, 'Received:', state);
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  if (!code) {
    console.error('No authorization code provided');
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    console.log('Exchanging authorization code for access token...');
    console.log('Token URL:', config.tokenUrl);
    console.log('Client ID:', config.clientId);
    console.log('Redirect URI:', config.redirectUri);

    // Exchange code for access token
    const tokenData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: config.redirectUri!,
      client_id: config.clientId!,
      client_secret: config.clientSecret!
    });

    console.log(`Making WHOOP Token Exchange request to: ${config.tokenUrl}`);
    const tokenResponse = await axios.post<TokenResponse>(config.tokenUrl!, tokenData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    console.log('Token exchange successful');
    console.log('Token response data:', JSON.stringify(tokenResponse.data, null, 2));

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Validate required tokens
    if (!access_token) {
      throw new Error('Access token not received from OAuth provider');
    }
    if (!refresh_token) {
      console.error('Warning: No refresh token received from OAuth provider');
    }

    // Clean up OAuth state
    delete req.session.oauthState;

    console.log(`OAuth flow completed successfully. Purpose: ${purpose}`);
    console.log(`Access token: ${access_token ? 'SET' : 'NOT SET'}`);
    console.log(`Refresh token: ${refresh_token ? 'SET' : 'NOT SET'}`);
    console.log(`Expires in: ${expires_in} seconds`);

    if (purpose === 'enroll') {
      if (!refresh_token) {
        return res.status(400).send('Enrollment requires offline access (refresh token). Please contact the gym admin.');
      }
      // Fetch profile to identify the user
      const profile: any = await makeWhoopApiRequest('/v2/user/profile/basic', access_token);
      const whoopUserId: string = String(profile?.user_id ?? profile?.id ?? '');
      const firstName: string | undefined = profile?.first_name || profile?.firstName;
      const lastName: string | undefined = profile?.last_name || profile?.lastName;
      const composedName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
      const displayName: string = composedName || String(profile?.name ?? profile?.full_name ?? 'Member');
      const avatarUrl: string | undefined = profile?.avatar_url || profile?.profile_picture_url;
      if (!whoopUserId) {
        return res.status(500).send('Failed to retrieve WHOOP user profile.');
      }

      const db = getDb();
      const enc = encryptSecret(refresh_token);

      // Upsert member by whoop_user_id
      const existing = db
        .prepare('SELECT id FROM members WHERE whoop_user_id = ?')
        .get(whoopUserId) as { id?: number } | undefined;

      if (existing?.id) {
        db.prepare('UPDATE members SET display_name = ?, avatar_url = ?, refresh_token_enc = ? WHERE id = ?')
          .run(displayName, avatarUrl || null, enc, existing.id);
      } else {
        db.prepare('INSERT INTO members (whoop_user_id, display_name, avatar_url, refresh_token_enc) VALUES (?, ?, ?, ?)')
          .run(whoopUserId, displayName, avatarUrl || null, enc);
      }

      // Redirect to thanks page
      res.redirect('/thanks');
      return;
    }

    // Default: personal mode, send tokens to client for localStorage storage
    res.send(`
      <html>
        <head>
          <title>Authentication Success</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                   background: #1a1a1a; color: white; text-align: center; padding: 50px; }
            .loading { color: #ff6b35; }
          </style>
        </head>
        <body>
          <h1>Authentication Successful!</h1>
          <p class="loading">Saving credentials and redirecting...</p>
          <script>
            try {
              const accessToken = '${access_token}';
              const refreshToken = '${refresh_token}';
              const expiresIn = ${expires_in || 3600};
              if (!accessToken || accessToken === 'undefined') {
                throw new Error('Invalid access token received');
              }
              localStorage.setItem('whoop_access_token', accessToken);
              if (refreshToken && refreshToken !== 'undefined') {
                localStorage.setItem('whoop_refresh_token', refreshToken);
              }
              localStorage.setItem('whoop_token_expiry', '${Date.now() + ((expires_in || 3600) * 1000)}');
              setTimeout(() => { window.location.href = '/dashboard'; }, 600);
            } catch (error) {
              alert('Authentication failed. Redirecting to login.');
              setTimeout(() => { window.location.href = '/'; }, 1200);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Token exchange failed:', {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
      headers: axiosError.response?.headers,
      message: axiosError.message
    });

    res.status(500).json({
      error: 'Failed to exchange authorization code',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Dashboard route (authentication handled client-side)
app.get('/dashboard', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'dashboard.html'));
});

// Activities route (authentication handled client-side)
app.get('/activities', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'activities.html'));
});

// Recoveries route (authentication handled client-side)
app.get('/recoveries', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'recoveries.html'));
});

// Cycles route (authentication handled client-side)
app.get('/cycles', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'cycles.html'));
});

// Sleep route (authentication handled client-side)
app.get('/sleeps', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'sleeps.html'));
});

// Debug route
app.get('/debug', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'debug.html'));
});

// Setup guide route
app.get('/setup', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'whoop-setup.html'));
});

// Thanks route
app.get('/thanks', (req: Request, res: Response) => {
  const thanksPath = path.join(getPublicDir(__dirname), 'thanks.html');
  res.sendFile(thanksPath);
});

// Leaderboard route (public display)
app.get('/leaderboard', (req: Request, res: Response) => {
  res.sendFile(path.join(getPublicDir(__dirname), 'leaderboard.html'));
});


// Helper function to extract token from request (Authorization header or session)
function getTokenFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  // Fallback to session for backward compatibility
  return req.session?.accessToken;
}

// New middleware to handle both Authorization header and session-based auth
async function ensureAuthenticated(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const accessToken = getTokenFromRequest(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Store token in req for API calls
  req.accessToken = accessToken;
  next();
}

// Token refresh endpoint for client-side use
app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const tokenData = await refreshAccessToken(refresh_token);
    console.log('Client-side token refresh successful');

    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token,
      expires_in: tokenData.expires_in,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    });
  } catch (error) {
    console.error('Client-side token refresh failed:', error);
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// Logout endpoint (clears localStorage on client side)
app.post('/auth/logout', (req: Request, res: Response) => {
    const sessionId = req.sessionID;
    if (sessionId) {
        stopTokenRefreshForSession(sessionId);
    }
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    console.log(`Session ${sessionId} logged out and cleanup completed`);
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// API Routes
function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

// Leaderboard aggregation (server-side)
app.get('/api/leaderboard', async (req: Request, res: Response) => {
  try {
    const staleStrainMs = 5 * 60 * 1000;   // 5 minutes
    const staleHourlyMs = 60 * 60 * 1000;  // 1 hour
    const forceArg = String((req.query as any).force || '').toLowerCase();
    const db = getDb();
    const members = db.prepare('SELECT id, whoop_user_id, display_name, avatar_url, refresh_token_enc FROM members').all() as Array<{
      id: number; whoop_user_id: string; display_name: string; avatar_url?: string; refresh_token_enc: string;
    }>;
    const { start, end } = getTodayRange();
    const startISO = start.toISOString();
    const endISO = end.toISOString();
    const todayStr = start.toISOString().slice(0, 10);

    const sleepBoard: Array<{ name: string; value: number; seconds?: number; consistency?: number; avatar?: string }> = [];
    const recoveryBoard: Array<{ name: string; value: number; avatar?: string }> = [];
    const strainBoard: Array<{ name: string; value: number; avatar?: string }> = [];

    for (const m of members) {
      // Check cache
      const cached = db
        .prepare('SELECT sleep_total_sec, sleep_perf_pct, recovery_score, strain_score, updated_at FROM daily_metrics WHERE member_id = ? AND date = ?')
        .get(m.id, todayStr) as { sleep_total_sec?: number; sleep_perf_pct?: number; recovery_score?: number; strain_score?: number; updated_at?: string } | undefined;
      const updated = cached?.updated_at ? new Date(cached.updated_at).getTime() : 0;
      const ageMs = updated ? (Date.now() - updated) : Number.POSITIVE_INFINITY;

      let sleepTotalSec: number | null = null;
      let sleepPerfPct: number | null = null;
      let recoveryScore: number | null = null;
      let strainScore: number | null = null;
      let sleepConsistencyPct: number | null = null;

      // Determine which metrics need refresh
      const forceAll = forceArg === 'all';
      const needStrainFetch = forceAll || forceArg === 'strain' ? true : ageMs > staleStrainMs;
      const needHourlyFetch = forceAll || forceArg === 'sleep' || forceArg === 'recovery' ? true : ageMs > staleHourlyMs;

      if (!needStrainFetch && cached) {
        // Use cache for all when fresh within 5 minutes
        sleepTotalSec = cached.sleep_total_sec ?? null;
        sleepPerfPct = cached.sleep_perf_pct ?? null;
        recoveryScore = cached.recovery_score ?? null;
        strainScore = cached.strain_score ?? null;
      } else {
        try {
          const refreshToken = decryptSecret(m.refresh_token_enc);
          const tokenData = await refreshAccessToken(refreshToken);
          const accessToken = tokenData.access_token;
          // Update stored refresh token if rotated
          if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
            const enc = encryptSecret(tokenData.refresh_token);
            db.prepare("UPDATE members SET refresh_token_enc = ?, last_refreshed_at = datetime('now') WHERE id = ?").run(enc, m.id);
          } else {
            db.prepare("UPDATE members SET last_refreshed_at = datetime('now') WHERE id = ?").run(m.id);
          }

          // Sleep (hourly): performance % and total slept seconds
          if (needHourlyFetch) {
            try {
              const sleepResp: any = await makeWhoopApiRequest(`/v2/activity/sleep?start=${startISO}&end=${endISO}&limit=25`, accessToken);
              const records: any[] = (sleepResp?.records as any[]) || (Array.isArray(sleepResp) ? sleepResp : []);
              let totalMinutes = 0;
              let bestPerf: number | null = null;
              let bestConsistency: number | null = null;
              for (const r of records) {
                const score = r?.score || r?.sleep?.score;
                const perf = Number(score?.sleep_performance_percentage);
                if (Number.isFinite(perf)) {
                  bestPerf = Math.max(bestPerf ?? perf, perf);
                }
                const consistency = Number(score?.sleep_consistency_percentage);
                if (Number.isFinite(consistency)) {
                  bestConsistency = Math.max(bestConsistency ?? consistency, consistency);
                }
                // Prefer stage minutes sum (deep + rem + light)
                const deep = Number(score?.slow_wave_sleep_minutes) || 0;
                const rem = Number(score?.rem_sleep_minutes) || 0;
                const light = Number(score?.light_sleep_minutes) || 0;
                let minutes = 0;
                if (deep + rem + light > 0) {
                  minutes = deep + rem + light;
                } else if (typeof score?.in_bed_duration_minutes === 'number') {
                  minutes = Number(score.in_bed_duration_minutes) - (Number(score.awake_time_minutes) || 0);
                } else if (r?.start && r?.end) {
                  const startTs = new Date(r.start).getTime();
                  const endTs = new Date(r.end).getTime();
                  minutes = Math.max(0, Math.round((endTs - startTs) / 60000));
                }
                totalMinutes += Math.max(0, minutes);
              }
              sleepTotalSec = totalMinutes > 0 ? totalMinutes * 60 : null;
              sleepPerfPct = bestPerf !== null ? Math.round(bestPerf) : null;
              sleepConsistencyPct = bestConsistency !== null ? Math.round(bestConsistency) : null;
            } catch (_) {
              // ignore
            }
          } else if (cached) {
            sleepTotalSec = cached.sleep_total_sec ?? null;
            sleepPerfPct = cached.sleep_perf_pct ?? null;
            sleepConsistencyPct = (cached as any).sleep_consistency_pct ?? null;
          }

          // Recovery (hourly): recovery score
          if (needHourlyFetch) {
            try {
              // Primary: list endpoint for today
              const recResp: any = await makeWhoopApiRequest(`/v2/recovery?start=${startISO}&end=${endISO}&limit=1`, accessToken);
              const r = (recResp?.records && recResp.records[0]) || (Array.isArray(recResp) ? recResp[0] : recResp);
              const scoreA = Number(r?.score ?? r?.recovery_score ?? r?.recovery?.score);
              let extracted = Number.isFinite(scoreA) ? scoreA : extractRecoveryScore(r);
              if (typeof extracted === 'number') {
                if (extracted <= 1) extracted = extracted * 100;
                recoveryScore = extracted;
              } else {
                recoveryScore = null;
              }
            } catch {
              // ignore and try to derive from cycle below if available
            }
            // If still null, bind recovery to today's cycle explicitly
            if (recoveryScore == null) {
              try {
                const cycResp: any = await makeWhoopApiRequest(`/v2/cycle?start=${startISO}&end=${endISO}&limit=1`, accessToken);
                const c = (cycResp?.records && cycResp.records[0]) || (Array.isArray(cycResp) ? cycResp[0] : cycResp);
                if (c) {
                  // Prefer score on the cycle if present
                  const recFromCycle = Number(c?.score?.recovery_score ?? c?.recovery_score ?? c?.recovery?.score);
                  if (Number.isFinite(recFromCycle)) {
                    recoveryScore = recFromCycle <= 1 ? recFromCycle * 100 : recFromCycle;
                  } else {
                    // Fallback endpoint: /cycle/{id}/recovery
                    const cycleId = c?.id ?? c?.cycle_id ?? c?.cycleId;
                    if (cycleId != null) {
                      const recObj: any = await makeWhoopApiRequest(`/v2/cycle/${cycleId}/recovery`, accessToken);
                      const score2 = Number(recObj?.score ?? recObj?.recovery_score ?? recObj?.recovery?.score);
                      let extracted2 = Number.isFinite(score2) ? score2 : extractRecoveryScore(recObj);
                      if (typeof extracted2 === 'number') {
                        if (extracted2 <= 1) extracted2 = extracted2 * 100;
                        recoveryScore = extracted2;
                      }
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          } else if (cached) {
            recoveryScore = cached.recovery_score ?? null;
          }

          // Strain (5 min): cycle score.strain
          if (needStrainFetch) {
            try {
              const cycResp: any = await makeWhoopApiRequest(`/v2/cycle?start=${startISO}&end=${endISO}&limit=1`, accessToken);
              const c = (cycResp?.records && cycResp.records[0]) || (Array.isArray(cycResp) ? cycResp[0] : cycResp);
              const strain = Number(c?.score?.strain ?? c?.strain ?? c?.score_strain ?? c?.cycle?.strain);
              strainScore = Number.isFinite(strain) ? strain : null;
              // Try to derive recovery from cycle if not set
              if (recoveryScore == null && c) {
                const recFromCycle = Number(c?.score?.recovery_score ?? c?.recovery_score ?? c?.recovery?.score);
                if (Number.isFinite(recFromCycle)) {
                  recoveryScore = recFromCycle;
                } else {
                  // Fallback: fetch specific cycle recovery
                  const cycleId = c?.id ?? c?.cycle_id ?? c?.cycleId;
                  if (cycleId != null) {
                    try {
                      const recObj: any = await makeWhoopApiRequest(`/v2/cycle/${cycleId}/recovery`, accessToken);
                      const score2 = Number(recObj?.score ?? recObj?.recovery_score ?? recObj?.recovery?.score);
                      if (Number.isFinite(score2)) recoveryScore = score2;
                    } catch {
                      // ignore
                    }
                  }
                }
              }
            } catch (_) {
              // ignore
            }
          } else if (cached) {
            strainScore = cached.strain_score ?? null;
          }

          // Upsert daily_metrics
          const exists = db
            .prepare('SELECT id FROM daily_metrics WHERE member_id = ? AND date = ?')
            .get(m.id, todayStr) as { id?: number } | undefined;
          if (exists?.id) {
            db.prepare("UPDATE daily_metrics SET sleep_total_sec = COALESCE(?, sleep_total_sec), sleep_perf_pct = COALESCE(?, sleep_perf_pct), sleep_consistency_pct = COALESCE(?, sleep_consistency_pct), recovery_score = COALESCE(?, recovery_score), strain_score = COALESCE(?, strain_score), updated_at = datetime('now') WHERE id = ?")
              .run(sleepTotalSec, sleepPerfPct, sleepConsistencyPct, recoveryScore, strainScore, exists.id);
          } else {
            db.prepare('INSERT INTO daily_metrics (member_id, date, sleep_total_sec, sleep_perf_pct, sleep_consistency_pct, recovery_score, strain_score) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(m.id, todayStr, sleepTotalSec, sleepPerfPct, sleepConsistencyPct, recoveryScore, strainScore);
          }
        } catch (err) {
          console.error(`Failed to update metrics for member ${m.id}`, err);
          // If token is revoked/invalid, remove this member so they disappear from the leaderboard
          const axiosError = err as AxiosError;
          const status = axiosError?.response?.status;
          const data: any = axiosError?.response?.data;
          const isInvalidGrant =
            status === 400 || status === 401 ||
            (typeof data === 'object' && (data?.error === 'invalid_grant' || data?.error === 'invalid_request'));
          if (isInvalidGrant) {
            try {
              deleteMemberByWhoopUserId(db, m.whoop_user_id);
              console.log(`Removed member ${m.whoop_user_id} due to invalid/revoked token`);
            } catch (e) {
              console.error('Failed to remove member after token failure', e);
            }
          }
          // Fallback to cached values if available
          if (cached) {
            sleepTotalSec = cached.sleep_total_sec ?? null;
            sleepPerfPct = cached.sleep_perf_pct ?? null;
            sleepConsistencyPct = (cached as any).sleep_consistency_pct ?? null;
            recoveryScore = cached.recovery_score ?? null;
            strainScore = cached.strain_score ?? null;
          }
        }
      }

      if (typeof sleepPerfPct === 'number') sleepBoard.push({ name: m.display_name, value: sleepPerfPct, seconds: typeof sleepTotalSec === 'number' ? sleepTotalSec : undefined, consistency: typeof sleepConsistencyPct === 'number' ? sleepConsistencyPct : undefined, avatar: m.avatar_url });
      if (typeof recoveryScore === 'number') recoveryBoard.push({ name: m.display_name, value: recoveryScore, avatar: m.avatar_url });
      if (typeof strainScore === 'number') strainBoard.push({ name: m.display_name, value: strainScore, avatar: m.avatar_url });
    }

    // Sort desc
    sleepBoard.sort((a, b) => b.value - a.value);
    recoveryBoard.sort((a, b) => b.value - a.value);
    strainBoard.sort((a, b) => b.value - a.value);

    res.json({
      sleep: sleepBoard,
      recovery: recoveryBoard,
      strain: strainBoard,
      date: todayStr
    });
  } catch (error) {
    console.error('Leaderboard aggregation failed', error);
    res.status(500).json({ error: 'Failed to build leaderboard' });
  }
});

// Allow a user to unlink themselves: requires Authorization header with a valid access token
app.post('/api/unlink', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile: any = await makeWhoopApiRequest('/v2/user/profile/basic', req.accessToken!);
    const whoopUserId: string = String(profile?.user_id ?? profile?.id ?? '');
    if (!whoopUserId) {
      return res.status(400).json({ error: 'Unable to determine user id from profile' });
    }
    const db = getDb();
    deleteMemberByWhoopUserId(db, whoopUserId);
    return res.json({ success: true });
  } catch (e) {
    console.error('Unlink failed', e);
    return res.status(500).json({ error: 'Failed to unlink user' });
  }
});

// Get user profile
app.get('/api/profile', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await makeWhoopApiRequest('/v2/user/profile/basic', req.accessToken!);
    res.json(profile);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get today's cycle data
app.get('/api/cycle/today', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const cycles = await makeWhoopApiRequest(
      `/v2/cycle?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}&limit=25`,
      req.accessToken!
    );

    res.json(cycles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cycle data' });
  }
});

// Get all cycles
app.get('/api/cycles', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = '10', start, end, nextToken } = req.query;
    let endpoint = `/v2/cycle?limit=${limit}`;

    if (start) endpoint += `&start=${start}`;
    if (end) endpoint += `&end=${end}`;
    if (nextToken) endpoint += `&nextToken=${nextToken}`;

    console.log(`Fetching cycles with endpoint: ${endpoint}`);
    const cycles = await makeWhoopApiRequest(endpoint, req.accessToken!);
    res.json(cycles);
  } catch (error) {
    console.error('Failed to fetch cycles:', error);
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    res.status(500).json({ error: 'Failed to fetch cycles' });
  }
});

// Get recovery data
app.get('/api/recovery', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = '10', start, end, nextToken } = req.query;
    let endpoint = `/v2/recovery?limit=${limit}`;

    if (start) endpoint += `&start=${start}`;
    if (end) endpoint += `&end=${end}`;
    if (nextToken) endpoint += `&nextToken=${nextToken}`;

    console.log('Recovery endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const recovery = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Recovery data received:', JSON.stringify(recovery, null, 2));
    res.json(recovery);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Recovery endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch recovery data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Get activities with pagination
app.get('/api/activities', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = '25', start, end, nextToken } = req.query;
    const parsedLimit = parseInt(String(limit), 10);
    const limitNum = Math.min(25, Math.max(1, isNaN(parsedLimit) ? 25 : parsedLimit));
    let endpoint = `/v2/activity/workout?limit=${limitNum}`;

    if (start) endpoint += `&start=${start}`;
    if (end) endpoint += `&end=${end}`;
    if (nextToken) endpoint += `&nextToken=${nextToken}`;

    console.log('Activities endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const activities = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Activities data received:', JSON.stringify(activities, null, 2));
    res.json(activities);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Activities endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch activities data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Get individual activity/workout details by ID
app.get('/api/activities/:id', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const endpoint = `/v2/activity/workout/${id}`;

    console.log('Individual activity endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const activity = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Individual activity data received:', JSON.stringify(activity, null, 2));
    res.json(activity);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Individual activity endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch individual activity data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Get individual recovery details by cycle ID
app.get('/api/recoveries/:cycleId', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cycleId } = req.params;
    const endpoint = `/v2/cycle/${cycleId}/recovery`

    console.log('Individual recovery endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const recovery: any = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Individual recovery data received:', JSON.stringify(recovery, null, 2));

    // The API seems to return the object directly, not in records for this endpoint.
    res.json(recovery);

  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Individual recovery endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch individual recovery data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Get sleep data
app.get('/api/sleep', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = '25', start, end, nextToken } = req.query;
    let endpoint = `/v2/activity/sleep?limit=${limit}`;

    if (start) endpoint += `&start=${start}`;
    if (end) endpoint += `&end=${end}`;
    if (nextToken) endpoint += `&nextToken=${nextToken}`;

    console.log('Sleep endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const sleep = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Sleep data received:', JSON.stringify(sleep, null, 2));
    res.json(sleep);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Sleep endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch sleep data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});

// Get individual sleep details by sleep ID
app.get('/api/sleep/:sleepId', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sleepId } = req.params;
    const endpoint = `/v2/activity/sleep/${sleepId}`; // Corrected from /v2/sleep to /v2/activity/sleep

    console.log('Individual sleep endpoint request:', endpoint);
    console.log('Full URL:', `${config.apiBaseUrl}${endpoint}`);

    const sleep = await makeWhoopApiRequest(endpoint, req.accessToken!);
    console.log('Individual sleep data received:', JSON.stringify(sleep, null, 2));
    res.json(sleep);
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Individual sleep endpoint error:', error);
    console.error('Error details:', {
      message: axiosError.message,
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data
    });

    if (axiosError.response?.status === 401) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    res.status(500).json({
      error: 'Failed to fetch individual sleep data',
      details: axiosError.response?.data || axiosError.message
    });
  }
});


// Session status endpoint
app.get('/auth/status', (req: Request, res: Response) => {
  const isAuthenticated = !!req.session.accessToken;
  const hasBackgroundRefresh = req.sessionID && activeSessions.has(req.sessionID);

  res.json({
    authenticated: isAuthenticated,
    sessionId: req.sessionID,
    backgroundRefresh: hasBackgroundRefresh,
    tokenExpiry: req.session.tokenExpiry ? new Date(req.session.tokenExpiry).toISOString() : null,
    timeUntilExpiry: req.session.tokenExpiry ? Math.max(0, req.session.tokenExpiry - Date.now()) : null
  });
});

// Debug configuration endpoint
app.get('/debug/config', (req: Request, res: Response) => {
  res.json({
    clientId: config.clientId ? 'SET' : 'NOT SET',
    clientSecret: config.clientSecret ? 'SET' : 'NOT SET',
    redirectUri: config.redirectUri,
    authorizationUrl: config.authorizationUrl,
    tokenUrl: config.tokenUrl,
    apiBaseUrl: config.apiBaseUrl,
    scopes: config.scopes,
    scopesArray: config.scopes.split(' '),
    sessionState: req.session.oauthState ? 'SET' : 'NOT SET',
    accessToken: req.session.accessToken ? 'SET' : 'NOT SET',
    refreshToken: req.session.refreshToken ? 'SET' : 'NOT SET',
    tokenExpiry: req.session.tokenExpiry ? new Date(req.session.tokenExpiry).toISOString() : 'NOT SET',
    backgroundRefresh: req.sessionID && activeSessions.has(req.sessionID)
  });
});

// Test OAuth with specific scopes
app.get('/auth/test/:scopes', (req: Request, res: Response) => {
  const testScopes = req.params.scopes.replace(/,/g, ' '); // Convert comma to space
  const state = generateState();
  req.session.oauthState = state;

  console.log('Testing OAuth with scopes:', testScopes);

  const authUrl = new URL(config.authorizationUrl!);
  authUrl.searchParams.append('client_id', config.clientId!);
  authUrl.searchParams.append('redirect_uri', config.redirectUri!);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', testScopes);
  authUrl.searchParams.append('state', state);

  console.log('Test authorization URL:', authUrl.toString());
  res.redirect(authUrl.toString());
});

// Admin: remove member
app.post('/api/admin/remove-member', async (req: Request, res: Response) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    const provided = req.headers['x-admin-secret'] || req.query.admin_secret || (req.body && (req.body as any).admin_secret);
    if (!adminSecret || String(provided) !== adminSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { whoop_user_id, member_id } = req.body || {};
    if (!whoop_user_id && !member_id) {
      return res.status(400).json({ error: 'Provide whoop_user_id or member_id' });
    }
    const db = getDb();
    if (member_id) {
      db.prepare('DELETE FROM members WHERE id = ?').run(member_id);
    } else if (whoop_user_id) {
      db.prepare('DELETE FROM members WHERE whoop_user_id = ?').run(String(whoop_user_id));
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('remove-member failed', e);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
}
app.use(errorHandler);


// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to set your WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET environment variables');
}); 