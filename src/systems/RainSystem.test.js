import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { RainSystem, getRainCoverage } from './RainSystem.js';

describe('RainSystem', () => {
    let scene;

    beforeEach(() => {
        scene = new THREE.Scene();
        RainSystem.points = null;
        RainSystem._positions = null;
        RainSystem._velocities = null;
        RainSystem._active = false;
    });

    it('init creates points attached to scene', () => {
        RainSystem.init(scene);
        expect(RainSystem.points).toBeInstanceOf(THREE.Points);
        expect(scene.children).toContain(RainSystem.points);
        expect(RainSystem.points.visible).toBe(false);
    });

    it('setActive toggles visibility', () => {
        RainSystem.init(scene);
        RainSystem.setActive(true);
        expect(RainSystem.points.visible).toBe(true);
        RainSystem.setActive(false);
        expect(RainSystem.points.visible).toBe(false);
    });

    it('update moves particles when active', () => {
        RainSystem.init(scene);
        RainSystem.setActive(true);
        const yBefore = RainSystem._positions[1];
        RainSystem.update(0.1, 100, 200, 1, 4 / 3);
        expect(RainSystem._positions[1]).not.toBe(yBefore);
        const cover = getRainCoverage(1, 4 / 3);
        expect(RainSystem.points.position.x).toBeCloseTo(100 + cover.offsetX);
        expect(RainSystem.points.position.z).toBeCloseTo(200 + cover.offsetZ);
    });

    it('getRainCoverage grows when zooming out', () => {
        const zoomedIn = getRainCoverage(2, 4 / 3);
        const zoomedOut = getRainCoverage(0.6, 4 / 3);
        expect(zoomedOut.halfW).toBeGreaterThan(zoomedIn.halfW);
    });
});
