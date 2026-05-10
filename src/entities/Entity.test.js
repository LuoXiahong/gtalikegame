import { describe, it, expect } from 'vitest';
import { Entity } from './Entity.js';

describe('Entity', () => {
    it('should initialize with correct default properties', () => {
        const entity = new Entity('e1', 'typeA', 10, 20);
        
        expect(entity.id).toBe('e1');
        expect(entity.type).toBe('typeA');
        
        expect(entity.transform).toEqual({
            x: 10, y: 20, width: 20, height: 20, angle: 0
        });
        
        expect(entity.physics).toBeNull();
        expect(entity.visual).toEqual({
            color: '#ffffff', walkCycle: 0
        });
    });
});
