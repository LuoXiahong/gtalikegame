import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { RainSystem, getRainCoverage } from './RainSystem.js';

describe('RainSystem', () => {
    let scene;

    beforeEach(() => {
        scene = new THREE.Scene();
        RainSystem.mesh = null;
        RainSystem._positions = null;
        RainSystem._velocities = null;
        RainSystem._lengthScales = null;
        RainSystem._active = false;
    });

    it('init creates InstancedMesh streaks attached to scene', () => {
        RainSystem.init(scene);
        expect(RainSystem.mesh).toBeInstanceOf(THREE.InstancedMesh);
        expect(scene.children).toContain(RainSystem.mesh);
        expect(RainSystem.mesh.visible).toBe(false);
        expect(RainSystem.mesh.count).toBeGreaterThan(100);
        expect(RainSystem.mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    });

    it('setActive toggles visibility', () => {
        RainSystem.init(scene);
        RainSystem.setActive(true);
        expect(RainSystem.mesh.visible).toBe(true);
        RainSystem.setActive(false);
        expect(RainSystem.mesh.visible).toBe(false);
    });

    it('update moves particles when active', () => {
        RainSystem.init(scene);
        RainSystem.setActive(true);
        const yBefore = RainSystem._positions[1];
        const matrixBefore = new THREE.Matrix4();
        RainSystem.mesh.getMatrixAt(0, matrixBefore);
        RainSystem.update(0.1, 100, 200, 1, 4 / 3);
        expect(RainSystem._positions[1]).not.toBe(yBefore);
        const cover = getRainCoverage(1, 4 / 3);
        expect(RainSystem.mesh.position.x).toBeCloseTo(100 + cover.offsetX);
        expect(RainSystem.mesh.position.z).toBeCloseTo(200 + cover.offsetZ);
        const matrixAfter = new THREE.Matrix4();
        RainSystem.mesh.getMatrixAt(0, matrixAfter);
        expect(matrixAfter.equals(matrixBefore)).toBe(false);
    });

    it('getRainCoverage grows when zooming out', () => {
        const zoomedIn = getRainCoverage(2, 4 / 3);
        const zoomedOut = getRainCoverage(0.6, 4 / 3);
        expect(zoomedOut.halfW).toBeGreaterThan(zoomedIn.halfW);
    });
});
