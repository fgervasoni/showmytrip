import type {APIRoute} from 'astro';
import {STRAVA_TOKEN_COOKIE} from '../../../lib/strava-auth';

const STRAVA_API = 'https://www.strava.com/api/v3';

export const GET: APIRoute = async ({cookies, params}) => {
    const accessToken = cookies.get(STRAVA_TOKEN_COOKIE)?.value;
    if (!accessToken) {
        return new Response(JSON.stringify({error: 'Unauthorized'}), {
            status: 401,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({error: 'Missing activity id'}), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const response = await fetch(
        `${STRAVA_API}/activities/${id}?include_all_efforts=false`,
        {headers: {Authorization: `Bearer ${accessToken}`}},
    );

    if (!response.ok) {
        const msg = await response.text();
        console.error(`[api/activities/${id}] Strava error ${response.status}:`, msg);
        return new Response(JSON.stringify({error: `Strava error: ${response.status}`}), {
            status: response.status,
            headers: {'Content-Type': 'application/json'},
        });
    }

    const activity = await response.json() as Record<string, unknown>;

    // Return only splits data
    return new Response(JSON.stringify({
        id: activity.id,
        name: activity.name,
        splits_metric: activity.splits_metric ?? [],
    }), {
        headers: {'Content-Type': 'application/json'},
    });
};

