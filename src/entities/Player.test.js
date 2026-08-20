import { describe, it, expect } from 'vitest';
import { Player } from './Player.js';

describe('Player', () => {
    it('should initialize Player with correct components', () => {
        const p = new Player(100, 200);
        
        expect(p.id).toBe('player1');
        expect(p.type).toBe('player');
        expect(p.transform.x).toBe(100);
        expect(p.transform.y).toBe(200);
        
        expect(p.physics).toBeDefined();
        expect(p.physics.walkSpeed).toBe(170);
        expect(p.physics.friction).toBe(0.5);
        
        expect(p.visual.color).toBe('#e74c3c');
        
        expect(p.interactionRadius).toBe(120);

        expect(p.health).toEqual({ current: 100, max: 100, dead: false });
    });
});
