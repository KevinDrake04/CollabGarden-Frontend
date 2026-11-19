# CollabGarden Frontend

React frontend for CollabGarden. It uses TypeScript, Vite, HeroUI, Lucide, and Tailwind CSS.

## Setup

Use Node.js 22. Dependencies are locked with pnpm.

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and set `VITE_API_URL` to the backend origin.

```bash
pnpm dev
```

Open http://localhost:5173. The API allows that origin. `http://127.0.0.1:5173` is a different origin and directory requests will fail.

Check the production build:

```bash
pnpm build
```

Docker is optional. With Docker Desktop running:

```bash
docker compose up --build
```

The container runs `pnpm dev` and publishes port 5173. Stop it with `docker compose down`.

## Project structure

- `src/api/` - clients for auth, directory, campaigns, collaborations, and admin
- `src/components/` - shared UI used by the pages and the component gallery
- `src/pages/` - routes, grouped by area
- `src/styles/` - shared color variables
- `src/App.tsx` - route table, including redirects from older URLs
- `Dockerfile` and `compose.yaml` - optional container setup

Dashboard pages live in `src/pages/dashboard/business`, `src/pages/dashboard/creator`, and `src/pages/dashboard/shared`.

## What the app does

Public pages:

- Landing page at `/`
- Business and creator directory at `/discover`, with search and county filters
- Business profiles at `/businesses/:id` and creator profiles at `/creators/:id`
- Open campaign list at `/campaigns`
- Login, logout, and signup

Signed-in business pages cover the overview, campaigns, deliverable review, account, and campaign create or edit. Creator pages cover the overview, open campaigns, deliverable submission, and account. Administrators use `/dashboard/admin`.

Older links such as `/app/...`, `/components`, and dashboard hash sections redirect to the current routes.

## Limitations

- Messages, payments, and profile editing under `/dev` are placeholders.
- `/dev/components` previews shared components with sample data. It does not call the API.
- The directory and profiles are read-only. Signup creates an account, and the account pages show the saved profile.
- There is no public campaign detail page. Open campaigns are listed, and a signed-in business edits its own campaigns.
