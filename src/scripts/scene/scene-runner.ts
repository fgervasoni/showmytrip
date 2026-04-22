import { type RoadPoint, type SceneState } from './scene-types';
import { getRoadYAtWorldX } from './scene-road';

export function getRunnerRoadY(roadPoints: RoadPoint[], state: SceneState): number {
    const screenX = state.runnerXRatio * 1000 + state.roadOffsetX;
    return getRoadYAtWorldX(roadPoints, screenX);
}

export function positionRunner(
    state: SceneState,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    runnerGif: HTMLImageElement,
): void {
    const svgRect = roadSvg.getBoundingClientRect();
    const sceneRect = sceneWrapper.getBoundingClientRect();
    const roadY = getRunnerRoadY(roadPoints, state);
    const scaleX = svgRect.width / 1000;
    const scaleY = svgRect.height / 400;
    const screenX = svgRect.left - sceneRect.left + state.runnerXRatio * 1000 * scaleX + state.runnerBobX;
    const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
    const w = runnerGif.offsetWidth || 60;
    const h = runnerGif.offsetHeight || 80;

    runnerGif.style.left = `${screenX - w / 2}px`;
    runnerGif.style.top = `${screenY - h + state.runnerBobY}px`;
}

