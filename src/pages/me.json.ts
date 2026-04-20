import type { APIRoute } from 'astro';
import { getStravaAthleteData } from '../lib/strava-data';
import { STRAVA_TOKEN_COOKIE } from '../lib/strava-auth';

export const GET: APIRoute = async ({ cookies }) => {
	const accessToken = cookies.get(STRAVA_TOKEN_COOKIE)?.value;

	if (!accessToken) {
		return new Response(
			JSON.stringify(
				{
					error: 'not_authenticated',
					message: 'Autenticazione Strava non trovata. Esegui prima il login.',
				},
				null,
				2,
			),
			{
				status: 401,
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
			},
		);
	}

	const payload = await getStravaAthleteData(accessToken);
	return new Response(JSON.stringify(payload, null, 2), {
		headers: { 'Content-Type': 'application/json; charset=utf-8' },
	});
};

