# CollabGarden Frontend

Frontend for CollabGarden using React, TypeScript, Vite, HeroUI, Lucide, and Tailwind CSS.

## Getting Started

Make sure Docker Desktop is running.

Start the app:

```bash
docker compose up --build
```

Open http://localhost:5173

Stop the app:

```bash
docker compose down
```

## Project Structure

- `src/components/` — Reusable UI components
- `src/pages/` — Application pages
- `src/styles/` — Shared colors
- `src/App.tsx` — Routing
- `Dockerfile` — Docker setup
- `compose.yaml` — Container configuration

## Development

View components at http://localhost:5173/components

Check the build:

```bash
docker compose exec frontend pnpm build
```

Pages are currently placeholders. Development will follow the Figma designs.