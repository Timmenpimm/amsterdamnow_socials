# WordPress to Instagram Carousel AI Engine

## Project Overview

Build a SaaS-style web application that automatically converts existing WordPress blog posts into Instagram carousel posts.

The application workflow:

1. Connect to WordPress website
2. Retrieve existing posts
3. Analyze content using AI
4. Generate Instagram carousel structure
5. Render branded carousel images
6. Preview and edit carousel
7. Publish to Instagram through Meta Graph API

The goal is a reusable content repurposing engine, not a single-purpose Instagram tool.

---

# Core Technology Stack

Use this stack unless there is a strong technical reason to change:

## Framework

- Next.js 15+
- App Router
- TypeScript
- React Server Components where appropriate

## Hosting

- Vercel

## Styling

- Tailwind CSS
- shadcn/ui components

## Database

- Supabase PostgreSQL
- Prisma ORM

## Authentication

- NextAuth/Auth.js

## AI

Use:

- Vercel AI SDK
- OpenAI API

AI should return structured JSON objects, never unstructured text.

Example:

```json
{
  "title": "5 things you should know",
  "slides": [
    {
      "headline": "",
      "body": "",
      "imagePrompt": "",
      "layout": "hero"
    }
  ],
  "caption": "",
  "hashtags": []
}
```

---

# Application Architecture

Structure:

```
/app
  /dashboard
  /api
    /wordpress
    /generate
    /instagram
    /render

/components
  /carousel
  /ui

/lib
  wordpress.ts
  openai.ts
  instagram.ts
  renderer.ts
  supabase.ts

/templates
  news.tsx
  listicle.tsx
  quote.tsx
  event.tsx

/database
  schema.prisma
```

Keep business logic outside React components.

---

# Main Features

## 1. WordPress Import

Create a WordPress connector.

Requirements:

- Support WordPress REST API
- Import:
  - title
  - content
  - excerpt
  - featured image
  - categories
  - tags
  - publication date

Create `lib/wordpress.ts` with functions:

```
getPosts()
getPostById()
getFeaturedImage()
```

## 2. AI Content Generator

Create an AI pipeline.

Input: WordPress article.
Output: Carousel JSON.

The AI should:

- summarize article
- identify strongest hooks
- create slide sequence
- generate CTA
- generate Instagram caption
- generate hashtags

Avoid generic marketing language.
The carousel should feel like professional editorial content.

## 3. Carousel Rendering Engine

Do not create images manually.

Use: React components → PNG rendering.

Recommended:

- Satori
- @vercel/og
- Playwright if needed

Create reusable templates, for example:

```
templates/
  modern-news.tsx
  minimal-business.tsx
  magazine.tsx
```

Each template receives:

```
{
  slides,
  brandSettings,
  images
}
```

Output:

```
slide-01.png
slide-02.png
slide-03.png
```

## 4. Admin Dashboard

Create dashboard where users can:

- view imported articles
- generate carousel
- preview slides
- select template
- edit text
- regenerate individual slides
- approve publishing

Pages:

```
/dashboard/posts
/dashboard/carousels
/dashboard/templates
/dashboard/settings
```

## 5. Instagram Integration

Use: Instagram Graph API.

Implement `lib/instagram.ts` with functions:

```
createMediaContainer()
publishCarousel()
getPublishingStatus()
```

Do not store access tokens in code.
Use environment variables.

---

# Environment Variables

Create `.env.example` with:

```
DATABASE_URL=

OPENAI_API_KEY=

WORDPRESS_URL=
WORDPRESS_USERNAME=
WORDPRESS_PASSWORD=

INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

# Database Models

Create Prisma models:

## User

Stores users.

## WordPressConnection

Stores connected websites.

Fields:

- url
- credentials
- createdAt

## Article

Stores imported posts.

Fields:

- wordpressId
- title
- content
- image
- status

## Carousel

Stores generated carousels.

Fields:

- articleId
- template
- slides JSON
- status
- instagramId

---

# Development Rules

Always:

- use TypeScript
- write clean modular code
- avoid unnecessary dependencies
- add error handling
- add loading states
- validate API inputs
- use environment variables
- create reusable components

Never:

- hardcode credentials
- put business logic inside UI components
- create huge files (>300 lines)
- skip error handling

---

# Development Workflow

Before coding:

1. Analyze existing project structure
2. Explain implementation plan
3. Wait for approval

When implementing:

1. Build one feature at a time
2. Test after every major change
3. Explain changed files
4. Keep git commits small and descriptive

---

# MVP Development Order

Build in this order:

**Phase 1:**

- Next.js setup
- Authentication
- Supabase connection
- Dashboard

**Phase 2:**

- WordPress importer

**Phase 3:**

- AI carousel generator

**Phase 4:**

- Carousel renderer

**Phase 5:**

- Preview editor

**Phase 6:**

- Instagram publishing

**Phase 7:**

- Automation with Vercel Cron

---

# Product Vision

This should become a general AI content repurposing platform.

Future channels:

- Instagram carousel
- LinkedIn carousel
- Pinterest pins
- Newsletter summaries
- TikTok scripts
- YouTube Shorts scripts

Build the architecture so new content channels can be added easily.
