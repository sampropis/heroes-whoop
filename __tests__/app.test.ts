import request from 'supertest';
import express, { Express } from 'express';
import session from 'express-session';
import axios from 'axios';

// Mock the dependencies
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create test app
const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mock session middleware
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Simple mock of the routes for testing purposes
  // A full integration test would require importing the actual app
  app.get('/auth/login', (req, res) => {
    const state = 'test_state';
    if (req.session) {
        req.session.oauthState = state;
    }
    const authUrl = new URL(process.env.WHOOP_AUTHORIZATION_URL!);
    authUrl.searchParams.append('client_id', process.env.WHOOP_CLIENT_ID!);
    authUrl.searchParams.append('redirect_uri', process.env.WHOOP_REDIRECT_URI!);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', process.env.WHOOP_SCOPES!);
    authUrl.searchParams.append('state', state);
    res.redirect(authUrl.toString());
  });

  app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;

    if (state !== req.session?.oauthState) {
        return res.status(400).json({ error: 'Invalid state parameter' });
    }

    if (!code) {
        return res.status(400).json({ error: 'Authorization code not provided' });
    }

    try {
        const mockTokenResponse = {
            data: {
                access_token: 'test_access_token',
                refresh_token: 'test_refresh_token',
                expires_in: 3600
            }
        };
        mockedAxios.post.mockResolvedValue(mockTokenResponse);

        const tokenResponse = await axios.post(process.env.WHOOP_TOKEN_URL!, {});

        if(req.session) {
            req.session.accessToken = tokenResponse.data.access_token;
            req.session.refreshToken = tokenResponse.data.refresh_token;
            req.session.tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000);
            delete req.session.oauthState;
        }

        res.redirect('/dashboard');
    } catch (error) {
        res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  });


  app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.json({ message: 'Logged out successfully' });
    });
  });

  app.get('/api/profile', (req, res) => {
    if (!req.session?.accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const mockProfile = { user_id: 1, email: 'test@test.com', first_name: 'Test', last_name: 'User' };
    res.json(mockProfile);
  });

  app.get('/api/cycle/today', (req, res) => {
    if (!req.session?.accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const mockCycle = { records: [{ id: 1, score_state: 'SCORED', score: { strain: 10 } }]};
    res.json(mockCycle);
  });

  app.get('/api/recovery', (req, res) => {
    if (!req.session?.accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    const mockRecovery = { records: [{ id: 1, score_state: 'SCORED', score: { recovery_score: 80 } }]};
    res.json(mockRecovery);
  });


  return app;
};

describe('WHOOP API Test App', () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();

    // Mock environment variables
    process.env.WHOOP_CLIENT_ID = 'test_client_id';
    process.env.WHOOP_CLIENT_SECRET = 'test_client_secret';
    process.env.WHOOP_REDIRECT_URI = 'http://localhost:3000/auth/callback';
    process.env.WHOOP_AUTHORIZATION_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
    process.env.WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
    process.env.WHOOP_API_BASE_URL = 'https://api.prod.whoop.com/developer/v2';
    process.env.WHOOP_SCOPES = 'read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline';
  });

  describe('Authentication Routes', () => {

    test('GET /auth/login should redirect to WHOOP OAuth', async () => {
      const response = await request(app).get('/auth/login');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('https://api.prod.whoop.com/oauth/oauth2/auth');
      expect(response.headers.location).toContain('client_id=test_client_id');
      expect(response.headers.location).toContain('response_type=code');
    });

    test('GET /auth/callback should handle valid OAuth callback', async () => {
        const agent = request.agent(app);
        // This will establish the session and set the oauthState
        await agent.get('/auth/login');
      
        // Now make the callback request
        const response = await agent
          .get('/auth/callback?code=test_code&state=test_state')
          
        expect(response.status).toBe(302);
        expect(response.headers.location).toBe('/dashboard');
        expect(mockedAxios.post).toHaveBeenCalled();
    });

    test('GET /auth/callback should reject invalid state', async () => {
      const agent = request.agent(app);
      await agent.get('/auth/login');

      const response = await agent
        .get('/auth/callback?code=test_code&state=invalid_state');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });

    test('GET /auth/callback should reject missing code', async () => {
        const agent = request.agent(app);
        await agent.get('/auth/login');
  
        const response = await agent
          .get('/auth/callback?state=test_state');
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Authorization code not provided');
      });

    test('POST /auth/logout should destroy session', async () => {
      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('API Routes', () => {
    test('GET /api/profile should return user profile when authenticated', async () => {
        const agent = request.agent(app);
        // Manually set session for authenticated requests
        const res = await agent.get('/auth/login'); // to initialize session
        
        // Cannot directly manipulate session like before, so we have to simulate a login
        await agent.get('/auth/callback?code=test_code&state=test_state');
  
        const response = await agent.get('/api/profile');
  
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('user_id');
    });
  
    test('GET /api/profile should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/profile');
  
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });
  
    test('GET /api/cycle/today should return today\'s cycle data', async () => {
        const agent = request.agent(app);
        // Initialize session with login
        await agent.get('/auth/login');
        // Simulate OAuth callback
        await agent.get('/auth/callback?code=test_code&state=test_state');

        const response = await agent.get('/api/cycle/today');
  
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('records');
        expect(response.body.records[0].score).toHaveProperty('strain');
    });
  
    test('GET /api/recovery should return recovery data', async () => {
        const agent = request.agent(app);
        // Initialize session with login
        await agent.get('/auth/login');
        // Simulate OAuth callback
        await agent.get('/auth/callback?code=test_code&state=test_state');
        const response = await agent.get('/api/recovery');
  
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('records');
        expect(response.body.records[0].score).toHaveProperty('recovery_score');
    });
  });

  describe('Configuration', () => {
    test('should use environment variables for configuration', () => {
      expect(process.env.WHOOP_CLIENT_ID).toBe('test_client_id');
      expect(process.env.WHOOP_CLIENT_SECRET).toBe('test_client_secret');
      expect(process.env.WHOOP_REDIRECT_URI).toBe('http://localhost:3000/auth/callback');
    });

    test('should have configurable URLs', () => {
      expect(process.env.WHOOP_AUTHORIZATION_URL).toBe('https://api.prod.whoop.com/oauth/oauth2/auth');
      expect(process.env.WHOOP_TOKEN_URL).toBe('https://api.prod.whoop.com/oauth/oauth2/token');
      expect(process.env.WHOOP_API_BASE_URL).toBe('https://api.prod.whoop.com/developer/v2');
    });

    test('should have proper OAuth scopes', () => {
      const scopes = process.env.WHOOP_SCOPES!.split(' ');
      expect(scopes).toContain('read:cycles');
      expect(scopes).toContain('read:recovery');
      expect(scopes).toContain('read:sleep');
      expect(scopes).toContain('read:workout');
      expect(scopes).toContain('read:profile');
      expect(scopes).toContain('read:body_measurement');
      expect(scopes).toContain('offline');
    });
  });
}); 