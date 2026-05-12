import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNPCModel, NPC_COLOR_PALETTE } from './NPCModelFactory.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

describe('NPCModelFactory', () => {
    it('should create a THREE.Group with boxy torso and boxy head', () => {
        const model = createNPCModel(0x8e44ad);

        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBe(2);

        // Verify body (Box)
        const bodyMesh = model.children[0];
        expect(bodyMesh).toBeInstanceOf(THREE.Mesh);
        expect(bodyMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        expect(bodyMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(bodyMesh.material.color.getHex()).toBe(0x8e44ad);

        // Verify body pivot (base on Y=0, height=1.4)
        expect(bodyMesh.position.y).toBeCloseTo(0.7);

        // Verify head (Box)
        const headMesh = model.children[1];
        expect(headMesh).toBeInstanceOf(THREE.Mesh);
        expect(headMesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
        expect(headMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(headMesh.material.color.getHex()).toBe(0xf1c27d); // Skin-tone

        // Verify head position
        expect(headMesh.position.y).toBeCloseTo(1.6);
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
