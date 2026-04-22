import type gsap from 'gsap';

export interface RoadPoint {
    x: number;
    y: number;
}

export interface FlagData {
    el: HTMLElement;
    worldX: number;
    name: string;
    pendingSpeed?: number;
    pendingAngle?: number;
    pendingElevation?: number;
    pendingHour?: number;
    applied?: boolean;
}

export interface ScrollElement {
    el: HTMLElement;
    worldX: number;
    parallaxRatio: number;
    topPx: number;
    heightPx: number;
}

export interface BirdData {
    el: HTMLElement;
    x: number;
    y: number;
    speed: number;
    wobblePhase: number;
}

export interface GrassTuft {
    el: HTMLElement;
    worldX: number;
}

export interface FlowerData {
    el: HTMLElement;
    worldX: number;
}

export interface MountainLayer {
    el: SVGSVGElement;
    speed: number;
}

export type SkyPalette = [string, string, string];

/** Shared mutable state passed between scene modules */
export interface SceneState {
    alive: boolean;
    roadOffsetX: number;
    currentSpeed: number;
    currentAngle: number;
    currentElevation: number;
    currentHour: number;
    baseScrollSpeed: number;
    speedMultiplier: number;
    runnerXRatio: number;
    runnerXTarget: number;
    runnerBobY: number;
    runnerBobTargetY: number;
    runnerBobX: number;
    runnerBobTargetX: number;
    lastY: number;
    direction: number;
    vegetationStartX: number;
    lastTime: number;
}

export type GsapTo = (target: any, vars: gsap.TweenVars) => gsap.core.Tween;
export type SafeTimeout = (fn: () => void, ms: number) => number;

export const clamp = (v: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, v));

