const STRAVA_AUTH_BASE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export const STRAVA_TOKEN_COOKIE = 'strava_access_token';
export const STRAVA_OAUTH_STATE_COOKIE = 'strava_oauth_state';

export type StravaEnv = {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
};

export type StravaTokenResponse = {
	token_type: string;
	expires_at: number;
	expires_in: number;
	refresh_token: string;
	access_token: string;
	athlete?: {
		id: number;
		username?: string | null;
	};
};

export function getStravaEnv(env?: ImportMetaEnv): StravaEnv {
	return {
		clientId: process.env.STRAVA_CLIENT_ID ?? env?.STRAVA_CLIENT_ID ?? '',
		clientSecret: process.env.STRAVA_CLIENT_SECRET ?? env?.STRAVA_CLIENT_SECRET ?? '',
		redirectUri: process.env.STRAVA_REDIRECT_URI ?? env?.STRAVA_REDIRECT_URI ?? '',
	};
}

export function getMissingEnvVars(stravaEnv: StravaEnv): string[] {
	const missing: string[] = [];

	if (!stravaEnv.clientId) {
		missing.push('STRAVA_CLIENT_ID');
	}
	if (!stravaEnv.clientSecret) {
		missing.push('STRAVA_CLIENT_SECRET');
	}
	if (!stravaEnv.redirectUri) {
		missing.push('STRAVA_REDIRECT_URI');
	}

	return missing;
}

export function createOAuthState(): string {
	return crypto.randomUUID();
}

export function buildStravaAuthorizeUrl(stravaEnv: StravaEnv, state: string): string {
	const params = new URLSearchParams({
		client_id: stravaEnv.clientId,
		response_type: 'code',
		redirect_uri: stravaEnv.redirectUri,
		approval_prompt: 'auto',
		scope: 'read,activity:read_all',
		state,
	});

	return `${STRAVA_AUTH_BASE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
	code: string,
	stravaEnv: StravaEnv,
): Promise<StravaTokenResponse> {
	const response = await fetch(STRAVA_TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			client_id: stravaEnv.clientId,
			client_secret: stravaEnv.clientSecret,
			code,
			grant_type: 'authorization_code',
		}),
	});

	if (!response.ok) {
		const message = await response.text();
		throw new Error(`Strava token exchange failed (${response.status}): ${message}`);
	}

	return (await response.json()) as StravaTokenResponse;
}

