import {type MountainLayer} from './scene-types';

export function buildMountainSVG(peaks: number[], color: string, opacity: number): SVGSVGElement {
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
}

export function initMountains(
    container: HTMLElement | null,
    layers: MountainLayer[],
): void {
    if (!container) return;
    container.innerHTML = '';
    layers.length = 0;

    const farPeaks = Array.from({length: 35}, () => 170 + Math.random() * 80);
    const farSvg = buildMountainSVG(farPeaks, '#b89494', 1);
    container.appendChild(farSvg);
    layers.push({el: farSvg, speed: 0.005});

    const midPeaks = Array.from({length: 20}, () => 120 + Math.random() * 80);
    const midSvg = buildMountainSVG(midPeaks, '#8b6464', 1);
    container.appendChild(midSvg);
    layers.push({el: midSvg, speed: 0.05});

    const nearPeaks = Array.from({length: 5}, () => 70 + Math.random() * 80);
    const nearSvg = buildMountainSVG(nearPeaks, '#694747', 1);
    container.appendChild(nearSvg);
    layers.push({el: nearSvg, speed: 0.1});
}

export function updateMountains(layers: MountainLayer[], roadOffsetX: number): void {
    layers.forEach(({el, speed}) => {
        const offset = -(roadOffsetX * speed) % (el.getBoundingClientRect().width / 2 || 1600);
        el.style.transform = `translateX(${offset}px)`;
    });
}


