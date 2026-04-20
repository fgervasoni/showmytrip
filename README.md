# ShowMyTrip

ShowMyTrip is an Astro web app that connects to Strava and displays your running data in a clean dashboard with an animated run scene, key metrics, and period-based summaries.

## Features

- Strava OAuth login/logout flow
- Dashboard with recent activities and quick stats
- Animated run scene synced with selected activity pace/profile
- Summary page with aggregates for 7, 31, 90, and 180 days
- Language switcher (`en` / `it`)
- Unit switcher (`km` / `mi`)
- Theme switcher (`light` / `dark` / `system`)

## Tech Stack

- Astro (server output)
- TypeScript
- Tailwind CSS
- Node adapter (`@astrojs/node`, standalone mode)

## Requirements

- Node.js `>=22.12.0`
- npm
- A Strava API application (for OAuth credentials)

## Environment Variables

Create a `.env` file in the project root with:

```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=http://localhost:4321/api/auth/strava/callback
```

Notes:
- `STRAVA_REDIRECT_URI` must match the callback URL configured in your Strava app.
- In production, set the production callback URL and use secure deployment settings.

## Getting Started

```bash
npm install
npm run dev
```

App is available at `http://localhost:4321`.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run astro -- --help
```

## Main Routes

- `/` - Dashboard (or Strava connect hero when not authenticated)
- `/summary` - Aggregated activity summary by selected period
- `/activities` - Activity-focused page
- `/api/activities` - Paginated activities proxy endpoint
- `/api/auth/strava/login` - Starts Strava OAuth flow
- `/api/auth/strava/callback` - OAuth callback endpoint
- `/api/auth/strava/logout` - Clears auth cookie

## Project Structure

```text
showMyTrip/
|- public/
|- src/
|  |- components/
|  |  |- dashboard/
|  |- layouts/
|  |- lib/
|  |- pages/
|  |  |- api/
|  |- scripts/
|  |- styles/
|- astro.config.mjs
|- package.json
```

## Authentication and Data Notes

- Strava access token is stored in an HTTP-only cookie.
- Locale and units preferences are stored in cookies.
- Theme preference is stored in localStorage.
- Strava dashboard/summary data is cached in-memory server-side for short periods.

## Build for Production

```bash
npm run build
npm run preview
```

This project is configured with Astro server output and Node adapter standalone mode.
