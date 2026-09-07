import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNPCModel, NPC_COLOR_PALETTE, NPC_RIG, setSharedEnvironment } from './NPCModelFactory.js';
import { EventBus } from '../core/EventBus.js';

/** First mesh found under a node (limb joints wrap their mesh). */
function firstMesh(node) {
    let found = null;
    node.traverse(c => {
        if (!found && c.isMesh) found = c;
    });
    return found;
}

describe('NPCModelFactory', () => {
    it('exposes a named rig with pelvis, torso, head, arms and legs', () => {
        const model = createNPCModel(0x3d3d3d);

        expect(model).toBeInstanceOf(THREE.Group);
        const rig = model.userData.rig;
        expect(rig).toBeDefined();
        ['pelvis', 'torso', 'head', 'hat', 'armL', 'armR', 'legL', 'legR'].forEach(name => {
            expect(rig[name]).toBeInstanceOf(THREE.Group);
        });
    });

    it('pivots limbs at the joint, not at the segment centre', () => {
        const rig = createNPCModel(0x3d3d3d).userData.rig;

        // Joint groups sit at hip/shoulder height; their mesh hangs below the pivot.
        expect(rig.pelvis.position.y).toBeCloseTo(NPC_RIG.HIP_Y);
        expect(firstMesh(rig.legL).position.y).toBeLessThan(0);
        expect(firstMesh(rig.armL).position.y).toBeLessThan(0);

        // Shoulder pivot in world terms = torso pivot + local offset.
        const shoulderWorldY = rig.torso.position.y + rig.armL.position.y;
        expect(shoulderWorldY).toBeCloseTo(NPC_RIG.SHOULDER_Y);
    });

    it('mirrors limbs across the shoulder/hip span (Z axis)', () => {
        const rig = createNPCModel(0x3d3d3d).userData.rig;

        expect(rig.armL.position.z).toBeCloseTo(-rig.armR.position.z);
        expect(rig.legL.position.z).toBeCloseTo(-rig.legR.position.z);
        expect(rig.armL.position.z).not.toBeCloseTo(0);
        expect(rig.legL.position.z).not.toBeCloseTo(0);
    });

    it('keeps feet on the ground and the head near NPC_HEIGHT', () => {
        const model = createNPCModel(0x3d3d3d);
        model.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(model);
        expect(box.min.y).toBeCloseTo(0, 1);
        // Head crown ~1.8m; the fedora adds a little on top.
        expect(box.max.y).toBeGreaterThan(1.8);
        expect(box.max.y).toBeLessThan(2.1);
    });

    it('breaks front/back symmetry so facing is readable from above', () => {
        const rig = createNPCModel(0x3d3d3d).userData.rig;

        // Fedora brim leans toward +X (forward), collar toward -X (back).
        const brim = rig.hat.children.find(c => c.geometry?.type === 'CylinderGeometry');
        expect(brim.position.x).toBeGreaterThan(0);

        const collar = rig.torso.children.find(c => c.isMesh && c.position.x < 0);
        expect(collar).toBeDefined();

        // A lighter lapel panel on the chest side, offset forward.
        const lapel = rig.torso.children.find(c => c.isMesh && c.position.x > 0.1);
        expect(lapel).toBeDefined();
    });

    it('should select a random color from the muted palette if no color is provided', () => {
        const rig = createNPCModel().userData.rig;
        // Torso wears the coat material verbatim; sleeves/trousers are shaded from it.
        const coatColorHex = firstMesh(rig.torso).material.color.getHex();

        expect(NPC_COLOR_PALETTE).toContain(coatColorHex);
    });

    it('should correctly parse a CSS hex string color', () => {
        const rig = createNPCModel('#5c4033').userData.rig;

        expect(firstMesh(rig.torso).material.color.getHex()).toBe(0x5c4033);
    });

    it('uses period-muted clothing colors (no bright primaries)', () => {
        // Guard against regressing to neon/vivid palette
        const forbidden = [0x8e44ad, 0xf1c40f, 0x1abc9c, 0xe74c3c, 0x2ecc71];
        forbidden.forEach(c => expect(NPC_COLOR_PALETTE).not.toContain(c));
    });

    it('shares geometry between NPCs but keeps materials per-instance', () => {
        const a = createNPCModel(0x3d3d3d).userData.rig;
        const b = createNPCModel(0x5c4033).userData.rig;

        // Same geometry object → one upload for the whole crowd.
        expect(firstMesh(a.legL).geometry).toBe(firstMesh(b.legL).geometry);
        expect(firstMesh(a.armL).geometry).toBe(firstMesh(b.armL).geometry);

        // Materials must stay separate — weather re-tinting is per-material.
        expect(firstMesh(a.armL).material).not.toBe(firstMesh(b.armL).material);
    });

    it('flags shared geometry so despawning one NPC cannot dispose another', () => {
        const model = createNPCModel(0x3d3d3d);

        model.traverse(child => {
            if (!child.isMesh || child.name === 'contactShadow') return;
            expect(child.geometry.userData.shared).toBe(true);
        });
    });

    it('attaches a contact shadow at the model root', () => {
        const model = createNPCModel(0x3d3d3d);
        const shadow = model.children.find(c => c.name === 'contactShadow');

        expect(shadow).toBeDefined();
        expect(shadow.material.transparent).toBe(true);
        expect(shadow.rotation.x).toBeCloseTo(-Math.PI / 2);
    });

    describe('weather reactivity', () => {
        it('dims roughness and albedo on rain, restores exactly on clear', () => {
            const rig = createNPCModel(0x3d3d3d).userData.rig;
            // Every clothing/skin material must stay weather-tracked after the
            // rig rewrite — coat (arm), trousers (leg), skin (head), dark (hat).
            const mats = [
                firstMesh(rig.torso).material,
                firstMesh(rig.armL).material,
                firstMesh(rig.legL).material,
                firstMesh(rig.head).material,
                firstMesh(rig.hat).material
            ];
            const base = mats.map(m => ({ roughness: m.roughness, color: m.color.getHex() }));

            EventBus.emit('weather_change', 'rain');

            mats.forEach((m, i) => {
                expect(m.roughness).toBeLessThan(base[i].roughness);
                expect(m.color.getHex()).not.toBe(base[i].color);
            });

            EventBus.emit('weather_change', 'clear');

            mats.forEach((m, i) => {
                expect(m.roughness).toBeCloseTo(base[i].roughness);
                expect(m.color.getHex()).toBe(base[i].color);
            });
        });

        it('boosts envMapIntensity on rain (wet reflects more, not just dims) and restores on clear (T55)', () => {
            setSharedEnvironment({ isTexture: true });
            const rig = createNPCModel(0x3d3d3d).userData.rig;
            const mat = firstMesh(rig.torso).material;
            const base = mat.envMapIntensity;
            expect(base).toBeGreaterThan(0);

            EventBus.emit('weather_change', 'rain');
            expect(mat.envMapIntensity).toBeGreaterThan(base);

            EventBus.emit('weather_change', 'clear');
            expect(mat.envMapIntensity).toBeCloseTo(base);

            setSharedEnvironment(null);
        });

        it('does not drift after repeated rain/clear toggles', () => {
            const rig = createNPCModel(0x5a5a5a).userData.rig;
            const coatMat = firstMesh(rig.torso).material;
            const baseRoughness = coatMat.roughness;
            const baseColor = coatMat.color.getHex();

            for (let i = 0; i < 3; i++) {
                EventBus.emit('weather_change', 'rain');
                EventBus.emit('weather_change', 'clear');
            }

            expect(coatMat.roughness).toBeCloseTo(baseRoughness);
            expect(coatMat.color.getHex()).toBe(baseColor);
        });
    });
});
