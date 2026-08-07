import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNPCModel, NPC_COLOR_PALETTE } from './NPCModelFactory.js';
import { EventBus } from '../core/EventBus.js';

describe('NPCModelFactory', () => {
    it('should create a THREE.Group with torso, head, fedora, and contact shadow', () => {
        const model = createNPCModel(0x3d3d3d);

        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.children.length).toBe(5);

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

        const shadow = model.children.find(c => c.name === 'contactShadow');
        expect(shadow).toBeDefined();
        expect(shadow.material.transparent).toBe(true);
        expect(shadow.rotation.x).toBeCloseTo(-Math.PI / 2);
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

    describe('weather reactivity', () => {
        it('dims roughness and albedo on rain, restores exactly on clear', () => {
            const model = createNPCModel(0x3d3d3d);
            const bodyMesh = model.children[0];
            const headMesh = model.children[1];
            const hatMesh = model.children[2];
            const bodyMat = bodyMesh.material;
            const headMat = headMesh.material;
            const hatMat = hatMesh.material;

            const baseBodyRoughness = bodyMat.roughness;
            const baseBodyColor = bodyMat.color.getHex();
            const baseHeadRoughness = headMat.roughness;
            const baseHeadColor = headMat.color.getHex();
            const baseHatRoughness = hatMat.roughness;
            const baseHatColor = hatMat.color.getHex();

            EventBus.emit('weather_change', 'rain');

            expect(bodyMat.roughness).toBeLessThan(baseBodyRoughness);
            expect(bodyMat.color.getHex()).not.toBe(baseBodyColor);
            expect(headMat.roughness).toBeLessThan(baseHeadRoughness);
            expect(headMat.color.getHex()).not.toBe(baseHeadColor);
            expect(hatMat.roughness).toBeLessThan(baseHatRoughness);
            expect(hatMat.color.getHex()).not.toBe(baseHatColor);

            EventBus.emit('weather_change', 'clear');

            expect(bodyMat.roughness).toBeCloseTo(baseBodyRoughness);
            expect(bodyMat.color.getHex()).toBe(baseBodyColor);
            expect(headMat.roughness).toBeCloseTo(baseHeadRoughness);
            expect(headMat.color.getHex()).toBe(baseHeadColor);
            expect(hatMat.roughness).toBeCloseTo(baseHatRoughness);
            expect(hatMat.color.getHex()).toBe(baseHatColor);
        });

        it('does not drift after repeated rain/clear toggles', () => {
            const model = createNPCModel(0x5a5a5a);
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
