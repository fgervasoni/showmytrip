import {type FlowerData, type GrassTuft, type RoadPoint, type SceneState} from './scene-types';
import {isNightTime} from './scene-sky';
import {getRoadYAtWorldX} from './scene-road';

const GRASS_INTERVAL = 35;
const FLOWER_INTERVAL = 80;

const FLOWER_COLORS = [
    ['#ef4444', '#fbbf24'],
    ['#a855f7', '#fbbf24'],
    ['#3b82f6', '#fde68a'],
    ['#ec4899', '#fbbf24'],
    ['#f97316', '#fde68a'],
    ['#facc15', '#a16207'],
];

// --- Grass ---

function buildGrassTuft(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'grass-tuft';
    const bladeCount = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < bladeCount; i++) {
        const blade = document.createElement('div');
        blade.className = 'grass-blade';
        const h = 6 + Math.random() * 10;
        const hue = 100 + Math.random() * 40;
        const lightness = 35 + Math.random() * 20;
        blade.style.height = `${h}px`;
        blade.style.left = `${i * 3 - (bladeCount * 1.5)}px`;
        blade.style.background = `hsl(${hue}, 50%, ${lightness}%)`;
        blade.style.transform = `rotate(${(Math.random() - 0.5) * 20}deg)`;
        el.appendChild(blade);
    }
    return el;
}

function spawnGrass(
    worldX: number,
    grassTufts: GrassTuft[],
    container: HTMLElement,
    state: SceneState,
): void {
    if (state.currentElevation < 500 || worldX < state.vegetationStartX) return;
    const el = buildGrassTuft();
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.opacity = `${0.5 + Math.random() * 0.35}`;
    container.appendChild(el);
    grassTufts.push({el, worldX});
}

export function updateGrass(
    grassTufts: GrassTuft[],
    grassNextX: { value: number },
    container: HTMLElement | null,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    state: SceneState,
): void {
    if (!container) return;
    const svgRect = roadSvg.getBoundingClientRect();
    const sceneRect = sceneWrapper.getBoundingClientRect();
    const scaleX = svgRect.width / 1000;
    const scaleY = svgRect.height / 400;

    const rightEdge = state.roadOffsetX + 1200;
    while (grassNextX.value < rightEdge) {
        spawnGrass(grassNextX.value, grassTufts, container, state);
        grassNextX.value += GRASS_INTERVAL + Math.random() * 25;
    }

    for (let i = grassTufts.length - 1; i >= 0; i--) {
        const g = grassTufts[i];
        const screenX = (g.worldX - state.roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

        if (screenX < -30) {
            g.el.remove();
            grassTufts.splice(i, 1);
            continue;
        }

        const roadY = getRoadYAtWorldX(roadPoints, g.worldX);
        const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
        const offset = (i % 2 === 0) ? -2 : 3;
        g.el.style.left = `${screenX}px`;
        g.el.style.top = `${screenY + offset}px`;
    }
}

// --- Flowers ---

function buildFlower(): HTMLElement {
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
        petal.style.width = `${petalSize}px`;
        petal.style.height = `${petalSize}px`;
        petal.style.background = petalColor;
        petal.style.left = `${Math.cos(rad) * petalSize}px`;
        petal.style.top = `${Math.sin(rad) * petalSize}px`;
        el.appendChild(petal);
    }

    const center = document.createElement('div');
    center.className = 'flower-center';
    center.style.background = centerColor;
    center.style.left = '-2px';
    center.style.top = '-2px';
    el.appendChild(center);

    const stem = document.createElement('div');
    const stemH = 6 + Math.random() * 8;
    stem.style.cssText = `width:1.5px;height:${stemH}px;background:#4ade80;position:absolute;top:4px;left:0px;border-radius:0 0 1px 1px;`;
    el.appendChild(stem);

    return el;
}

function spawnFlower(
    worldX: number,
    flowers: FlowerData[],
    container: HTMLElement,
    state: SceneState,
): void {
    if (isNightTime(state.currentHour) || state.currentElevation < 500 || worldX < state.vegetationStartX) return;
    const el = buildFlower();
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.opacity = `${0.6 + Math.random() * 0.3}`;
    container.appendChild(el);
    flowers.push({el, worldX});
}

export function updateFlowers(
    flowers: FlowerData[],
    flowerNextX: { value: number },
    container: HTMLElement | null,
    roadPoints: RoadPoint[],
    roadSvg: SVGSVGElement,
    sceneWrapper: HTMLElement,
    state: SceneState,
): void {
    if (!container) return;
    const svgRect = roadSvg.getBoundingClientRect();
    const sceneRect = sceneWrapper.getBoundingClientRect();
    const scaleX = svgRect.width / 1000;
    const scaleY = svgRect.height / 400;

    const rightEdge = state.roadOffsetX + 1200;
    while (flowerNextX.value < rightEdge) {
        if (Math.random() < 0.6) spawnFlower(flowerNextX.value, flowers, container, state);
        flowerNextX.value += FLOWER_INTERVAL + Math.random() * 60;
    }

    for (let i = flowers.length - 1; i >= 0; i--) {
        const f = flowers[i];
        const screenX = (f.worldX - state.roadOffsetX) * scaleX + (svgRect.left - sceneRect.left);

        if (screenX < -20) {
            f.el.remove();
            flowers.splice(i, 1);
            continue;
        }

        const roadY = getRoadYAtWorldX(roadPoints, f.worldX);
        const screenY = svgRect.top - sceneRect.top + roadY * scaleY;
        f.el.style.left = `${screenX + 5}px`;
        f.el.style.top = `${screenY - 8}px`;
    }
}

