import { describe, it, expect } from 'vitest';
import { Car } from './Car.js';
import { GameConfig } from '../core/GameConfig.js';

describe('Car', () => {
    it('should initialize Car with correct components', () => {
        const c = new Car('car1', 50, 50, '#111');

        expect(c.id).toBe('car1');
        expect(c.type).toBe('car');
        expect(c.transform.x).toBe(50);
        expect(c.transform.width).toBe(50);
        expect(c.transform.height).toBe(20);

        // Arcade physics (T-101)
        expect(c.physics).not.toBeNull();
        expect(c.physics.speed).toBe(0);
        expect(c.physics.maxSpeed).toBe(GameConfig.VEHICLE.MAX_SPEED);
        expect(c.physics.rollingResistance).toBe(0.97);

        expect(c.occupied).toBe(false);
        expect(c.visual.color).toBe('#111');
        expect(c.visual.z).toBe(0.05);
    });

    it('caps top speed at 100 km/h in world units', () => {
        // WorldMetrics.SCALE_FACTOR: 1 px = 0.1 m → 1 m/s = 10 px/s.
        expect(GameConfig.VEHICLE.MAX_SPEED_KMH).toBe(100);
        expect(GameConfig.VEHICLE.MAX_SPEED).toBeCloseTo(100 / 3.6 * 10, 5);
    });

    it('scales acceleration/braking by the same ratio as the top-speed change', () => {
        const c = new Car('car2', 0, 0, '#222');
        expect(c.physics.acceleration).toBeCloseTo(600 * GameConfig.VEHICLE.SPEED_SCALE);
        expect(c.physics.brakeForce).toBeCloseTo(800 * GameConfig.VEHICLE.SPEED_SCALE);
    });
});
