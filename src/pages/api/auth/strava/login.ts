import type { APIRoute } from 'astro';
import {
	buildStravaAuthorizeUrl,
	createOAuthState,
	getMissingEnvVars,
	getStravaEnv,
	STRAVA_OAUTH_STATE_COOKIE,
} from '../../../../lib/strava-auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
	const stravaEnv = getStravaEnv(import.meta.env);
	const missingEnvVars = getMissingEnvVars(stravaEnv);

	if (missingEnvVars.length > 0) {
		return new Response(
			`Config mancante. Imposta queste variabili ambiente: ${missingEnvVars.join(', ')}`,
			{ status: 500 },
		);
	}

	const state = createOAuthState();
	cookies.set(STRAVA_OAUTH_STATE_COOKIE, state, {
		httpOnly: true,
		secure: import.meta.env.PROD,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 10,
	});

	const authorizeUrl = buildStravaAuthorizeUrl(stravaEnv, state);
	return redirect(authorizeUrl);
};

