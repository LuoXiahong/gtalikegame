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
        // Halved from 170 alongside the friction fix — 170 was tuned by feel while the
        // friction bug silently halved real speed to 85, so 85 is what actually felt right.
        expect(p.physics.walkSpeed).toBe(85);
        // 1 = no decay; MovementSystem's friction is for values that persist across
        // frames, but PlayerMovementSystem reassigns velX/velY fresh every frame.
        expect(p.physics.friction).toBe(1);
        
        expect(p.visual.color).toBe('#e74c3c');
        
        expect(p.interactionRadius).toBe(120);

        expect(p.health).toEqual({ current: 100, max: 100, dead: false });
    });
});
