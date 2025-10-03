const request = require('supertest');
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

describe('Security Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false }
    }));

    // Mock OAuth state generation
    app.get('/auth/login', (req, res) => {
      const state = crypto.randomBytes(32).toString('hex');
      req.session.oauthState = state;
      res.json({ state });
    });

    app.get('/auth/callback', (req, res) => {
      const { state } = req.query;
      
      if (state !== req.session.oauthState) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }
      
      res.json({ message: 'Valid state' });
    });

    // Mock authenticated route
    app.get('/api/protected', (req, res) => {
      if (!req.session.accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      res.json({ message: 'Authenticated' });
    });
  });

  describe('OAuth State Parameter', () => {
    test('should generate unique state parameter', async () => {
      const response1 = await request(app).get('/auth/login');
      const response2 = await request(app).get('/auth/login');
      
      expect(response1.body.state).toBeDefined();
      expect(response2.body.state).toBeDefined();
      expect(response1.body.state).not.toBe(response2.body.state);
    });

    test('should validate state parameter on callback', async () => {
      const agent = request.agent(app);
      
      // Get state from login
      const loginResponse = await agent.get('/auth/login');
      const state = loginResponse.body.state;
      
      // Valid state should succeed
      const validResponse = await agent.get('/auth/callback').query({ state });
      expect(validResponse.status).toBe(200);
      
      // Invalid state should fail
      const invalidResponse = await agent.get('/auth/callback').query({ state: 'invalid' });
      expect(invalidResponse.status).toBe(400);
      expect(invalidResponse.body.error).toBe('Invalid state parameter');
    });

    test('should generate state with sufficient entropy', async () => {
      const response = await request(app).get('/auth/login');
      const state = response.body.state;
      
      // State should be at least 32 characters (16 bytes hex)
      expect(state.length).toBeGreaterThanOrEqual(32);
      
      // State should be hexadecimal
      expect(state).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Session Security', () => {
    test('should protect API routes without authentication', async () => {
      const response = await request(app).get('/api/protected');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Not authenticated');
    });

    test('should maintain session state across requests', async () => {
      const agent = request.agent(app);
      
      // First request - set up session
      await agent.get('/auth/login');
      
      // Second request - session should persist
      const response = await agent.get('/auth/login');
      expect(response.body.state).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should handle missing query parameters', async () => {
      const response = await request(app).get('/auth/callback');
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });

    test('should handle empty state parameter', async () => {
      const response = await request(app).get('/auth/callback').query({ state: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });

    test('should handle null state parameter', async () => {
      const response = await request(app).get('/auth/callback').query({ state: null });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });
  });

  describe('CSRF Protection', () => {
    test('should prevent CSRF attacks via state parameter', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);
      
      // Agent 1 starts OAuth flow
      const loginResponse1 = await agent1.get('/auth/login');
      const state1 = loginResponse1.body.state;
      
      // Agent 2 starts OAuth flow
      const loginResponse2 = await agent2.get('/auth/login');
      const state2 = loginResponse2.body.state;
      
      // Agent 1 tries to use Agent 2's state - should fail
      const response = await agent1.get('/auth/callback').query({ state: state2 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });
  });

  describe('Error Handling', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app).get('/auth/callback').query({ state: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');
    });

    test('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/auth/callback')
        .query({ state: 'a'.repeat(10000) }); // Very long state
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid state parameter');
    });
  });
}); 