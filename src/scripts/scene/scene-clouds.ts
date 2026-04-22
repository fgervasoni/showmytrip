import {type RoadPoint, type SceneState, type ScrollElement} from './scene-types';
import {isNightTime} from './scene-sky';

const LAYER_RATIOS = [0.025, 0.07, 0.16];
const LAYER_INTERVALS = [300, 170, 260];
const LAYER_W = [[22, 48], [50, 110], [80, 155]];
const LAYER_H_MULT = [0.38, 0.32, 0.27];
const LAYER_OP = [[0.18, 0.32], [0.38, 0.65], [0.08, 0.18]];
const LAYER_Y = [[0.03, 0.22], [0.06, 0.50], [0.02, 0.28]];

export {LAYER_RATIOS};

function buildCloud(w: number, h: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cloud-el';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    const bumpCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < bumpCount; i++) {
        const bump = document.createElement('div');
        const bw = Math.round(w * (0.3 + Math.random() * 0.35));
        const bh = Math.round(bw * (0.7 + Math.random() * 0.6));
        bump.style.cssText = `
            position:absolute;background:white;border-radius:50%;
            width:${bw}px;height:${bh}px;
            left:${Math.round((i / bumpCount) * w * 0.7)}px;
            top:${Math.round(-bh * (0.4 + Math.random() * 0.3))}px;
        `;
        el.appendChild(bump);
    }
    return el;
}

function buildStar(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'star-el';
    const size = 2 + Math.random() * 3;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.animationDelay = `${Math.random() * 3}s`;
    return el;
}

function getRoadScreenY(
    worldX: number,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
): number {
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
}

function spawnElement(
    worldX: number,
    layerIdx: number,
    scrollElements: ScrollElement[],
    container: HTMLElement,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    currentHour: number,
): void {
    const roadY = getRoadScreenY(worldX, roadPoints, roadSvg, sceneWrapper);
    const sceneH = sceneWrapper.getBoundingClientRect().height || 340;

    if (isNightTime(currentHour)) {
        const el = buildStar();
        el.style.position = 'absolute';
        el.style.left = '0px';
        const maxTop = Math.max(5, roadY - 10);
        const top = 5 + Math.random() * Math.max(10, maxTop - 5);
        el.style.top = `${top}px`;
        el.style.opacity = `${0.5 + Math.random() * 0.5}`;
        container.appendChild(el);
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
        container.appendChild(el);
        scrollElements.push({el, worldX, parallaxRatio: LAYER_RATIOS[layerIdx], topPx: top, heightPx: h});
    }
}

export function renderScrollElements(
    scrollElements: ScrollElement[],
    layerNextX: number[],
    container: HTMLElement | null,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    state: SceneState,
): void {
    if (!container) return;
    const svgRect = roadSvg.getBoundingClientRect();
    const sceneRect = sceneWrapper.getBoundingClientRect();
    const svgScaleX = svgRect.width / 1000;

    LAYER_RATIOS.forEach((ratio, i) => {
        const rightEdge = state.roadOffsetX * ratio + 1200;
        while (layerNextX[i] < rightEdge) {
            spawnElement(layerNextX[i], i, scrollElements, container, roadPoints, roadSvg, sceneWrapper, state.currentHour);
            layerNextX[i] += LAYER_INTERVALS[i] + Math.random() * 80;
        }
    });

    for (let i = scrollElements.length - 1; i >= 0; i--) {
        const item = scrollElements[i];
        const offset = state.roadOffsetX * item.parallaxRatio;
        const screenX = (item.worldX - offset) * svgScaleX + (svgRect.left - sceneRect.left);
        if (screenX < -200) {
            item.el.remove();
            scrollElements.splice(i, 1);
        } else {
            item.el.style.left = `${screenX}px`;
        }
    }
}

