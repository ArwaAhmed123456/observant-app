# Observant Security — Backend API

Node.js / Express / MongoDB REST API for the Observant Guard & Patrol mobile app.

---

## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Auth | JWT (access 15m + refresh 30d) |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Photo storage | Cloudinary |
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

### 3. Set up MongoDB Atlas (free tier works fine)
1. Go to https://cloud.mongodb.com
2. Create a free M0 cluster
3. Add a database user (username + password)
4. Whitelist your IP (or 0.0.0.0/0 for dev)
5. Click **Connect → Drivers** and copy the connection string into `MONGODB_URI`

### 4. Set up Cloudinary (free tier)
1. Sign up at https://cloudinary.com
2. Copy Cloud Name, API Key, API Secret into `.env`

### 5. Set up Firebase (for push notifications)
1. Go to https://console.firebase.google.com
2. Create a project (or use existing)
3. Project Settings → Service Accounts → Generate new private key
4. Save the downloaded JSON as `backend/firebase-service-account.json`
5. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `.env`

### 6. Seed initial data
```bash
npm run seed
```
This creates the Observant organisation, 1 manager, 3 guards, 3 sites, and 10 patrol checkpoints.

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
{ "email": "elena@observant.com", "password": "manager123" }
```
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

1. Push backend folder to its own Git repo (or subfolder)
2. Set all env vars in your hosting dashboard
3. Build command: `npm install`
4. Start command: `npm start`
5. Run seed once: `npm run seed`

The API is stateless — no sessions stored server-side. Scale horizontally freely.
