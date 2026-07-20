import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNPCModel, NPC_COLOR_PALETTE } from './NPCModelFactory.js';

describe('NPCModelFactory', () => {
    it('should create a THREE.Group with torso, head, and fedora', () => {
        const model = createNPCModel(0x3d3d3d);

        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBe(4);

        const bodyMesh = model.children[0];
        expect(bodyMesh).toBeInstanceOf(THREE.Mesh);
        expect(bodyMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        expect(bodyMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(bodyMesh.material.color.getHex()).toBe(0x3d3d3d);
        expect(bodyMesh.position.y).toBeCloseTo(0.7);

        const headMesh = model.children[1];
        expect(headMesh).toBeInstanceOf(THREE.Mesh);
        expect(headMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        expect(headMesh.material.color.getHex()).toBe(0xf1c27d);
        expect(headMesh.position.y).toBeCloseTo(1.6);

        const brim = model.children[2];
        const crown = model.children[3];
        expect(brim.geometry).toBeInstanceOf(THREE.CylinderGeometry);
        expect(crown.geometry).toBeInstanceOf(THREE.CylinderGeometry);
        expect(brim.position.y).toBeGreaterThan(headMesh.position.y);
        expect(crown.position.y).toBeGreaterThan(brim.position.y);
    });

    it('should select a random color from the muted palette if no color is provided', () => {
        const model = createNPCModel();
        const bodyMesh = model.children[0];
        const bodyColorHex = bodyMesh.material.color.getHex();

        expect(NPC_COLOR_PALETTE).toContain(bodyColorHex);
    });

    it('should correctly parse a CSS hex string color', () => {
        const model = createNPCModel('#5c4033');
        const bodyMesh = model.children[0];

        expect(bodyMesh.material.color.getHex()).toBe(0x5c4033);
    });

    it('uses period-muted clothing colors (no bright primaries)', () => {
        // Guard against regressing to neon/vivid palette
        const forbidden = [0x8e44ad, 0xf1c40f, 0x1abc9c, 0xe74c3c, 0x2ecc71];
        forbidden.forEach(c => expect(NPC_COLOR_PALETTE).not.toContain(c));
    });
});
