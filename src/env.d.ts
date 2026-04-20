/// <reference types="astro/client" />

interface ImportMetaEnv {
	readonly STRAVA_CLIENT_ID: string;
	readonly STRAVA_CLIENT_SECRET: string;
	readonly STRAVA_REDIRECT_URI: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

