import type {APIRoute} from 'astro';
import {STRAVA_TOKEN_COOKIE} from '../../lib/strava-auth.ts';

const STRAVA_API = 'https://www.strava.com/api/v3';

export const GET: APIRoute = async ({cookies, url}) => {
    const accessToken = cookies.get(STRAVA_TOKEN_COOKIE)?.value;
    if (!accessToken) {
        return new Response(JSON.stringify({error: 'Unauthorized'}), {
            status: 401,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') ?? '5')));

    const response = await fetch(
        `${STRAVA_API}/athlete/activities?page=${page}&per_page=${perPage}`,
        {headers: {Authorization: `Bearer ${accessToken}`}},
    );

    if (!response.ok) {
        const msg = await response.text();
        console.error(`[api/activities] Strava error ${response.status}:`, msg);
        return new Response(JSON.stringify({error: `Strava error: ${response.status}`}), {
            status: response.status,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const activities = await response.json();
    return new Response(JSON.stringify(activities), {
        headers: {'Content-Type': 'application/json'},
    });
};

