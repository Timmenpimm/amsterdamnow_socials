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