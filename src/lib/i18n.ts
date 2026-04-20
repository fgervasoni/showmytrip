export const LOCALE_COOKIE = 'smt_locale';
export const UNITS_COOKIE = 'smt_units';
export type Locale = 'en' | 'it';
export type Units = 'km' | 'mi';
export const DEFAULT_LOCALE: Locale = 'en';

const translations = {
	en: {
		// Hero
		heroTitle: 'ShowMyTrip',
		heroDescription: 'Connect your Strava account to see your animated run and key stats.',
		connectStrava: 'Connect Strava',
		// Dashboard header
		hello: 'Hi',
		runner: 'runner',
		avgPace: 'avg pace',
		notAvailable: 'not available',
		// Nav
		dashboard: 'Dashboard',
		summary: 'Summary',
		disconnect: 'Disconnect',
		// Stats cards
		distance: 'Distance',
		time: 'Time',
		pace: 'Pace',
		elevation: 'Elevation',
		kudos: 'Kudos',
		// Activity list
		recentActivities: 'Recent activities',
		noName: 'Unnamed activity',
		prev: '← Prev',
		next: 'Next →',
		page: 'Page',
		// Average stats
		totals: 'Totals',
		activities: 'Activities',
		averagesPerActivity: 'Averages per activity',
		heartRate: 'Heart rate',
		personalRecords: 'Personal records',
		longestRun: 'Longest run',
		bestPace: 'Best pace',
		mostElevation: 'Most elevation',
		longestDuration: 'Longest (time)',
		mostKudos: 'Most kudos',
		consistency: 'Consistency',
		weeklyAverage: 'Weekly average',
		currentStreak: 'Current streak',
		activeDays: 'Active days',
		day: 'day',
		days: 'days',
		actPerWeek: 'act/wk',
		bySport: 'By sport type',
		activitySummary: 'Activity summary',
		avgPaceLabel: 'Avg pace',
		// Period selector
		period7d: '7 days',
		period31d: '31 days',
		period3m: '3 months',
		period6m: '6 months',
		noActivitiesInPeriod: 'No activities found in this period.',
		loadingActivities: 'Loading activities…',
		loadingDashboard: 'Loading dashboard…',
		loadingSummary: 'Loading summary…',
		loadingPeriod: 'Loading selected period…',
		// Scene
		runAnimation: 'Run animation',
		// Settings
		language: 'Language',
		theme: 'Theme',
		units: 'Units',
	},
	it: {
		heroTitle: 'ShowMyTrip',
		heroDescription: 'Collega il tuo account Strava per vedere la tua corsa animata e le statistiche principali.',
		connectStrava: 'Collega Strava',
		hello: 'Ciao',
		runner: 'runner',
		avgPace: 'passo medio',
		notAvailable: 'non disponibile',
		dashboard: 'Dashboard',
		summary: 'Riepilogo',
		disconnect: 'Disconnetti',
		distance: 'Distanza',
		time: 'Tempo',
		pace: 'Passo',
		elevation: 'Dislivello',
		kudos: 'Kudos',
		recentActivities: 'Attività recenti',
		noName: 'Attività senza nome',
		prev: '← Prec',
		next: 'Succ →',
		page: 'Pagina',
		totals: 'Totali',
		activities: 'Attività',
		averagesPerActivity: 'Medie per attività',
		heartRate: 'Freq. cardiaca',
		personalRecords: 'Record personali',
		longestRun: 'Corsa più lunga',
		bestPace: 'Miglior passo',
		mostElevation: 'Più dislivello',
		longestDuration: 'Più lunga (tempo)',
		mostKudos: 'Più kudos',
		consistency: 'Costanza',
		weeklyAverage: 'Media settimanale',
		currentStreak: 'Streak attuale',
		activeDays: 'Giorni attivi',
		day: 'giorno',
		days: 'giorni',
		actPerWeek: 'att/sett',
		bySport: 'Per tipo di sport',
		activitySummary: 'Riepilogo delle tue attività',
		avgPaceLabel: 'Passo medio',
		// Period selector
		period7d: '7 giorni',
		period31d: '31 giorni',
		period3m: '3 mesi',
		period6m: '6 mesi',
		noActivitiesInPeriod: 'Nessuna attività trovata in questo periodo.',
		loadingActivities: 'Caricamento attività…',
		loadingDashboard: 'Caricamento dashboard…',
		loadingSummary: 'Caricamento riepilogo…',
		loadingPeriod: 'Caricamento periodo selezionato…',
		runAnimation: 'Animazione corsa',
		language: 'Lingua',
		theme: 'Tema',
		units: 'Unità',
	},
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey): string {
	return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

export function getLocale(cookieValue?: string): Locale {
	if (cookieValue === 'it' || cookieValue === 'en') return cookieValue;
	return DEFAULT_LOCALE;
}

export function getUnits(cookieValue?: string): Units {
	if (cookieValue === 'mi') return 'mi';
	return 'km';
}





