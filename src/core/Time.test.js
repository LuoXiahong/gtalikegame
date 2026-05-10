import { describe, it, expect, beforeEach } from 'vitest';
import { Time } from './Time.js';

describe('Time', () => {
    beforeEach(() => {
        Time.delta = 0;
        Time.lastFrame = 1000;
    });

    it('should calculate delta time correctly', () => {
        Time.update(1016); // 16ms later (approx 60fps)
        expect(Time.delta).toBeCloseTo(0.016);
        expect(Time.lastFrame).toBe(1016);
    });

    it('should cap delta time at 0.1s to prevent huge jumps', () => {
        Time.update(1500); // 500ms later (huge lag spike)
        expect(Time.delta).toBe(0.1);
        expect(Time.lastFrame).toBe(1500);
    });
});
