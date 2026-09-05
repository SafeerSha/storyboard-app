# StoryBoard

A lightweight requirements board for freelancers: turn one-line client requirements into clear feature stories, review them, and prepare them for client approval.

## Stack
- Next.js + TypeScript
- Tailwind CSS
- Supabase
- Gemini API with structured JSON output
- Vercel-ready

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional; defaults to `gemini-2.5-flash`)

Run `supabase/schema.sql` in the Supabase SQL editor.

## Current MVP

- Premium minimal SaaS landing page
- Demo project workspace
- Gemini requirement -> structured feature story
- Editable generated story
- Acceptance criteria / assumptions / clarifications
- Story statuses
- Supabase schema with RLS foundation

## Next build phase

1. Supabase Auth and real project CRUD
2. Persistent story CRUD
3. Client share links with secure token validation
4. Client review/comment/approve/request-changes
5. Revision history
6. Dashboard metrics
7. Production hardening and Vercel deployment

Keep all secrets in environment variables. Never commit Gemini or Supabase secret keys.

## UI direction
The app is dashboard-first: fixed left navigation, compact top bar, workspace overview, project cards, and a focused story workspace. The visual language is a premium minimal SaaS style with neutral surfaces, subtle borders, generous whitespace, and restrained indigo accents.

## Client portal
Freelancer side now includes a Clients screen where a client can be assigned to an existing project and receive a 6-digit login ID plus a generated or manually supplied password. Clients sign in at `/client/login` and can review stories, request changes with a comment, or approve a story.

Required additional server-only environment variables:
- `SUPABASE_SECRET_KEY` — never expose this to the browser.
- `SUPABASE_JWKS_URL` — JWKS endpoint for auth verification.
- `CLIENT_SESSION_SECRET` — use a long random value (32+ bytes) for signing client portal sessions.

The freelancer dashboard is protected by Supabase Auth. Create an account at `/login`. Projects and clients APIs require the authenticated freelancer. Client portal sessions are separate from Supabase Auth and are scoped to the assigned project.
