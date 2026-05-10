import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AISystem } from './AISystem.js';
import { World } from '../world/World.js';

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn()
    }
}));

describe('AISystem', () => {
    let mockNPC;

    beforeEach(() => {
        mockNPC = {
            id: 'npc1',
            transform: { x: 0, y: 0, angle: 0 },
            physics: { velX: 0, velY: 0, speed: 50 },
            visual: { walkCycle: 0 },
            ai: { state: 'idle', timer: 1 }
        };

        World.getEntitiesByType.mockReturnValue([mockNPC]);
        
        // Mock Math.random żeby kontrolować stany w testach
        vi.spyOn(Math, 'random').mockReturnValue(0.5); 
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should decrease timer by dt', () => {
        AISystem.update(0.1);
        expect(mockNPC.ai.timer).toBeCloseTo(0.9);
    });

    it('should change state when timer reaches 0', () => {
        AISystem.update(1.0); // timer becomes 0
        
        // Since random() is 0.5, it should change to 'walk' (0.5 >= 0.45)
        expect(mockNPC.ai.state).toBe('walk');
        expect(mockNPC.ai.timer).toBeGreaterThan(0);
        // And it should update animation because it is walking
        expect(mockNPC.visual.walkCycle).toBeGreaterThan(0);
    });
});
