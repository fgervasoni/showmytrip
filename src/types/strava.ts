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

