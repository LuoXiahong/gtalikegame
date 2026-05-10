import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AISystem } from './AISystem.js';
import { World } from '../world/World.js';
import { EventBus } from '../core/EventBus.js';

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn()
    }
}));

vi.mock('../core/EventBus.js', () => ({
    EventBus: {
        on: vi.fn()
    }
}));

describe('AISystem', () => {
    let mockNPC;
    let gunshotCallback;
    let explosionCallback;

    beforeEach(() => {
        mockNPC = {
            id: 'npc1',
            transform: { x: 0, y: 0, angle: 0 },
            physics: { velX: 0, velY: 0, speed: 50 },
            visual: { walkCycle: 0 },
            ai: { 
                state: 'idle', 
                timer: 1,
                waypoints: [{ x: 100, y: 0 }, { x: 0, y: 100 }],
                currentWaypointIndex: 0
            }
        };

        World.getEntitiesByType.mockReturnValue([mockNPC]);
        
        // Mock Math.random żeby kontrolować stany w testach
        vi.spyOn(Math, 'random').mockReturnValue(0.5); 

        // Capture callbacks
        EventBus.on.mockImplementation((event, cb) => {
            if (event === 'gunshot') gunshotCallback = cb;
            if (event === 'explosion') explosionCallback = cb;
        });
        
        AISystem.init();
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
        
        expect(mockNPC.ai.state).toBe('walk');
        expect(mockNPC.visual.walkCycle).toBeGreaterThan(0);
        // Sprawdzamy ruch w kierunku aktualnego punktu drogi (100, 0)
        expect(mockNPC.physics.velX).toBeGreaterThan(0);
        expect(mockNPC.physics.velY).toBe(0);
    });

    it('should switch waypoints and enter idle state when reaching target', () => {
        // Ustawiamy pozycję NPC blisko celu
        mockNPC.ai.state = 'walk';
        mockNPC.transform.x = 95; // dystans do (100, 0) wynosi 5 (< 10)
        mockNPC.transform.y = 0;
        
        AISystem.update(0.1);
        
        expect(mockNPC.ai.state).toBe('idle');
        expect(mockNPC.ai.timer).toBeGreaterThan(0);
        expect(mockNPC.ai.currentWaypointIndex).toBe(1); // przełączył się na drugi punkt drogi
        expect(mockNPC.physics.velX).toBe(0);
    });

    it('should change to flee state on gunshot event within range', () => {
        // Trigger gunshot at (100, 100)
        gunshotCallback({ x: 100, y: 100 });
        
        expect(mockNPC.ai.state).toBe('flee');
        expect(mockNPC.ai.timer).toBeGreaterThan(5);
        
        // Test movement in flee state
        AISystem.update(0.1);
        const expectedFleeSpeed = mockNPC.physics.speed * 2.5;
        const totalVel = Math.sqrt(mockNPC.physics.velX ** 2 + mockNPC.physics.velY ** 2);
        expect(totalVel).toBeCloseTo(expectedFleeSpeed * 0.1);
    });

    it('should change to flee state on explosion event within range', () => {
        // Trigger explosion far away but within radius
        explosionCallback({ x: 800, y: 0, radius: 1000 });
        
        expect(mockNPC.ai.state).toBe('flee');
        expect(mockNPC.ai.timer).toBeGreaterThan(8);
    });
});
