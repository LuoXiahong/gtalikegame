import { describe, it, expect } from 'vitest';
import { GameConfig } from './GameConfig.js';

// Recursively collects every leaf (non-object) value under a dot path.
function leaves(obj, prefix = '') {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return typeof value === 'object' && value !== null
            ? leaves(value, path)
            : [[path, value]];
    });
}

describe('GameConfig', () => {
    it('has the expected top-level tunable sections', () => {
        expect(Object.keys(GameConfig)).toEqual(
            expect.arrayContaining(['SPAWN', 'TRAFFIC', 'AI', 'INTERACTION', 'POLICE', 'HEALTH'])
        );
    });

    it('every leaf tunable is a finite number', () => {
        leaves(GameConfig).forEach(([path, value]) => {
            expect(Number.isFinite(value), `${path} should be a finite number, got ${JSON.stringify(value)}`).toBe(true);
        });
    });
});
