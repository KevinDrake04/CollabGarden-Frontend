# CollabGarden Frontend

## About CollabGarden

CollabGarden connects local New Jersey businesses with content creators. This repo is the frontend. It talks to a separate backend API.

Visitors can browse businesses and creators, open a profile, and sign up as either role. After login, a business can manage campaigns and review deliverables, and a creator can look through open campaigns and submit deliverables. Administrators have their own dashboard.

## Tech Stack

- React and TypeScript
- Vite
- React Router
- Tailwind CSS and HeroUI
- Lucide for icons
- pnpm

## Getting Started

Use Node.js 22. Dependencies are locked with pnpm.

```bash
pnpm install
```

Copy `.env.example` to `.env.local` and set `VITE_API_URL` to the backend origin.

```bash
pnpm dev
```

Open http://localhost:5173. The API allows that origin.

Check the production build:

```bash
pnpm build
```

Docker is optional. With Docker Desktop running:

```bash
docker compose up --build
```

The container runs `pnpm dev` and publishes port 5173. Stop it with `docker compose down`.

## Current Features

- Landing page
- Business and creator directory, with search and county filters
- Public business and creator profiles
- Open campaign list
- Login, logout, and signup
- Business dashboard for the overview, campaigns, creating or editing a campaign, deliverable review, and account
- Creator dashboard for the overview, open campaigns, deliverable submission, and account
- Admin dashboard
