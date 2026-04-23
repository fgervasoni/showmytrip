const STRAVA_API_BASE_URL = 'https://www.strava.com/api/v3';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

type StravaEndpointResult = {
    data: unknown | null;
    error: string | null;
    rateLimited?: boolean;
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
            rateLimited: response.status === 429,
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

// Fetch best_efforts from the top N activities by pace (for run activities > 1km)
type BestEffort = {
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    start_date: string;
    activity_id: number;
    activity_name?: string;
    average_heartrate?: number;
};

async function fetchBestEfforts(
    allActivities: unknown[],
    accessToken: string,
    maxDetailFetches = 25,
): Promise<BestEffort[]> {
    if (!Array.isArray(allActivities)) return [];

    // Filter run activities with distance > 1km
    const runActivities = (allActivities as Record<string, unknown>[])
        .filter((a) =>
            (a.type === 'Run' || a.type === 'VirtualRun') &&
            typeof a.distance === 'number' && a.distance > 1000 &&
            typeof a.moving_time === 'number' && a.moving_time > 0
        );

    // Build a diverse set: fastest by pace per distance bucket
    // Use granular buckets to ensure coverage for 1k, 5k, 10k etc.
    const distanceBuckets = [1500, 3000, 5000, 8000, 10000, 15000, 21100, 30000, 42200, 50000];
    const selected = new Map<number, Record<string, unknown>>();

    // For each bucket, find activities that are at least that distance, sorted by pace
    for (const bucket of distanceBuckets) {
        const candidates = runActivities
            .filter((a) => (a.distance as number) >= bucket * 0.9)
            .sort((a, b) => {
                const paceA = (a.moving_time as number) / (a.distance as number);
                const paceB = (b.moving_time as number) / (b.distance as number);
                return paceA - paceB;
            });
        // Take the top 2 fastest for this bucket
        for (const c of candidates.slice(0, 2)) {
            selected.set(c.id as number, c);
        }
    }

    // Also add the overall fastest by pace (for short distances like 400m, 800m, 1k)
    const byPace = [...runActivities].sort((a, b) => {
        const paceA = (a.moving_time as number) / (a.distance as number);
        const paceB = (b.moving_time as number) / (b.distance as number);
        return paceA - paceB;
    });
    for (const a of byPace.slice(0, 5)) {
        selected.set(a.id as number, a);
    }

    // Add longest runs (they cover all distance best efforts)
    const byDistance = [...runActivities].sort((a, b) =>
        (b.distance as number) - (a.distance as number)
    );
    for (const a of byDistance.slice(0, 3)) {
        selected.set(a.id as number, a);
    }

    // Limit total fetches
    const topActivities = [...selected.values()].slice(0, maxDetailFetches);

    // Fetch details in parallel (limited batch)
    const detailResults = await Promise.all(
        topActivities.map((a) =>
            fetchStravaEndpoint(`/activities/${a.id}?include_all_efforts=true`, accessToken)
        )
    );

    const allBestEfforts: BestEffort[] = [];

    console.log(`[strava-data] Fetched ${detailResults.filter(r => !r.error && r.data).length}/${topActivities.length} activity details for best efforts`);

    for (const result of detailResults) {
        if (result.error || !result.data) continue;
        const detail = result.data as Record<string, unknown>;
        const efforts = detail.best_efforts as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(efforts)) continue;

        for (const effort of efforts) {
            allBestEfforts.push({
                name: String(effort.name ?? ''),
                distance: Number(effort.distance ?? 0),
                moving_time: Number(effort.moving_time ?? 0),
                elapsed_time: Number(effort.elapsed_time ?? 0),
                start_date: String(effort.start_date ?? ''),
                activity_id: Number(detail.id ?? 0),
                activity_name: String(detail.name ?? ''),
                average_heartrate: typeof effort.average_heartrate === 'number' ? effort.average_heartrate : undefined,
            });
        }
    }

    // Log unique effort names for debugging
    const uniqueNames = [...new Set(allBestEfforts.map(e => e.name))];
    console.log(`[strava-data] Best effort names found: ${uniqueNames.join(', ')}`);

    return allBestEfforts;
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

    const [statsResult, activitiesResult, zonesResult, allActivitiesResult] = await Promise.all([
        athleteId
            ? fetchStravaEndpoint(`/athletes/${athleteId}/stats`, accessToken)
            : Promise.resolve({
                data: null,
                error: 'Impossibile recuperare stats: id atleta non disponibile.',
            }),
        fetchAllActivities(accessToken, afterTimestamp),
        fetchStravaEndpoint('/athlete/zones', accessToken),
        fetchAllActivities(accessToken, 0),
    ]);

    const errors = {
        athlete: athleteResult.error,
        stats: statsResult.error,
        recentActivities: activitiesResult.error,
        zones: zonesResult.error,
        allActivities: allActivitiesResult.error,
    };

    // Fetch best efforts from top activities by pace (skip if rate limited)
    const allActs = Array.isArray(allActivitiesResult.data) ? allActivitiesResult.data as unknown[] : [];
    const earlyRateLimited = [athleteResult, statsResult, activitiesResult, zonesResult, allActivitiesResult]
        .some(r => r.rateLimited);
    let bestEfforts: BestEffort[] = [];
    if (!earlyRateLimited) {
        try {
            bestEfforts = await fetchBestEfforts(allActs, accessToken);
        } catch (e) {
            console.error('[strava-data] bestEfforts:', e);
        }
    }

    // Log errors to console for debugging
    Object.entries(errors).forEach(([key, err]) => {
        if (err) console.error(`[strava-data] ${key}:`, err);
    });

    // Detect rate limiting
    const rateLimited = [athleteResult, statsResult, activitiesResult, zonesResult, allActivitiesResult]
        .some(r => r.rateLimited);

    const result: Record<string, unknown> = {
        generatedAt: new Date().toISOString(),
        athlete: athleteResult.data,
        stats: statsResult.data,
        recentActivities: activitiesResult.data,
        allActivities: allActivitiesResult.data,
        bestEfforts,
        zones: zonesResult.data,
        rateLimited,
        errors,
    };

    // Store in cache
    cache.set(cacheKey, {data: result, timestamp: Date.now()});

    return result;
}
