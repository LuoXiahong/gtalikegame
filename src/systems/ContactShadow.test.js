import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { addContactShadow, getContactShadowTexture } from './ContactShadow.js';
import { EventBus } from '../core/EventBus.js';

describe('ContactShadow', () => {
    afterEach(() => {
        // Reset shared rain flag so later tests start from clear weather.
        EventBus.emit('weather_change', 'clear');
    });

    it('returns a reusable soft texture', () => {
        const a = getContactShadowTexture();
        const b = getContactShadowTexture();
        expect(a).toBe(b);
        expect(a).toBeInstanceOf(THREE.Texture);
    });

    it('adds a flat transparent plane named contactShadow', () => {
        const group = new THREE.Group();
        const mesh = addContactShadow(group, { width: 1, depth: 0.5, y: 0.02, opacity: 0.3 });

        expect(group.children).toContain(mesh);
        expect(mesh.name).toBe('contactShadow');
        expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
        expect(mesh.material.transparent).toBe(true);
        expect(mesh.material.depthWrite).toBe(false);
        expect(mesh.material.opacity).toBeCloseTo(0.3);
        expect(mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
        expect(mesh.position.y).toBeCloseTo(0.02);
    });

    it('stays centered/symmetric by default (clear weather)', () => {
        const group = new THREE.Group();
        const mesh = addContactShadow(group, { width: 1, depth: 0.5, y: 0.02 });

        expect(mesh.position.x).toBeCloseTo(0);
        expect(mesh.position.z).toBeCloseTo(0);
        expect(mesh.scale.x).toBeCloseTo(1);
        expect(mesh.scale.z).toBeCloseTo(1);
    });

    it('offsets/stretches existing shadows when weather turns to rain, and reverts on clear', () => {
        const group = new THREE.Group();
        const mesh = addContactShadow(group, { width: 1, depth: 0.5, y: 0.02 });

        const clearX = mesh.position.x;
        const clearScaleX = mesh.scale.x;

        EventBus.emit('weather_change', 'rain');
        expect(mesh.position.x).not.toBeCloseTo(clearX);
        expect(mesh.scale.x).toBeGreaterThan(clearScaleX);

        EventBus.emit('weather_change', 'clear');
        expect(mesh.position.x).toBeCloseTo(clearX);
        expect(mesh.scale.x).toBeCloseTo(clearScaleX);
    });

    it('applies the rain skew immediately to shadows created while it is already raining', () => {
        EventBus.emit('weather_change', 'rain');

        const group = new THREE.Group();
        const mesh = addContactShadow(group, { width: 1, depth: 0.5, y: 0.02 });

        expect(mesh.position.x).not.toBeCloseTo(0);
        expect(mesh.scale.x).toBeGreaterThan(1);
    });
});
