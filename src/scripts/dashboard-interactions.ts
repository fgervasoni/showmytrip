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
        (window as any).__showMyTripCleanup = null;
    }

    // Bail out early if no scene on this page (e.g. summary)
    const sceneCheck = document.querySelector('.scene-wrapper');
    const listCheck = document.getElementById('activities-list');
    if (!sceneCheck && !listCheck) return;

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

    // Track gsap-animated elements for targeted cleanup
    const gsapTargets: (Element | object)[] = [];
    const gsapTo = (target: any, vars: gsap.TweenVars): gsap.core.Tween => {
        gsapTargets.push(target);
        return gsap.to(target, vars);
    };

    (window as any).__showMyTripCleanup = () => {
        alive = false;
        timers.forEach((id) => clearTimeout(id));
        // Only kill tweens we created — not '*' which nukes the new page too
        gsapTargets.forEach((t) => gsap.killTweensOf(t));
        gsapTargets.length = 0;
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
            // Quadratic curve: amplifica molto di più i dislivelli alti rispetto a quelli bassi
            const angleNorm = currentAngle / 35; // 0..1
            const angleSq = angleNorm * angleNorm;

            // Step size: da ~1px (piatto) a ~28px (ripidissimo)
            const stepBase = 1 + angleSq * 27;
            const step = stepBase + (Math.random() * stepBase * 0.6);

            lastY += direction * step;

            // Range di oscillazione Y: da ~8px (piatto) a ~115px (ripidissimo)
            const range = 8 + angleSq * 115;
            const upperLimit = clamp(320 - range, 175, 312);
            const lowerLimit = clamp(320 + range, 328, 400);

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
            updateMountains();
            updateBirds(dt);
            updateGrass();
            updateFlowers();
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
                gsapTo({v: 0}, {
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
                gsapTo({v: 0}, {
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
        type FlagData = {
            el: HTMLElement;
            worldX: number;
            name: string;
            pendingSpeed?: number;
            pendingAngle?: number;
            pendingElevation?: number;
            pendingHour?: number;
            applied?: boolean;
        };
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

        const positionFlags = (): void => {
            if (flags.length === 0) return;
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const scaleX = svgRect.width / 1000;
            const scaleY = svgRect.height / 400;

            // Runner world X position
            const runnerWorldX = runnerXRatio * 1000 + roadOffsetX;

            for (let i = flags.length - 1; i >= 0; i--) {
                const f = flags[i];
                const screenX = (f.worldX - roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

                // Apply pending speed/angle when runner reaches this flag
                if (!f.applied && runnerWorldX >= f.worldX) {
                    f.applied = true;
                    if (f.pendingSpeed !== undefined) {
                        const wasNight = isNightTime();
                        currentSpeed = f.pendingSpeed;
                        currentAngle = f.pendingAngle ?? currentAngle;
                        currentElevation = f.pendingElevation ?? currentElevation;
                        currentHour = f.pendingHour ?? currentHour;
                        sceneWrapper.dataset.speed = String(currentSpeed);
                        sceneWrapper.dataset.angle = String(currentAngle);
                        updateScrollSpeed();
                        applySkyColors(currentHour);
                        updateCelestial(currentHour);

                        // Clear old elements if switching between day/night
                        if (wasNight !== isNightTime()) {
                            scrollElements.forEach((item) => item.el.remove());
                            scrollElements.length = 0;
                        }
                    }
                }

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

            gsapTo(skyGradientStops[0], {attr: {'stop-color': top}, duration: 1.5, ease: 'power2.inOut'});
            gsapTo(skyGradientStops[1], {attr: {'stop-color': mid}, duration: 1.5, ease: 'power2.inOut'});
            gsapTo(skyGradientStops[2], {attr: {'stop-color': bottom}, duration: 1.5, ease: 'power2.inOut'});
        };

        // =============================================
        // CELESTIAL BODY (sun / moon)
        // =============================================
        const celestialBody = document.getElementById('celestial-body') as HTMLElement | null;

        const updateCelestial = (hour: number): void => {
            if (!celestialBody) return;
            const isNight = hour >= 20 || hour < 6;

            // Switch sun ↔ moon class
            celestialBody.classList.toggle('celestial-sun', !isNight);
            celestialBody.classList.toggle('celestial-moon', isNight);

            // Arc position: map hour to progress 0→1 within day/night cycle
            let progress: number;
            if (!isNight) {
                progress = clamp((hour - 6) / 14, 0, 1);
            } else {
                const nightHour = hour >= 20 ? hour - 20 : hour + 4;
                progress = clamp(nightHour / 10, 0, 1);
            }

            const sceneW = sceneWrapper.getBoundingClientRect().width || 800;
            const sceneH = sceneWrapper.getBoundingClientRect().height || 340;

            // Horizontal: 8% → 92%
            const x = sceneW * (0.08 + progress * 0.84);

            // Vertical: parabolic arc — highest (smallest Y) at center (progress=0.5)
            // topMin = top of arc, topMax = near horizon
            const topMin = sceneH * 0.06;
            const topMax = sceneH * 0.52;
            // 4*(p-0.5)^2 goes from 1 (edges) to 0 (center)
            const parabola = 4 * (progress - 0.5) ** 2;
            const topY = topMin + (topMax - topMin) * parabola;

            gsapTo(celestialBody, {
                left: x - 20,
                top: topY,
                duration: 1.5,
                ease: 'power2.inOut',
            });

            // Fade near horizon
            const edgeFade = 1 - Math.max(0, (Math.abs(progress - 0.5) - 0.35) / 0.15);
            gsapTo(celestialBody, {opacity: clamp(edgeFade, 0.1, 1), duration: 1.5, ease: 'power2.inOut'});
        };

        // =============================================
        // MOUNTAINS (parallax silhouettes)
        // =============================================
        const mountainsContainer = document.getElementById('mountains-container') as HTMLElement | null;

        const buildMountainSVG = (peaks: number[], color: string, opacity: number): SVGSVGElement => {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 2000 400');
            svg.setAttribute('preserveAspectRatio', 'none');
            svg.style.position = 'absolute';
            svg.style.bottom = '0';
            svg.style.left = '0';
            svg.style.width = '200%';
            svg.style.height = '100%';

            let d = 'M0,400 ';
            const segW = 2000 / (peaks.length - 1);
            peaks.forEach((h, i) => {
                const x = i * segW;
                const y = 400 - h;
                if (i === 0) {
                    d += `L${x},${y} `;
                } else {
                    // Smooth curves between peaks
                    const prevX = (i - 1) * segW;
                    const cpx1 = prevX + segW * 0.5;
                    const cpy1 = 400 - peaks[i - 1];
                    const cpx2 = x - segW * 0.5;
                    d += `C${cpx1},${cpy1} ${cpx2},${y} ${x},${y} `;
                }
            });
            d += 'L2000,400 Z';

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            path.setAttribute('fill', color);
            path.setAttribute('opacity', String(opacity));
            svg.appendChild(path);
            return svg;
        };

        const mountainLayers: { el: SVGSVGElement; speed: number }[] = [];

        const initMountains = (): void => {
            if (!mountainsContainer) return;
            mountainsContainer.innerHTML = '';
            mountainLayers.length = 0;

            // Layer 0: far mountains (small, faint)
            const farPeaks = Array.from({length: 12}, () => 40 + Math.random() * 80);
            const farSvg = buildMountainSVG(farPeaks, '#94a3b8', 0.2);
            mountainsContainer.appendChild(farSvg);
            mountainLayers.push({el: farSvg, speed: 0.008});

            // Layer 1: mid mountains
            const midPeaks = Array.from({length: 8}, () => 60 + Math.random() * 120);
            const midSvg = buildMountainSVG(midPeaks, '#64748b', 0.15);
            mountainsContainer.appendChild(midSvg);
            mountainLayers.push({el: midSvg, speed: 0.02});

            // Layer 2: near hills
            const nearPeaks = Array.from({length: 10}, () => 30 + Math.random() * 60);
            const nearSvg = buildMountainSVG(nearPeaks, '#475569', 0.1);
            mountainsContainer.appendChild(nearSvg);
            mountainLayers.push({el: nearSvg, speed: 0.04});
        };

        const updateMountains = (): void => {
            mountainLayers.forEach(({el, speed}) => {
                const offset = -(roadOffsetX * speed) % (el.getBoundingClientRect().width / 2 || 1600);
                el.style.transform = `translateX(${offset}px)`;
            });
        };

        // =============================================
        // BIRDS
        // =============================================
        const birdsContainer = document.getElementById('birds-container') as HTMLElement | null;

        type BirdData = { el: HTMLElement; x: number; y: number; speed: number; wobblePhase: number };
        const birds: BirdData[] = [];

        const buildBird = (size: number): HTMLElement => {
            const el = document.createElement('div');
            el.className = 'bird-el';
            el.style.width = `${size}px`;
            el.style.height = `${size * 0.6}px`;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 12');
            svg.setAttribute('overflow', 'visible');
            svg.style.width = '100%';
            svg.style.height = '100%';

            const color = isNightTime() ? '#94a3b8' : '#1f2937';

            // Left wing — rotates around body center
            const gLeft = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            gLeft.setAttribute('class', 'bird-wing-left');
            const leftWing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            leftWing.setAttribute('d', 'M12,9 Q8,3 1,1');
            leftWing.setAttribute('stroke', color);
            leftWing.setAttribute('stroke-width', '1.8');
            leftWing.setAttribute('stroke-linecap', 'round');
            leftWing.setAttribute('fill', 'none');
            gLeft.appendChild(leftWing);
            svg.appendChild(gLeft);

            // Right wing
            const gRight = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            gRight.setAttribute('class', 'bird-wing-right');
            const rightWing = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            rightWing.setAttribute('d', 'M12,9 Q16,3 23,1');
            rightWing.setAttribute('stroke', color);
            rightWing.setAttribute('stroke-width', '1.8');
            rightWing.setAttribute('stroke-linecap', 'round');
            rightWing.setAttribute('fill', 'none');
            gRight.appendChild(rightWing);
            svg.appendChild(gRight);

            // Body dot
            const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            body.setAttribute('cx', '12');
            body.setAttribute('cy', '9');
            body.setAttribute('r', '1.2');
            body.setAttribute('fill', color);
            svg.appendChild(body);

            // Randomize flap speed
            const flapDuration = 0.3 + Math.random() * 0.25;
            gLeft.style.transformOrigin = '12px 9px';
            gRight.style.transformOrigin = '12px 9px';
            gLeft.style.animation = `bird-flap-left ${flapDuration}s ease-in-out infinite`;
            gRight.style.animation = `bird-flap-right ${flapDuration}s ease-in-out infinite`;

            el.appendChild(svg);
            return el;
        };

        const spawnBird = (): void => {
            if (!birdsContainer || isNightTime()) return;
            const sceneH = sceneWrapper.getBoundingClientRect().height || 340;
            const sceneW = sceneWrapper.getBoundingClientRect().width || 800;
            const size = 12 + Math.random() * 16;
            const el = buildBird(size);
            const x = sceneW + 20;
            const y = 15 + Math.random() * sceneH * 0.35;
            const speed = 40 + Math.random() * 60;

            el.style.position = 'absolute';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.opacity = `${0.4 + Math.random() * 0.4}`;
            birdsContainer.appendChild(el);
            birds.push({el, x, y, speed, wobblePhase: Math.random() * Math.PI * 2});
        };

        const scheduleBird = (): void => {
            if (!alive) return;
            spawnBird();
            safeTimeout(scheduleBird, 3000 + Math.random() * 6000);
        };

        const updateBirds = (dt: number): void => {
            for (let i = birds.length - 1; i >= 0; i--) {
                const b = birds[i];
                b.x -= b.speed * dt;
                b.wobblePhase += dt * 2;
                const wobble = Math.sin(b.wobblePhase) * 3;
                b.el.style.left = `${b.x}px`;
                b.el.style.top = `${b.y + wobble}px`;

                if (b.x < -40) {
                    b.el.remove();
                    birds.splice(i, 1);
                }
            }
        };

        // =============================================
        // GRASS TUFTS along road
        // =============================================
        const grassContainer = document.getElementById('grass-container') as HTMLElement | null;

        type GrassTuft = { el: HTMLElement; worldX: number };
        const grassTufts: GrassTuft[] = [];
        let grassNextX = -100;
        const GRASS_INTERVAL = 35;
        // Vegetation only spawns at worldX >= this value (set when entering high elevation)
        let vegetationStartX = -Infinity;

        const buildGrassTuft = (): HTMLElement => {
            const el = document.createElement('div');
            el.className = 'grass-tuft';
            const bladeCount = 3 + Math.floor(Math.random() * 4);

            for (let i = 0; i < bladeCount; i++) {
                const blade = document.createElement('div');
                blade.className = 'grass-blade';
                const h = 6 + Math.random() * 10;
                const hue = 100 + Math.random() * 40; // green range
                const lightness = 35 + Math.random() * 20;
                blade.style.height = `${h}px`;
                blade.style.left = `${i * 3 - (bladeCount * 1.5)}px`;
                blade.style.background = `hsl(${hue}, 50%, ${lightness}%)`;
                blade.style.animationDelay = `${Math.random() * 2}s`;
                blade.style.animationDuration = `${1.5 + Math.random() * 1.5}s`;
                blade.style.transform = `rotate(${(Math.random() - 0.5) * 20}deg)`;
                el.appendChild(blade);
            }
            return el;
        };

        const spawnGrass = (worldX: number): void => {
            if (!grassContainer || currentElevation < 500 || worldX < vegetationStartX) return;
            const el = buildGrassTuft();
            el.style.position = 'absolute';
            el.style.left = '0px';
            el.style.opacity = `${0.5 + Math.random() * 0.35}`;
            grassContainer.appendChild(el);
            grassTufts.push({el, worldX});
        };

        const updateGrass = (): void => {
            if (!grassContainer) return;
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const scaleX = svgRect.width / 1000;
            const scaleY = svgRect.height / 400;

            // Spawn grass ahead
            const rightEdge = roadOffsetX + 1200;
            while (grassNextX < rightEdge) {
                spawnGrass(grassNextX);
                grassNextX += GRASS_INTERVAL + Math.random() * 25;
            }

            // Position & cull
            for (let i = grassTufts.length - 1; i >= 0; i--) {
                const g = grassTufts[i];
                const screenX = (g.worldX - roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

                if (screenX < -30) {
                    g.el.remove();
                    grassTufts.splice(i, 1);
                    continue;
                }

                // Find road Y at this worldX
                let roadY = 320;
                for (let j = 0; j < roadPoints.length - 1; j++) {
                    const p0 = roadPoints[j];
                    const p1 = roadPoints[j + 1];
                    if (g.worldX >= p0.x && g.worldX <= p1.x) {
                        const t = (g.worldX - p0.x) / (p1.x - p0.x);
                        roadY = p0.y + (p1.y - p0.y) * t;
                        break;
                    }
                }

                const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
                // Place grass slightly above or below road line for variety
                const offset = (i % 2 === 0) ? -2 : 3;
                g.el.style.left = `${screenX}px`;
                g.el.style.top = `${screenY + offset}px`;
            }
        };


        // =============================================
        // FLOWERS along road
        // =============================================
        type FlowerData = { el: HTMLElement; worldX: number };
        const flowers: FlowerData[] = [];
        let flowerNextX = -50;
        const FLOWER_INTERVAL = 80;

        const FLOWER_COLORS = [
            ['#ef4444', '#fbbf24'], // red + yellow center
            ['#a855f7', '#fbbf24'], // purple
            ['#3b82f6', '#fde68a'], // blue
            ['#ec4899', '#fbbf24'], // pink
            ['#f97316', '#fde68a'], // orange
            ['#facc15', '#a16207'], // yellow
        ];

        const buildFlower = (): HTMLElement => {
            const el = document.createElement('div');
            el.className = 'flower-el';
            el.style.animation = `flower-sway ${2 + Math.random() * 2}s ease-in-out infinite`;
            el.style.animationDelay = `${Math.random() * 3}s`;

            const [petalColor, centerColor] = FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
            const petalCount = 4 + Math.floor(Math.random() * 3);
            const petalSize = 3 + Math.random() * 2;

            for (let i = 0; i < petalCount; i++) {
                const petal = document.createElement('div');
                petal.className = 'flower-petal';
                const angle = (i / petalCount) * 360;
                const rad = (angle * Math.PI) / 180;
                const px = Math.cos(rad) * petalSize;
                const py = Math.sin(rad) * petalSize;
                petal.style.width = `${petalSize}px`;
                petal.style.height = `${petalSize}px`;
                petal.style.background = petalColor;
                petal.style.left = `${px}px`;
                petal.style.top = `${py}px`;
                el.appendChild(petal);
            }

            // Center
            const center = document.createElement('div');
            center.className = 'flower-center';
            center.style.background = centerColor;
            center.style.left = '-2px';
            center.style.top = '-2px';
            el.appendChild(center);

            // Stem
            const stem = document.createElement('div');
            const stemH = 6 + Math.random() * 8;
            stem.style.cssText = `
                width:1.5px;height:${stemH}px;
                background:#4ade80;
                position:absolute;top:4px;left:0px;
                border-radius:0 0 1px 1px;
            `;
            el.appendChild(stem);

            return el;
        };

        const spawnFlower = (worldX: number): void => {
            if (!grassContainer || isNightTime() || currentElevation < 500 || worldX < vegetationStartX) return;
            const el = buildFlower();
            el.style.position = 'absolute';
            el.style.left = '0px';
            el.style.opacity = `${0.6 + Math.random() * 0.3}`;
            grassContainer.appendChild(el);
            flowers.push({el, worldX});
        };

        const updateFlowers = (): void => {
            if (!grassContainer) return;
            const svgRect = roadSvg.getBoundingClientRect();
            const sceneRect = sceneWrapper.getBoundingClientRect();
            const scaleX = svgRect.width / 1000;
            const scaleY = svgRect.height / 400;

            // Spawn flowers ahead
            const rightEdge = roadOffsetX + 1200;
            while (flowerNextX < rightEdge) {
                if (Math.random() < 0.6) spawnFlower(flowerNextX);
                flowerNextX += FLOWER_INTERVAL + Math.random() * 60;
            }

            for (let i = flowers.length - 1; i >= 0; i--) {
                const f = flowers[i];
                const screenX = (f.worldX - roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

                if (screenX < -20) {
                    f.el.remove();
                    flowers.splice(i, 1);
                    continue;
                }

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
                // Flowers slightly above road
                f.el.style.left = `${screenX + 5}px`;
                f.el.style.top = `${screenY - 8}px`;
            }
        };

        // =============================================
        // METRICS
        // =============================================
        const setMetrics = (btn: Element): void => {
            const get = (attr: string) => btn.getAttribute(attr) ?? '-';

            const animateMetric = (el: HTMLElement | null, value: string): void => {
                if (!el) return;
                gsapTo(el, {
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

            // Update metrics immediately
            setMetrics(btn);

            // Apply new road angle immediately so new terrain segments use it —
            // the flag will visually mark the slope transition point.
            currentAngle = angle;
            sceneWrapper.dataset.angle = String(currentAngle);

            // Update vegetation boundary immediately (starts at the flag position)
            const wasHighElevation = currentElevation >= 500;
            const newHighElevation = elevation >= 500;
            currentElevation = elevation; // update immediately for vegetation checks
            const flagWorldX = roadOffsetX + 1100;
            if (!wasHighElevation && newHighElevation) {
                vegetationStartX = flagWorldX;
            } else if (wasHighElevation && !newHighElevation) {
                vegetationStartX = Infinity;
            }

            // Place activity flag on the road ahead of the runner,
            // with pending speed/sky values that will apply when the runner reaches it
            const activityName = btn.getAttribute('data-activity-name') ?? '';
            const worldX = roadOffsetX + 1100;
            const wrapper = document.createElement('div');
            wrapper.className = 'scene-flag';
            const banner = document.createElement('div');
            banner.className = 'scene-flag-banner';
            const pole = document.createElement('div');
            pole.className = 'scene-flag-pole';
            wrapper.appendChild(banner);
            wrapper.appendChild(pole);
            wrapper.addEventListener('mouseenter', () => showFlagTooltip(activityName, wrapper));
            wrapper.addEventListener('mouseleave', hideFlagTooltip);
            sceneWrapper.appendChild(wrapper);
            flags.push({
                el: wrapper,
                worldX,
                name: activityName,
                pendingSpeed: speed > 0 ? speed : 2.5,
                pendingAngle: angle,
                pendingElevation: elevation,
                pendingHour: hour,
                applied: false,
            });

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
            updateCelestial(initHour);
            // If initial activity has high elevation, allow vegetation from the start
            if (currentElevation >= 500) vegetationStartX = -Infinity;
        }

        LAYER_RATIOS.forEach((r, i) => {
            layerNextX[i] = r > 0 ? -200 : -200;
        });

        initRoad();
        initMountains();
        updateScrollSpeed();
        renderRoad();
        positionRunner();

        if (!reducedMotion) {
            requestAnimationFrame(tick);
            scheduleBob();
            safeTimeout(scheduleSurprise, 2000);
            safeTimeout(scheduleRunnerDrift, 3000);
            safeTimeout(scheduleBird, 1000);
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
        const loadingLabel = activitySection.dataset.loadingLabel
            ?? (locale === 'it' ? 'Caricamento attività…' : 'Loading activities…');

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
                setActivitiesLoading(false);
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

// Debounced init: astro:page-load fires on initial + SPA navigation,
// astro:after-swap fires before page-load during SPA nav.
// We use a single debounced call to avoid double-init.
let initTimer: number | null = null;
const scheduleInit = () => {
    if (initTimer !== null) clearTimeout(initTimer);
    initTimer = window.setTimeout(() => {
        initTimer = null;
        initDashboard();
    }, 10);
};

document.addEventListener('astro:page-load', scheduleInit);
document.addEventListener('astro:after-swap', scheduleInit);
