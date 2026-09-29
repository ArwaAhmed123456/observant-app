# Observant Security — Backend API

Node.js / Express / MongoDB REST API for the Observant Guard & Patrol mobile app.

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | JWT (access 15m + refresh 30d) |
| Push notifications | Expo Push Service (FCM optional) |
| Photo storage | MongoDB GridFS |
| Rate limiting | express-rate-limit |

---

## Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your real values (see comments in file)
```

### 3. Configure MongoDB Atlas
Set `MONGODB_URI` to the Atlas cluster's dedicated `ObservantApp` database. MongoDB creates collections automatically (`users`, `sites`, `shiftsessions`, `checkcalls`, `patrolsessions`, and others); it does not use SQL-style tables. The previous app database remains separate. Add the API host's outbound IP to Atlas Network Access, or use a host-supported network rule.

### 4. Configure patrol image storage
Checkpoint and avatar images are stored in the MongoDB `observantMedia` GridFS bucket.

### 5. Push notifications
The Android app registers an Expo Push token automatically after sign-in. The server sends shift, check-call, patrol, and manager alert notifications through Expo Push Service.

### 6. Seed initial data
```bash
npm run seed
```
This idempotently creates the Observant organisation and first administrator only. No demo users or sites are inserted. Sign in as the administrator, create an active manager, create a site under **Sites & Geofences**, then assign guards and checkpoints.

### 7. Run the server
```bash
npm run dev     # development (nodemon, auto-restart)
npm start       # production
```

Server starts on http://localhost:5000

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All routes (except `/auth/login` and `/auth/register-org`) require:
```
Authorization: Bearer <accessToken>
```

---

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/register-org` | Create new organisation + admin user |
| POST | `/auth/login` | Login → returns accessToken + refreshToken |
| POST | `/auth/refresh` | Exchange refresh token for new access token |
| POST | `/auth/logout` | Revoke refresh token |
| GET  | `/auth/me` | Current user profile |
| PATCH | `/auth/me/fcm-token` | Update device FCM token for push notifications |

**Login request:**
```json
{ "email": "<BOOTSTRAP_ADMIN_EMAIL>", "password": "<BOOTSTRAP_ADMIN_PASSWORD>" }
```
The seed uses `BOOTSTRAP_ADMIN_PASSWORD` from your environment and never prints it. Keep it in a secret manager (or the ignored local bootstrap file) and rotate it after first sign-in.
**Login response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "name": "Elena Rostova", "role": "manager", ... }
}
```

---

### Users & Sites

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/users` | manager | List users in org |
| POST | `/users` | manager | Create guard or manager |
| GET | `/users/:id` | any | Get user by ID |
| PATCH | `/users/:id` | manager | Update user |
| DELETE | `/users/:id` | manager | Deactivate user |
| POST | `/users/:id/avatar` | manager | Upload avatar photo |
| GET | `/sites` | any | List sites |
| POST | `/sites` | manager | Create site |
| GET | `/sites/:id` | any | Get site |
| PATCH | `/sites/:id` | manager | Update site |

---

### Shift Sessions

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/shifts/book-on` | guard | Start shift (book on) |
| POST | `/shifts/book-off` | guard | End shift (book off) |
| GET | `/shifts/active` | any | Get active session |
| GET | `/shifts` | any | List sessions |
| GET | `/shifts/:id` | any | Get one session |

---

### Check Calls

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/check-calls/fire` | guard | Fire a check call (mobile calls after 1hr timer) |
| POST | `/check-calls/:id/respond` | guard | Respond yes/no |
| POST | `/check-calls/expire` | guard | Mark as missed (called when 10-min window ends) |
| GET | `/check-calls` | any | List check calls |
| GET | `/check-calls/:id` | any | Get one |

---

### Patrols

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/patrols/checkpoints?siteId=` | any | List patrol checkpoints for a site |
| POST | `/patrols/checkpoints` | manager | Add checkpoint |
| PATCH | `/patrols/checkpoints/:id` | manager | Update checkpoint |
| DELETE | `/patrols/checkpoints/:id` | manager | Remove checkpoint |
| POST | `/patrols/start` | guard | Start patrol session |
| POST | `/patrols/:id/capture` | guard | Upload checkpoint photo (multipart, field: `photo`) |
| POST | `/patrols/:id/finish` | guard | Finish patrol |
| GET | `/patrols` | any | List patrols |
| GET | `/patrols/:id` | any | Get patrol with captures |
| POST | `/patrols/random-prompt` | guard | Log anti-idle prompt |
| POST | `/patrols/random-prompt/:id/respond` | guard | Mark prompt as responded |

---

### Rosters

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/rosters` | any | List rosters |
| POST | `/rosters` | manager | Publish/update roster for a guard-week |
| GET | `/rosters/week/:date` | manager | All rosters for a Monday date |
| GET | `/rosters/guard/:guardId` | any | Guard's roster for current/specified week |
| GET | `/rosters/templates` | manager | List saved templates |
| POST | `/rosters/templates` | manager | Save template |
| DELETE | `/rosters/templates/:id` | manager | Delete template |

---

### Alerts

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/alerts` | manager | List alerts |
| GET | `/alerts/unread-count` | manager | Unread badge count |
| PATCH | `/alerts/:id/read` | manager | Mark one read |
| PATCH | `/alerts/read-all` | manager | Mark all read |
| DELETE | `/alerts/:id` | manager | Delete alert |

---

### Reports

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/reports/shift-calls` | manager | Full JSON report |
| GET | `/reports/shift-calls/csv` | manager | CSV download |
| GET | `/reports/summary` | manager | KPI summary |

**Query params for reports:** `from`, `to`, `guardId`, `siteId`, `type` (combined/check_calls/patrols)

---

## Data Models

| Collection | Purpose |
|-----------|---------|
| `organisations` | Tenant root — one per company |
| `users` | Guards and managers, scoped to org |
| `sites` | Physical locations |
| `shiftrosters` | Weekly schedules per guard |
| `rostertemplates` | Saved schedule patterns |
| `shiftsessions` | Live shift (book on → book off) |
| `checkcalls` | Individual check call events |
| `patrolcheckpoints` | Checkpoint config per site |
| `patrolsessions` | Patrol runs with embedded photo captures |
| `randompromptlogs` | Anti-idle prompt history |
| `alerts` | Manager notifications |

---

## Deployment (Render / Railway / VPS)

1. Create a Node web service with `backend` as its root directory.
2. Set `NODE_ENV=production`, `MONGODB_URI`, two distinct strong JWT secrets (32+ characters), and an explicit `CORS_ORIGINS` in the host's secret settings. Add SMTP values if account recovery emails are enabled.
3. Build command: `npm install`; start command: `npm start`; health check: `/health`.
4. Run `npm run seed` once from the service environment. It is safe to rerun.
5. Set the deployed HTTPS API origin as `EXPO_PUBLIC_API_URL` in the Expo/EAS environment and build Android again. An APK built without this value remains in local demo mode.

MongoDB stores refresh-token hashes and operational records. A background worker schedules hourly check calls, 10-minute missed-call escalation, random patrol prompts, ignored-prompt alerts, and shift-end reminders. Run one API instance unless the worker is moved behind a distributed scheduler/lock.
