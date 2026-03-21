# 🔐 OncoAssistant Security Setup Guide

## Overview

The application now includes enterprise-level security features:

✅ **JWT Authentication** - Session tokens instead of stored passwords
✅ **API Key Protection** - Keys stored only on server, never exposed to client
✅ **Rate Limiting** - Protection against brute-force and DDoS attacks
✅ **CORS Protection** - Only whitelisted origins allowed
✅ **Helmet Security Headers** - XSS, Clickjacking, and other header-based attack protection
✅ **Audit Logging** - All API calls logged for compliance
✅ **Input Sanitization** - Protection against SQL injection and XSS
✅ **Data Encryption Ready** - Infrastructure for encrypting patient data

---

## 🚀 Getting Started

### Step 1: Install Dependencies

```bash
npm install
```

This installs the new security packages:
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing
- `express-rate-limit` - Rate limiting
- `cors` - CORS protection
- `helmet` - Security headers

### Step 2: Configure Environment Variables

The `.env` file has been updated with new security settings:

```bash
# SECURITY - Change these to strong values!
APP_PASSWORD="SecurePass123"
JWT_SECRET="your_super_secret_jwt_key_change_this_12345678"

# AI Provider Keys (never share these!)
GEMINI_API_KEY="your-real-gemini-key"
OPENAI_API_KEY="your-real-openai-key"

# Database encryption will be generated automatically on first run
DATABASE_ENCRYPTION_KEY=""
```

**IMPORTANT**: Before deploying to production:
1. Change `APP_PASSWORD` to a strong password (8+ chars, upper, lower, numbers)
2. Change `JWT_SECRET` to a random string
3. Add your API keys (GEMINI_API_KEY, OPENAI_API_KEY, etc.)

### Step 3: First Run

When you run the server for the first time:

```bash
npm run dev
```

You'll see output like:

```
🔐 Generated DATABASE_ENCRYPTION_KEY - ADD THIS TO YOUR .env FILE:
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

Set: DATABASE_ENCRYPTION_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

Copy this value to your `.env` file:
```env
DATABASE_ENCRYPTION_KEY="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
```

---

## 📋 Authentication Flow

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "SecurePass123"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

### Using the Token

All subsequent API calls must include the token:

```bash
curl -X GET http://localhost:3000/api/patients \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 🛡️ Security Features Explained

### 1. JWT Authentication

- User logs in with password
- Server returns JWT token (valid for 24 hours)
- Client stores token in localStorage
- All requests include token in Authorization header
- Server validates token on each request

**Why it's better than hardcoding API keys:**
- No passwords stored in cookies
- Tokens expire after 24 hours
- Tokens are cryptographically signed

### 2. API Key Protection

**BEFORE (❌ Unsafe):**
```typescript
// Client sent API key to server
const apiKey = config.apiKey;  // From user input!
fetch('/api/ai/generate', {
  body: JSON.stringify({ apiKey, prompt })
});
```

**AFTER (✅ Secure):**
```typescript
// Server only uses its own environment variables
let apiKey = process.env.GEMINI_API_KEY;  // Only on server
// Client never sees the real key
```

### 3. Rate Limiting

Prevents brute-force attacks:
- 100 requests per minute per IP
- 5 login attempts per 15 minutes
- Logged with IP address and timestamp

### 4. CORS Protection

Only whitelisted origins can access the API:
```env
ALLOWED_ORIGINS="http://localhost:3000,https://your-domain.com"
```

### 5. Security Headers (Helmet)

Automatically adds:
- `X-Content-Type-Options: nosniff` (prevents MIME type sniffing)
- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-XSS-Protection: 1; mode=block` (XSS protection)
- `Strict-Transport-Security` (HTTPS enforcement)

### 6. Audit Logging

All API calls are logged:
```json
[API_LOG] {"timestamp":"2026-03-21T10:30:00Z","method":"GET","endpoint":"/api/patients","statusCode":200,"userId":"user","ip":"127.0.0.1","duration":45}
```

Turn off with:
```env
LOG_API_CALLS="false"
```

### 7. Input Sanitization

All user input is sanitized:
```typescript
const safe_name = sanitizeInput(user_input);
// Removes: <, >, ", ', and trims whitespace
// Limits to 1000 characters by default
```

---

## 🚨 Security Checklist

Before deploying to production:

- [ ] Change `APP_PASSWORD` to a strong password
- [ ] Change `JWT_SECRET` to a random value (at least 32 characters)
- [ ] Set all API keys (GEMINI_API_KEY, OPENAI_API_KEY, etc.)
- [ ] Update `ALLOWED_ORIGINS` to your actual domain
- [ ] Set `NODE_ENV="production"`
- [ ] Enable HTTPS (Railway/Render do this automatically)
- [ ] Review `.env.example` for all available options
- [ ] Test authentication flow
- [ ] Check audit logs working (`LOG_API_CALLS="true"`)
- [ ] Backup DATABASE_ENCRYPTION_KEY somewhere safe

---

## 📚 File Structure

New security-related files:

```
src/lib/
├── security.ts          # All security functions
├── aiService.ts         # Uses security middleware
└── ...other files
```

Updated server configuration:

```
server.ts                # Security middleware & routes
.env                    # Your local configuration
.env.example            # Template for all settings
```

---

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with password
- `POST /api/auth/logout` - Logout (requires auth)
- `GET /api/health` - Health check (no auth required)

### Protected Endpoints
- `GET /api/patients` - List all patients
- `POST /api/patients` - Create/update patient
- `POST /api/ai/generate` - Generate AI response
- `GET /api/consultations/:patientId` - Get consultation
- `POST /api/consultations/:patientId` - Save consultation

All protected endpoints require valid JWT token in Authorization header.

---

## 🐛 Troubleshooting

### "No token provided. Please login first."
- User not authenticated
- **Solution**: Make sure client sends login first and stores token

### "Invalid or expired token."
- Token is invalid or has expired
- **Solution**: Refresh by logging in again

### "Too many requests"
- Rate limit exceeded
- **Solution**: Wait a few minutes before retrying

### API key not working
- Key not set in .env
- **Solution**: Add API key to .env and restart server

### Encryption key errors
- DATABASE_ENCRYPTION_KEY not properly formatted
- **Solution**: Copy the auto-generated key from console output

---

## 📖 Next Steps

1. **Frontend Integration**: Update React components to use JWT token
   - Store token from login response
   - Include token in all API calls
   - Handle 401 responses by redirecting to login

2. **Testing**: Test all security features
   - Test login/logout
   - Test rate limiting
   - Test expired tokens

3. **Deployment**: Set up on Railway/Render with production config
   - Use production passwords
   - Enable HTTPS
   - Set up monitoring

4. **Monitoring**: Monitor audit logs
   - Check for unusual login attempts
   - Track failed API requests
   - Review rate limit hits

---

## 📞 Support

For issues or questions about the security setup, refer to:
- `src/lib/security.ts` - Full function documentation
- `server.ts` - Middleware implementation
- `.env.example` - All configuration options

**Remember**: Security is a journey, not a destination. Regularly review and update your security practices!

🔐 Stay secure!
