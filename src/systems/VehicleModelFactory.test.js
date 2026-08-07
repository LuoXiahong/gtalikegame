import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    createVehicleModel,
    pickArchetypeKey,
    VEHICLE_ARCHETYPES
} from './VehicleModelFactory.js';
import { EventBus } from '../core/EventBus.js';

describe('VehicleModelFactory', () => {
    it('exposes period archetypes with silhouette flags', () => {
        expect(VEHICLE_ARCHETYPES.sedan_30s).toBeDefined();
        expect(VEHICLE_ARCHETYPES.sedan_30s.fendersSeparate).toBe(true);
        expect(VEHICLE_ARCHETYPES.sedan_30s.runningBoard).toBe(true);
        expect(VEHICLE_ARCHETYPES.sedan_30s.headlampStyle).toBe('round_exposed');
        expect(VEHICLE_ARCHETYPES.sedan_30s.grilleStyle).toBe('vertical_slats');
        expect(VEHICLE_ARCHETYPES.sedan_30s.whitewallTires).toBe(true);
        expect(VEHICLE_ARCHETYPES.coupe_30s).toBeDefined();
        expect(VEHICLE_ARCHETYPES.panel_van_30s).toBeDefined();
    });

    it('picks archetype stably from entity id', () => {
        const keys = Object.keys(VEHICLE_ARCHETYPES);
        expect(pickArchetypeKey('car_0')).toBe(keys[0]);
        expect(pickArchetypeKey('car_1')).toBe(keys[1 % keys.length]);
        expect(pickArchetypeKey('car_0')).toBe(pickArchetypeKey('traffic_0'));
    });

    it('creates a Group with multiple meshes for sedan_30s', () => {
        const model = createVehicleModel(0x1a1a1a, 'sedan_30s');
        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBeGreaterThan(8);

        let meshCount = 0;
        model.traverse(child => {
            if (child.isMesh) meshCount++;
        });
        expect(meshCount).toBeGreaterThan(8);

        const shadow = model.children.find(c => c.name === 'contactShadow');
        expect(shadow).toBeDefined();
        expect(shadow.material.transparent).toBe(true);
        expect(shadow.rotation.x).toBeCloseTo(-Math.PI / 2);
    });

    it('falls back to sedan_30s for unknown archetype key', () => {
        const model = createVehicleModel(0x5c1a1a, 'does_not_exist');
        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBeGreaterThan(0);
    });

    describe('weather reactivity', () => {
        function findMaterial(model, colorHex) {
            let found = null;
            model.traverse(child => {
                if (!found && child.isMesh && child.material?.color?.getHex() === colorHex) {
                    found = child.material;
                }
            });
            return found;
        }

        it('dims roughness and albedo on rain, restores exactly on clear', () => {
            const model = createVehicleModel(0x2266aa, 'sedan_30s');
            const bodyMat = model.children[0].material; // chassis (paint body)
            const darkMat = model.children[1].material; // cabin
            const chromeMat = findMaterial(model, 0xc0c0c0);
            expect(chromeMat).toBeTruthy();

            const baseBodyRoughness = bodyMat.roughness;
            const baseBodyColor = bodyMat.color.getHex();
            const baseDarkRoughness = darkMat.roughness;
            const baseDarkColor = darkMat.color.getHex();
            const baseChromeRoughness = chromeMat.roughness;
            const baseChromeColor = chromeMat.color.getHex();

            EventBus.emit('weather_change', 'rain');

            expect(bodyMat.roughness).toBeLessThan(baseBodyRoughness);
            expect(bodyMat.color.getHex()).not.toBe(baseBodyColor);
            expect(darkMat.roughness).toBeLessThan(baseDarkRoughness);
            expect(darkMat.color.getHex()).not.toBe(baseDarkColor);
            expect(chromeMat.roughness).toBeLessThan(baseChromeRoughness);
            expect(chromeMat.color.getHex()).not.toBe(baseChromeColor);

            EventBus.emit('weather_change', 'clear');

            expect(bodyMat.roughness).toBeCloseTo(baseBodyRoughness);
            expect(bodyMat.color.getHex()).toBe(baseBodyColor);
            expect(darkMat.roughness).toBeCloseTo(baseDarkRoughness);
            expect(darkMat.color.getHex()).toBe(baseDarkColor);
            expect(chromeMat.roughness).toBeCloseTo(baseChromeRoughness);
            expect(chromeMat.color.getHex()).toBe(baseChromeColor);
        });

        it('does not drift after repeated rain/clear toggles', () => {
            const model = createVehicleModel(0x334455, 'coupe_30s');
            const bodyMat = model.children[0].material;
            const baseRoughness = bodyMat.roughness;
            const baseColor = bodyMat.color.getHex();

            for (let i = 0; i < 3; i++) {
                EventBus.emit('weather_change', 'rain');
                EventBus.emit('weather_change', 'clear');
            }

            expect(bodyMat.roughness).toBeCloseTo(baseRoughness);
            expect(bodyMat.color.getHex()).toBe(baseColor);
        });
    });
});
