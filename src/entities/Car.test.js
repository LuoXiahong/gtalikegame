import { describe, it, expect } from 'vitest';
import { Car } from './Car.js';

describe('Car', () => {
    it('should initialize Car with correct components', () => {
        const c = new Car('car1', 50, 50, '#111');
        
        expect(c.id).toBe('car1');
        expect(c.type).toBe('car');
        expect(c.transform.x).toBe(50);
        expect(c.transform.width).toBe(90);
        expect(c.transform.height).toBe(45);
        
        // Auto ma teraz fizykę arcade (T-101)
        expect(c.physics).not.toBeNull();
        expect(c.physics.speed).toBe(0); // Prędkość początkowa
        expect(c.physics.maxSpeed).toBe(600);
        expect(c.physics.rollingResistance).toBe(0.98);
        
        // Auto ma warstwę z i flagi zajętości
        expect(c.occupied).toBe(false);
        expect(c.visual.color).toBe('#111');
        expect(c.visual.z).toBe(0.05);
    });
});
