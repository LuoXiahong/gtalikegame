import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from './World.js';
import { Tilemap } from './Tilemap.js';
import { Decals } from './Decals.js';

vi.mock('./Tilemap.js', () => ({
    Tilemap: {
        init: vi.fn()
    }
}));

vi.mock('./Decals.js', () => ({
    Decals: {
        init: vi.fn()
    }
}));

describe('World', () => {
    beforeEach(() => {
        // Reset World state
        World.entities = [];
        World.entitiesByType = {};
        World.buildings = [];
        World.tilemap = null;
        World.decals = null;
        vi.clearAllMocks();
    });

    it('should have default dimensions and tile size', () => {
        expect(World.width).toBe(3000);
        expect(World.height).toBe(3000);
        expect(World.tileSize).toBe(100);
    });

    it('should initialize tilemap, decals and buildings in init()', () => {
        World.init();

        expect(World.tilemap).toBe(Tilemap);
        expect(Tilemap.init).toHaveBeenCalled();

        expect(World.decals).toBe(Decals);
        expect(Decals.init).toHaveBeenCalled();

        expect(World.buildings.length).toBe(9); // 3x3 grid
        expect(World.buildings[0]).toMatchObject({
            w: 300,
            h: 300
        });
        expect(typeof World.buildings[0].z).toBe('number');
    });

    it('should add an entity correctly', () => {
        const entity = { id: 'test-1', type: 'player' };
        World.addEntity(entity);

        expect(World.entities).toContain(entity);
        expect(World.entities.length).toBe(1);
    });

    it('should remove an entity by id', () => {
        const entity1 = { id: 'test-1', type: 'player' };
        const entity2 = { id: 'test-2', type: 'npc' };
        World.addEntity(entity1);
        World.addEntity(entity2);

        World.removeEntity('test-1');

        expect(World.entities).not.toContain(entity1);
        expect(World.entities).toContain(entity2);
        expect(World.entities.length).toBe(1);
    });

    it('should get entities by type', () => {
        const entity1 = { id: 'test-1', type: 'player' };
        const entity2 = { id: 'test-2', type: 'npc' };
        const entity3 = { id: 'test-3', type: 'npc' };

        World.addEntity(entity1);
        World.addEntity(entity2);
        World.addEntity(entity3);

        const npcs = World.getEntitiesByType('npc');
        expect(npcs.length).toBe(2);
        expect(npcs).toContain(entity2);
        expect(npcs).toContain(entity3);
        expect(npcs).not.toContain(entity1);
    });

    it('should reset state correctly', () => {
        World.entities = [{}];
        World.entitiesByType = { npc: [{}] };
        World.buildings = [{}];
        World.reset();
        expect(World.entities.length).toBe(0);
        expect(Object.keys(World.entitiesByType).length).toBe(0);
        expect(World.buildings.length).toBe(0);
    });
});
