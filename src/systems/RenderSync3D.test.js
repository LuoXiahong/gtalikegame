import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSync3D } from './RenderSync3D.js';
import { World } from '../world/World.js';
import { MissionSystem } from './MissionSystem.js';

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

        // Sprawdzenie współrzędnych i kątów
        expect(playerMesh.position.x).toBe(100);
        expect(playerMesh.position.z).toBe(200);
        expect(playerMesh.rotation.y).toBe(-1.5);

        expect(npcMesh.position.x).toBe(300);
        expect(npcMesh.position.z).toBe(400);
        expect(npcMesh.rotation.y).toBeCloseTo(0);

        expect(carMesh.position.x).toBe(500);
        expect(carMesh.position.z).toBe(600);
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
        expect(playerMesh.position.y).toBe(5.0); // Powinien być uniesiony o 5u nad asfalt
    });

    it('should create and update mission target indicator', () => {
        MissionSystem.targetLocation = { x: 1500, y: 1500, radius: 40 };

        RenderSync3D.update(mockScene);

        expect(mockScene.add).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeDefined();
        expect(RenderSync3D.targetMesh.position.x).toBe(1500);
        expect(RenderSync3D.targetMesh.position.z).toBe(1500);

        // Usuń cel
        MissionSystem.targetLocation = null;
        RenderSync3D.update(mockScene);

        expect(mockScene.remove).toHaveBeenCalled();
        expect(RenderSync3D.targetMesh).toBeNull();
    });
});
