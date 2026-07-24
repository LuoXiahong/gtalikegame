import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
    TREE_TYPES,
    TREE_TYPE_ALIASES,
    createTree,
    createTreeAt,
    resolveTreeType,
    plantHash
} from './TreeFactory.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

describe('TreeFactory', () => {
    it('exposes seven plant archetypes', () => {
        expect(TREE_TYPES).toEqual([
            'oak', 'pine', 'round', 'birch', 'bush', 'hedge', 'tallBush'
        ]);
    });

    it('resolves legacy aliases', () => {
        expect(resolveTreeType('tree')).toBe('oak');
        expect(resolveTreeType('shrub')).toBe('bush');
        expect(TREE_TYPE_ALIASES.tree).toBe('oak');
    });

    it.each(TREE_TYPES)('creates a Group for %s', (type) => {
        const tree = createTree(type, 1, 2);
        expect(tree).toBeInstanceOf(THREE.Group);
        expect(tree.userData.treeType).toBe(type);
        expect(tree.children.length).toBeGreaterThan(0);
        expect(tree.position.y).toBeCloseTo(WorldMetrics.SIDEWALK_HEIGHT);
    });

    it('plantHash is stable', () => {
        expect(plantHash(1, 2, 3)).toBe(plantHash(1, 2, 3));
        expect(plantHash(1, 2, 3)).not.toBe(plantHash(1, 2, 4));
    });

    it('createTreeAt applies rotation', () => {
        const tree = createTreeAt('oak', 5, 6, Math.PI / 2);
        expect(tree.rotation.y).toBeCloseTo(Math.PI / 2);
        expect(tree.position.x).toBe(5);
        expect(tree.position.z).toBe(6);
    });
});
