import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollisionSystem } from './CollisionSystem.js';
import { World } from './World.js';

vi.mock('./World.js', () => ({
    World: {
        getEntitiesByType: vi.fn(),
        getControlled: vi.fn(),
        buildings: []
    }
}));

describe('CollisionSystem', () => {
    let mockPlayer;

    beforeEach(() => {
        vi.clearAllMocks();
        World.buildings = [];
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
        World.getControlled.mockReturnValue(mockPlayer);
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

    it('does not zero physics.walkSpeed for an on-foot player hitting a building (walkSpeed is a constant, not a velocity magnitude)', () => {
        // Regression: the building-hit handler only zeroes physics.speed, which only
        // Car has. Player uses physics.walkSpeed — PlayerMovementSystem's constant
        // walk-speed multiplier — so it's structurally untouched here (zeroing it
        // would permanently strand the player: can rotate but never move again).
        mockPlayer.physics.walkSpeed = 100;

        const building = { x: 105, y: 80, w: 50, h: 50 };
        World.buildings = [building];

        CollisionSystem.update();

        expect(mockPlayer.physics.velX).toBe(0);
        expect(mockPlayer.physics.walkSpeed).toBe(100);
    });

    it('zeroes physics.speed (not just velX/velY) when a car hits a building', () => {
        const mockCar = {
            id: 'car1',
            type: 'car',
            transform: { x: 100, y: 100, width: 20, height: 20, angle: 0 },
            physics: { velX: 50, velY: 0, speed: 120 }
        };
        World.getControlled.mockReturnValue(mockCar);

        const building = { x: 105, y: 80, w: 50, h: 50 };
        World.buildings = [building];

        CollisionSystem.update();

        expect(mockCar.physics.velX).toBe(0);
        expect(mockCar.physics.speed).toBe(0);
    });

    it('uses the oriented (OBB) footprint for a rotated car, not its axis-aligned box', () => {
        // Long car (width 40, height 16) rotated 90deg to face along world Y.
        // Its true footprint is now only 16 wide on the world x-axis (half-extent 8),
        // even though the raw width/height (half-extent 20) would suggest otherwise.
        const mockCar = {
            id: 'car1',
            type: 'car',
            transform: { x: 100, y: 100, width: 40, height: 16, angle: Math.PI / 2 },
            physics: { velX: 0, velY: 0, speed: 80 }
        };
        World.getControlled.mockReturnValue(mockCar);

        // Building's left edge is 12px away from the car center: inside the naive
        // (unrotated) half-width of 20, but outside the true rotated half-width of 8.
        const building = { x: 112, y: 90, w: 50, h: 20 };
        World.buildings = [building];

        // A naive axis-aligned check (ignoring rotation) would call this a collision.
        expect(CollisionSystem.checkAABB(mockCar.transform, building)).toBe(true);

        CollisionSystem.update();

        // With OBB/SAT, the rotated car's true (narrower) footprint doesn't reach
        // the building, so nothing should move or be zeroed out.
        expect(mockCar.transform.x).toBe(100);
        expect(mockCar.transform.y).toBe(100);
        expect(mockCar.physics.speed).toBe(80);
    });

    it('resolves car-vs-car collisions: splits the push and stops the driven car', () => {
        const drivenCar = {
            id: 'car1',
            type: 'car',
            transform: { x: 100, y: 100, width: 90, height: 45, angle: 0 },
            physics: { velX: 30, velY: 5, speed: 200 }
        };
        const otherCar = {
            id: 'car2',
            type: 'car',
            transform: { x: 150, y: 100, width: 90, height: 45, angle: 0 },
            physics: { velX: 0, velY: 0, speed: 0 }
        };
        World.getControlled.mockReturnValue(drivenCar);

        World.getEntitiesByType.mockImplementation((type) => {
            if (type === 'player') return [mockPlayer];
            if (type === 'car') return [drivenCar, otherCar];
            return [];
        });

        // Centers 50 apart, half-widths 45 each -> overlap of 40 along x.
        CollisionSystem.update();

        expect(drivenCar.transform.x).toBe(80); // 100 - 40 * 0.5
        expect(otherCar.transform.x).toBe(170); // 150 + 40 * 0.5
        expect(drivenCar.physics.velX).toBe(0);
        expect(drivenCar.physics.velY).toBe(5); // untouched: normal is purely on x
        expect(drivenCar.physics.speed).toBe(0);
    });

    it('survives an npc_hit listener despawning the NPC mid-iteration', async () => {
        // getEntitiesByType hands back the live internal array, and HealthSystem
        // removes an NPC from it the moment a hit drops HP to zero. Iterating
        // that array with a cached length then walked off the shortened end and
        // crashed on `undefined.transform`.
        const { EventBus } = await import('../core/EventBus.js');
        const car = {
            id: 'car1', type: 'car',
            transform: { x: 100, y: 100, width: 90, height: 45, angle: 0 },
            physics: { velX: 0, velY: 0, speed: 100 }
        };
        const makeNpc = (id) => ({
            id, type: 'npc',
            transform: { x: 100, y: 100, width: 18, height: 18, angle: 0 },
            health: { current: 100, max: 100, dead: false }
        });
        const live = [makeNpc('npc1'), makeNpc('npc2'), makeNpc('npc3')];

        World.getControlled.mockReturnValue(car);
        World.getEntitiesByType.mockImplementation((type) => {
            if (type === 'player') return [mockPlayer];
            if (type === 'car') return [car];
            if (type === 'npc') return live; // by reference, as the real World does
            return [];
        });

        const onHit = ({ npc }) => {
            const idx = live.indexOf(npc);
            if (idx !== -1) live.splice(idx, 1);
        };
        EventBus.on('npc_hit', onHit);
        try {
            expect(() => CollisionSystem.update()).not.toThrow();
            expect(live.length).toBe(0);
        } finally {
            EventBus.off('npc_hit', onHit);
        }
    });

    it('does not resolve collisions between two cars neither of which is controlled', () => {
        const carA = { id: 'car1', type: 'car', transform: { x: 100, y: 100, width: 90, height: 45, angle: 0 }, physics: { velX: 0, velY: 0, speed: 0 } };
        const carB = { id: 'car2', type: 'car', transform: { x: 150, y: 100, width: 90, height: 45, angle: 0 }, physics: { velX: 0, velY: 0, speed: 0 } };
        World.getControlled.mockReturnValue(mockPlayer); // on foot, far from both cars

        World.getEntitiesByType.mockImplementation((type) => {
            if (type === 'player') return [mockPlayer];
            if (type === 'car') return [carA, carB];
            return [];
        });

        CollisionSystem.update();

        expect(carA.transform.x).toBe(100);
        expect(carB.transform.x).toBe(150);
    });
});
