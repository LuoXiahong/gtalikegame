import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Camera } from './Camera.js';
import { EventBus } from '../core/EventBus.js';

describe('Camera', () => {
    let mockEntity;

    beforeEach(() => {
        Camera.x = 0;
        Camera.y = 0;
        Camera.width = 800;
        Camera.height = 600;
        Camera._needsSnap = false;

        mockEntity = {
            transform: { x: 1000, y: 1000 }
        };
    });

    it('should follow target with smoothing when _needsSnap is false', () => {
        Camera.follow(mockEntity, 0.1);
        
        // targetX = 400 - 1000 = -600
        // targetY = 300 - 1000 = -700
        // with smoothing = 6, dt = 0.1, lerp factor is 0.6
        // Camera.x should be 0 + (-600 - 0) * 0.6 = -360
        expect(Camera.x).toBeCloseTo(-360);
        expect(Camera.y).toBeCloseTo(-420);
        expect(Camera._needsSnap).toBe(false);
    });

    it('should snap directly to target when _needsSnap is true', () => {
        Camera._needsSnap = true;
        Camera.follow(mockEntity, 0.1);

        // targetX = 400 - 1000 = -600
        // targetY = 300 - 1000 = -700
        // Should snap directly to targets
        expect(Camera.x).toBe(-600);
        expect(Camera.y).toBe(-700);
        expect(Camera._needsSnap).toBe(false); // resets flag
    });

    it('should set _needsSnap when vehicle enter/exit events occur', () => {
        Camera.init();
        
        // Simulating the event listener callback
        Camera._needsSnap = false;
        EventBus.emit('vehicle_entered', { carId: 'car1' });
        expect(Camera._needsSnap).toBe(true);

        Camera._needsSnap = false;
        EventBus.emit('vehicle_exited', { carId: 'car1' });
        expect(Camera._needsSnap).toBe(true);
    });
});
