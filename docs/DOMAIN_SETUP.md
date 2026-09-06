# Domain Setup Guide

StoryBoard uses hostname-based routing to serve two distinct applications from a single Next.js codebase and a single Vercel deployment:

1. **Freelancer Dashboard**: `storyboard.com`
2. **Client Portal**: `storyboard-client.com`

## Local Development Setup

To test both domains locally, the application recognizes specific local hostnames:

- **Freelancer**: `localhost:3000`
- **Client**: `client.localhost:3000`

### Accessing Locally
Modern browsers (Chrome, Edge, Firefox) automatically resolve `*.localhost` to `127.0.0.1`. You do not need to modify your hosts file.

Simply start your dev server (`npm run dev`) and visit:
- [http://localhost:3000](http://localhost:3000) for the Freelancer app.
- [http://client.localhost:3000](http://client.localhost:3000) for the Client Portal.

*(Note: If you are using Safari, you may need to add `127.0.0.1 client.localhost` to your `/etc/hosts` file).*

## Production Vercel Setup

**Do NOT create a second Vercel project.** Both domains point to the exact same deployment.

1. Go to your existing Vercel project settings.
2. Navigate to **Domains**.
3. Add `storyboard.com` (or your actual freelancer domain).
4. Add `storyboard-client.com` (or your actual client domain).
5. Configure your DNS provider (e.g., Cloudflare, Namecheap) to point both domains to Vercel's nameservers or CNAME records as instructed by Vercel.

## Environment Variables

For production, you must set these environment variables in Vercel to tell the application which domain is which:

```env
NEXT_PUBLIC_FREELANCER_DOMAIN=storyboard.com
NEXT_PUBLIC_CLIENT_DOMAIN=storyboard-client.com
```

If these are not set, the app will fall back to `localhost` and `client.localhost`.

## How it works
The routing is handled at the edge in `middleware.ts`. When a request comes in on the client domain, Next.js internally rewrites paths like `/login` to `/client/login`. The browser URL remains clean, and cross-domain access is blocked via 404s.
