import { type SkyPalette, type GsapTo, clamp } from './scene-types';

export function getSkyColors(hour: number): SkyPalette {
    if (hour >= 5 && hour < 7) return ['#1e3a5f', '#f97316', '#fbbf24'];
    if (hour >= 7 && hour < 10) return ['#38bdf8', '#7dd3fc', '#e0f2fe'];
    if (hour >= 10 && hour < 16) return ['#0ea5e9', '#38bdf8', '#bae6fd'];
    if (hour >= 16 && hour < 18) return ['#0284c7', '#f59e0b', '#fde68a'];
    if (hour >= 18 && hour < 20) return ['#1e3a5f', '#dc2626', '#fb923c'];
    if (hour >= 20 && hour < 22) return ['#0f172a', '#1e3a5f', '#475569'];
    return ['#020617', '#0f172a', '#1e293b'];
}

export function applySkyColors(
    hour: number,
    skyGradientStops: NodeListOf<SVGStopElement> | SVGStopElement[],
    gsapTo: GsapTo,
): void {
    if (skyGradientStops.length < 3) return;
    const [top, mid, bottom] = getSkyColors(hour);
    gsapTo(skyGradientStops[0], { attr: { 'stop-color': top }, duration: 1.5, ease: 'power2.inOut' });
    gsapTo(skyGradientStops[1], { attr: { 'stop-color': mid }, duration: 1.5, ease: 'power2.inOut' });
    gsapTo(skyGradientStops[2], { attr: { 'stop-color': bottom }, duration: 1.5, ease: 'power2.inOut' });
}

export function updateCelestial(
    hour: number,
    celestialBody: HTMLElement | null,
    sceneWrapper: HTMLElement,
    gsapTo: GsapTo,
): void {
    if (!celestialBody) return;
    const isNight = hour >= 20 || hour < 6;

    celestialBody.classList.toggle('celestial-sun', !isNight);
    celestialBody.classList.toggle('celestial-moon', isNight);

    let progress: number;
    if (!isNight) {
        progress = clamp((hour - 6) / 14, 0, 1);
    } else {
        const nightHour = hour >= 20 ? hour - 20 : hour + 4;
        progress = clamp(nightHour / 10, 0, 1);
    }

    const sceneW = sceneWrapper.getBoundingClientRect().width || 800;
    const sceneH = sceneWrapper.getBoundingClientRect().height || 340;

    const x = sceneW * (0.08 + progress * 0.84);
    const topMin = sceneH * 0.06;
    const topMax = sceneH * 0.52;
    const parabola = 4 * (progress - 0.5) ** 2;
    const topY = topMin + (topMax - topMin) * parabola;

    gsapTo(celestialBody, { left: x - 20, top: topY, duration: 1.5, ease: 'power2.inOut' });

    const edgeFade = 1 - Math.max(0, (Math.abs(progress - 0.5) - 0.35) / 0.15);
    gsapTo(celestialBody, { opacity: clamp(edgeFade, 0.1, 1), duration: 1.5, ease: 'power2.inOut' });
}

export function isNightTime(currentHour: number): boolean {
    return currentHour >= 20 || currentHour < 6;
}

