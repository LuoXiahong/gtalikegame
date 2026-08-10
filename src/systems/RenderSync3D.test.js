import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSync3D } from './RenderSync3D.js';
import { World } from '../world/World.js';
import { MissionSystem } from './MissionSystem.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { Time } from '../core/Time.js';

// Mock World
vi.mock('../world/World.js', () => ({
    World: {
        entities: [],
        tilemap: {
            getTileAt: vi.fn().mockReturnValue(0)
        }
    }
}));

// Mock MissionSystem
vi.mock('./MissionSystem.js', () => ({
    MissionSystem: {
        targetLocation: null
    }
}));

describe('RenderSync3D', () => {
    let mockScene;
    const SF = WorldMetrics.SCALE_FACTOR;

    beforeEach(() => {
        vi.clearAllMocks();
        RenderSync3D.meshes.clear();
        RenderSync3D.targetMesh = null;

        mockScene = {
            add: vi.fn(),
            remove: vi.fn()
        };

        World.entities = [];
        World.tilemap.getTileAt.mockReturnValue(0);
        MissionSystem.targetLocation = null;
    });

    it('should create dynamic meshes for player, npc, and car', () => {
        World.entities = [
            {
                id: 'player1',
                type: 'player',
                transform: { x: 100, y: 200, angle: 1.5, width: 20, height: 20 },
                visible: true
            },
            {
                id: 'npc1',
                type: 'npc',
                transform: { x: 300, y: 400, angle: 0, width: 10, height: 10 },
                visual: { color: '#8e44ad' },
                visible: true
            },
            {
                id: 'car1',
                type: 'car',
                transform: { x: 500, y: 600, angle: -0.5, width: 40, height: 80 },
                visual: { color: '#c0392b' },
                visible: true
            }
        ];

        RenderSync3D.update(mockScene);

        expect(mockScene.add).toHaveBeenCalledTimes(3);
        expect(RenderSync3D.meshes.size).toBe(3);

        const playerMesh = RenderSync3D.meshes.get('player1');
        const npcMesh = RenderSync3D.meshes.get('npc1');
        const carMesh = RenderSync3D.meshes.get('car1');

        expect(playerMesh).toBeDefined();
        expect(npcMesh).toBeDefined();
        expect(carMesh).toBeDefined();

        // Scaled coordinates and angles
        expect(playerMesh.position.x).toBeCloseTo(100 * SF);
        expect(playerMesh.position.z).toBeCloseTo(200 * SF);
        expect(playerMesh.rotation.y).toBe(-1.5);

        expect(npcMesh.position.x).toBeCloseTo(300 * SF);
        expect(npcMesh.position.z).toBeCloseTo(400 * SF);
        expect(npcMesh.rotation.y).toBeCloseTo(0);

        expect(carMesh.position.x).toBeCloseTo(500 * SF);
        expect(carMesh.position.z).toBeCloseTo(600 * SF);
        expect(carMesh.rotation.y).toBe(0.5);

        // Shadows + MeshStandardMaterial (skip flat contact-shadow blobs)
        [playerMesh, npcMesh, carMesh].forEach(meshGroup => {
            meshGroup.traverse(child => {
                if (child.isMesh && child.name !== 'contactShadow') {
                    expect(child.material instanceof THREE.MeshStandardMaterial).toBe(true);
                    expect(child.castShadow).toBe(true);
                    expect(child.receiveShadow).toBe(true);
                }
            });
            const shadow = meshGroup.children.find(c => c.name === 'contactShadow');
            expect(shadow).toBeDefined();
            expect(shadow.material).toBeInstanceOf(THREE.MeshBasicMaterial);
        });
    });

    it('should correctly remove and dispose meshes of despawned entities', () => {
        World.entities = [
            { id: 'player1', type: 'player', transform: { x: 100, y: 200, angle: 0 }, visible: true }
        ];

        RenderSync3D.update(mockScene);
        expect(RenderSync3D.meshes.size).toBe(1);

        World.entities = [];
        RenderSync3D.update(mockScene);

        expect(mockScene.remove).toHaveBeenCalled();
        expect(RenderSync3D.meshes.size).toBe(0);
    });

    it('should adjust height (y) for characters on sidewalk', () => {
        World.entities = [
            { id: 'player1', type: 'player', transform: { x: 550, y: 550, angle: 0 }, visible: true }
        ];

        // Player on sidewalk (tile type 2)
        World.tilemap.getTileAt.mockReturnValue(2);

        RenderSync3D.update(mockScene);

        const playerMesh = RenderSync3D.meshes.get('player1');
        expect(playerMesh.position.y).toBeCloseTo(WorldMetrics.SIDEWALK_HEIGHT);
    });

    it('should lift characters by the bounce from their animation pose', () => {
        World.entities = [
            {
                id: 'player1',
                type: 'player',
                transform: { x: 100, y: 200, angle: 0 },
                physics: { velX: 5.0, velY: 0 },
                visual: { pose: { bounce: 0.02, legL: 0, legR: 0, armL: 0, armR: 0, lean: 0, head: 0 } },
                visible: true
            },
            {
                id: 'npc1',
                type: 'npc',
                transform: { x: 300, y: 400, angle: 0 },
                physics: { velX: 0, velY: 0 }, // Standing still — no pose yet
                visible: true
            }
        ];

        RenderSync3D.update(mockScene);

        expect(RenderSync3D.meshes.get('player1').position.y).toBeCloseTo(0.02);
        // No pose → plain ground height, no leftover bounce.
        expect(RenderSync3D.meshes.get('npc1').position.y).toBeCloseTo(0);
    });

    it('should copy pose angles onto the character rig joints', () => {
        const pose = {
            legL: 0.4, legR: -0.4, armL: -0.32, armR: 0.32,
            lean: -0.12, head: 0.12, bounce: 0.01
        };
        World.entities = [
            {
                id: 'player1',
                type: 'player',
                transform: { x: 0, y: 0, angle: 0 },
                physics: { velX: 3, velY: 0 },
                visual: { pose },
                visible: true
            }
        ];

        RenderSync3D.update(mockScene);

        const rig = RenderSync3D.meshes.get('player1').userData.rig;
        expect(rig.legL.rotation.z).toBeCloseTo(pose.legL);
        expect(rig.legR.rotation.z).toBeCloseTo(pose.legR);
        expect(rig.armL.rotation.z).toBeCloseTo(pose.armL);
        expect(rig.armR.rotation.z).toBeCloseTo(pose.armR);
        expect(rig.torso.rotation.z).toBeCloseTo(pose.lean);
        expect(rig.head.rotation.z).toBeCloseTo(pose.head);
    });

    it('should keep shared geometry alive when one character despawns', () => {
        World.entities = [
            { id: 'npc1', type: 'npc', transform: { x: 0, y: 0, angle: 0 }, visible: true },
            { id: 'npc2', type: 'npc', transform: { x: 50, y: 0, angle: 0 }, visible: true }
        ];
        RenderSync3D.update(mockScene);

        const survivor = RenderSync3D.meshes.get('npc2');
        const sharedGeom = survivor.userData.rig.legL.children[0].geometry;
        const disposeSpy = vi.spyOn(sharedGeom, 'dispose');

        // npc1 despawns; its rig references the very same geometry object.
        World.entities = World.entities.filter(e => e.id === 'npc2');
        RenderSync3D.update(mockScene);

        expect(disposeSpy).not.toHaveBeenCalled();
        expect(sharedGeom.attributes.position).toBeDefined();
    });

    it('should leave non-character meshes untouched by applyPose', () => {
        const car = new THREE.Group();

        expect(() => RenderSync3D.applyPose(car, { legL: 1 })).not.toThrow();
        expect(car.rotation.z).toBeCloseTo(0);
    });

    it('should create and update mission target indicator', () => {
        MissionSystem.targetLocation = { x: 1500, y: 1500, radius: 40 };

        RenderSync3D.update(mockScene);

        expect(mockScene.add).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeDefined();
        expect(RenderSync3D.targetMesh.position.x).toBeCloseTo(1500 * SF);
        expect(RenderSync3D.targetMesh.position.z).toBeCloseTo(1500 * SF);

        MissionSystem.targetLocation = null;
        RenderSync3D.update(mockScene);

        expect(mockScene.remove).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeNull();
    });

    it('should reset meshes and targetMesh correctly', () => {
        RenderSync3D.meshes.set('e1', { traverse: vi.fn() });
        RenderSync3D.targetMesh = { traverse: vi.fn() };
        RenderSync3D.reset(mockScene);
        expect(RenderSync3D.meshes.size).toBe(0);
        expect(RenderSync3D.targetMesh).toBeNull();
        expect(mockScene.remove).toHaveBeenCalledTimes(2);
    });
});
