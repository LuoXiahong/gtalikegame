/**
 * CharacterAnimationSystem — procedural walk/run cycle for player and NPCs.
 *
 * Stateless: the cycle phase lives on the entity (`visual.pose`), never in the
 * system. Reads `physics.velX/velY`, writes joint angles that RenderSync3D
 * copies onto the rig built by NPCModelFactory.
 *
 * Every angle in `visual.pose` is a ready-to-assign `rotation.z` value for its
 * joint: positive swings a downward-hanging limb toward local +X (forward),
 * because rotating (0, -L) about +Z by θ lands at (L·sinθ, -L·cosθ).
 */
import { World } from '../world/World.js';

// Entity velocities are per-frame displacements in 2D pixels (MovementSystem
// adds them straight to transform), so px/s needs the division by dt.
export const WALK_SPEED = 110;   // px/s — at or below this the gait is a pure walk
export const RUN_SPEED = 220;    // px/s — at or above this the gait is a pure run

export const WALK_CADENCE = 1.7; // full cycles per second while walking
export const RUN_CADENCE = 2.9;

export const WALK_SWING = 0.35;  // rad — leg swing half-amplitude
export const RUN_SWING = 0.62;  // beyond ~0.7 the boxy legs read as a split, not a stride
export const ARM_SWING_RATIO = 0.75; // arms swing slightly less than legs

export const WALK_BOUNCE = 0.02;  // m of vertical body travel
export const RUN_BOUNCE = 0.05;

export const RUN_LEAN = 0.14;    // rad of forward torso lean at full run

// Exponential approach rate for the idle↔moving amplitude ramp (per second),
// so stopping eases the limbs back to rest instead of snapping mid-stride.
export const INTENSITY_SMOOTHING = 8;

/** Deterministic per-entity phase offset — NPCs desync without Math.random. */
function phaseSeed(id) {
    const key = String(id);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = (hash * 31 + key.charCodeAt(i)) % 997;
    }
    return (hash / 997) * Math.PI * 2;
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

const TWO_PI = Math.PI * 2;

export const CharacterAnimationSystem = {
    /**
     * @param {number} dt - Seconds since the previous frame.
     * @param {Array} [entities] - Defaults to the live world entity list.
     */
    update(dt, entities = World.entities) {
        if (!dt || dt <= 0 || !entities) return;

        entities.forEach(ent => {
            if (!ent || (ent.type !== 'player' && ent.type !== 'npc')) return;
            if (!ent.physics) return;

            if (!ent.visual) ent.visual = {};
            let pose = ent.visual.pose;
            if (!pose) {
                pose = ent.visual.pose = {
                    phase: phaseSeed(ent.id),
                    intensity: 0,
                    gait: 0,
                    legL: 0, legR: 0, armL: 0, armR: 0,
                    bounce: 0, lean: 0, head: 0
                };
            }

            const stepPx = Math.hypot(ent.physics.velX || 0, ent.physics.velY || 0);
            const speed = stepPx / dt;

            // gait 0 = walk, 1 = run; intensity fades the whole cycle out at rest.
            const gait = clamp01((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED));
            const targetIntensity = clamp01(speed / WALK_SPEED);
            const k = 1 - Math.exp(-INTENSITY_SMOOTHING * dt);
            pose.intensity += (targetIntensity - pose.intensity) * k;
            pose.gait += (gait - pose.gait) * k;

            const cadence = WALK_CADENCE + (RUN_CADENCE - WALK_CADENCE) * pose.gait;
            pose.phase = (pose.phase + cadence * TWO_PI * dt * pose.intensity) % TWO_PI;

            const swing = (WALK_SWING + (RUN_SWING - WALK_SWING) * pose.gait) * pose.intensity;
            const swingL = Math.sin(pose.phase) * swing;

            pose.legL = swingL;
            pose.legR = -swingL;
            // Contralateral: the left arm counter-swings against the left leg.
            pose.armL = -swingL * ARM_SWING_RATIO;
            pose.armR = swingL * ARM_SWING_RATIO;

            // Body is tallest at mid-stance (legs together) — twice per cycle.
            const bounceAmp = WALK_BOUNCE + (RUN_BOUNCE - WALK_BOUNCE) * pose.gait;
            pose.bounce = (1 - Math.abs(Math.sin(pose.phase))) * bounceAmp * pose.intensity;

            // Negative rotation.z tips the torso top toward +X (forward);
            // the head cancels it so the fedora stays level.
            pose.lean = -RUN_LEAN * pose.gait * pose.intensity;
            pose.head = -pose.lean;
        });
    }
};
