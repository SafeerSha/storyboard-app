# REQly Performance Audit & Free-Tier Optimization Pass

**Audit Date**: September 2026  
**Target Environment**: Supabase Free Tier (500 MB DB storage, Compute Limits, Connection Pooler), Next.js on Vercel  
**Status**: Completed — Ready for Implementation

---

## Executive Summary

A comprehensive architectural and performance audit was executed across the entire REQly application covering all routes, server/client components, database queries, Supabase clients, middleware, session management, RLS policies, and Gemini AI endpoints.

The application architecture is functional, secure, and visually refined. However, several critical performance bottlenecks and architectural antipatterns currently impose unnecessary compute, connection, memory, and database load on the Supabase Free Tier.

### Top Bottleneck Categories Identified:

1. **Critical Missing Database Indexes**: Foreign keys and primary filter/sort columns (`projects.owner_id`, `stories.project_id`, `stories.epic_id`, `clients.project_id`, `story_comments.story_id`, `story_revisions.story_id`) lack indexes, forcing PostgreSQL into sequential table scans.
2. **Volatile RLS Policies & Subquery Inefficiencies**: Per-row execution of `public.is_super_admin()` and naked `auth.uid()` calls across multi-table joins without InitPlan subquery caching.
3. **Double Auth Cascades in Middleware & Layout**: Every authenticated dashboard route triggers duplicate calls to `supabase.auth.getUser()` and duplicate queries to `freelancer_profiles` across `middleware.ts` and `layout.tsx`. Furthermore, unauthenticated client/team routes trigger unnecessary Supabase Auth lookups.
4. **Sequential Query Waterfalls**: Server components (`app/client/page.tsx`, `app/team/page.tsx`, `app/(dashboard)/project/[id]/page.tsx`) sequentially await independent database queries instead of parallelizing with `Promise.all`.
5. **Overfetching (`SELECT *`) & Unbounded In-Memory Filtering**: Multiple endpoints fetch unneeded large text columns or entire table sets into Node.js memory for filtering (e.g. `project_inbox_items` in-memory text search and unbounded card listing).
6. **Unnecessary Client-Side Fetching on Dashboard**: `app/(dashboard)/page.tsx` is completely interactive-free yet operates as a `"use client"` component fetching `/api/projects` on mount via `useEffect`.

---

## Detailed Findings Table

| ID         | Finding                                                 | Affected File / Component                                                                       | Affected Query / Pattern                                                                                           | Severity     | Expected Impact                                                                                     | Recommended Fix                                                                                                                |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **AUD-01** | Missing indexes on primary foreign keys & sort columns  | Database schema (`supabase/schema.sql`, `epics.sql`)                                            | `projects(owner_id)`, `stories(project_id)`, `stories(epic_id)`, `clients(project_id)`, `story_comments(story_id)` | **CRITICAL** | Full table scans on every project view, story query, and RLS evaluation; high disk I/O on free tier | Create migration `supabase/performance_indexes.sql` with composite & single-column indexes                                     |
| **AUD-02** | Volatile RLS policy evaluation per row without InitPlan | `supabase/profiles.sql`, `epics.sql`, `feedback_threads.sql`                                    | `auth.uid() = owner_id or public.is_super_admin()`                                                                 | **CRITICAL** | Function executes for every row examined in queries; O(N) compute multiplication                    | Convert `is_super_admin()` to `STABLE`; wrap `(select auth.uid())` and `(select public.is_super_admin())`                      |
| **AUD-03** | Redundant Auth + Profile lookup cascade on every route  | `middleware.ts` and `app/(dashboard)/layout.tsx`                                                | `supabase.auth.getUser()` + `freelancer_profiles` query executed twice per page transition                         | **HIGH**     | Doubles external network latency and PostgreSQL queries on every dashboard navigation               | Skip Auth lookups for `/team` and `/client` routes in middleware; pass verified headers down to avoid duplicate layout queries |
| **AUD-04** | Sequential query waterfall on Client Portal             | `app/client/page.tsx`                                                                           | Sequential `await db.from("projects")`, `await db.from("stories")`, `await db.from("epics")`                       | **HIGH**     | 3x database latency on every client portal page load                                                | Parallelize with `Promise.all([projectsQuery, storiesQuery, epicsQuery])`                                                      |
| **AUD-05** | Sequential query waterfall on Team Portal               | `app/team/page.tsx`                                                                             | Sequential `await admin.from("projects")`, `await admin.from("epics")`, `await admin.from("stories")`              | **HIGH**     | 3x database latency on every team portal page load                                                  | Parallelize with `Promise.all([projectQuery, epicsQuery, storiesQuery])`                                                       |
| **AUD-06** | Sequential query waterfall on Project Workspace         | `app/(dashboard)/project/[id]/page.tsx`                                                         | Sequential fetch of `stories` and `epics` after `project`                                                          | **HIGH**     | Sequential delay before streaming project workspace                                                 | Parallelize `stories` and `epics` queries with `Promise.all`                                                                   |
| **AUD-07** | Dashboard home page client-side fetch waterfall         | `app/(dashboard)/page.tsx`                                                                      | `"use client"` with `useEffect` fetching `/api/projects` on mount                                                  | **HIGH**     | Empty skeleton flash, extra client-server round-trip, extra auth check, delayed LCP                 | Convert `app/(dashboard)/page.tsx` to Server Component fetching data directly with bounded summary                             |
| **AUD-08** | In-memory text search and unbounded inbox items         | `app/api/inbox/route.ts`                                                                        | `.select("*, converted_project:projects(id, name)")` + in-memory JavaScript `.filter()`                            | **MEDIUM**   | Pulls large JSON/notes into Node.js memory; unbounded memory growth as ideas increase               | Push search to SQL `ilike`, bound query with `.limit(100)`, omit large unused note bodies on list view                         |
| **AUD-09** | Widespread `SELECT *` overfetching                      | `app/(dashboard)/project/[id]/page.tsx`, `app/client/page.tsx`, `app/team/page.tsx`, API routes | `.select("*")` on `stories`, `epics`, and `projects`                                                               | **MEDIUM**   | Transfers unused columns (`raw_requirement`, nested metadata) across network                        | Prune selects to only required UI fields                                                                                       |
| **AUD-10** | Unindexed 3-table join in Feedback RLS Policy           | `supabase/feedback_threads.sql`                                                                 | 3-table join in `owners can manage feedback messages` without index on `stories.project_id`                        | **MEDIUM**   | Slow thread message loading under multi-user feedback                                               | Add indexes on FKs; optimize RLS policy subquery caching                                                                       |
| **AUD-11** | Unbounded stories aggregation in `/api/projects`        | `app/api/projects/route.ts`                                                                     | Sequential fetch of all `stories` and all `epics` across all user projects into JS arrays                          | **MEDIUM**   | Heavy in-memory array looping; O(M\*N) story processing                                             | Parallelize stories & epics queries with `Promise.all`; add composite index on `(project_id, status)`                          |
| **AUD-12** | Client-side AI generation modal lacks request abort     | `components/GenerateStoriesModal.tsx`                                                           | Unbounded `fetch("/api/generate-stories")` without `AbortController`                                               | **LOW**      | Abandoned requests continue executing and inserting stories in background                           | Add `AbortController` to abort request if user closes modal or navigates away                                                  |

---

## Category-by-Category Deep Dive

### 1. Database & Schema Optimization (Supabase Free Tier)

- **Problem**: In PostgreSQL, foreign keys do NOT automatically create indexes on the referencing table. Thus:
  - `projects.owner_id`: queried by RLS and dashboard.
  - `stories.project_id`: queried by every project workspace, team portal, client portal, feedback count endpoint.
  - `stories.epic_id`: queried by epic filtering.
  - `clients.project_id`: queried by client lookups and RLS.
  - `story_comments.story_id` & `story_revisions.story_id`: queried by revision history and discussions.
- **Solution**: A consolidated migration file `supabase/performance_indexes.sql` creating targeted B-tree and composite indexes, matching exact `WHERE ... ORDER BY` access patterns.

### 2. RLS Security & InitPlan Caching

- **Problem**: When an RLS policy calls `auth.uid()` or a function `is_super_admin()`, PostgreSQL treats it as a volatile expression unless wrapped in `(select ...)`. In `profiles.sql`, `is_super_admin()` was called on every row without the `STABLE` keyword.
- **Solution**:
  - Re-declare `public.is_super_admin()` with `STABLE SECURITY DEFINER`.
  - Rewrite all RLS policies to use `(select auth.uid())` and `(select public.is_super_admin())`.
  - Scope policies `TO authenticated` where anonymous users are never permitted, preventing useless policy checks.

### 3. Authentication & Middleware Efficiency

- **Problem**: `middleware.ts` runs on every non-static path. For users accessing `/team/*` or `/client/*`, it still initiated Supabase Auth calls. For dashboard routes, `middleware.ts` validated the session and fetched profile, followed immediately by `layout.tsx` repeating both calls.
- **Solution**:
  - Early-exit `/team/*` and `/client/*` in `middleware.ts` before calling `supabase.auth.getUser()`.
  - Pass resolved user identity and role from `middleware.ts` to downstream server components using request headers (`x-user-id`, `x-user-email`, `x-user-role`, `x-user-name`).
  - In `app/(dashboard)/layout.tsx`, read from `headers()` first to avoid duplicate network & DB calls.

### 4. Query Parallelization

- **Problem**: Next.js server components and API endpoints used sequential `await` for independent data dependencies.
- **Solution**: Group independent queries into `Promise.all`:
  - Client portal: `[project, stories, epics]` in parallel.
  - Team portal: `[project, epics, stories]` in parallel.
  - Project page: `[stories, epics]` in parallel.
  - Projects API: `[stories, epics]` in parallel.

### 5. Payload & Column Pruning

- **Problem**: Excessive `select("*")` pulling `raw_requirement`, heavy JSON structures, and unneeded columns.
- **Solution**: Explicit column projection across API endpoints and server components.
