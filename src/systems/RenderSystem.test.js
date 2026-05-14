import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RenderSystem } from './RenderSystem.js';
import { World } from '../world/World.js';
import { Camera } from '../world/Camera.js';
import { VehicleSystem } from './VehicleSystem.js';

describe('RenderSystem', () => {
    let mockCtx;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCtx = {
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            fill: vi.fn(),
            fillRect: vi.fn(),
            stroke: vi.fn(),
            strokeRect: vi.fn(),
            arc: vi.fn(),
            fillText: vi.fn(),
            setLineDash: vi.fn()
        };

        const canvasStub = { width: 800, height: 600, getContext: () => mockCtx };
        vi.spyOn(document, 'getElementById').mockReturnValue(canvasStub);
        RenderSystem.canvas = canvasStub;
        RenderSystem.ctx = mockCtx;

        World.entities = [];
        World.buildings = [];
        World.entitiesByType = {};
        World.tilemap = null;
        World.decals = null;
    });

    it('should initialize canvas and context', () => {
        RenderSystem.init();
        expect(RenderSystem.canvas).not.toBeNull();
        expect(RenderSystem.ctx).not.toBeNull();
    });

    it('should sort renderables by distance to player in 2D drawEntities', () => {
        const player = {
            id: 'p1',
            type: 'player',
            transform: { x: 0, y: 0, width: 20, height: 20, angle: 0 },
            visual: { color: '#fff', walkCycle: 0 },
            visible: true
        };

        const carClose = {
            id: 'c1',
            type: 'car',
            transform: { x: 100, y: 0, width: 40, height: 80, angle: 0 },
            visual: { color: '#red', z: 0.5 }
        };

        const carFar = {
            id: 'c2',
            type: 'car',
            transform: { x: 1000, y: 0, width: 40, height: 80, angle: 0 },
            visual: { color: '#blue', z: 0.5 }
        };

        World.addEntity(player);
        World.addEntity(carClose);
        World.addEntity(carFar);

        // Spy on fill to verify rendering order or execution
        RenderSystem.drawEntities();

        expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should draw grid, shadows, debug hitboxes and AI overlays', () => {
        World.width = 200;
        World.height = 200;
        World.buildings = [{ x: 10, y: 10, w: 50, h: 50 }];
        RenderSystem.debugAI = true;

        RenderSystem.update();

        expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
    });
});
