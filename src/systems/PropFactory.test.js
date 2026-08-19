import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    createProp,
    createPropAt,
    PROP_TYPES,
    STREET_LIGHT_DISTANCE,
    createPooledStreetLight
} from './PropFactory.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { STREET_LIGHT_BASE } from './RenderSystem3D.js';

describe('PropFactory', () => {
    it('exposes the five sidewalk archetypes', () => {
        expect(PROP_TYPES).toEqual(['lampPost', 'hydrant', 'bench', 'kiosk', 'trashCan']);
    });

    it.each(PROP_TYPES)('creates a Group for %s', (type) => {
        const prop = createProp(type);
        expect(prop).toBeInstanceOf(THREE.Group);
        expect(prop.userData.propType).toBe(type);
        expect(prop.children.length).toBeGreaterThan(0);
    });

    it('maps fireHydrant alias to hydrant', () => {
        const prop = createProp('fireHydrant');
        expect(prop.userData.propType).toBe('hydrant');
    });

    it('carries no light of its own — lamp posts only advertise a light position', () => {
        // 72 posts each owning a PointLight meant MeshStandardMaterial evaluated
        // 72 lights per fragment with no distance culling. Posts now publish a
        // spot and RenderSystem3D's fixed pool moves onto the nearest ones.
        const lamp = createProp('lampPost');
        const lights = [];
        let poolCount = 0;
        lamp.traverse(obj => {
            if (obj.isLight) lights.push(obj);
            if (obj.userData?.isStreetLightPool) poolCount++;
        });
        expect(lights.length).toBe(0);
        expect(poolCount).toBe(0);
        expect(lamp.userData.lampLightOffset).toEqual({ x: 0.75, y: 4.9, z: 0 });
    });

    it('createPooledStreetLight yields a reusable street light', () => {
        const light = createPooledStreetLight();
        expect(light).toBeInstanceOf(THREE.PointLight);
        expect(light.userData.isStreetLight).toBe(true);
        expect(light.distance).toBe(STREET_LIGHT_DISTANCE);
        expect(light.intensity).toBeCloseTo(STREET_LIGHT_BASE);
        expect(light.castShadow).toBe(false);
        expect(light.userData.baseIntensity).toBeCloseTo(STREET_LIGHT_BASE);
    });

    it('uses an unlit pole material so nearby PointLights cannot specular-flicker', () => {
        const lamp = createProp('lampPost');
        const pole = lamp.children.find(c => c.userData?.isLampPole);
        expect(pole).toBeDefined();
        expect(pole.material).toBeInstanceOf(THREE.MeshBasicMaterial);
        expect(pole.material.color.getHex()).toBe(0x3a3a42);
    });

    it('does not add lights to non-lamp props', () => {
        for (const type of ['hydrant', 'bench', 'kiosk', 'trashCan']) {
            const prop = createProp(type);
            let lightCount = 0;
            prop.traverse(obj => {
                if (obj.isLight) lightCount++;
            });
            expect(lightCount).toBe(0);
        }
    });

    it('places prop at sidewalk height via createPropAt', () => {
        const prop = createPropAt('bench', 10, 20, Math.PI / 2);
        expect(prop.position.x).toBe(10);
        expect(prop.position.z).toBe(20);
        expect(prop.position.y).toBeCloseTo(WorldMetrics.SIDEWALK_HEIGHT);
        expect(prop.rotation.y).toBeCloseTo(Math.PI / 2);
    });
});
