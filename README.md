# Sysnnova — School Grade Management System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6%2B-brightgreen.svg)](https://www.mongodb.com/)
[![Electron](https://img.shields.io/badge/Electron-31-47848F.svg)](https://www.electronjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6-119EFF.svg)](https://capacitorjs.com/)

A complete MERN-stack (MongoDB, Express, React, Node) system that digitalizes the entire school grading workflow for Philippine senior high schools and beyond.

---

## Platform Support

| Platform | Status | Download |
|----------|--------|----------|
| Web (Desktop Browser) | Production | [https://pns-sysnnova.cloud](https://pns-sysnnova.cloud) |
| Mobile (Android) | Production | [Sysnnova-Android-v2.4.apk](https://pns-sysnnova.cloud/downloads/Sysnnova-Android-v2.4.apk) |
| Mobile Web (PWA) | Production | [https://pns-sysnnova.cloud](https://pns-sysnnova.cloud) |
| Desktop (Windows) | Production | [Sysnnova-Setup-Windows-v2.0.exe](https://pns-sysnnova.cloud/downloads/Sysnnova-Setup-Windows-v2.0.exe) |
| **Desktop (Linux)** | **New** | [AppImage](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.AppImage) · [.deb](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.deb) · [.rpm](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.rpm) · [.tar.gz](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.tar.gz) |

---

## Key Features

### End-to-End Encrypted Messaging
- RSA-4096 keypair generated per adviser/teacher on signup
- Private key delivered to client at login (stored in memory, not localStorage)
- Messages encrypted client-side: AES-256-GCM + RSA-OAEP 4096 key wrapping
- Only ciphertext reaches the database; self-copy for sender included
- No second password prompt — decrypt immediately after login

### Offline-First Architecture
- IndexedDB caches all GET responses (assessments, classes, students, messages)
- Service Worker serves cached responses when offline
- Optimistic writes — POST/PUT/PATCH enqueued to local outbox, applied to cache immediately
- Automatic sync — when back online, outbox flushes to server, server responses update cache
- Offline score entry — teachers can enter scores offline; they sync on reconnect
- Works across all platforms: Web, Mobile, Windows, Linux

### Cross-Platform Apps
- **Web**: React 18 + Vite + Tailwind CSS
- **Mobile**: Capacitor 6 (Android), native push notifications ready
- **Windows**: Electron 31 (NSIS installer)
- **Linux**: Electron 31 (AppImage, .deb, .rpm, .tar.gz)
- All desktop/mobile apps bundle the same web client with full offline capability

### Multi-School, Multi-Tenant
- Schools registered by **name + full address** (Province → City/Municipality → Barangay)
- Structured signup: Province → City/Municipality → Barangay → School cascade
- Every user belongs to exactly one school
- Cross-school messaging blocked; grade routing scoped to same school

### Grade Workflow
1. **Teacher** downloads Excel template for exact class (section, grade, strand, subject, semester, AY)
2. **Teacher** encodes grades offline or online, uploads same file
3. **Server** validates, cryptographically signs with teacher's private key, routes to adviser of same school
4. **Adviser** reviews grouped submissions, requests fixes via encrypted messages, publishes
5. **Student** sees published grades instantly; adviser downloads official report card
6. **Admin** monitors live traffic, database browser, audit trail

### Security by Design
- Passwords: bcrypt-hashed, httpOnly JWT sessions
- Device verification: new device → emailed 6-digit code (10-min TTL, sha256 stored)
- Role-based access: students see only own grades; advisers/teachers message only within school
- Signed grade uploads: each file verified against teacher's public key
- Full audit trail: logins, signups, publishes, admin actions with actor/timestamp/IP

---

## Admin Account (for testing/development)

| Field | Value |
|-------|-------|
| **Email** | `garquejether681@gmail.com` |
| **Password** | `123456` |
| **Role** | Admin |
| **School** | Default seeded school |

> **Note**: This account is seeded automatically on first run. Change the password immediately in production.

---

## Prerequisites

- Node.js ≥ 18 (tested on 22)
- MongoDB running locally (`mongod`) — default URI `mongodb://127.0.0.1:27017/agrimind`

---

## Quick Start

```bash
# 1. Install all dependencies (root, server, client)
npm run install:all

# 2. (Optional) configure SMTP
cp server/.env.example server/.env   # then edit SMTP_* values

# 3. Run both servers
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

The Vite dev server proxies `/api` to the backend, so no CORS config is needed in dev.

---

## Production Build

```bash
# Build web client
npm run build            # outputs to client/dist

# Build mobile (Android)
cd client && npx cap sync android && cd android && ./gradlew assembleRelease

# Build Windows desktop
cd desktop && npm run dist

# Build Linux desktop
cd desktop && npm run dist:linux
```

### Production Deploy
- Serve `client/dist` statically (nginx, Apache, or static server)
- Proxy `/api` to Node backend (`NODE_ENV=production node server/src/index.js`)
- Set in `server/.env`:
  ```
  CLIENT_ORIGIN=https://your-domain.com
  JWT_SECRET=your-long-random-secret
  SMTP_* variables for email
  ```

---

## Project Structure

```
server/
  src/
    config/        env & DB config
    models/        User, School, Message, GradeSheet, Assessment
    routes/        auth, users, schools, grades, assessments, messages
    services/      excel (template build/parse), mailer (SMTP), keys (RSA)
    middleware/    JWT auth + role guards
client/
  src/
    api/           axios client + offline adapter (IndexedDB + outbox)
    context/       AuthContext (session + E2E key lifecycle + offline bootstrap)
    offline/       engine.js (cache, outbox, sync, applyToCache)
    components/    Layout, ProtectedRoute, Modal, Toast, UnlockModal, Spinner
    pages/         Landing, Login, Signup, Dashboard*, GradesPage, MessagesPage, MyStudentsPage
    utils/         Web Crypto helpers, platform detection
desktop/           Electron app (Windows + Linux)
  main.js          loadFile + preload (contextBridge)
  preload.js       exposes window.desktop
  build/           icons (512x512 PNG)
  web/             bundled client/dist (relative paths for file://)
```

---

## Testing

```bash
# Server E2E tests (signup, grades, messaging, roles)
npm --prefix server run test

# Browser flows (Playwright)
cd /tmp/opencode && node repro_e2e.cjs  # offline add/edit/sync verification
```

---

## Security Notes

- Passwords: bcrypt + httpOnly JWT cookies
- Role-based access: students see only own grades; advisers/teachers message within school only
- E2E messaging: client-side RSA-OAEP 4096 + AES-256-GCM, private key delivered at login
- Signed grade uploads: each file verified against teacher's public key
- Audit trail: all logins, publishes, admin actions recorded with actor/timestamp/IP
- Device verification: emailed codes for new device login (sha256 stored, 10-min TTL)

---

## Developed By

**JetherS. Garque**  
Email: `garquejether681@gmail.com`  
GitHub: [@Jether34](https://github.com/Jether34)

---

## License

MIT License — see [LICENSE](LICENSE) for details.