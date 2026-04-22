import type {RunActivity, Units} from '../types';

export type {RunActivity, Units};

const KM_TO_MI = 0.621371;

export function formatDistance(distanceMeters?: number, units: Units = 'km'): string {
    if (!distanceMeters) {
        return '-';
    }
    const km = distanceMeters / 1000;
    if (units === 'mi') {
        return `${(km * KM_TO_MI).toFixed(2)} mi`;
    }
    return `${km.toFixed(2)} km`;
}

export function formatDuration(seconds?: number): string {
    if (!seconds) {
        return '-';
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatPace(distanceMeters?: number, movingTime?: number, units: Units = 'km'): string {
    if (!distanceMeters || !movingTime) {
        return '-';
    }
    const km = distanceMeters / 1000;
    const dist = units === 'mi' ? km * KM_TO_MI : km;
    const paceSecPerUnit = movingTime / dist;
    const min = Math.floor(paceSecPerUnit / 60);
    const sec = Math.round(paceSecPerUnit % 60);
    return `${min}:${sec.toString().padStart(2, '0')} /${units}`;
}

export function formatSpeed(speed?: number): string {
    if (!speed) {
        return '-';
    }
    return `${(speed * 3.6).toFixed(1)} km/h`;
}

export function formatDate(value?: string): string {
    if (!value) {
        return '-';
    }
    return new Date(value).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function getRoadAngle(activity?: RunActivity): number {
    if (!activity?.distance || !activity?.total_elevation_gain || activity.distance <= 0) {
        return 0;
    }
    const gradePercent = (activity.total_elevation_gain / activity.distance) * 100;
    // Amplify heavily: 1% grade ≈ 5° visual slope (max 35°)
    const angle = gradePercent * 5;
    return Math.max(0, Math.min(35, angle));
}


