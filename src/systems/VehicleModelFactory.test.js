import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    createVehicleModel,
    pickArchetypeKey,
    VEHICLE_ARCHETYPES
} from './VehicleModelFactory.js';

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
});
