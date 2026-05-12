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
        // Dodaj gracza, npc i auto
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

        // Powinien dodać 3 meshe do sceny
        expect(mockScene.add).toHaveBeenCalledTimes(3);
        expect(RenderSync3D.meshes.size).toBe(3);

        const playerMesh = RenderSync3D.meshes.get('player1');
        const npcMesh = RenderSync3D.meshes.get('npc1');
        const carMesh = RenderSync3D.meshes.get('car1');

        expect(playerMesh).toBeDefined();
        expect(npcMesh).toBeDefined();
        expect(carMesh).toBeDefined();

        // Sprawdzenie współrzędnych i kątów (scaled)
        expect(playerMesh.position.x).toBeCloseTo(100 * SF);
        expect(playerMesh.position.z).toBeCloseTo(200 * SF);
        expect(playerMesh.rotation.y).toBe(-1.5);

        expect(npcMesh.position.x).toBeCloseTo(300 * SF);
        expect(npcMesh.position.z).toBeCloseTo(400 * SF);
        expect(npcMesh.rotation.y).toBeCloseTo(0);

        expect(carMesh.position.x).toBeCloseTo(500 * SF);
        expect(carMesh.position.z).toBeCloseTo(600 * SF);
        expect(carMesh.rotation.y).toBe(0.5);

        // Weryfikacja cieniowania i użycia MeshStandardMaterial
        [playerMesh, npcMesh, carMesh].forEach(meshGroup => {
            meshGroup.traverse(child => {
                if (child.isMesh) {
                    expect(child.material instanceof THREE.MeshStandardMaterial).toBe(true);
                    expect(child.castShadow).toBe(true);
                    expect(child.receiveShadow).toBe(true);
                }
            });
        });
    });

    it('should correctly remove and dispose meshes of despawned entities', () => {
        World.entities = [
            { id: 'player1', type: 'player', transform: { x: 100, y: 200, angle: 0 }, visible: true }
        ];

        RenderSync3D.update(mockScene);
        expect(RenderSync3D.meshes.size).toBe(1);

        // Usuń gracza z symulacji
        World.entities = [];
        RenderSync3D.update(mockScene);

        expect(mockScene.remove).toHaveBeenCalled();
        expect(RenderSync3D.meshes.size).toBe(0);
    });

    it('should adjust height (y) for characters on sidewalk', () => {
        World.entities = [
            { id: 'player1', type: 'player', transform: { x: 550, y: 550, angle: 0 }, visible: true }
        ];

        // Mock, że gracz stoi na chodniku (kafelek o typie 2)
        World.tilemap.getTileAt.mockReturnValue(2);

        RenderSync3D.update(mockScene);

        const playerMesh = RenderSync3D.meshes.get('player1');
        expect(playerMesh.position.y).toBeCloseTo(WorldMetrics.SIDEWALK_HEIGHT); // Powinien być uniesiony o SIDEWALK_HEIGHT nad asfalt
    });

    it('should apply procedural walk bounce animation for moving characters', () => {
        Time.time = 0.5; // Set game time

        World.entities = [
            {
                id: 'player1',
                type: 'player',
                transform: { x: 100, y: 200, angle: 0 },
                physics: { velX: 5.0, velY: 0 }, // Moving!
                visible: true
            },
            {
                id: 'npc1',
                type: 'npc',
                transform: { x: 300, y: 400, angle: 0 },
                physics: { velX: 0, velY: 0 }, // Standing still!
                visible: true
            }
        ];

        RenderSync3D.update(mockScene);

        const playerMesh = RenderSync3D.meshes.get('player1');
        const npcMesh = RenderSync3D.meshes.get('npc1');

        // Player is moving, so Y position should be groundY + bounceY
        const expectedBounce = Math.abs(Math.sin(0.5 * 10)) * 0.1;
        expect(playerMesh.position.y).toBeCloseTo(expectedBounce);

        // NPC is standing still, so Y position should be exactly groundY (0)
        expect(npcMesh.position.y).toBeCloseTo(0);
    });

    it('should create and update mission target indicator', () => {
        MissionSystem.targetLocation = { x: 1500, y: 1500, radius: 40 };

        RenderSync3D.update(mockScene);

        expect(mockScene.add).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeDefined();
        expect(RenderSync3D.targetMesh.position.x).toBeCloseTo(1500 * SF);
        expect(RenderSync3D.targetMesh.position.z).toBeCloseTo(1500 * SF);

        // Usuń cel
        MissionSystem.targetLocation = null;
        RenderSync3D.update(mockScene);

        expect(mockScene.remove).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeNull();
    });
});
