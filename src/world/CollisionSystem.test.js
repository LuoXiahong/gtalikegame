import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollisionSystem } from './CollisionSystem.js';
import { World } from './World.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';

vi.mock('./World.js', () => ({
    World: {
        getEntitiesByType: vi.fn(),
        buildings: []
    }
}));

vi.mock('../systems/VehicleSystem.js', () => ({
    VehicleSystem: {
        getControlledEntity: vi.fn()
    }
}));

describe('CollisionSystem', () => {
    let mockPlayer;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPlayer = {
            id: 'player1',
            type: 'player',
            transform: { x: 100, y: 100, width: 20, height: 20 },
            physics: { velX: 0, velY: 0 }
        };
        World.getEntitiesByType.mockImplementation((type) => {
            if (type === 'player') return [mockPlayer];
            return [];
        });
        VehicleSystem.getControlledEntity.mockReturnValue(mockPlayer);
    });

    it('should push player out of a building on the shortest axis', () => {
        // Building at 110, 90, size 50x50. 
        // Player at 100, 100 (center), size 20x20.
        // Left edge of player: 90, Right edge: 110
        // Top edge of player: 90, Bottom edge: 110
        // Building: x=110, y=90, w=50, h=50 (left=110, top=90, right=160, bottom=140)
        // There is a slight overlap on the right side of the player (left side of building)
        
        const building = { x: 105, y: 80, w: 50, h: 50 }; // Left edge of building is 105
        World.buildings = [building];

        // Before update, player.x + width/2 = 110. Building starts at 105. Overlap = 5.
        CollisionSystem.update();

        // Player should be pushed left by 5 pixels
        expect(mockPlayer.transform.x).toBe(100 - 5 + 10 - 10); // Wait, center is 100, half width is 10. edge is 110.
        // 110 - 105 = 5. so x becomes 100 - 5 = 95.
        expect(mockPlayer.transform.x).toBe(95);
        expect(mockPlayer.physics.velX).toBe(0);
    });

    it('should allow sliding along walls (only zeroing velocity on the hit axis)', () => {
        mockPlayer.physics.velX = 10;
        mockPlayer.physics.velY = 10;
        
        const building = { x: 105, y: 50, w: 50, h: 100 }; // Vertical wall on the right
        World.buildings = [building];

        CollisionSystem.update();

        expect(mockPlayer.physics.velX).toBe(0);
        expect(mockPlayer.physics.velY).toBe(10); // Still moving vertically
    });
});
