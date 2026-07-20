import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { addContactShadow, getContactShadowTexture } from './ContactShadow.js';

describe('ContactShadow', () => {
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
});
