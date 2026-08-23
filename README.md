# GeoSocial - Render + PostgreSQL

## Deploy on Render

1. Create a PostgreSQL database on Render.
2. Create a Web Service from this repository.
3. Build Command:
   npm install
4. Start Command:
   npm start
5. Add environment variable:
   DATABASE_URL = the Internal Database URL from your Render PostgreSQL service
6. Add:
   NODE_ENV=production

The server serves `frontend/index.html` and exposes the API under `/api`.

## Database

Run `backend/schema.sql` against the Render PostgreSQL database. If your Render setup provides a SQL console, paste the file there.

## Important

Browser GPS requires HTTPS. Render's Web Service URL is HTTPS.

This starter uses PostgreSQL and a REST API. For truly instant live movement and chat, add WebSocket/SSE after the basic version is working.

The frontend below is intentionally a small working integration layer. Replace the original mock `state.pins` flow with API calls from this file.
