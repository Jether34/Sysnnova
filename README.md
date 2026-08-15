# Sysnnova — School Grade Management System

A complete MERN-stack (MongoDB, Express, React, Node) system that digitalizes the entire school grading workflow for Philippine senior high schools and beyond.

## Overview

Sysnnova transforms paper-based grading into a secure, verifiable, end-to-end encrypted digital workflow:

- **Advisers** collect grades from subject teachers, review them grouped by academic year / semester / strand / grade / section, and publish them to their advisory's students
- **Subject Teachers** download a pre-filled Excel template per section (students listed, grouped by gender, adviser name included), encode grades, and upload — the system auto-maps the file to the correct adviser
- **Students** log in and see **only their own** published grades
- **Administrators** get a live control room with traffic monitoring, database browser, audit trail, and user management

**Adviser ↔ Subject Teacher messaging is end-to-end encrypted** (RSA-OAEP 4096 + AES-GCM hybrid, Web Crypto API). Grade publishing sends an **SMTP email** notification to each student.

## Platform Support

| Platform | Status | Download |
|----------|--------|----------|
| Web (Desktop Browser) | ✅ Production | [https://pns-sysnnova.cloud](https://pns-sysnnova.cloud) |
| Mobile (Android) | ✅ Production | [Sysnnova-Android-v2.4.apk](https://pns-sysnnova.cloud/downloads/Sysnnova-Android-v2.4.apk) |
| Mobile Web | ✅ Production | [https://pns-sysnnova.cloud](https://pns-sysnnova.cloud) (PWA-ready) |
| Desktop (Windows) | ✅ Production | [Sysnnova-Setup-Windows-v2.0.exe](https://pns-sysnnova.cloud/downloads/Sysnnova-Setup-Windows-v2.0.exe) |
| **Desktop (Linux)** | ✅ **New** | [AppImage](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.AppImage) · [.deb](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.deb) · [.rpm](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.rpm) · [.tar.gz](https://pns-sysnnova.cloud/downloads/Sysnnova-Desktop-Linux-2.5.0.tar.gz) |

## Key Features

### 🔐 End-to-End Encrypted Messaging
- RSA-4096 keypair generated per adviser/teacher on signup
- Private key delivered to client at login (stored in memory, not localStorage)
- Messages encrypted client-side: AES-256-GCM + RSA-OAEP 4096 key wrapping
- Only ciphertext reaches the database; self-copy for sender included
- No second password prompt — decrypt immediately after login

### 📊 Offline-First Architecture
- **IndexedDB** caches all GET responses (assessments, classes, students, messages)
- **Service Worker** (`offline-first`) serves cached responses when offline
- **Optimistic writes** — POST/PUT/PATCH enqueued to local outbox, applied to cache immediately
- **Automatic sync** — when back online, outbox flushes to server, server responses update cache
- **Offline score entry** — teachers can enter scores offline; they sync on reconnect
- Works across all platforms: Web, Mobile, Windows, Linux

### 📱 Cross-Platform Apps
- **Web**: React 18 + Vite + Tailwind CSS
- **Mobile**: Capacitor 6 (Android), native push notifications ready
- **Windows**: Electron 31 (NSIS installer)
- **Linux**: Electron 31 (AppImage, .deb, .rpm, .tar.gz)
- All desktop/mobile apps bundle the same web client with full offline capability

### 🏫 Multi-School, Multi-Tenant
- Schools registered by **name + full address** (Province → City/Municipality → Barangay)
- Structured signup: Province → City/Municipality → Barangay → School cascade
- Every user belongs to exactly one school
- Cross-school messaging blocked; grade routing scoped to same school

### 📝 Grade Workflow
1. **Teacher** downloads Excel template for exact class (section, grade, strand, subject, semester, AY)
2. **Teacher** encodes grades offline or online, uploads same file
3. **Server** validates, cryptographically signs with teacher's private key, routes to adviser of same school
4. **Adviser** reviews grouped submissions, requests fixes via encrypted messages, publishes
5. **Student** sees published grades instantly; adviser downloads official report card
6. **Admin** monitors live traffic, database browser, audit trail

### 🛡️ Security by Design
- Passwords: bcrypt-hashed, httpOnly JWT sessions
- Device verification: new device → emailed 6-digit code (10-min TTL, sha256 stored)
- Role-based access: students see only own grades; advisers/teachers message only within school
- Signed grade uploads: each file verified against teacher's public key
- Full audit trail: logins, signups, publishes, admin actions with actor/timestamp/IP

## Downloads

### Mobile (Android)
- **APK v2.4**: [Sysnnova-Android-v2.4.apk](https://pns-sysnnova.cloud/downloads/Sysnnova-Android-v2.4.apk) (5.25 MB)
- Signed with `sysnnova-release.keystore` (v2.3 devices must uninstall first)

### Desktop (Windows)
- **Installer v2.0**: [Sysnnova-Setup-Windows-v2.0.exe](https://pns-sysnnova.cloud/downloads/Sysnnova-Setup-Windows-v2.0.exe) (76.5 MB)

### Desktop (Linux) — **New in v2.5**
| Format | Version | Size | Universal |
|--------|---------|------|-----------|
| AppImage | 2.5.0 | 104 MB | ✅ All distros |
| .deb | 2.5.0 | 72.7 MB | Debian/Ubuntu |
| .rpm | 2.5.0 | 73.3 MB | Fedora/RHEL/openSUSE |
| .tar.gz | 2.5.0 | 99 MB | Portable |

All Linux artifacts signed with the same Electron keystore, include full offline engine.

## Prerequisites
- Node.js ≥ 18 (tested on 22)
- MongoDB running locally (`mongod`) — default URI `mongodb://127.0.0.1:27017/agrimind`

## Quick Start

```bash
# 1. Install all dependencies (root, server, client)
npm run install:all

# 2. (Optional) configure SMTP
cp server/.env.example server/.env   # then edit SMTP_* values

# 3. Run both servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

The Vite dev server proxies `/api` to the backend, so no CORS config is needed in dev.

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

## Testing

```bash
# Server E2E tests (signup, grades, messaging, roles)
npm --prefix server run test

# Browser flows (Playwright)
cd /tmp/opencode && node repro_e2e.cjs  # offline add/edit/sync verification
```

## Security Notes

- Passwords: bcrypt + httpOnly JWT cookies
- Role-based access: students see only own grades; advisers/teachers message within school only
- E2E messaging: client-side RSA-OAEP 4096 + AES-256-GCM, private key delivered at login
- Signed grade uploads: each file verified against teacher's public key
- Audit trail: all logins, publishes, admin actions recorded with actor/timestamp/IP
- Device verification: emailed codes for new device login (sha256 stored, 10-min TTL)

## Deployment Architecture

**VPS**: `76.13.183.207` (Ubuntu, nginx, PM2 for Node, MongoDB)
- Web: `/var/www/sysnnova/dist/` + `/opt/sysnnova/mobile/web/`
- API: `node server/src/index.js` on port 5000 (proxied by nginx)
- Downloads: `/var/www/sysnnova/downloads/` (APK, Windows exe, Linux artifacts)
- Deploy script: `deploy_web.py` (SFTP + symlinks) + manual APK/Linux uploads

## Developed By

**JetherS. Garque**  
Email: jsgarque@fit.edu.ph  
GitHub: [@Jether34](https://github.com/Jether34)

---

## License

MIT License — see [LICENSE](LICENSE) for details.