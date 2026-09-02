import { describe, it, expect, vi } from 'vitest';
import {
    collectHeroPuddleSpots,
    createPuddleReflectors,
    createInvertedLampGhost,
    setPuddleReflectorsActive,
    disposePuddleReflectors,
    HERO_INTERSECTION_2D,
    PUDDLE_RADIUS,
    PUDDLE_LAMP_OFFSET,
    GHOST_STRUCTURE_OPACITY,
    GHOST_GLOBE_OPACITY,
    PuddleReflectorShader
} from './PuddleReflector.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { CityBuilder3D, LAMP_EDGE_INSET } from './CityBuilder3D.js';

describe('PuddleReflector', () => {
    it('exposes a soft-alpha puddle shader', () => {
        expect(PuddleReflectorShader.fragmentShader).toContain('opacity');
        expect(PuddleReflectorShader.fragmentShader).toContain('discard');
        expect(PuddleReflectorShader.uniforms.opacity.value).toBeGreaterThan(0.4);
    });

    it('collects deterministic hero spots near the main intersection lamps', () => {
        const SF = WorldMetrics.SCALE_FACTOR;
        const a = collectHeroPuddleSpots(SF, 2);
        const b = collectHeroPuddleSpots(SF, 2);
        expect(a).toEqual(b);
        expect(a.length).toBe(2);

        const ix = HERO_INTERSECTION_2D.x * SF;
        const iz = HERO_INTERSECTION_2D.z * SF;
        const lamps = CityBuilder3D.collectLampSpots(SF);
        for (const spot of a) {
            expect(spot.radius).toBe(PUDDLE_RADIUS);
            expect(spot.lampX).toBeDefined();
            const nearLamp = lamps.some(
                l => Math.abs(Math.hypot(l.x - spot.x, l.z - spot.z) - PUDDLE_LAMP_OFFSET) < 0.01
            );
            expect(nearLamp).toBe(true);
            expect(Math.hypot(spot.x - ix, spot.z - iz)).toBeLessThan(25);
        }
    });

    it('places hero puddles clear of the kerb so the sidewalk cannot clip the disc', () => {
        // Lamps stand LAMP_EDGE_INSET inside the block edge; the disc must be
        // pushed past the kerb by more than its own radius or the raised
        // sidewalk slab occludes part of it (wedge + z-fight dither at the kerb).
        const kerbToLamp = LAMP_EDGE_INSET * WorldMetrics.SCALE_FACTOR;
        expect(PUDDLE_LAMP_OFFSET).toBeGreaterThan(kerbToLamp + PUDDLE_RADIUS);
    });

    it('builds an inverted lamp ghost with Y flip in the puddle', () => {
        const ghost = createInvertedLampGhost({
            x: 11,
            z: 21,
            lampX: 10,
            lampZ: 20,
            lampRot: Math.PI / 2
        });
        expect(ghost.scale.y).toBeLessThan(0);
        expect(ghost.userData.isPuddleLampGhost).toBe(true);
        expect(ghost.children.length).toBeGreaterThanOrEqual(2);
        expect(ghost.position.x).toBe(11);
        expect(ghost.position.z).toBe(21);
        expect(ghost.position.y).toBeGreaterThan(0);
    });

    it('keeps the mirrored lamp reading as wet asphalt, not a second lamp', () => {
        // Rough wet asphalt scatters: the bright globe smears into a highlight
        // while the pole/arm holding it up all but vanish. If the structure ever
        // creeps back toward the globe's strength the puddle reads as a legible
        // upside-down lamp pasted on the road (the artifact this replaced).
        const ghost = createInvertedLampGhost({ x: 11, z: 21, lampX: 10, lampZ: 20, lampRot: 0 });
        const opacities = ghost.children.map(c => c.material.opacity);
        const structure = Math.min(...opacities);
        const highlight = Math.max(...opacities);

        expect(structure).toBe(GHOST_STRUCTURE_OPACITY);
        expect(highlight).toBe(GHOST_GLOBE_OPACITY);
        expect(structure).toBeLessThan(highlight * 0.75);
        expect(highlight).toBeLessThan(0.6);
    });

    it('creates Reflector + stencil disc + lamp ghost per hero puddle', () => {
        const scene = { add: vi.fn(), remove: vi.fn() };
        const reflectors = createPuddleReflectors(scene, { active: true });
        expect(reflectors.length).toBe(2);
        expect(reflectors.ghosts.length).toBe(2);
        expect(reflectors.discs.length).toBe(2);
        // 2 discs + 2 ghosts + 2 reflectors
        expect(scene.add).toHaveBeenCalledTimes(6);
        for (const r of reflectors) {
            expect(r.isReflector).toBe(true);
            expect(r.userData.isPuddleReflector).toBe(true);
            expect(r.visible).toBe(true);
        }
        disposePuddleReflectors(reflectors, scene);
        expect(scene.remove).toHaveBeenCalledTimes(6);
    });

    it('toggles visibility with weather for reflectors, ghosts, and discs', () => {
        const scene = { add: vi.fn(), remove: vi.fn() };
        const reflectors = createPuddleReflectors(scene, { active: true });
        setPuddleReflectorsActive(reflectors, false);
        expect(reflectors.every(r => r.visible === false)).toBe(true);
        expect(reflectors.ghosts.every(g => g.visible === false)).toBe(true);
        expect(reflectors.discs.every(d => d.visible === false)).toBe(true);
        setPuddleReflectorsActive(reflectors, true);
        expect(reflectors.every(r => r.visible === true)).toBe(true);
        disposePuddleReflectors(reflectors, scene);
    });
});
