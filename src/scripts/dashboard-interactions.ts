import gsap from 'gsap';
import {
    formatDate, formatDistance, formatDuration, formatPace, formatSpeed,
    getRoadAngle, getRunnerLiftPx, type RunActivity, type Units,
} from '../lib/run-helpers';
import {
    type SceneState, type FlagData, type ScrollElement, type BirdData,
    type MountainLayer, type GrassTuft, type FlowerData, type RoadPoint,
    clamp,
} from './scene/scene-types';
import { SEGMENT_WIDTH, initRoad, renderRoad, getLocalSlope, generateNextY } from './scene/scene-road';
import { positionRunner } from './scene/scene-runner';
import { applySkyColors, updateCelestial, isNightTime } from './scene/scene-sky';
import { initMountains, updateMountains } from './scene/scene-mountains';
import { scheduleBird, updateBirds } from './scene/scene-birds';
import { LAYER_RATIOS, renderScrollElements } from './scene/scene-clouds';
import { updateGrass, updateFlowers } from './scene/scene-vegetation';
import { createFlag, positionFlags } from './scene/scene-flags';

function initDashboard() {
    if ((window as any).__showMyTripCleanup) {
        (window as any).__showMyTripCleanup();
        (window as any).__showMyTripCleanup = null;
    }

    const sceneCheck = document.querySelector('.scene-wrapper');
    const listCheck = document.getElementById('activities-list');
    if (!sceneCheck && !listCheck) return;

    let alive = true;
    const timers: number[] = [];
    const safeTimeout = (fn: () => void, ms: number) => {
        const id = window.setTimeout(() => { if (alive) fn(); }, ms);
        timers.push(id);
        return id;
    };

    const flagTooltip = document.createElement('div');
    flagTooltip.className = 'scene-flag-tooltip';
    document.body.appendChild(flagTooltip);

    const gsapTargets: (Element | object)[] = [];
    const gsapTo = (target: any, vars: gsap.TweenVars): gsap.core.Tween => {
        gsapTargets.push(target);
        return gsap.to(target, vars);
    };

    (window as any).__showMyTripCleanup = () => {
        alive = false;
        timers.forEach((id) => clearTimeout(id));
        gsapTargets.forEach((t) => gsap.killTweensOf(t));
        gsapTargets.length = 0;
        flagTooltip.remove();
    };

    let selectActivity: (btn: Element) => void = () => {};

    // --- DOM ---
    const sceneWrapper = document.querySelector('.scene-wrapper') as HTMLElement | null;
    const runnerGif = document.getElementById('runner-gif') as HTMLImageElement | null;
    const roadPolyline = document.getElementById('road-path') as SVGPolylineElement | null;
    const skyFill = document.getElementById('sky-fill') as SVGPolygonElement | null;
    const groundFill = document.getElementById('ground-fill') as SVGPolygonElement | null;
    const roadSvg = document.querySelector('.road-svg') as SVGSVGElement | null;
    const rocksContainer = document.getElementById('scrolling-elements') as HTMLElement | null;
    const activityButtons = Array.from(document.querySelectorAll('.activity-item'));
    const selectedRunName = document.getElementById('selected-run-name');
    const selectedRunPace = document.getElementById('selected-run-pace');
    const metricDistance = document.getElementById('metric-distance');
    const metricDuration = document.getElementById('metric-duration');
    const metricPace = document.getElementById('metric-pace');
    const metricElevation = document.getElementById('metric-elevation');
    const metricKudos = document.getElementById('metric-kudos');

    if (sceneWrapper && runnerGif && roadPolyline && roadSvg) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const state: SceneState = {
            alive: true, roadOffsetX: 0,
            currentSpeed: Number(sceneWrapper.dataset.speed ?? '2.5'),
            currentAngle: Number(sceneWrapper.dataset.angle ?? '0'),
            currentElevation: 0, currentHour: 12,
            baseScrollSpeed: 0, speedMultiplier: 1,
            runnerXRatio: 0.32, runnerXTarget: 0.32,
            runnerBobY: 0, runnerBobTargetY: 0,
            runnerBobX: 0, runnerBobTargetX: 0,
            lastY: 320, direction: -1,
            vegetationStartX: -Infinity, lastTime: 0,
        };

        const roadPoints: RoadPoint[] = [];
        const flags: FlagData[] = [];
        const scrollElements: ScrollElement[] = [];
        const birds: BirdData[] = [];
        const mountainLayers: MountainLayer[] = [];
        const grassTufts: GrassTuft[] = [];
        const flowers: FlowerData[] = [];
        const layerNextX = [-200, -200, -200];
        const grassNextX = { value: -100 };
        const flowerNextX = { value: -50 };

        const mountainsContainer = document.getElementById('mountains-container') as HTMLElement | null;
        const birdsContainer = document.getElementById('birds-container') as HTMLElement | null;
        const grassContainer = document.getElementById('grass-container') as HTMLElement | null;
        const celestialBody = document.getElementById('celestial-body') as HTMLElement | null;
        const skySvg = document.querySelector('.sky-svg') as SVGSVGElement | null;
        const skyGradientStops = skySvg?.querySelectorAll('#sky-gradient stop') as NodeListOf<SVGStopElement> ?? [];

        const updateScrollSpeed = (): void => {
            const safeSpeed = state.currentSpeed > 0 ? state.currentSpeed : 2.5;
            state.baseScrollSpeed = 60;
            state.speedMultiplier = clamp(safeSpeed / 3.5, 0.5, 2.0);
        };

        const showFlagTooltip = (name: string, flagEl: HTMLElement): void => {
            flagTooltip.textContent = name;
            const fr = flagEl.getBoundingClientRect();
            flagTooltip.style.top = `${fr.top - 32}px`;
            flagTooltip.style.left = `${fr.left + fr.width / 2}px`;
            flagTooltip.style.transform = 'translateX(-50%)';
            flagTooltip.classList.add('visible');
        };
        const hideFlagTooltip = (): void => { flagTooltip.classList.remove('visible'); };

        const setMetrics = (btn: Element): void => {
            const get = (attr: string) => btn.getAttribute(attr) ?? '-';
            const animateMetric = (el: HTMLElement | null, value: string): void => {
                if (!el) return;
                gsapTo(el, {
                    opacity: 0, y: -8, duration: 0.15, ease: 'power2.in',
                    onComplete() {
                        el.textContent = value;
                        gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
                    },
                });
            };
            if (selectedRunName) selectedRunName.textContent = get('data-activity-name');
            if (selectedRunPace) selectedRunPace.textContent = get('data-activity-pace');
            animateMetric(metricDistance, get('data-activity-distance'));
            animateMetric(metricDuration, get('data-activity-duration'));
            animateMetric(metricPace, get('data-activity-pace'));
            animateMetric(metricElevation, get('data-activity-elevation'));
            animateMetric(metricKudos, get('data-activity-kudos'));
        };

        // --- Animation loop ---
        const tick = (timestamp: number): void => {
            if (!alive) return;
            if (!state.lastTime) state.lastTime = timestamp;
            const dt = (timestamp - state.lastTime) / 1000;
            state.lastTime = timestamp;

            const slope = getLocalSlope(roadPoints, state);
            const slopeFactor = clamp(1 - slope * 1.2, 0.25, 2.0);
            state.roadOffsetX += state.baseScrollSpeed * slopeFactor * state.speedMultiplier * dt;

            const rightEdge = state.roadOffsetX + 1000 + SEGMENT_WIDTH * 2;
            while (roadPoints.length > 0 && roadPoints[roadPoints.length - 1].x < rightEdge) {
                const lastPt = roadPoints[roadPoints.length - 1];
                roadPoints.push({ x: lastPt.x + SEGMENT_WIDTH, y: generateNextY(state) });
            }
            while (roadPoints.length > 2 && roadPoints[0].x < state.roadOffsetX - SEGMENT_WIDTH * 2) {
                roadPoints.shift();
            }

            state.runnerBobY += (state.runnerBobTargetY - state.runnerBobY) * 0.06;
            state.runnerBobX += (state.runnerBobTargetX - state.runnerBobX) * 0.04;
            state.runnerXRatio += (state.runnerXTarget - state.runnerXRatio) * 0.001;

            renderRoad(roadPoints, state, roadPolyline, skyFill, groundFill);
            renderScrollElements(scrollElements, layerNextX, rocksContainer, roadPoints, roadSvg, sceneWrapper, state);
            updateMountains(mountainLayers, state.roadOffsetX);
            updateBirds(birds, dt);
            updateGrass(grassTufts, grassNextX, grassContainer, roadPoints, roadSvg, sceneWrapper, state);
            updateFlowers(flowers, flowerNextX, grassContainer, roadPoints, roadSvg, sceneWrapper, state);
            positionRunner(state, roadPoints, roadSvg, sceneWrapper, runnerGif);
            positionFlags(flags, scrollElements, roadPoints, roadSvg, sceneWrapper, state, skyGradientStops, celestialBody, gsapTo);

            if (alive) requestAnimationFrame(tick);
        };

        const scheduleBob = (): void => {
            if (!alive) return;
            state.runnerBobTargetY = (Math.random() - 0.5) * 8;
            state.runnerBobTargetX = (Math.random() - 0.5) * 12;
            safeTimeout(scheduleBob, 600 + Math.random() * 1800);
        };

        const scheduleSurprise = (): void => {
            if (!alive) return;
            const type = Math.random();
            if (type < 0.3) {
                gsapTo({ v: 0 }, {
                    v: 1, duration: 0.35, ease: 'power2.out',
                    onUpdate() { state.runnerBobTargetY = -16 * (1 - Math.abs(this.progress() * 2 - 1)); },
                });
            } else if (type < 0.6) {
                const origSpeed = state.baseScrollSpeed;
                gsapTo({ v: 0 }, {
                    v: 1, duration: 1.2, ease: 'power2.inOut',
                    onUpdate() { state.baseScrollSpeed = origSpeed * (1 + 0.6 * Math.sin(this.progress() * Math.PI)); },
                    onComplete() { updateScrollSpeed(); },
                });
            } else {
                state.runnerBobTargetX = (Math.random() - 0.5) * 25;
            }
            safeTimeout(scheduleSurprise, 3000 + Math.random() * 5000);
        };

        const scheduleRunnerDrift = (): void => {
            if (!alive) return;
            state.runnerXTarget = Math.random() < 0.5 ? 0.38 + Math.random() * 0.17 : 0.22 + Math.random() * 0.10;
            safeTimeout(scheduleRunnerDrift, 4000 + Math.random() * 8000);
        };

        // --- Activity selection ---
        selectActivity = (btn: Element): void => {
            const speed = Number(btn.getAttribute('data-activity-speed') ?? '2.5');
            const angle = Number(btn.getAttribute('data-activity-road-angle') ?? '0');
            const elevation = Number(btn.getAttribute('data-activity-elevation-raw') ?? '0');
            const hour = Number(btn.getAttribute('data-activity-start-hour') ?? '12');

            setMetrics(btn);
            state.currentAngle = angle;
            sceneWrapper.dataset.angle = String(state.currentAngle);

            const wasHighElev = state.currentElevation >= 500;
            const newHighElev = elevation >= 500;
            state.currentElevation = elevation;
            const flagWorldX = state.roadOffsetX + 1100;
            if (!wasHighElev && newHighElev) state.vegetationStartX = flagWorldX;
            else if (wasHighElev && !newHighElev) state.vegetationStartX = Infinity;

            const activityName = btn.getAttribute('data-activity-name') ?? '';
            const el = createFlag(activityName, flagWorldX, sceneWrapper, showFlagTooltip, hideFlagTooltip);
            flags.push({
                el, worldX: flagWorldX, name: activityName,
                pendingSpeed: speed > 0 ? speed : 2.5,
                pendingAngle: angle, pendingElevation: elevation, pendingHour: hour, applied: false,
            });

            const allVisible = Array.from(document.querySelectorAll('.activity-item'));
            allVisible.forEach((item) => item.setAttribute('aria-pressed', item === btn ? 'true' : 'false'));
        };

        // --- Init ---
        const initial = activityButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
        if (initial) {
            setMetrics(initial);
            state.currentElevation = Number(initial.getAttribute('data-activity-elevation-raw') ?? '0');
            state.currentHour = Number(initial.getAttribute('data-activity-start-hour') ?? '12');
            applySkyColors(state.currentHour, skyGradientStops, gsapTo);
            updateCelestial(state.currentHour, celestialBody, sceneWrapper, gsapTo);
            if (state.currentElevation >= 500) state.vegetationStartX = -Infinity;
        }

        LAYER_RATIOS.forEach((_r, i) => { layerNextX[i] = -200; });
        initRoad(roadPoints, state);
        initMountains(mountainsContainer, mountainLayers);
        updateScrollSpeed();
        renderRoad(roadPoints, state, roadPolyline, skyFill, groundFill);
        positionRunner(state, roadPoints, roadSvg, sceneWrapper, runnerGif);

        if (!reducedMotion) {
            requestAnimationFrame(tick);
            scheduleBob();
            safeTimeout(scheduleSurprise, 2000);
            safeTimeout(scheduleRunnerDrift, 3000);
            scheduleBird(birds, birdsContainer, sceneWrapper, () => state.currentHour, () => alive, safeTimeout);
        }

        window.addEventListener('resize', () => positionRunner(state, roadPoints, roadSvg, sceneWrapper, runnerGif));
        activityButtons.forEach((btn) => btn.addEventListener('click', () => selectActivity(btn)));
    }

    // =============================================
    // PAGINATION (AJAX)
    // =============================================
    const activitySection = document.getElementById('activity-section') as HTMLElement | null;
    const activitiesListShell = document.getElementById('activities-list-shell') as HTMLElement | null;
    const activitiesList = document.getElementById('activities-list') as HTMLElement | null;
    const activitiesLoadingIndicator = document.getElementById('activities-loading-indicator') as HTMLElement | null;
    const prevBtn = document.getElementById('page-prev') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('page-next') as HTMLButtonElement | null;
    const pageIndicator = document.getElementById('page-indicator');

    if (activitySection && activitiesList) {
        const locale = activitySection.dataset.locale ?? 'en';
        const units = (activitySection.dataset.units ?? 'km') as Units;
        const PAGE_SIZE = 5;
        const noName = locale === 'it' ? 'Attività senza nome' : 'Unnamed activity';
        const pageLabel = locale === 'it' ? 'Pagina' : 'Page';
        const loadingLabel = activitySection.dataset.loadingLabel ?? (locale === 'it' ? 'Caricamento attività…' : 'Loading activities…');
        let selectedActivityId: string | null = null;
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

        const renderItem = (activity: RunActivity): string => {
            const name = activity.name ?? noName;
            const pace = formatPace(activity.distance, activity.moving_time, units);
            const distance = formatDistance(activity.distance, units);
            const meta = `${activity.type ?? 'Sport'} - ${distance} - ${pace} - ${formatDate(activity.start_date)}`;
            const isSelected = selectedActivityId !== null && String(activity.id ?? '') === selectedActivityId;
            return `<button type="button" class="activity-item"
                data-activity-id="${esc(String(activity.id ?? ''))}"
                data-activity-speed="${esc(String(activity.average_speed ?? 2.5))}"
                data-activity-name="${esc(name)}" data-activity-pace="${esc(pace)}"
                data-activity-distance="${esc(distance)}"
                data-activity-duration="${esc(formatDuration(activity.moving_time))}"
                data-activity-speed-label="${esc(formatSpeed(activity.average_speed))}"
                data-activity-elevation="${esc(activity.total_elevation_gain ? `${activity.total_elevation_gain} m` : '-')}"
                data-activity-elevation-raw="${esc(String(activity.total_elevation_gain ?? 0))}"
                data-activity-kudos="${esc(typeof activity.kudos_count === 'number' ? String(activity.kudos_count) : '-')}"
                data-activity-road-angle="${esc(getRoadAngle(activity).toFixed(2))}"
                data-activity-runner-lift="${esc(String(getRunnerLiftPx(activity)))}"
                data-activity-start-hour="${esc(activity.start_date ? String(new Date(activity.start_date).getHours()) : '12')}"
                aria-pressed="${isSelected ? 'true' : 'false'}">
                <span class="activity-item-title">${esc(name)}</span>
                <span class="activity-item-meta">${esc(meta)}</span>
            </button>`;
        };

        const wireButtons = (): void => {
            Array.from(activitiesList.querySelectorAll<Element>('.activity-item')).forEach((btn) => {
                btn.addEventListener('click', () => {
                    selectedActivityId = (btn as HTMLElement).dataset.activityId ?? null;
                    Array.from(activitiesList.querySelectorAll('.activity-item')).forEach((b) => b.setAttribute('aria-pressed', 'false'));
                    btn.setAttribute('aria-pressed', 'true');
                    selectActivity(btn);
                });
            });
        };

        const setActivitiesLoading = (isLoading: boolean): void => {
            activitySection.setAttribute('aria-busy', String(isLoading));
            activitiesList.setAttribute('aria-busy', String(isLoading));
            activitiesList.style.opacity = isLoading ? '0.35' : '';
            activitiesList.style.pointerEvents = isLoading ? 'none' : '';
            if (activitiesLoadingIndicator) {
                activitiesLoadingIndicator.setAttribute('aria-hidden', String(!isLoading));
                const text = activitiesLoadingIndicator.querySelector('span:last-child');
                if (text) text.textContent = loadingLabel;
            }
            activitiesListShell?.classList.toggle('is-loading', isLoading);
        };

        const fetchPage = async (page: number): Promise<void> => {
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            setActivitiesLoading(true);
            try {
                const res = await fetch(`/api/activities?page=${page + 1}&per_page=${PAGE_SIZE}`);
                if (!res.ok) { console.error('[pagination] fetch error:', res.status, await res.text()); return; }
                const activities: RunActivity[] = await res.json();
                activitySection.dataset.currentPage = String(page);
                activitySection.dataset.hasMore = String(activities.length >= PAGE_SIZE);
                activitiesList.innerHTML = activities.map(renderItem).join('');
                wireButtons();
                if (pageIndicator) pageIndicator.textContent = `${pageLabel} ${page + 1}`;
            } catch (err) { console.error('[pagination] error:', err); }
            finally {
                setActivitiesLoading(false);
                const curPage = Number(activitySection.dataset.currentPage ?? '0');
                if (prevBtn) prevBtn.disabled = curPage === 0;
                if (nextBtn) nextBtn.disabled = activitySection.dataset.hasMore !== 'true';
            }
        };

        if (prevBtn) prevBtn.onclick = () => { const p = Number(activitySection.dataset.currentPage ?? '0'); if (p > 0) fetchPage(p - 1); };
        if (nextBtn) nextBtn.onclick = () => { const p = Number(activitySection.dataset.currentPage ?? '0'); if (activitySection.dataset.hasMore === 'true') fetchPage(p + 1); };

        const preSelected = activitiesList.querySelector<HTMLElement>('.activity-item[aria-pressed="true"]');
        if (preSelected) selectedActivityId = preSelected.dataset.activityId ?? null;
        wireButtons();
    }
}

let initTimer: number | null = null;
const scheduleInit = () => {
    if (initTimer !== null) clearTimeout(initTimer);
    initTimer = window.setTimeout(() => { initTimer = null; initDashboard(); }, 10);
};

document.addEventListener('astro:page-load', scheduleInit);
document.addEventListener('astro:after-swap', scheduleInit);
