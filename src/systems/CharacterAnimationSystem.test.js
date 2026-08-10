import { describe, it, expect } from 'vitest';
import {
    CharacterAnimationSystem,
    WALK_SPEED,
    RUN_SPEED,
    ARM_SWING_RATIO,
    RUN_LEAN
} from './CharacterAnimationSystem.js';

const DT = 1 / 60;

/**
 * Character moving along +X at a given px/s. Velocities are per-frame
 * displacements, matching what MovementSystem consumes.
 */
function makeChar(speedPxPerSec, id = 'player1', type = 'player') {
    return {
        id,
        type,
        transform: { x: 0, y: 0, angle: 0 },
        physics: { velX: speedPxPerSec * DT, velY: 0 },
        visual: {}
    };
}

/** Run the system for a while so smoothed values settle. */
function settle(ent, frames = 120) {
    for (let i = 0; i < frames; i++) CharacterAnimationSystem.update(DT, [ent]);
    return ent.visual.pose;
}

describe('CharacterAnimationSystem', () => {
    it('advances the cycle phase proportionally to speed', () => {
        const walker = makeChar(WALK_SPEED, 'a');
        const runner = makeChar(RUN_SPEED, 'b');

        // Same starting phase for a fair comparison of accumulated advance.
        CharacterAnimationSystem.update(DT, [walker]);
        CharacterAnimationSystem.update(DT, [runner]);
        walker.visual.pose.phase = 0;
        runner.visual.pose.phase = 0;
        walker.visual.pose.intensity = 1;
        runner.visual.pose.intensity = 1;
        walker.visual.pose.gait = 0;
        runner.visual.pose.gait = 1;

        CharacterAnimationSystem.update(DT, [walker]);
        CharacterAnimationSystem.update(DT, [runner]);

        expect(walker.visual.pose.phase).toBeGreaterThan(0);
        expect(runner.visual.pose.phase).toBeGreaterThan(walker.visual.pose.phase);
    });

    it('keeps limbs in opposite phase (legs mirrored, arms contralateral)', () => {
        const pose = settle(makeChar(WALK_SPEED));

        expect(pose.legR).toBeCloseTo(-pose.legL);
        expect(pose.armR).toBeCloseTo(-pose.armL);
        // Left arm counter-swings against the left leg.
        expect(pose.armL).toBeCloseTo(-pose.legL * ARM_SWING_RATIO);
    });

    it('runs with a bigger swing, faster cadence and a forward lean', () => {
        const walker = settle(makeChar(WALK_SPEED, 'a'));
        const runner = settle(makeChar(RUN_SPEED * 1.5, 'b'));

        expect(runner.gait).toBeGreaterThan(0.9);
        expect(walker.gait).toBeLessThan(0.1);

        // Compare swing capacity, not the instantaneous sample (phases differ).
        const walkSwing = Math.abs(walker.legL) / Math.abs(Math.sin(walker.phase));
        const runSwing = Math.abs(runner.legL) / Math.abs(Math.sin(runner.phase));
        expect(runSwing).toBeGreaterThan(walkSwing);

        // Forward lean is a negative rotation.z; the head cancels it.
        expect(runner.lean).toBeLessThan(0);
        expect(runner.lean).toBeCloseTo(-RUN_LEAN, 1);
        expect(runner.head).toBeCloseTo(-runner.lean);
        expect(walker.lean).toBeCloseTo(0, 2);
    });

    it('eases limbs back to rest when the character stops', () => {
        const ent = makeChar(WALK_SPEED);
        settle(ent);
        expect(Math.abs(ent.visual.pose.legL)).toBeGreaterThan(0);

        ent.physics.velX = 0;
        ent.physics.velY = 0;
        const mid = { ...settle(ent, 3) };
        const rest = settle(ent, 120);

        // Decays rather than snapping, and ends at rest.
        expect(Math.abs(mid.legL)).toBeGreaterThan(Math.abs(rest.legL));
        expect(rest.legL).toBeCloseTo(0, 3);
        expect(rest.legR).toBeCloseTo(0, 3);
        expect(rest.armL).toBeCloseTo(0, 3);
        expect(rest.bounce).toBeCloseTo(0, 3);
        expect(rest.lean).toBeCloseTo(0, 3);
    });

    it('freezes the phase while idle so stopped characters do not twitch', () => {
        const ent = makeChar(0);
        settle(ent, 10);
        const phase = ent.visual.pose.phase;

        settle(ent, 10);

        expect(ent.visual.pose.phase).toBeCloseTo(phase);
    });

    it('bounces the body twice per stride cycle', () => {
        const ent = makeChar(WALK_SPEED);
        settle(ent);
        const pose = ent.visual.pose;
        pose.intensity = 1;

        // Mid-stance (legs together) is the high point; full stride the low point.
        pose.phase = 0;
        CharacterAnimationSystem.update(DT, [{ ...ent, visual: { pose } }]);
        const atZero = pose.bounce;
        pose.phase = Math.PI / 2;
        CharacterAnimationSystem.update(DT, [{ ...ent, visual: { pose } }]);
        const atQuarter = pose.bounce;
        pose.phase = Math.PI;
        CharacterAnimationSystem.update(DT, [{ ...ent, visual: { pose } }]);
        const atHalf = pose.bounce;

        expect(atZero).toBeGreaterThan(atQuarter);
        expect(atHalf).toBeGreaterThan(atQuarter);
    });

    it('gives each entity a deterministic, desynced starting phase', () => {
        const a = makeChar(WALK_SPEED, 'npc-1', 'npc');
        const b = makeChar(WALK_SPEED, 'npc-2', 'npc');
        CharacterAnimationSystem.update(DT, [a, b]);

        expect(a.visual.pose.phase).not.toBeCloseTo(b.visual.pose.phase);

        // Same id → same seed on a fresh entity (no Math.random).
        const aAgain = makeChar(WALK_SPEED, 'npc-1', 'npc');
        CharacterAnimationSystem.update(DT, [aAgain]);
        expect(aAgain.visual.pose.phase).toBeCloseTo(a.visual.pose.phase);
    });

    it('ignores non-characters and entities without physics', () => {
        const car = { id: 'car1', type: 'car', physics: { velX: 5, velY: 0 }, visual: {} };
        const ghost = { id: 'npc9', type: 'npc', visual: {} };

        CharacterAnimationSystem.update(DT, [car, ghost]);

        expect(car.visual.pose).toBeUndefined();
        expect(ghost.visual.pose).toBeUndefined();
    });

    it('is a no-op for a zero or missing delta', () => {
        const ent = makeChar(WALK_SPEED);

        CharacterAnimationSystem.update(0, [ent]);

        expect(ent.visual.pose).toBeUndefined();
    });
});
