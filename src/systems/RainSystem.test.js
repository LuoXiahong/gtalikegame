import { describe, it, expect, beforeEach, vi } from 'vitest';
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
        RainSystem.splashMesh = null;
        RainSystem._splashAge = null;
        RainSystem._splashX = null;
        RainSystem._splashZ = null;
        RainSystem._splashCursor = 0;
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

    describe('ground-hit splash pool (T57)', () => {
        it('init creates a splash InstancedMesh pool alongside the streaks', () => {
            RainSystem.init(scene);
            expect(RainSystem.splashMesh).toBeInstanceOf(THREE.InstancedMesh);
            expect(scene.children).toContain(RainSystem.splashMesh);
            expect(RainSystem.splashMesh.visible).toBe(false);
            expect(RainSystem.splashMesh.count).toBeGreaterThan(10);
        });

        it('setActive toggles splash pool visibility with the streaks', () => {
            RainSystem.init(scene);
            RainSystem.setActive(true);
            expect(RainSystem.splashMesh.visible).toBe(true);
            RainSystem.setActive(false);
            expect(RainSystem.splashMesh.visible).toBe(false);
        });

        it('triggering a splash grows it (scale > 0) then fades it back to 0', () => {
            RainSystem.init(scene);
            RainSystem.setActive(true);
            RainSystem._triggerSplash(5, 7);

            const idx = 0; // _splashCursor started at 0, so this claimed slot 0
            expect(RainSystem._splashAge[idx]).toBe(0);
            expect(RainSystem._splashX[idx]).toBe(5);
            expect(RainSystem._splashZ[idx]).toBe(7);

            // Pin ambient rain resets so ~0.5s of simulated update() calls below
            // can't naturally re-trigger and reclaim slot 0 via round-robin —
            // this test isolates the age→scale decay curve, not the pool's
            // ambient occupancy under real rain.
            const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);

            RainSystem.update(0.01, 0, 0, 1, 4 / 3);
            const grown = new THREE.Matrix4();
            RainSystem.splashMesh.getMatrixAt(idx, grown);
            // Matrix4.decompose() special-cases det===0 as scale (1,1,1) (three.js
            // guards against a divide-by-zero in the rotation extraction below it),
            // so a plain scale+translate matrix's own scale reads straight off
            // elements[0] (x-basis x-component) instead.
            expect(grown.elements[0]).toBeGreaterThan(0);

            // Advance well past SPLASH_LIFETIME (0.3s) — should decay back to 0.
            // update() clamps dt to 0.05/call, so accumulate over several calls.
            for (let i = 0; i < 10; i++) RainSystem.update(0.05, 0, 0, 1, 4 / 3);
            const faded = new THREE.Matrix4();
            RainSystem.splashMesh.getMatrixAt(idx, faded);
            expect(faded.elements[0]).toBeCloseTo(0);

            randomSpy.mockRestore();
        });

        it('untriggered pool slots start at scale 0 (no stray glints on init)', () => {
            RainSystem.init(scene);
            const lastSlot = RainSystem.splashMesh.count - 1;
            const m = new THREE.Matrix4();
            RainSystem.splashMesh.getMatrixAt(lastSlot, m);
            expect(m.elements[0]).toBe(0);
        });
    });
});
