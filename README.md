# GridWright

A single-page web tool for designing per-well crystallization optimization trays.
Define how reagents and/or pH vary across a microplate; GridWright computes an explicit
pipetting recipe (stock volumes + water) for every well, a stock-prep list, and live
feasibility warnings.

All chemistry math runs in the browser (TypeScript engine). The backend only stores and
returns screen documents as JSON blobs identified by human-readable slugs.

---

## Running locally (dev mode)

Two terminals — frontend and backend run separately in dev mode.

**Frontend**
```bash
cd frontend
npm install
npm run dev          # Vite dev server at http://localhost:5173
npm run test         # Vitest engine tests
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Vite proxies `/api/*` to port 8000, so the full app is available at
`http://localhost:5173`.

The SQLite database is created automatically at `./gridwright.db` (relative to wherever
you launch uvicorn). Set `DB_PATH` to override:

```bash
DB_PATH=/tmp/gw.db uvicorn app.main:app --reload --port 8000
```

---

## Running with Docker Compose (single container)

```bash
# first run — builds image, creates ./data volume dir, starts on :8000
docker compose up --build

# subsequent runs
docker compose up
```

The app is available at `http://localhost:8000`.
The SQLite file is persisted in `./data/gridwright.db`.

---

## Production deploy (Coolify)

1. Point Coolify at this repository and select **Dockerfile** as the build method.
2. Expose port **8000**.
3. Add a persistent volume mounted at `/data` (stores the SQLite file).
4. Set environment variables:

   | Variable          | Value                 | Notes                            |
   |-------------------|-----------------------|----------------------------------|
   | `DB_PATH`         | `/data/gridwright.db` | Already the default in the image |
   | `SCREEN_TTL_DAYS` | `90`                  | Optional — omit for no expiry    |

The multi-stage Dockerfile builds the React frontend (`npm ci && npm run build`) in a
Node 20 image, then packages it with the FastAPI backend into a Python 3.12-slim image.
FastAPI serves the built frontend statically and handles all `/api/*` routes.

---

## Project layout

```
frontend/src/engine/          pure TS calculation (types, units, expand, ph, well, screen)
frontend/src/engine/__tests__/ Vitest specs
frontend/src/ui/              React: wizard (Step 1–3), PlatePreview, WellDetail, PrepList, exports
frontend/src/api/             thin API client
backend/app/                  FastAPI: routes, SQLite, slug generation
Dockerfile                    multi-stage build
docker-compose.yml            local convenience (one service + ./data volume)
```
