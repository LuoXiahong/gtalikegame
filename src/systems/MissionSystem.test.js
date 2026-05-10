import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MissionSystem } from './MissionSystem.js';
import { EventBus } from '../core/EventBus.js';
import { World } from '../world/World.js';

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn()
    }
}));

describe('MissionSystem', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        MissionSystem.init();
    });

    it('should start at stage 0', () => {
        expect(MissionSystem.stage).toBe(0);
    });

    it('should advance to stage 1 when player is near npc', () => {
        EventBus.emit('player_near_npc');
        expect(MissionSystem.stage).toBe(1);
        expect(MissionSystem.timer).toBe(45);
        expect(MissionSystem.timerActive).toBe(true);
    });

    it('should advance to stage 2 when player is near car after stage 1', () => {
        EventBus.emit('player_near_npc');
        EventBus.emit('player_near_car');
        expect(MissionSystem.stage).toBe(2);
        expect(MissionSystem.timer).toBe(60);
        expect(MissionSystem.targetLocation).not.toBeNull();
    });

    it('should decrement timer in update', () => {
        EventBus.emit('player_near_npc');
        const initialTimer = MissionSystem.timer;
        MissionSystem.update(0.1);
        expect(MissionSystem.timer).toBeCloseTo(initialTimer - 0.1);
    });

    it('should escalate wanted level when timer expires', () => {
        const spy = vi.spyOn(EventBus, 'emit');
        EventBus.emit('player_near_npc');
        MissionSystem.timer = 0.05;
        MissionSystem.update(0.1);
        
        expect(spy).toHaveBeenCalledWith('npc_hit');
        expect(MissionSystem.timer).toBe(10); // Reset for repeat pressure
    });

    it('should complete mission when in target zone in stage 2', () => {
        EventBus.emit('player_near_npc');
        EventBus.emit('player_near_car');
        
        World.getEntitiesByType.mockReturnValue([{
            transform: { x: 3000, y: 3000 }
        }]);

        MissionSystem.update(0.1);
        expect(MissionSystem.stage).toBe(3);
        expect(MissionSystem.timerActive).toBe(false);
    });
});
