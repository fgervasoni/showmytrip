import gsap from 'gsap';
import {
    formatDate,
    formatDistance,
    formatDuration,
    formatPace,
    formatSpeed,
    getRoadAngle,
    getRunnerLiftPx,
    type RunActivity,
    type Units,
} from '../lib/run-helpers';

function initDashboard() {
    // Kill any previous instance (SPA navigation)
    if ((window as any).__showMyTripCleanup) {
        (window as any).__showMyTripCleanup();
    }

    let alive = true;
    const timers: number[] = [];
    const safeTimeout = (fn: () => void, ms: number) => {
        const id = window.setTimeout(() => {
            if (alive) fn();
        }, ms);
        timers.push(id);
        return id;
    };

    // Shared tooltip appended to body (early, so cleanup can reference it)
    const flagTooltip = document.createElement('div');
    flagTooltip.className = 'scene-flag-tooltip';
    document.body.appendChild(flagTooltip);

    (window as any).__showMyTripCleanup = () => {
        alive = false;
        timers.forEach((id) => clearTimeout(id));
        gsap.killTweensOf('*');
        flagTooltip.remove();
    };

    // --- DOM ---
    // Shared selectActivity ref — assigned inside scene block, used by pagination
    let selectActivity: (btn: Element) => void = () => {
    };

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
    const metricSpeed = document.getElementById('metric-speed');
    const metricElevation = document.getElementById('metric-elevation');
    const metricKudos = document.getElementById('metric-kudos');

    if (sceneWrapper && runnerGif && roadPolyline && roadSvg) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let currentSpeed = Number(sceneWrapper.dataset.speed ?? '2.5');
        let currentAngle = Number(sceneWrapper.dataset.angle ?? '0');

        const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

        // =============================================
        // ROAD: scrolling terrain generation
        // =============================================
        const SEGMENT_WIDTH = 40; // px in SVG viewBox units
        const TOTAL_SEGMENTS = Math.ceil(1000 / SEGMENT_WIDTH) + 4;
        const roadPoints: { x: number; y: number }[] = [];
        let roadOffsetX = 0;
        let lastY = 320;
        let direction = -1; // -1 = going up, 1 = going down

        const generateNextY = (): number => {
            // Step size depends on elevation angle
            const stepBase = 1 + currentAngle * 0.55;
            const step = stepBase + (Math.random() * stepBase * 0.6);

            lastY += direction * step;

            // Road lives in viewBox Y range ~260-390
            const range = 10 + currentAngle * 4;
            const upperLimit = clamp(320 - range, 250, 310);
            const lowerLimit = clamp(320 + range, 330, 390);

            if (lastY <= upperLimit) {
                lastY = upperLimit;
                direction = 1;
            } else if (lastY >= lowerLimit) {
                lastY = lowerLimit;
                direction = -1;
            }

            const changeChance = currentAngle > 5 ? 0.08 : 0.15;
            if (Math.random() < changeChance) {
                direction *= -1;
            }

            const noise = (Math.random() - 0.5) * 4;
            return clamp(lastY + noise, 250, 395);
        };

        // Initialize road with enough points to fill the screen
        const initRoad = (): void => {
            roadPoints.length = 0;
            lastY = 320;
            direction = -1;
            for (let i = 0; i < TOTAL_SEGMENTS; i++) {
                roadPoints.push({x: i * SEGMENT_WIDTH, y: generateNextY()});
            }
            roadOffsetX = 0;
        };

        const renderRoad = (): void => {
            const pts = roadPoints
                .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
                .join(' ');
            roadPolyline.setAttribute('points', pts);

            // Sky polygon: fills from top down to road line
            if (skyFill) {
                const roadPtsStr = roadPoints
                    .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
                    .reverse()
                    .join(' ');
                const skyPts = `-200,0 1200,0 ${roadPtsStr}`;
                skyFill.setAttribute('points', skyPts);
            }

            // Ground polygon: fills from road line down to bottom (covers clouds below road)
            if (groundFill) {
                const roadPtsStr = roadPoints
                    .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
                    .join(' ');
                const groundPts = `${roadPtsStr} 1200,400 -200,400`;
                groundFill.setAttribute('points', groundPts);
            }
        };

        // =============================================
        // RUNNER: position on road with random bobbing
        // =============================================
        let runnerXRatio = 0.32;      // dynamic — drifts between 0.22 and 0.55
        let runnerXTarget = 0.32;
        let runnerBobY = 0;
        let runnerBobTargetY = 0;
        let runnerBobX = 0;
        let runnerBobTargetX = 0;

        const getRunnerRoadY = (): number => {
            const screenX = runnerXRatio * 1000 + roadOffsetX;
            for (let i = 0; i < roadPoints.length - 1; i++) {
                const p0 = roadPoints[i];
                const p1 = roadPoints[i + 1];
                if (screenX >= p0.x && screenX <= p1.x) {
                    const t = (screenX - p0.x) / (p1.x - p0.x);
                    return p0.y + (p1.y - p0.y) * t;
                }
            }
            return 320;
        };

        const positionRunner = (): void => {
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const roadY = getRunnerRoadY();
            const scaleX = svgRect.width / 1000;
            const scaleY = svgRect.height / 400;
            const screenX = svgRect.left - sceneRect.left + runnerXRatio * 1000 * scaleX + runnerBobX;
            const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
            const w = runnerGif.offsetWidth || 60;
            const h = runnerGif.offsetHeight || 80;

            runnerGif.style.left = `${screenX - w / 2}px`;
            runnerGif.style.top = `${screenY - h + runnerBobY}px`;
        };

        // =============================================
        // ANIMATION LOOP
        // =============================================
        let baseScrollSpeed = 0;
        let speedMultiplier = 1; // percentage boost from average_speed
        let lastTime = 0;

        const updateScrollSpeed = (): void => {
            const safeSpeed = currentSpeed > 0 ? currentSpeed : 2.5;
            baseScrollSpeed = 60; // fixed base scroll speed
            // average_speed (m/s): ~2 = slow jog, ~4 = fast run, ~6+ = sprint
            // Map to a multiplier: 0.5x to 2.0x
            speedMultiplier = clamp(safeSpeed / 3.5, 0.5, 2.0);
        };

        // Get the local slope at the runner's position (positive = uphill, negative = downhill)
        const getLocalSlope = (): number => {
            const screenX = runnerXRatio * 1000 + roadOffsetX;
            for (let i = 0; i < roadPoints.length - 1; i++) {
                const p0 = roadPoints[i];
                const p1 = roadPoints[i + 1];
                if (screenX >= p0.x && screenX <= p1.x) {
                    // dy/dx: negative dy = going up (Y decreases = uphill)
                    return (p0.y - p1.y) / SEGMENT_WIDTH;
                }
            }
            return 0;
        };

        const tick = (timestamp: number): void => {
            if (!alive) return;
            if (!lastTime) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            // Adjust speed: slope is primary, average_speed is percentage modifier
            const slope = getLocalSlope();
            const slopeFactor = clamp(1 - slope * 1.2, 0.25, 2.0);
            const effectiveSpeed = baseScrollSpeed * slopeFactor * speedMultiplier;

            // Scroll road left
            roadOffsetX += effectiveSpeed * dt;

            // Add new segments on the right, remove old ones on the left
            const rightEdge = roadOffsetX + 1000 + SEGMENT_WIDTH * 2;
            while (roadPoints.length > 0 && roadPoints[roadPoints.length - 1].x < rightEdge) {
                const lastPt = roadPoints[roadPoints.length - 1];
                roadPoints.push({x: lastPt.x + SEGMENT_WIDTH, y: generateNextY()});
            }
            while (roadPoints.length > 2 && roadPoints[0].x < roadOffsetX - SEGMENT_WIDTH * 2) {
                roadPoints.shift();
            }

            // Smooth bob interpolation
            runnerBobY += (runnerBobTargetY - runnerBobY) * 0.06;
            runnerBobX += (runnerBobTargetX - runnerBobX) * 0.04;
            // Slow X drift across scene
            runnerXRatio += (runnerXTarget - runnerXRatio) * 0.001;

            renderRoad();
            renderScrollElements();
            positionRunner();
            positionFlags();
            if (alive) requestAnimationFrame(tick);
        };

        // Random bobbing: small unpredictable vertical and horizontal micro-movements
        const scheduleBob = (): void => {
            if (!alive) return;
            runnerBobTargetY = (Math.random() - 0.5) * 8;
            runnerBobTargetX = (Math.random() - 0.5) * 12;
            const delay = 600 + Math.random() * 1800;
            safeTimeout(scheduleBob, delay);
        };

        // Occasional bigger random movement (stumble, speed burst, etc.)
        const scheduleSurprise = (): void => {
            if (!alive) return;
            const type = Math.random();
            if (type < 0.3) {
                // Small hop
                gsap.to({v: 0}, {
                    v: 1,
                    duration: 0.35,
                    ease: 'power2.out',
                    onUpdate() {
                        runnerBobTargetY = -16 * (1 - Math.abs(this.progress() * 2 - 1));
                    },
                });
            } else if (type < 0.6) {
                // Speed burst
                const origSpeed = baseScrollSpeed;
                gsap.to({v: 0}, {
                    v: 1,
                    duration: 1.2,
                    ease: 'power2.inOut',
                    onUpdate() {
                        const t = this.progress();
                        baseScrollSpeed = origSpeed * (1 + 0.6 * Math.sin(t * Math.PI));
                    },
                    onComplete() {
                        updateScrollSpeed();
                    },
                });
            } else {
                // Lateral sway
                runnerBobTargetX = (Math.random() - 0.5) * 25;
            }
            const delay = 3000 + Math.random() * 5000;
            safeTimeout(scheduleSurprise, delay);
        };

        // Periodically shift runner X: sometimes ahead, sometimes behind
        const scheduleRunnerDrift = (): void => {
            if (!alive) return;
            runnerXTarget = Math.random() < 0.5
                ? 0.38 + Math.random() * 0.17   // ahead: 38%–55%
                : 0.22 + Math.random() * 0.10;  // behind: 22%–32%
            safeTimeout(scheduleRunnerDrift, 4000 + Math.random() * 8000);
        };

        // =============================================
        // SCROLLING ELEMENTS: clouds + rocks
        // =============================================
        let currentElevation = 0;
        let currentHour = 12;

        // Activity flag
        // Each flag scrolls with the road and persists until it exits the scene
        type FlagData = { el: HTMLElement; worldX: number; name: string };
        const flags: FlagData[] = [];

        // Shared tooltip appended to body to avoid overflow:hidden clipping
        const showFlagTooltip = (name: string, flagEl: HTMLElement): void => {
            flagTooltip.textContent = name;
            const fr = flagEl.getBoundingClientRect();
            const left = fr.left + fr.width / 2;
            const top = fr.top - 32;
            flagTooltip.style.top = `${top}px`;
            flagTooltip.style.left = `${left}px`;
            flagTooltip.style.transform = 'translateX(-50%)';
            flagTooltip.classList.add('visible');
        };

        const hideFlagTooltip = (): void => {
            flagTooltip.classList.remove('visible');
        };

        const placeFlag = (name: string): void => {
            // Spawn off-screen to the right so the flag enters naturally with the road scroll
            const worldX = roadOffsetX + 1100;
            const wrapper = document.createElement('div');
            wrapper.className = 'scene-flag';
            const banner = document.createElement('div');
            banner.className = 'scene-flag-banner';
            const pole = document.createElement('div');
            pole.className = 'scene-flag-pole';
            wrapper.appendChild(banner);
            wrapper.appendChild(pole);
            wrapper.addEventListener('mouseenter', () => showFlagTooltip(name, wrapper));
            wrapper.addEventListener('mouseleave', hideFlagTooltip);
            // Append to sceneWrapper (not rocksContainer) to avoid pointer-events:none and overflow:hidden
            sceneWrapper.appendChild(wrapper);
            flags.push({el: wrapper, worldX, name});
        };

        const positionFlags = (): void => {
            if (flags.length === 0) return;
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const scaleX = svgRect.width / 1000;
            const scaleY = svgRect.height / 400;

            for (let i = flags.length - 1; i >= 0; i--) {
                const f = flags[i];
                const screenX = (f.worldX - roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

                // Remove flag once it exits to the left
                if (screenX < -20) {
                    f.el.remove();
                    flags.splice(i, 1);
                    continue;
                }

                // Find road Y at flag world position
                let roadY = 320;
                for (let j = 0; j < roadPoints.length - 1; j++) {
                    const p0 = roadPoints[j];
                    const p1 = roadPoints[j + 1];
                    if (f.worldX >= p0.x && f.worldX <= p1.x) {
                        const t = (f.worldX - p0.x) / (p1.x - p0.x);
                        roadY = p0.y + (p1.y - p0.y) * t;
                        break;
                    }
                }
                const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
                f.el.style.left = `${screenX - 1}px`;
                f.el.style.top = `${screenY - 38}px`;
            }
        };

        const isNightTime = (): boolean => currentHour >= 20 || currentHour < 6;

        type ScrollElement = {
            el: HTMLElement;
            worldX: number;
            parallaxRatio: number;
            topPx: number;
            heightPx: number;
        };

        const scrollElements: ScrollElement[] = [];

        // 3 independent spawn counters — one per parallax layer
        const layerNextX = [-200, -200, -200];
        const LAYER_RATIOS = [0.025, 0.07, 0.16];
        const LAYER_INTERVALS = [220, 120, 190];
        // Layer 0: far/small/faint  Layer 1: mid (original)  Layer 2: near/large/faint
        const LAYER_W = [[22, 48], [50, 110], [80, 155]];
        const LAYER_H_MULT = [0.38, 0.32, 0.27];
        const LAYER_OP = [[0.18, 0.32], [0.38, 0.65], [0.08, 0.18]];
        const LAYER_Y = [[0.03, 0.22], [0.06, 0.50], [0.02, 0.28]];
        // z-index: most transparent layers go behind the most opaque one
        const LAYER_Z = [2, 4, 1]; // layer2 faintest→behind, layer0 faint→mid, layer1 opaque→front

        // Get road Y in screen pixels at a given worldX
        const getRoadScreenY = (worldX: number): number => {
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const svgScaleY = svgRect.height / 400;

            for (let i = 0; i < roadPoints.length - 1; i++) {
                const p0 = roadPoints[i];
                const p1 = roadPoints[i + 1];
                if (worldX >= p0.x && worldX <= p1.x) {
                    const t = (worldX - p0.x) / (p1.x - p0.x);
                    const roadY = p0.y + (p1.y - p0.y) * t;
                    return svgRect.top - sceneRect.top + roadY * svgScaleY;
                }
            }
            return svgRect.top - sceneRect.top + 320 * (svgRect.height / 400);
        };

        // Build a cloud element with random bumps for unique shape
        const buildCloud = (w: number, h: number): HTMLElement => {
            const el = document.createElement('div');
            el.className = 'cloud-el';
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;

            const bumpCount = 2 + Math.floor(Math.random() * 3); // 2-4 bumps
            for (let i = 0; i < bumpCount; i++) {
                const bump = document.createElement('div');
                const bw = Math.round(w * (0.3 + Math.random() * 0.35));
                const bh = Math.round(bw * (0.7 + Math.random() * 0.6));
                bump.style.cssText = `
				position:absolute;
				background:white;
				border-radius:50%;
				width:${bw}px;
				height:${bh}px;
				left:${Math.round((i / bumpCount) * w * 0.7)}px;
				top:${Math.round(-bh * (0.4 + Math.random() * 0.3))}px;
			`;
                el.appendChild(bump);
            }
            return el;
        };

        // Build a star element
        const buildStar = (): HTMLElement => {
            const el = document.createElement('div');
            el.className = 'star-el';
            const size = 2 + Math.random() * 3;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            // Random twinkle delay
            el.style.animationDelay = `${Math.random() * 3}s`;
            return el;
        };

        const spawnElement = (worldX: number, layerIdx: number): void => {
            if (!rocksContainer) return;
            const roadY = getRoadScreenY(worldX);
            const sceneH = sceneWrapper.getBoundingClientRect().height || 340;

            if (isNightTime()) {
                const el = buildStar();
                el.style.position = 'absolute';
                el.style.left = '0px';
                const maxTop = Math.max(5, roadY - 10);
                const top = 5 + Math.random() * Math.max(10, maxTop - 5);
                el.style.top = `${top}px`;
                el.style.opacity = `${0.5 + Math.random() * 0.5}`;
                rocksContainer.appendChild(el);
                scrollElements.push({el, worldX, parallaxRatio: LAYER_RATIOS[layerIdx], topPx: top, heightPx: 5});
            } else {
                const [wMin, wMax] = LAYER_W[layerIdx];
                const w = wMin + Math.random() * (wMax - wMin);
                const h = w * LAYER_H_MULT[layerIdx] * (0.8 + Math.random() * 0.4);
                const [opMin, opMax] = LAYER_OP[layerIdx];
                const op = opMin + Math.random() * (opMax - opMin);
                const [yMin, yMax] = LAYER_Y[layerIdx];
                const top = yMin * sceneH + Math.random() * (yMax - yMin) * sceneH;
                const el = buildCloud(w, h);
                el.style.opacity = `${op}`;
                el.style.position = 'absolute';
                el.style.left = '0px';
                el.style.top = `${top}px`;
                el.style.zIndex = String(LAYER_Z[layerIdx]);
                rocksContainer.appendChild(el);
                scrollElements.push({el, worldX, parallaxRatio: LAYER_RATIOS[layerIdx], topPx: top, heightPx: h});
            }
        };

        const renderScrollElements = (): void => {
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const svgScaleX = svgRect.width / 1000;

            // Spawn each layer independently
            LAYER_RATIOS.forEach((ratio, i) => {
                const rightEdge = roadOffsetX * ratio + 1200;
                while (layerNextX[i] < rightEdge) {
                    spawnElement(layerNextX[i], i);
                    layerNextX[i] += LAYER_INTERVALS[i] + Math.random() * 80;
                }
            });

            // Update positions using per-element parallax ratio
            for (let i = scrollElements.length - 1; i >= 0; i--) {
                const item = scrollElements[i];
                const offset = roadOffsetX * item.parallaxRatio;
                const screenX = (item.worldX - offset) * svgScaleX + (svgRect.left - sceneRect.left);
                if (screenX < -200) {
                    item.el.remove();
                    scrollElements.splice(i, 1);
                } else {
                    item.el.style.left = `${screenX}px`;
                }
            }
        };

        // =============================================
        // SKY COLOR based on time of day
        // =============================================
        const skySvg = document.querySelector('.sky-svg') as SVGSVGElement | null;
        const skyGradientStops = skySvg?.querySelectorAll('#sky-gradient stop') ?? [];

        type SkyPalette = [string, string, string]; // top, mid, bottom

        const getSkyColors = (hour: number): SkyPalette => {
            if (hour >= 5 && hour < 7) {
                // Dawn
                return ['#1e3a5f', '#f97316', '#fbbf24'];
            } else if (hour >= 7 && hour < 10) {
                // Morning
                return ['#38bdf8', '#7dd3fc', '#e0f2fe'];
            } else if (hour >= 10 && hour < 16) {
                // Midday
                return ['#0ea5e9', '#38bdf8', '#bae6fd'];
            } else if (hour >= 16 && hour < 18) {
                // Late afternoon
                return ['#0284c7', '#f59e0b', '#fde68a'];
            } else if (hour >= 18 && hour < 20) {
                // Sunset
                return ['#1e3a5f', '#dc2626', '#fb923c'];
            } else if (hour >= 20 && hour < 22) {
                // Dusk
                return ['#0f172a', '#1e3a5f', '#475569'];
            } else {
                // Night
                return ['#020617', '#0f172a', '#1e293b'];
            }
        };

        const applySkyColors = (hour: number): void => {
            if (skyGradientStops.length < 3) return;
            const [top, mid, bottom] = getSkyColors(hour);

            gsap.to(skyGradientStops[0], {attr: {'stop-color': top}, duration: 1.5, ease: 'power2.inOut'});
            gsap.to(skyGradientStops[1], {attr: {'stop-color': mid}, duration: 1.5, ease: 'power2.inOut'});
            gsap.to(skyGradientStops[2], {attr: {'stop-color': bottom}, duration: 1.5, ease: 'power2.inOut'});
        };

        // =============================================
        // METRICS
        // =============================================
        const setMetrics = (btn: Element): void => {
            const get = (attr: string) => btn.getAttribute(attr) ?? '-';

            const animateMetric = (el: HTMLElement | null, value: string): void => {
                if (!el) return;
                gsap.to(el, {
                    opacity: 0,
                    y: -8,
                    duration: 0.15,
                    ease: 'power2.in',
                    onComplete() {
                        el.textContent = value;
                        gsap.fromTo(el, {opacity: 0, y: 8}, {opacity: 1, y: 0, duration: 0.25, ease: 'power2.out'});
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

        // =============================================
        // ACTIVITY SELECTION
        // =============================================
        selectActivity = (btn: Element): void => {
            const speed = Number(btn.getAttribute('data-activity-speed') ?? '2.5');
            const angle = Number(btn.getAttribute('data-activity-road-angle') ?? '0');
            const elevation = Number(btn.getAttribute('data-activity-elevation-raw') ?? '0');
            const hour = Number(btn.getAttribute('data-activity-start-hour') ?? '12');
            const wasNight = isNightTime();

            currentSpeed = speed > 0 ? speed : 2.5;
            currentAngle = angle;
            currentElevation = elevation;
            currentHour = hour;
            sceneWrapper.dataset.speed = String(currentSpeed);
            sceneWrapper.dataset.angle = String(currentAngle);

            updateScrollSpeed();
            setMetrics(btn);
            currentElevation = elevation;
            applySkyColors(hour);

            // Place activity flag on the road ahead of the runner
            const activityName = btn.getAttribute('data-activity-name') ?? '';
            placeFlag(activityName);

            // Clear old elements if switching between day/night
            if (wasNight !== isNightTime()) {
                scrollElements.forEach((item) => item.el.remove());
                scrollElements.length = 0;
            }

            // Update aria-pressed on all currently visible activity buttons
            const allVisible = Array.from(document.querySelectorAll('.activity-item'));
            allVisible.forEach((item) => {
                item.setAttribute('aria-pressed', item === btn ? 'true' : 'false');
            });
        };

        // =============================================
        // INIT
        // =============================================
        const initial = activityButtons.find((b) => b.getAttribute('aria-pressed') === 'true');
        if (initial) {
            setMetrics(initial);
            currentElevation = Number(initial.getAttribute('data-activity-elevation-raw') ?? '0');
            const initHour = Number(initial.getAttribute('data-activity-start-hour') ?? '12');
            currentHour = initHour;
            applySkyColors(initHour);
        }

        LAYER_RATIOS.forEach((r, i) => {
            layerNextX[i] = r > 0 ? -200 : -200;
        });

        initRoad();
        updateScrollSpeed();
        renderRoad();
        positionRunner();

        if (!reducedMotion) {
            requestAnimationFrame(tick);
            scheduleBob();
            safeTimeout(scheduleSurprise, 2000);
            safeTimeout(scheduleRunnerDrift, 3000);
        }

        window.addEventListener('resize', positionRunner);

        activityButtons.forEach((btn) => {
            btn.addEventListener('click', () => selectActivity(btn));
        });
    }

// =============================================
// PAGINATION (AJAX)
// =============================================
    const activitySection = document.getElementById('activity-section') as HTMLElement | null;
    const activitiesList = document.getElementById('activities-list') as HTMLElement | null;
    const prevBtn = document.getElementById('page-prev') as HTMLButtonElement | null;
    const nextBtn = document.getElementById('page-next') as HTMLButtonElement | null;
    const pageIndicator = document.getElementById('page-indicator');

    if (activitySection && activitiesList) {
        const locale = activitySection.dataset.locale ?? 'en';
        const units = (activitySection.dataset.units ?? 'km') as Units;
        const PAGE_SIZE = 5;

        const noName = locale === 'it' ? 'Attività senza nome' : 'Unnamed activity';
        const pageLabel = locale === 'it' ? 'Pagina' : 'Page';

        // Track selected activity id across page changes
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
            data-activity-name="${esc(name)}"
            data-activity-pace="${esc(pace)}"
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
                    Array.from(activitiesList.querySelectorAll('.activity-item')).forEach((b) =>
                        b.setAttribute('aria-pressed', 'false'),
                    );
                    btn.setAttribute('aria-pressed', 'true');
                    selectActivity(btn);
                });
            });
        };

        const fetchPage = async (page: number): Promise<void> => {
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            activitiesList.style.opacity = '0.4';
            activitiesList.style.pointerEvents = 'none';

            try {
                const res = await fetch(`/api/activities?page=${page + 1}&per_page=${PAGE_SIZE}`);
                if (!res.ok) {
                    console.error('[pagination] fetch error:', res.status, await res.text());
                    return;
                }
                const activities: RunActivity[] = await res.json();

                activitySection.dataset.currentPage = String(page);
                activitySection.dataset.hasMore = String(activities.length >= PAGE_SIZE);

                activitiesList.innerHTML = activities.map(renderItem).join('');
                wireButtons();

                // Do NOT auto-select: keep current scene/metrics from previous selection

                if (pageIndicator) pageIndicator.textContent = `${pageLabel} ${page + 1}`;
            } catch (err) {
                console.error('[pagination] error:', err);
            } finally {
                activitiesList.style.opacity = '';
                activitiesList.style.pointerEvents = '';
                const curPage = Number(activitySection.dataset.currentPage ?? '0');
                if (prevBtn) prevBtn.disabled = curPage === 0;
                if (nextBtn) nextBtn.disabled = activitySection.dataset.hasMore !== 'true';
            }
        };

        if (prevBtn) prevBtn.onclick = () => {
            const page = Number(activitySection.dataset.currentPage ?? '0');
            if (page > 0) fetchPage(page - 1);
        };
        if (nextBtn) nextBtn.onclick = () => {
            const page = Number(activitySection.dataset.currentPage ?? '0');
            if (activitySection.dataset.hasMore === 'true') fetchPage(page + 1);
        };

        // Wire initial server-rendered buttons
        // Also capture already-selected id from server render
        const preSelected = activitiesList.querySelector<HTMLElement>('.activity-item[aria-pressed="true"]');
        if (preSelected) selectedActivityId = preSelected.dataset.activityId ?? null;
        wireButtons();
    }
} // end initDashboard

// astro:page-load fires on initial load and on every SPA navigation
document.addEventListener('astro:page-load', initDashboard);
