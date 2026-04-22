const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

type StravaEndpointResult = {
    data: unknown | null;
    error: string | null;
};

type CacheEntry = {
    data: Record<string, unknown>;
    timestamp: number;
};

const cache = new Map<string, CacheEntry>();

async function fetchStravaEndpoint(path: string, accessToken: string): Promise<StravaEndpointResult> {
    const response = await fetch(`${STRAVA_API_BASE_URL}${path}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const message = await response.text();
        return {
            data: null,
            error: `HTTP ${response.status} on ${path}: ${message}`,
        };
    }

    return {
        data: (await response.json()) as unknown,
        error: null,
    };
}

function getAthleteId(athlete: unknown): number | null {
    if (!athlete || typeof athlete !== 'object' || !('id' in athlete)) {
        return null;
    }

    const maybeId = (athlete as { id: unknown }).id;
    return typeof maybeId === 'number' ? maybeId : null;
}

async function fetchAllActivities(accessToken: string, afterTimestamp: number): Promise<StravaEndpointResult> {
    const perPage = 100;
    let page = 1;
    const allActivities: unknown[] = [];

    while (true) {
        const result = await fetchStravaEndpoint(
            `/athlete/activities?per_page=${perPage}&page=${page}&after=${afterTimestamp}`,
            accessToken,
        );
        if (result.error) return result;
        const batch = result.data as unknown[];
        if (!Array.isArray(batch) || batch.length === 0) break;
        allActivities.push(...batch);
        if (batch.length < perPage) break;
        page++;
    }

    return { data: allActivities, error: null };
}

export async function getStravaDashboardData(accessToken: string): Promise<Record<string, unknown>> {
    const cacheKey = `dashboard:${accessToken}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const athleteResult = await fetchStravaEndpoint('/athlete', accessToken);
    const activitiesResult = await fetchStravaEndpoint('/athlete/activities?per_page=5&page=1', accessToken);

    if (activitiesResult.error) console.error('[strava-data] activities (dashboard):', activitiesResult.error);
    if (athleteResult.error) console.error('[strava-data] athlete:', athleteResult.error);

    const result: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        athlete: athleteResult.data,
        recentActivities: activitiesResult.data,
        errors: {
            athlete: athleteResult.error,
            recentActivities: activitiesResult.error,
        },
    };

    cache.set(cacheKey, {data: result, timestamp: Date.now()});
    return result;
}

export async function getStravaAthleteData(accessToken: string, days = 7): Promise<Record<string, unknown>> {
    const afterTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const cacheKey = `athlete:${accessToken}:${days}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }

    const athleteResult = await fetchStravaEndpoint('/athlete', accessToken);
    const athleteId = getAthleteId(athleteResult.data);

    const [statsResult, activitiesResult] = await Promise.all([
        athleteId
            ? fetchStravaEndpoint(`/athletes/${athleteId}/stats`, accessToken)
            : Promise.resolve({
                data: null,
                error: 'Impossibile recuperare stats: id atleta non disponibile.',
            }),
        fetchAllActivities(accessToken, afterTimestamp),
    ]);

    const errors = {
        athlete: athleteResult.error,
        stats: statsResult.error,
        recentActivities: activitiesResult.error,
    };

    // Log errors to console for debugging
    Object.entries(errors).forEach(([key, err]) => {
        if (err) console.error(`[strava-data] ${key}:`, err);
    });

    const result: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        athlete: athleteResult.data,
        stats: statsResult.data,
        recentActivities: activitiesResult.data,
        errors,
    };

    // Store in cache
    cache.set(cacheKey, {data: result, timestamp: Date.now()});

    return result;
}
