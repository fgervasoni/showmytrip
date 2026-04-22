import { type BirdData, type SafeTimeout } from './scene-types';
import { isNightTime } from './scene-sky';

export function buildBird(size: number, night: boolean): HTMLElement {
    const el = document.createElement('div');
    el.className = 'bird-el';
    el.style.width = `${size}px`;
    el.style.height = `${size * 0.6}px`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 12');
    svg.setAttribute('overflow', 'visible');
    svg.style.width = '100%';
    svg.style.height = '100%';

    const color = night ? '#94a3b8' : '#1f2937';

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

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    body.setAttribute('cx', '12');
    body.setAttribute('cy', '9');
    body.setAttribute('r', '1.2');
    body.setAttribute('fill', color);
    svg.appendChild(body);

    const flapDuration = 0.3 + Math.random() * 0.25;
    gLeft.style.transformOrigin = '12px 9px';
    gRight.style.transformOrigin = '12px 9px';
    gLeft.style.animation = `bird-flap-left ${flapDuration}s ease-in-out infinite`;
    gRight.style.animation = `bird-flap-right ${flapDuration}s ease-in-out infinite`;

    el.appendChild(svg);
    return el;
}

export function spawnBird(
    birds: BirdData[],
    container: HTMLElement | null,
    sceneWrapper: HTMLElement,
    currentHour: number,
): void {
    if (!container || isNightTime(currentHour)) return;
    const sceneH = sceneWrapper.getBoundingClientRect().height || 340;
    const sceneW = sceneWrapper.getBoundingClientRect().width || 800;
    const size = 12 + Math.random() * 16;
    const el = buildBird(size, isNightTime(currentHour));
    const x = sceneW + 20;
    const y = 15 + Math.random() * sceneH * 0.35;
    const speed = 40 + Math.random() * 60;

    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = `${0.4 + Math.random() * 0.4}`;
    container.appendChild(el);
    birds.push({ el, x, y, speed, wobblePhase: Math.random() * Math.PI * 2 });
}

export function scheduleBird(
    birds: BirdData[],
    container: HTMLElement | null,
    sceneWrapper: HTMLElement,
    currentHourFn: () => number,
    alive: () => boolean,
    safeTimeout: SafeTimeout,
): void {
    const loop = (): void => {
        if (!alive()) return;
        spawnBird(birds, container, sceneWrapper, currentHourFn());
        safeTimeout(loop, 3000 + Math.random() * 6000);
    };
    safeTimeout(loop, 1000);
}

export function updateBirds(birds: BirdData[], dt: number): void {
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
}

