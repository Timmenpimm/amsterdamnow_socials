# Amsterdam NOW Socials

Automatically convert WordPress blog posts into Instagram carousel posts using AI.

This application analyzes existing WordPress content, generates optimized Instagram carousels with AI-created graphics, and publishes directly to Instagram through the Meta Graph API.

## Quick Start

```bash
npm install
npx prisma generate
npm run dev
```

Visit `http://localhost:3000` to get started.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your credentials
2. Run database migrations: `npx prisma migrate dev`
3. Start development server: `npm run dev`

## API-toegang voor externe apps (Bearer auth)

Naast browser-sessies accepteren de business-API-routes (settings, import, generate, render, carousels, publish) server-to-server calls met een gedeelde API-key:

```
Authorization: Bearer <ENGINE_API_KEY>
```

Zet hiervoor twee env vars (zie `.env.example`):

- `ENGINE_API_KEY` — gedeeld geheim (bijv. `openssl rand -hex 32`); leeg laten schakelt Bearer-auth uit
- `ENGINE_SERVICE_USER_EMAIL` — e-mailadres van een bestaand engine-account waar de calls namens draaien (de "service user")

Een geldige Bearer-call gedraagt zich exact als een ingelogde sessie van de service user. Auth-, register- en Instagram-OAuth-routes blijven puur browser-flows. Dit is bedoeld voor de artikel-tool-koppeling.

## Documentation

See `CLAUDE.md` for architecture, development rules, and feature specifications.
