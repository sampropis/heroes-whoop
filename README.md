# WHOOP Developer API Test Site

A web application that demonstrates integration with the WHOOP Developer API, featuring OAuth authentication and comprehensive data visualization.

## Features

- 🔐 **OAuth 2.0 Authentication** - Secure login with WHOOP accounts
- 📊 **Cycle Data Visualization** - Today's physiological cycle data
- 💪 **Recovery Metrics** - Latest recovery scores and health metrics
- 😴 **Sleep Analysis** - Sleep patterns and performance data
- 🏃 **Workout Tracking** - Exercise and activity monitoring
- 📱 **Responsive Design** - Modern UI that works on all devices
- ⚙️ **Configurable URLs** - Easy API endpoint configuration

## Prerequisites

- Node.js 18.0.0 or higher
- WHOOP Developer Account and App
- npm or yarn package manager

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd external-developer-api-test-site
```

### 2. Install Dependencies

```bash
npm install
```

### 3. WHOOP Developer Setup

1. Visit the [WHOOP Developer Dashboard](https://developer.whoop.com/dashboard)
2. Create a new Team if you don't have one
3. Create a new App with these settings:
   - **Scopes**: `read:cycles`, `read:recovery`, `read:sleep`, `read:workout`, `read:profile`, `read:body_measurement`, `offline`
   - **Redirect URI**: `http://localhost:3000/auth/callback`
4. Note down your `Client ID` and `Client Secret`

### 4. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp config.example.env .env
   ```

2. Edit `.env` with your WHOOP App credentials:
   ```env
   WHOOP_CLIENT_ID=your_client_id_here
   WHOOP_CLIENT_SECRET=your_client_secret_here
   WHOOP_REDIRECT_URI=http://localhost:3000/auth/callback
   SESSION_SECRET=your_secure_session_secret
   ```

### 5. Run the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Visit `http://localhost:3000` in your browser.

## API Endpoints

### Authentication
- `GET /auth/login` - Start OAuth flow
- `GET /auth/callback` - OAuth callback handler
- `POST /auth/logout` - End user session

### Data API
- `GET /api/profile` - User profile information
- `GET /api/cycle/today` - Today's cycle data
- `GET /api/cycles` - Recent cycles (paginated)
- `GET /api/recovery` - Recovery data (paginated)

## Configuration

All URLs are configurable via environment variables:

```env
# API Base URLs
WHOOP_AUTHORIZATION_URL=https://api.prod.whoop.com/oauth/oauth2/auth
WHOOP_TOKEN_URL=https://api.prod.whoop.com/oauth/oauth2/token
WHOOP_API_BASE_URL=https://api.prod.whoop.com/developer/v2

# Application Settings
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_session_secret

# OAuth Configuration
WHOOP_SCOPES=read:cycles,read:recovery,read:sleep,read:workout,read:profile,read:body_measurement,offline
```

## Project Structure

```
external-developer-api-test-site/
├── app.js                 # Main Express application
├── package.json          # Dependencies and scripts
├── config.example.env    # Environment variables example
├── public/               # Static frontend files
│   ├── index.html       # Landing page
│   ├── dashboard.html   # Dashboard page
│   ├── styles.css       # CSS styles
│   └── dashboard.js     # Frontend JavaScript
├── __tests__/           # Test files
└── README.md            # This file
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## WHOOP API Integration

This application integrates with the WHOOP Developer API v2:

- **Authentication**: OAuth 2.0 with PKCE
- **Data Access**: Cycles, Recovery, Sleep, Workouts, Profile
- **Rate Limiting**: Implemented with proper error handling
- **Security**: CSRF protection, secure session management

## Development

### Adding New Features

1. Create new API endpoints in `app.js`
2. Add frontend functionality in `dashboard.js`
3. Update styles in `styles.css`
4. Add tests in `__tests__/`

### Security Considerations

- Never expose your `WHOOP_CLIENT_SECRET` in client-side code
- Use HTTPS in production
- Implement proper session management
- Validate all API responses

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_very_secure_session_secret
WHOOP_CLIENT_ID=your_production_client_id
WHOOP_CLIENT_SECRET=your_production_client_secret
WHOOP_REDIRECT_URI=https://yourdomain.com/auth/callback
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- [WHOOP Developer Documentation](https://developer.whoop.com/docs)
- [WHOOP API Reference](https://developer.whoop.com/api)
- [WHOOP Developer Dashboard](https://developer.whoop.com/dashboard)

## Troubleshooting

### Common Issues

1. **OAuth Callback Error**: Ensure redirect URI matches exactly in WHOOP Dashboard
2. **API Rate Limiting**: Implement proper retry logic and respect rate limits
3. **Token Expiry**: Application handles token refresh automatically
4. **CORS Issues**: Ensure proper CORS configuration for your domain

### Debug Mode

Enable debug logging:

```bash
DEBUG=app:* npm run dev
``` 
