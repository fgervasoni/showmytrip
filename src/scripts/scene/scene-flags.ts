import { type FlagData, type RoadPoint, type ScrollElement, type SceneState, type GsapTo } from './scene-types';
import { getRoadYAtWorldX } from './scene-road';
import { isNightTime, applySkyColors, updateCelestial } from './scene-sky';
import { clamp } from './scene-types';

export function createFlag(
    activityName: string,
    worldX: number,
    sceneWrapper: HTMLElement,
    showTooltip: (name: string, el: HTMLElement) => void,
    hideTooltip: () => void,
): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'scene-flag';
    const banner = document.createElement('div');
    banner.className = 'scene-flag-banner';
    const pole = document.createElement('div');
    pole.className = 'scene-flag-pole';
    wrapper.appendChild(banner);
    wrapper.appendChild(pole);
    wrapper.addEventListener('mouseenter', () => showTooltip(activityName, wrapper));
    wrapper.addEventListener('mouseleave', hideTooltip);
    sceneWrapper.appendChild(wrapper);
    return wrapper;
}

export function positionFlags(
    flags: FlagData[],
    scrollElements: ScrollElement[],
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    state: SceneState,
    skyGradientStops: NodeListOf<SVGStopElement> | SVGStopElement[],
    celestialBody: HTMLElement | null,
    gsapTo: GsapTo,
): void {
    if (flags.length === 0) return;
    const svgRect = roadSvg.getBoundingClientRect();
    const sceneRect = sceneWrapper.getBoundingClientRect();
    const scaleX = svgRect.width / 1000;
    const scaleY = svgRect.height / 400;

    const runnerWorldX = state.runnerXRatio * 1000 + state.roadOffsetX;

    for (let i = flags.length - 1; i >= 0; i--) {
        const f = flags[i];
        const screenX = (f.worldX - state.roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

        // Apply pending values when runner reaches flag
        if (!f.applied && runnerWorldX >= f.worldX) {
            f.applied = true;
            if (f.pendingSpeed !== undefined) {
                const wasNight = isNightTime(state.currentHour);
                state.currentSpeed = f.pendingSpeed;
                state.currentAngle = f.pendingAngle ?? state.currentAngle;
                state.currentElevation = f.pendingElevation ?? state.currentElevation;
                state.currentHour = f.pendingHour ?? state.currentHour;
                sceneWrapper.dataset.speed = String(state.currentSpeed);
                sceneWrapper.dataset.angle = String(state.currentAngle);
                state.baseScrollSpeed = 60;
                state.speedMultiplier = clamp((state.currentSpeed > 0 ? state.currentSpeed : 2.5) / 3.5, 0.5, 2.0);
                applySkyColors(state.currentHour, skyGradientStops, gsapTo);
                updateCelestial(state.currentHour, celestialBody, sceneWrapper, gsapTo);

                if (wasNight !== isNightTime(state.currentHour)) {
                    scrollElements.forEach((item) => item.el.remove());
                    scrollElements.length = 0;
                }
            }
        }

        if (screenX < -20) {
            f.el.remove();
            flags.splice(i, 1);
            continue;
        }

        const roadY = getRoadYAtWorldX(roadPoints, f.worldX);
        const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
        f.el.style.left = `${screenX - 1}px`;
        f.el.style.top = `${screenY - 38}px`;
    }
}

