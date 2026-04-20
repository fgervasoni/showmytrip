import type { APIRoute } from 'astro';
import { STRAVA_TOKEN_COOKIE } from '../../../../lib/strava-auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
	cookies.delete(STRAVA_TOKEN_COOKIE, { path: '/' });
	return redirect('/');
};

