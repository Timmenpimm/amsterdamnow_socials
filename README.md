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

## Documentation

See `CLAUDE.md` for architecture, development rules, and feature specifications.
