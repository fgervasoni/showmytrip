export type RunActivity = {
    id?: number;
    name?: string;
    type?: string;
    distance?: number;
    moving_time?: number;
    average_speed?: number;
    max_speed?: number;
    total_elevation_gain?: number;
    kudos_count?: number;
    average_heartrate?: number;
    max_heartrate?: number;
    start_date?: string;
};

export type Units = 'km' | 'mi';

