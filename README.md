# ARS — Disaster Rescue & SOS Management System

ARS is a plain HTML/CSS/JavaScript rescue dashboard backed by an Express API, Supabase Postgres, and Socket.io. The existing dashboard design is retained.

## Requirements

- Node.js 22 or later and npm
- Supabase project
- Google Maps JavaScript API enabled for interactive dashboard maps

## Setup

The commands below use `npm.cmd` for Windows PowerShell. In Command Prompt, macOS, or Linux, use `npm` instead.

1. Install dependencies:

   ```sh
   npm.cmd install
   ```

2. In your Supabase project, open the SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql) to create the application tables and OTP functions.
3. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`) and set:
   - `SUPABASE_URL`: the project URL from Supabase project settings.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key from Supabase project settings. Never expose this key in browser code or commit it.
   - `JWT_SECRET`: a random secret of at least 32 characters.
   - `SEED_ADMIN_PASSWORD` and `SEED_RESCUER_PASSWORD`: strong passwords used only by the seed script.
   - `FRONTEND_URL`: the origin used in the browser, e.g. `http://localhost:8000`.
   - `PORT`: defaults to `8000`.
   - `LOCAL_DEMO_MODE`: set to `true` only for a local demo. It disables authentication and role checks for the dashboards and API; the server binds to `127.0.0.1` in this mode. Never enable it on a network-accessible deployment.
   - `SMS_PROVIDER`: `console` for local development, or `twilio` / `msg91`.
   - `SMS_API_KEY`: Twilio `accountSid:authToken` or an MSG91 auth key.
   - `SMS_FROM`: Twilio sender number, or MSG91 flow template ID.
   - `GOOGLE_GEOCODING_KEY`: optional server-side key for reverse geocoding. The browser Maps key remains in `assets/js/config.js`.

   `.env` is ignored by git. The Express server accesses Supabase using the service role key; browser pages continue to call the existing `/api` endpoints.

4. Seed the admin, five rescuers, and eight Chennai SOS examples:

   ```sh
   npm.cmd run seed
   ```

   Seeded admin phone: `9000000001`. The password is the `SEED_ADMIN_PASSWORD` value from `.env` (for example, `ARSAdmin2026!`).
   Seeded approved rescuers use the `SEED_RESCUER_PASSWORD` value (for example, `Rescuer2026!`).

5. Start the application:

   ```sh
   npm.cmd run dev
   ```

6. Open `http://localhost:8000/login/index.html`. Express serves the front end, API, and Socket.io from the same origin. Do not use `python -m http.server` for the connected application.

### Deploy to Vercel

The project includes a Vercel Node.js entry point at [`server.js`](./server.js). Connect the GitHub repository to Vercel and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` for Production in the Vercel project settings. The app uses Vercel's assigned production domain for CORS by default; if you use a custom domain, also set `FRONTEND_URL` to its origin (for example, `https://your-domain.com`). Then deploy the latest commit. Do not set `LOCAL_DEMO_MODE=true` in Vercel. The entry point includes the static frontend, API, and Socket.IO server in the Vercel function.

## API and real-time updates

- Authentication: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/forgot/*`.
- SOS: public `POST /api/sos`; authenticated list, mine, accept, and status endpoints at `/api/sos`.
- Admin: `/api/admin/rescuers`, `/api/admin/stats`, and `/api/admin/sos/:id/assign`.
- Rescuer duty: `PATCH /api/users/duty`.
- Notifications: `/api/notifications`.
- In standard mode, Socket.io room membership and events require the JWT received at login.
- Local unauthenticated demo: set `LOCAL_DEMO_MODE=true` in `.env` and open `http://localhost:8000/`. This is strictly for local testing; it allows anyone with local access to view and modify application records.
- Import [`postman/ARS.postman_collection.json`](./postman/ARS.postman_collection.json) into Postman to try the endpoints. Set the collection `token`, `sosId`, and `rescuerId` variables after login/list requests.

### Password reset SMS

In development, `SMS_PROVIDER=console` prints the reset OTP to the server terminal; the API never includes the OTP in its response. Twilio and MSG91 require provider credentials and approved sender/template configuration. Reset codes expire after five minutes, permit at most five verification attempts, and enforce a 30-second resend cooldown.

### Google Maps

Set the browser key in `assets/js/config.js` for rendering maps and drawing dashboard routes. Set `GOOGLE_GEOCODING_KEY` in `.env` if SOS creation should resolve coordinates to a human-readable address server-side. Enable Maps JavaScript API, Routes API for in-dashboard directions, and Geocoding API for reverse geocoding as needed. Restrict keys to the required APIs and origins.

## Validation and behavior

- Signup creates a pending rescuer account; an admin must approve it.
- SOS acceptance is atomic: only one rescuer can accept a pending case.
- SOS status moves in order: accepted → en_route → reached → resolved.
- The simulator calls the public SOS endpoint. Dashboard lists, counters, notifications, and map markers refresh using authenticated API calls and Socket.io events.
- The development seed script replaces the current Supabase `sos` table contents with its eight example records.
