import { describe, it, expect } from 'vitest';
import { NPC } from './NPC.js';

describe('NPC', () => {
    it('should initialize NPC with correct components', () => {
        const npc = new NPC('npc1', 0, 0, '#aaa');
        
        expect(npc.id).toBe('npc1');
        expect(npc.type).toBe('npc');
        expect(npc.transform.width).toBe(18);
        expect(npc.transform.height).toBe(18);
        
        expect(npc.physics).toBeDefined();
        expect(npc.physics.speed).toBe(80);
        
        expect(npc.ai).toBeDefined();
        expect(npc.ai.state).toBe('idle');
        expect(npc.ai.timer).toBe(0);
    });
});
