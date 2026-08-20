import { describe, it, expect } from 'vitest';
import { EVENTS } from './Events.js';

describe('EVENTS catalog', () => {
    it('has no duplicate event-name values across different keys', () => {
        const values = Object.values(EVENTS);
        expect(new Set(values).size).toBe(values.length);
    });

    it('every key is the SCREAMING_SNAKE_CASE form of its snake_case value', () => {
        Object.entries(EVENTS).forEach(([key, value]) => {
            expect(key).toBe(value.toUpperCase());
        });
    });

    it('every value is a non-empty snake_case string (matches EventBus call-site convention)', () => {
        Object.values(EVENTS).forEach(value => {
            expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
        });
    });
});
