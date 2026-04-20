import type { APIRoute } from 'astro';
import {
	exchangeCodeForToken,
	getMissingEnvVars,
	getStravaEnv,
	STRAVA_OAUTH_STATE_COOKIE,
	STRAVA_TOKEN_COOKIE,
} from '../../../../lib/strava-auth';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
	const state = url.searchParams.get('state');
	const code = url.searchParams.get('code');
	const error = url.searchParams.get('error');
	const storedState = cookies.get(STRAVA_OAUTH_STATE_COOKIE)?.value;

	if (error) {
		return redirect(`/?authError=${encodeURIComponent(error)}`);
	}

	if (!code || !state || !storedState || state !== storedState) {
		return new Response('OAuth state non valido oppure codice assente.', { status: 400 });
	}

	const stravaEnv = getStravaEnv(import.meta.env);
	const missingEnvVars = getMissingEnvVars(stravaEnv);
	if (missingEnvVars.length > 0) {
		return new Response(
			`Config mancante. Imposta queste variabili ambiente: ${missingEnvVars.join(', ')}`,
			{ status: 500 },
		);
	}

	try {
		const tokenPayload = await exchangeCodeForToken(code, stravaEnv);

		cookies.set(STRAVA_TOKEN_COOKIE, tokenPayload.access_token, {
			httpOnly: true,
			secure: import.meta.env.PROD,
			sameSite: 'lax',
			path: '/',
			maxAge: tokenPayload.expires_in,
		});
	} catch {
		return redirect('/?authError=token_exchange_failed');
	} finally {
		cookies.delete(STRAVA_OAUTH_STATE_COOKIE, { path: '/' });
	}

	return redirect('/');
};

