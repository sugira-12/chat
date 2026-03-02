# Cyber Social (Express + React Rewrite)

This repo now contains a Vercel-friendly rewrite:

- `server/` - Express API (JWT auth, MySQL, Cloudinary uploads, optional Pusher realtime)
- `client/` - React (Vite) web app

The older PHP version is still in `php/` (kept for reference while you migrate).

## What You Need For Cloudinary

1) Create a Cloudinary account.
2) In the Cloudinary Dashboard, copy these values:
- Cloud name
- API key
- API secret

You will add them as environment variables on your server:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional:
- `CLOUDINARY_FOLDER` (defaults to `cyber`)

## Local Run (Development)

### 1) MySQL

- Create a database (example: `cyber`)
- Import schema: `server/sql/schema.sql` (same schema used by the app)

### 2) Server

```bash
cd server
copy .env.example .env
npm install
npm run dev
```

Server runs on `http://localhost:3001` and exposes `http://localhost:3001/api/*`.

### 3) Client

```bash
cd client
copy .env.example .env
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

Set `VITE_API_BASE_URL=http://localhost:3001/api` in `client/.env`.

## Deploy To Vercel

You will create two Vercel projects (one for `server/`, one for `client/`).

### 1) Deploy `server/` (API)

In Vercel:
- New Project -> select this repo
- Root Directory: `server`
- Add env vars:
  - `APP_DEBUG=0`
  - `JWT_SECRET=...`
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - (Optional) `CLOUDINARY_FOLDER=cyber`
  - (Optional) `CORS_ORIGIN=https://YOUR-CLIENT.vercel.app`
- Deploy

Test: `https://YOUR-SERVER.vercel.app/api/health`

### 2) Deploy `client/` (React)

In Vercel:
- New Project -> select this repo
- Root Directory: `client`
- Add env var:
  - `VITE_API_BASE_URL=https://YOUR-SERVER.vercel.app/api`
- Deploy

## Notes / Limits

- Media uploads are stored on Cloudinary (server-side upload).
- Realtime chat is wired for polling by default; optional Pusher can be enabled later.

