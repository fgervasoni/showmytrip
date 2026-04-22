import { type RoadPoint, type SceneState, clamp } from './scene-types';

const SEGMENT_WIDTH = 40;
const TOTAL_SEGMENTS = Math.ceil(1000 / SEGMENT_WIDTH) + 4;

export { SEGMENT_WIDTH };

export function generateNextY(state: SceneState): number {
    const angleNorm = state.currentAngle / 35;
    const angleSq = angleNorm * angleNorm;

    const stepBase = 1 + angleSq * 27;
    const step = stepBase + (Math.random() * stepBase * 0.6);

    state.lastY += state.direction * step;

    const range = 8 + angleSq * 115;
    const upperLimit = clamp(320 - range, 175, 312);
    const lowerLimit = clamp(320 + range, 328, 400);

    if (state.lastY <= upperLimit) {
        state.lastY = upperLimit;
        state.direction = 1;
    } else if (state.lastY >= lowerLimit) {
        state.lastY = lowerLimit;
        state.direction = -1;
    }

    const changeChance = state.currentAngle > 5 ? 0.08 : 0.15;
    if (Math.random() < changeChance) {
        state.direction *= -1;
    }

    const noise = (Math.random() - 0.5) * 4;
    return clamp(state.lastY + noise, 250, 395);
}

export function initRoad(roadPoints: RoadPoint[], state: SceneState): void {
    roadPoints.length = 0;
    state.lastY = 320;
    state.direction = -1;
    for (let i = 0; i < TOTAL_SEGMENTS; i++) {
        roadPoints.push({ x: i * SEGMENT_WIDTH, y: generateNextY(state) });
    }
    state.roadOffsetX = 0;
}

export function renderRoad(
    roadPoints: RoadPoint[],
    state: SceneState,
    roadPolyline: SVGPolylineElement,
    skyFill: SVGPolygonElement | null,
    groundFill: SVGPolygonElement | null,
): void {
    const { roadOffsetX } = state;
    const pts = roadPoints
        .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ');
    roadPolyline.setAttribute('points', pts);

    if (skyFill) {
        const roadPtsStr = roadPoints
            .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
            .reverse()
            .join(' ');
        skyFill.setAttribute('points', `-200,0 1200,0 ${roadPtsStr}`);
    }

    if (groundFill) {
        const roadPtsStr = roadPoints
            .map((p) => `${(p.x - roadOffsetX).toFixed(1)},${p.y.toFixed(1)}`)
            .join(' ');
        groundFill.setAttribute('points', `${roadPtsStr} 1200,400 -200,400`);
    }
}

export function getLocalSlope(roadPoints: RoadPoint[], state: SceneState): number {
    const screenX = state.runnerXRatio * 1000 + state.roadOffsetX;
    for (let i = 0; i < roadPoints.length - 1; i++) {
        const p0 = roadPoints[i];
        const p1 = roadPoints[i + 1];
        if (screenX >= p0.x && screenX <= p1.x) {
            return (p0.y - p1.y) / SEGMENT_WIDTH;
        }
    }
    return 0;
}

export function getRoadYAtWorldX(roadPoints: RoadPoint[], worldX: number): number {
    for (let i = 0; i < roadPoints.length - 1; i++) {
        const p0 = roadPoints[i];
        const p1 = roadPoints[i + 1];
        if (worldX >= p0.x && worldX <= p1.x) {
            const t = (worldX - p0.x) / (p1.x - p0.x);
            return p0.y + (p1.y - p0.y) * t;
        }
    }
    return 320;
}

