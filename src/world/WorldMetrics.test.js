import { describe, it, expect } from 'vitest';
import { WorldMetrics } from './WorldMetrics.js';

describe('WorldMetrics', () => {
    it('should export standard metric constants correctly', () => {
        expect(WorldMetrics).toBeDefined();
        expect(WorldMetrics.SCALE_FACTOR).toBe(0.1);
        expect(WorldMetrics.SIDEWALK_HEIGHT).toBe(0.15);
        expect(WorldMetrics.FLOOR_HEIGHT).toBe(3.0);
        expect(WorldMetrics.LANE_WIDTH).toBe(3.5);
    });

    it('should define correct NPC dimensions', () => {
        expect(WorldMetrics.NPC_HEIGHT).toBe(1.8);
        expect(WorldMetrics.NPC_WIDTH).toBe(0.6);
        expect(WorldMetrics.NPC_DEPTH).toBe(0.4);
    });

    it('should define realistic sedan and van dimensions', () => {
        expect(WorldMetrics.SEDAN.length).toBe(4.5);
        expect(WorldMetrics.SEDAN.width).toBe(1.8);
        expect(WorldMetrics.SEDAN.height).toBe(1.4);

        expect(WorldMetrics.VAN.length).toBe(5.5);
        expect(WorldMetrics.VAN.width).toBe(2.2);
        expect(WorldMetrics.VAN.height).toBe(1.8);
    });
});
