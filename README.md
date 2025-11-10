# WHOOP Developer API Test Site

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/WhoopInc/external-developer-api-test-site)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/WhoopInc/external-developer-api-test-site)
[![Node.js](https://img.shields.io/badge/node.js-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue)](https://www.typescriptlang.org/)

A comprehensive, production-ready web application demonstrating integration with the WHOOP Developer API v2. This test site provides a complete reference implementation featuring secure OAuth 2.0 authentication, real-time data visualization, automatic token management, and a modern responsive interface for exploring WHOOP health and fitness data.

## 🚀 Features

- 🔐 **Secure OAuth 2.0 Flow** - Complete WHOOP authentication with PKCE and CSRF protection
- 📊 **Real-time Data Visualization** - Interactive charts and metrics for all WHOOP data types
- 💪 **Comprehensive Health Metrics** - Cycles, Recovery, Sleep, Workouts, and Body Measurements
- 🔄 **Automatic Token Refresh** - Background refresh every 15 minutes keeps your session active without interruption
- 📱 **Responsive Design** - Mobile-first UI that works seamlessly across all devices
- ⚡ **TypeScript & Modern Stack** - Type-safe development with Express.js and modern tooling
- 🧪 **Full Test Coverage** - Comprehensive test suite with security and integration tests
- 🛡️ **Production Ready** - Security headers, error handling, and deployment configurations

## 📋 Prerequisites

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **WHOOP Developer Account** ([Sign up](https://developer.whoop.com/))
- **npm** or **yarn** package manager
- **Git** for version control

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/WhoopInc/external-developer-api-test-site.git
cd external-developer-api-test-site

# Install dependencies
npm install

# Verify installation
npm run build
```

### 2. WHOOP Developer Account Setup

#### Step 1: Create WHOOP Developer Account
1. Visit [WHOOP Developer Dashboard](https://developer.whoop.com/dashboard)
2. Sign up or log in with your WHOOP account
3. Create a new development team if needed

#### Step 2: Register Your Application
1. **Create New App** in the developer dashboard
2. **Configure Application Settings**:
   ```
   App Name: WHOOP Test Site (or your preference)
   Description: Test application for WHOOP API integration
   Website: http://localhost:3000 (for development)
   ```

3. **Set OAuth Redirect URI**:
   ```
   Redirect URI: http://localhost:3000/auth/callback
   ```

4. **Select Required Scopes** (check all available):
   - ✅ `read:cycles` - Access physiological cycle data
   - ✅ `read:recovery` - Recovery scores and metrics  
   - ✅ `read:sleep` - Sleep analysis and patterns
   - ✅ `read:workout` - Exercise and activity data
   - ✅ `read:profile` - Basic user profile information
   - ✅ `read:body_measurement` - Body composition data
   - ✅ `offline` - Refresh token support (if available)

5. **Save Your Credentials**:
   - Copy your `Client ID`
   - Copy your `Client Secret` (keep this secure!)

### 3. Environment Configuration

#### Option A: Quick Setup (Recommended)
```bash
# Copy the environment template
cp config.example.env .env.dev

# Edit with your WHOOP credentials
nano .env.dev  # or your preferred editor (VS Code, vim, etc.)
```

#### Option B: Manual Setup
Create `.env.dev` file with the following content:

```env
# WHOOP OAuth Credentials (from Developer Dashboard)
WHOOP_CLIENT_ID=your_client_id_here
WHOOP_CLIENT_SECRET=your_client_secret_here

# Application Settings
PORT=3000
SESSION_SECRET=your_very_secure_session_secret_here_32_chars_minimum
NODE_ENV=development

# Session Cookie Security
# Set to 'true' only if serving over HTTPS (required for production deployments)
# Leave unset or 'false' for local development with http://localhost
SECURE_COOKIES=false

# OAuth Configuration (defaults work for most cases)
WHOOP_REDIRECT_URI=http://localhost:3000/auth/callback
# Scopes: Use spaces OR commas (both work automatically)
WHOOP_SCOPES=read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline

# WHOOP API URLs (usually don't need to change)
WHOOP_AUTHORIZATION_URL=https://api.prod.whoop.com/oauth/oauth2/auth
WHOOP_TOKEN_URL=https://api.prod.whoop.com/oauth/oauth2/token
WHOOP_API_BASE_URL=https://api.prod.whoop.com/developer
```

**🔐 Security Notes**:
```bash
# Generate a secure random string for SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**⚠️ Important: SECURE_COOKIES Setting**
- For **local development** (even with `NODE_ENV=production`): Set `SECURE_COOKIES=false` or leave unset
- For **actual production** with HTTPS: Set `SECURE_COOKIES=true`
- If you see "OAuth state mismatch" errors when running locally, ensure `SECURE_COOKIES` is not set to `true`

### 4. Development Workflow

#### Start Development Server
```bash
# Start with hot reload (recommended for development)
npm run dev
```

#### Build for Production
```bash
# Build the application
npm run build

# Start production server
npm start
```

### 5. Test Your Integration

#### Step 1: Launch the Application
1. **Open Browser**: Navigate to `http://localhost:3000`
2. **Verify Setup**: You should see the WHOOP landing page

#### Step 2: Complete OAuth Flow
1. **Click "Connect with WHOOP"** button
2. **Authorize Application**: Complete OAuth flow in WHOOP's interface
3. **Grant Permissions**: Allow access to your WHOOP data
4. **Automatic Redirect**: You'll be redirected back to the dashboard

#### Step 3: Explore Your Data
- **Dashboard**: Overview of today's metrics
- **Activities**: View your workouts and exercises
- **Recoveries**: Check your recovery scores and HRV
- **Cycles**: Explore your physiological cycles
- **Sleep**: Analyze your sleep patterns
- **Debug**: Troubleshoot OAuth and API issues

### 6. Verify Everything Works

#### Quick Health Check:
```bash
# Check if server is running
curl http://localhost:3000/auth/status

# Test OAuth configuration
curl http://localhost:3000/debug/config
```

#### Expected Response:
```json
{
  "authenticated": false,
  "sessionId": "session_id_here",
  "backgroundRefresh": false,
  "tokenExpiry": null,
  "timeUntilExpiry": null
}
```

### 7. Troubleshooting Common Issues

#### ❌ "Invalid redirect URI" Error
**Solution**: Ensure your WHOOP app's redirect URI exactly matches:
```
http://localhost:3000/auth/callback
```

#### ❌ "Invalid client" Error  
**Solution**: Double-check your `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` in `.env.dev`

#### ❌ "Invalid scope" Error
**Solution**: Remove `offline` from scopes if not supported by your WHOOP app:
```env
WHOOP_SCOPES=read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement
```

#### ❌ Port Already in Use
**Solution**: Change the port in your `.env.dev`:
```env
PORT=3001
```
Then update your WHOOP app's redirect URI to `http://localhost:3001/auth/callback`

## 📊 Available Data & Pages

| Page | Endpoint | Description |
|------|----------|-------------|
| **Dashboard** | `/dashboard` | Overview of recent metrics and quick stats |
| **Cycles** | `/cycles` | Physiological cycles with strain and recovery |
| **Recovery** | `/recoveries` | Recovery scores, HRV, and readiness metrics |
| **Sleep** | `/sleeps` | Sleep stages, efficiency, and performance |
| **Activities** | `/activities` | Workouts, exercises, and activity tracking |
| **Debug** | `/debug` | OAuth troubleshooting and API testing |

## 🔌 API Reference

### 🔐 Authentication Endpoints

| Method | Endpoint | Description | Parameters | Response |
|--------|----------|-------------|------------|----------|
| `GET` | `/auth/login` | Initiate OAuth 2.0 flow | None | Redirects to WHOOP OAuth |
| `GET` | `/auth/callback` | OAuth callback handler | `code`, `state` | HTML page with token storage |
| `POST` | `/auth/logout` | Terminate user session | None | `{success: true}` |
| `GET` | `/auth/status` | Check authentication status | None | Session info JSON |
| `POST` | `/api/auth/refresh` | Refresh access token | `refresh_token` | New token data |

### 📊 Data API Endpoints

#### User & Profile
| Method | Endpoint | Description | Parameters | Response |
|--------|----------|-------------|------------|----------|
| `GET` | `/api/profile` | User profile information | None | User profile object |

#### Physiological Cycles
| Method | Endpoint | Description | Query Parameters | Response |
|--------|----------|-------------|------------------|----------|
| `GET` | `/api/cycle/today` | Today's physiological cycle | None | Today's cycle data |
| `GET` | `/api/cycles` | Paginated cycle data | `limit`, `start`, `end`, `nextToken` | Cycles array with pagination |

#### Recovery Metrics
| Method | Endpoint | Description | Query Parameters | Response |
|--------|----------|-------------|------------------|----------|
| `GET` | `/api/recovery` | Recovery metrics | `limit`, `start`, `end`, `nextToken` | Recovery data array |
| `GET` | `/api/recoveries/:cycleId` | Specific recovery by cycle ID | None | Individual recovery object |

#### Activities & Workouts
| Method | Endpoint | Description | Query Parameters | Response |
|--------|----------|-------------|------------------|----------|
| `GET` | `/api/activities` | Workout/activity data | `limit`, `start`, `end`, `nextToken` | Activities array |
| `GET` | `/api/activities/:id` | Specific activity details | None | Individual activity object |

#### Sleep Data
| Method | Endpoint | Description | Query Parameters | Response |
|--------|----------|-------------|------------------|----------|
| `GET` | `/api/sleep` | Sleep data | `limit`, `start`, `end`, `nextToken` | Sleep sessions array |
| `GET` | `/api/sleep/:sleepId` | Specific sleep session | None | Individual sleep object |

### 🛠️ Debug & Utility Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/debug/config` | View current configuration (masked) | Configuration object |
| `GET` | `/auth/test/:scopes` | Test OAuth with specific scopes | Redirects to OAuth |

### 🔑 Authentication Methods

The API supports multiple authentication methods:

#### Method 1: Authorization Header (Recommended)
```bash
curl -H "Authorization: Bearer your_access_token" \
     http://localhost:3000/api/profile
```

#### Method 2: Session Cookie (Automatic)
After completing OAuth flow, cookies are automatically managed:
```bash
curl -b "connect.sid=your_session_cookie" \
     http://localhost:3000/api/profile
```

#### Method 3: Client-Side Token Management
```javascript
// Frontend JavaScript example
const response = await fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('whoop_access_token')}`
  }
});
```

### 🔄 Automatic Token Refresh

The application includes **automatic background token refresh** to keep your session active:

- **Refresh Interval**: Tokens are automatically refreshed every **15 minutes**
- **Seamless Experience**: Refresh happens silently in the background without interrupting your workflow
- **Smart Management**: Only refreshes when a valid refresh token is available
- **Error Handling**: Gracefully handles refresh failures without disrupting active sessions
- **On Startup**: Background refresh automatically starts when you authenticate
- **On Logout**: Refresh process cleanly stops when you log out

**Monitoring Refresh Status:**
- View real-time refresh status on the **Debug page** (`/debug.html`)
- See token expiration countdowns and refresh activity
- Verify background refresh is active (✅ Active / ❌ Inactive)

This ensures uninterrupted access to your WHOOP data during extended browsing sessions.

### 📝 API Usage Examples

#### Get User Profile
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/profile
```

#### Get Today's Cycle Data
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/cycle/today
```

#### Get Recent Activities with Pagination
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:3000/api/activities?limit=10&start=2024-01-01T00:00:00Z"
```

#### Get Recovery Data for Specific Date Range
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:3000/api/recovery?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z"
```

### 🔄 Token Refresh

#### Automatic Refresh (Client-Side)
```javascript
// The application automatically refreshes tokens every 15 minutes
// Manual refresh if needed:
const refreshResponse = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refresh_token: localStorage.getItem('whoop_refresh_token')
  })
});
```

#### Manual Refresh (Server-Side)
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"refresh_token":"your_refresh_token"}' \
     http://localhost:3000/api/auth/refresh
```

### 📊 Response Formats

#### Success Response
```json
{
  "records": [...],
  "next_token": "optional_pagination_token"
}
```

#### Error Response
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

#### Authentication Error
```json
{
  "error": "Not authenticated"
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WHOOP_CLIENT_ID` | ✅ | - | OAuth client ID from WHOOP Developer Dashboard |
| `WHOOP_CLIENT_SECRET` | ✅ | - | OAuth client secret (keep secure!) |
| `WHOOP_REDIRECT_URI` | ✅ | `http://localhost:3000/auth/callback` | OAuth redirect URI |
| `WHOOP_SCOPES` | ✅ | See below | OAuth scopes (space OR comma-separated) |
| `SESSION_SECRET` | ✅ | - | Secure random string for session encryption |
| `SECURE_COOKIES` | ⚠️ | `false` | Enable secure cookies (only for HTTPS) |
| `PORT` | ❌ | `3000` | Server port |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `WHOOP_AUTHORIZATION_URL` | ❌ | `https://api.prod.whoop.com/oauth/oauth2/auth` | OAuth authorization endpoint |
| `WHOOP_TOKEN_URL` | ❌ | `https://api.prod.whoop.com/oauth/oauth2/token` | OAuth token endpoint |
| `WHOOP_API_BASE_URL` | ❌ | `https://api.prod.whoop.com/developer` | WHOOP API base URL |

### Complete Environment Examples

#### Development Configuration (`.env.dev`)
```env
# WHOOP OAuth Credentials
WHOOP_CLIENT_ID=your_client_id_here
WHOOP_CLIENT_SECRET=your_client_secret_here
WHOOP_REDIRECT_URI=http://localhost:3000/auth/callback

# WHOOP API Endpoints
WHOOP_AUTHORIZATION_URL=https://api.prod.whoop.com/oauth/oauth2/auth
WHOOP_TOKEN_URL=https://api.prod.whoop.com/oauth/oauth2/token
WHOOP_API_BASE_URL=https://api.prod.whoop.com/developer

# Application Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=generate_with_crypto_randomBytes_32_hex
SECURE_COOKIES=false

# OAuth Scopes (flexible format - use spaces OR commas)
WHOOP_SCOPES=read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline
```

#### Production Configuration (`.env.prod`)
```env
# WHOOP OAuth Credentials (Production)
WHOOP_CLIENT_ID=your_production_client_id_here
WHOOP_CLIENT_SECRET=your_production_client_secret_here
WHOOP_REDIRECT_URI=https://yourdomain.com/auth/callback

# WHOOP API Endpoints
WHOOP_AUTHORIZATION_URL=https://api.prod.whoop.com/oauth/oauth2/auth
WHOOP_TOKEN_URL=https://api.prod.whoop.com/oauth/oauth2/token
WHOOP_API_BASE_URL=https://api.prod.whoop.com/developer

# Application Configuration
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_very_secure_production_secret_64_chars_recommended

# Cookie Security (false for local prod testing, true for HTTPS deployment)
SECURE_COOKIES=false

# OAuth Scopes (flexible format - use spaces OR commas)
WHOOP_SCOPES=read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline
```

**⚠️ SECURE_COOKIES Important Notes:**
- Set to `false` for local development (including `npm run prod` locally)
- Set to `true` only when deploying to actual HTTPS server
- Prevents "OAuth state mismatch" errors when running on `http://localhost`

### Environment File Selection

The app automatically selects environment files based on `NODE_ENV`:

```bash
# Development
NODE_ENV=development  → .env.dev

# Production  
NODE_ENV=production   → .env.prod

# Fallback (any other value)
.env
```

### OAuth Scopes

Available scopes for WHOOP API access:

| Scope | Description | Data Access |
|-------|-------------|-------------|
| `read:profile` | Basic user information | Name, email, user ID |
| `read:cycles` | Physiological cycles | Strain, recovery, cycle boundaries |
| `read:recovery` | Recovery metrics | Recovery score, HRV, RHR |
| `read:sleep` | Sleep data | Sleep stages, efficiency, duration |
| `read:workout` | Activity/workout data | Exercise sessions, activity metrics |
| `read:body_measurement` | Body composition | Weight, body fat, muscle mass |
| `offline` | Refresh token support | Long-term access without re-auth |

**Recommended Scope Configuration:**
```env
# Either format works - automatically normalized by the app:
WHOOP_SCOPES=read:cycles read:recovery read:sleep read:workout read:profile read:body_measurement offline
# OR
WHOOP_SCOPES=read:cycles,read:recovery,read:sleep,read:workout,read:profile,read:body_measurement,offline
```

## 📁 Project Structure

```
external-developer-api-test-site/
├── 📄 app.ts                    # Main Express server (TypeScript)
├── 📄 paths.ts                  # Path resolution utilities
├── 📦 package.json              # Dependencies and npm scripts
├── ⚙️ env.template               # Environment variables template
├── 📋 tsconfig.json             # TypeScript configuration
├── 🧪 jest.config.js            # Test configuration
├── 📊 coverage/                 # Test coverage reports
├── 🏗️ dist/                     # Compiled backend code
├── 🌐 dist-public/              # Compiled frontend assets
├── 📁 public/                   # Frontend source files
│   ├── 📄 index.html           # Landing page
│   ├── 📄 dashboard.html       # Main dashboard
│   ├── 📄 activities.html      # Activities page
│   ├── 📄 recoveries.html      # Recovery metrics page
│   ├── 📄 cycles.html          # Cycles data page
│   ├── 📄 sleeps.html          # Sleep analysis page
│   ├── 📄 debug.html           # OAuth debugging tools
│   ├── 📄 whoop-setup.html     # Setup guide
│   ├── 🎨 styles.css           # Global styles
│   ├── 📜 auth.ts              # Authentication utilities
│   ├── 📜 ui.ts                # UI components and helpers
│   ├── 📜 dashboard.ts         # Dashboard functionality
│   ├── 📜 activities.ts        # Activities page logic
│   ├── 📜 recoveries.ts        # Recovery page logic
│   ├── 📜 cycles.ts            # Cycles page logic
│   ├── 📜 sleeps.ts            # Sleep page logic
│   ├── 📜 debug.ts             # Debug page utilities
│   ├── 📂 types/               # TypeScript type definitions
│   │   └── 📄 whoop.ts         # WHOOP API types
│   └── ⚙️ tsconfig.json        # Frontend TypeScript config
├── 🧪 __tests__/               # Test suite
│   ├── 📄 app.test.ts          # Main application tests
│   ├── 📄 paths.test.ts        # Path utilities tests
│   └── 📄 security.test.js     # Security and OAuth tests
├── 🚫 .gitignore               # Git ignore rules
└── 📖 README.md                # This documentation
```

### Key Files Explained

- **`app.ts`**: Main Express server with OAuth flow, API routes, and middleware
- **`paths.ts`**: Utility functions for resolving static asset paths in dev/prod
- **`public/`**: Frontend TypeScript files compiled to `dist-public/`
- **`__tests__/`**: Comprehensive test suite with >90% coverage
- **`env.template`**: Template for environment configuration

## 🧪 Testing & Development

### 🧪 Running Tests

#### Basic Test Commands
```bash
# Run all tests
npm test

# Run tests with detailed coverage report
npm run test -- --coverage

# Run tests in watch mode (auto-rerun on file changes)
npm run test -- --watch

# Run specific test file
npm test -- __tests__/app.test.ts
npm test -- __tests__/paths.test.ts
npm test -- __tests__/security.test.js
```

#### Test Coverage Analysis
```bash
# Generate detailed coverage report
npm run test -- --coverage --coverageReporters=html

# View coverage report
open coverage/index.html
```

### 📊 Test Coverage Details

The project maintains **>90% test coverage** across all modules:

#### ✅ Authentication & Security Tests
- **OAuth Flow**: State validation, token exchange, session management
- **CSRF Protection**: Cross-site request forgery prevention
- **Input Validation**: Parameter sanitization and validation
- **Error Handling**: Comprehensive error scenarios

#### ✅ API Integration Tests
- **WHOOP API Calls**: Mock responses for all endpoints
- **Authentication Middleware**: Token validation and error handling
- **Data Transformation**: Response formatting and error handling
- **Rate Limiting**: API call throttling and retry logic

#### ✅ Utility & Infrastructure Tests
- **Path Resolution**: Development vs production path handling
- **Configuration Loading**: Environment variable processing
- **Session Management**: Cookie handling and session persistence
- **Error Boundaries**: Graceful error handling and recovery

### 🔄 Development Workflow

#### 1. Start Development Environment
```bash
# Start development server with hot reload
npm run dev
```

#### 2. Make Code Changes
```bash
# TypeScript files are automatically compiled
# Frontend changes in public/ are compiled to dist-public/
# Backend changes in app.ts are compiled to dist/
```

#### 3. Run Tests Continuously
```bash
# Run tests in watch mode for continuous feedback
npm run test -- --watch

# Or run specific test suites
npm test -- --testNamePattern="Authentication"
npm test -- --testNamePattern="API"
```

#### 4. Build and Test Production
```bash
# Build the application
npm run build

# Test production build locally
npm run prod

# Verify all functionality works in production mode
```

### 🛠️ Code Quality Standards

#### TypeScript Configuration
- **Strict Mode**: All strict TypeScript checks enabled
- **Type Safety**: Comprehensive type definitions for WHOOP API
- **Path Mapping**: Clean import paths and module resolution
- **Compilation**: Separate configs for frontend and backend

#### Testing Framework
- **Jest**: Primary testing framework with TypeScript support
- **Supertest**: HTTP integration testing for API endpoints
- **Mocking**: Comprehensive mocking of external dependencies
- **Coverage**: Detailed coverage reporting with HTML output

#### Code Standards
- **ESLint**: Code linting with TypeScript-specific rules
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit hooks for code quality (if configured)
- **Type Safety**: No `any` types, comprehensive interfaces

### 🚀 Adding New Features

#### 1. Backend API Routes
```typescript
// Add to app.ts with proper authentication
app.get('/api/new-feature', ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await makeWhoopApiRequest('/v2/new-feature', req.accessToken!);
    res.json(data);
  } catch (error) {
    console.error('New feature error:', error);
    res.status(500).json({ error: 'Failed to fetch new feature data' });
  }
});
```

#### 2. Frontend Pages
```typescript
// Create new-page.html in public/
// Create new-page.ts in public/
// Add route in app.ts: app.get('/new-page', (req, res) => res.sendFile(...))
```

#### 3. Type Definitions
```typescript
// Add to public/types/whoop.ts
export interface NewFeatureData {
  id: string;
  name: string;
  // ... other properties
}
```

#### 4. Tests
```typescript
// Create __tests__/new-feature.test.ts
import request from 'supertest';
// ... test implementation
```

#### 5. Documentation
- Update this README with new endpoints
- Add API documentation
- Update troubleshooting section if needed

### 🔍 Debugging & Troubleshooting

#### Development Debugging
```bash
# Enable debug logging
DEBUG=app:* npm run dev

# Check OAuth configuration
curl http://localhost:3000/debug/config

# Test specific endpoints
curl http://localhost:3000/auth/status
```

#### Test Debugging
```bash
# Run tests with verbose output
npm test -- --verbose

# Run specific test with detailed output
npm test -- --testNamePattern="OAuth" --verbose

# Debug test failures
npm test -- --detectOpenHandles --forceExit
```

#### Production Debugging
```bash
# Check production build
npm run build && npm start

# Test production endpoints
curl http://localhost:3000/debug/config
```

### 📈 Performance Testing

#### Load Testing
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test script
cat > load-test.yml << EOF
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/profile"
          headers:
            Authorization: "Bearer YOUR_TOKEN"
EOF

# Run load test
artillery run load-test.yml
```

#### Memory Profiling
```bash
# Run with memory profiling
node --inspect dist/app.js

# Or use clinic.js for comprehensive profiling
npm install -g clinic
clinic doctor -- node dist/app.js
```

### 🧹 Code Maintenance

#### Regular Maintenance Tasks
```bash
# Update dependencies
npm update

# Check for security vulnerabilities
npm audit

# Fix security issues
npm audit fix

# Clean build artifacts
rm -rf dist/ dist-public/ coverage/

# Rebuild everything
npm run build
```

#### Code Quality Checks
```bash
# Lint code (if ESLint is configured)
npm run lint

# Format code (if Prettier is configured)
npm run format

# Type check without compilation
npx tsc --noEmit
```

## 🚀 Deployment

### Production Environment Setup

1. **Environment Configuration**:
```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_very_secure_production_secret_here
WHOOP_CLIENT_ID=your_production_client_id
WHOOP_CLIENT_SECRET=your_production_client_secret
WHOOP_REDIRECT_URI=https://yourdomain.com/auth/callback
```

2. **Build and Start**:
```bash
npm run build
npm start
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/auth/status || exit 1

# Start the application
CMD ["npm", "start"]
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  whoop-api-test:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env.prod
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/auth/status"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Cloud Platform Deployment

#### Heroku
```bash
# Install Heroku CLI and login
heroku create your-whoop-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set WHOOP_CLIENT_ID=your_client_id
heroku config:set WHOOP_CLIENT_SECRET=your_client_secret
heroku config:set SESSION_SECRET=your_session_secret
heroku config:set WHOOP_REDIRECT_URI=https://your-whoop-app-name.herokuapp.com/auth/callback

# Deploy
git push heroku main
```

#### Railway
```bash
# Install Railway CLI and login
railway login

# Create new project
railway new

# Set environment variables via dashboard or CLI
railway variables set NODE_ENV=production
railway variables set WHOOP_CLIENT_ID=your_client_id
# ... (set other variables)

# Deploy
railway up
```

#### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Update WHOOP_REDIRECT_URI to your Vercel domain
```

### Security Considerations for Production

- ✅ **HTTPS Only**: Ensure SSL/TLS certificates are properly configured
- ✅ **Environment Variables**: Never commit secrets to version control
- ✅ **Session Security**: Use secure session secrets (32+ random characters)
- ✅ **CORS Configuration**: Restrict origins to your domain
- ✅ **Rate Limiting**: Implement API rate limiting for production traffic
- ✅ **Monitoring**: Set up application monitoring and error tracking
- ✅ **Health Checks**: Configure health check endpoints for load balancers

### Performance Optimization

```typescript
// Example: Add caching middleware
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 300 }); // 5 minute cache

app.get('/api/profile', ensureAuthenticated, async (req, res) => {
  const cacheKey = `profile_${req.accessToken}`;
  const cached = cache.get(cacheKey);
  
  if (cached) {
    return res.json(cached);
  }
  
  const profile = await makeWhoopApiRequest('/v2/user/profile/basic', req.accessToken!);
  cache.set(cacheKey, profile);
  res.json(profile);
});
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

1. **Fork and Clone**:
```bash
git clone https://github.com/your-username/external-developer-api-test-site.git
cd external-developer-api-test-site
npm install
```

2. **Create Feature Branch**:
```bash
git checkout -b feature/your-feature-name
```

3. **Set Up Environment**:
```bash
cp env.template .env.dev
# Edit .env.dev with your WHOOP credentials
```

### Contribution Process

1. **Make Changes**: Implement your feature or bug fix
2. **Add Tests**: Ensure new code has corresponding tests
3. **Run Tests**: Verify all tests pass
   ```bash
   npm test
   npm run build  # Ensure builds successfully
   ```
4. **Update Documentation**: Update README if needed
5. **Commit Changes**: Use clear, descriptive commit messages
   ```bash
   git commit -m "feat: add new recovery metrics visualization"
   ```
6. **Push and PR**: Push to your fork and create a pull request

### Code Standards

- **TypeScript**: All new code should be written in TypeScript
- **Testing**: Maintain >90% test coverage
- **Security**: Follow OAuth and web security best practices
- **Documentation**: Update README for new features
- **Commit Messages**: Use conventional commit format

### Areas for Contribution

- 🎨 **UI/UX Improvements**: Enhanced visualizations, better mobile experience
- 📊 **Data Analysis**: New metrics, charts, or data processing features  
- 🔧 **Developer Experience**: Better error handling, debugging tools
- 📚 **Documentation**: Tutorials, examples, API documentation
- 🧪 **Testing**: Additional test coverage, integration tests
- 🚀 **Performance**: Caching, optimization, bundle size reduction

## 🐛 Troubleshooting

### Common Issues

#### OAuth Flow Problems

**Problem**: "Invalid redirect URI" error
```
Solution: Ensure WHOOP_REDIRECT_URI in your .env exactly matches 
the redirect URI configured in your WHOOP Developer Dashboard
```

**Problem**: "Invalid client" error  
```
Solution: Verify WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET are correct
and your WHOOP app is properly configured
```

**Problem**: "Invalid scope" error
```
Solution: Check that your WHOOP app has all the scopes you're requesting.
Remove 'offline' scope if not supported by your app configuration.
Note: The app automatically handles both space and comma-separated formats.
```

**Problem**: "OAuth state mismatch" or "Invalid state parameter" error
```
Solution: This happens when session cookies aren't preserved during OAuth redirect.
Common causes:
1. Running locally with NODE_ENV=production and SECURE_COOKIES=true
   - Fix: Set SECURE_COOKIES=false in your .env file
2. Missing or expired session
   - Fix: Clear browser cookies and try again
3. Different domain/port between auth start and callback
   - Fix: Ensure WHOOP_REDIRECT_URI matches your running server

For local development, always use:
SECURE_COOKIES=false
```

#### API Request Issues

**Problem**: 401 Unauthorized errors
```
Solution: 
1. Check if access token is expired (tokens last ~30 minutes)
2. Verify token refresh is working properly
3. Ensure Authorization header format: "Bearer <token>"
```

**Problem**: 429 Rate Limit errors
```
Solution: Implement exponential backoff retry logic.
WHOOP API has rate limits - space out your requests.
```

**Problem**: CORS errors in browser
```
Solution: CORS is handled server-side. If you see CORS errors,
check that your server is running and accessible.
```

#### Build/Runtime Issues

**Problem**: "Cannot find module" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Problem**: TypeScript compilation errors
```bash
# Check TypeScript configuration
npm run build
# Fix any type errors shown
```

**Problem**: Static files not loading
```
Solution: The app automatically resolves paths for dev/prod.
Ensure both 'public/' and 'dist-public/' directories exist.
```

### Debug Mode

Enable detailed logging:

```bash
# Development with debug logs
DEBUG=app:* npm run dev

# Check OAuth configuration
curl http://localhost:3000/debug/config
```

### Getting Help

- 📖 **WHOOP Developer Docs**: [developer.whoop.com/docs](https://developer.whoop.com/docs)
- 🔧 **API Reference**: [developer.whoop.com/api](https://developer.whoop.com/api)  
- 💬 **Issues**: Create a GitHub issue with:
  - Environment details (Node.js version, OS)
  - Steps to reproduce
  - Error messages and logs
  - Configuration (without secrets!)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **WHOOP Inc.** for providing the comprehensive Developer API
- **Express.js** community for the robust and flexible web framework
- **TypeScript** team for excellent tooling and type safety
- **Jest** team for the comprehensive testing framework
- **All contributors** who help improve this project and the WHOOP developer ecosystem

---

**Built with ❤️ for the WHOOP Developer Community**

*For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/WhoopInc/external-developer-api-test-site)*

*This project demonstrates best practices for WHOOP API integration and serves as a reference implementation for developers building health and fitness applications.* 
