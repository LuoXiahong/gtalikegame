import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNPCModel, NPC_COLOR_PALETTE } from './NPCModelFactory.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

describe('NPCModelFactory', () => {
    it('should create a THREE.Group with cylinder body and sphere head', () => {
        const model = createNPCModel(0x8e44ad);

        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBe(2);

        // Verify body (Cylinder)
        const bodyMesh = model.children[0];
        expect(bodyMesh).toBeInstanceOf(THREE.Mesh);
        expect(bodyMesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
        expect(bodyMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(bodyMesh.material.color.getHex()).toBe(0x8e44ad);

        // Verify body scale and pivot (base on Y=0)
        const bodyHeight = WorldMetrics.NPC_HEIGHT * 0.75;
        expect(bodyMesh.position.y).toBeCloseTo(bodyHeight / 2);

        // Verify head (Sphere)
        const headMesh = model.children[1];
        expect(headMesh).toBeInstanceOf(THREE.Mesh);
        expect(headMesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
        expect(headMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(headMesh.material.color.getHex()).toBe(0xf1c27d); // Skin-tone

        // Verify head position reaches exact NPC_HEIGHT at the top
        const headRadius = (WorldMetrics.NPC_WIDTH / 3) * 1.1;
        expect(headMesh.position.y).toBeCloseTo(WorldMetrics.NPC_HEIGHT - headRadius);
    });

    it('should select a random color from the palette if no color is provided', () => {
        const model = createNPCModel();
        const bodyMesh = model.children[0];
        const bodyColorHex = bodyMesh.material.color.getHex();

        expect(NPC_COLOR_PALETTE).toContain(bodyColorHex);
    });

    it('should correctly parse a CSS hex string color', () => {
        const model = createNPCModel('#27ae60');
        const bodyMesh = model.children[0];
        
        expect(bodyMesh.material.color.getHex()).toBe(0x27ae60);
    });
});
