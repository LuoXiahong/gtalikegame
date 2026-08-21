/**
 * NPCModelFactory — boxy 3D NPC silhouettes (muted period clothing + fedora),
 * built as an articulated rig so CharacterAnimationSystem can pose the limbs.
 */
import * as THREE from 'three';
import { addContactShadow } from './ContactShadow.js';
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

// Wet/dim look on rain: lower roughness (subtle sheen) + darker albedo.
// Kept subtle so NPCs read as "wet/dim", not shiny plastic or blacked-out.
const WET_ROUGHNESS_MULT = 0.6;
const WET_COLOR_MULT = 0.8;

// All live NPC materials created by createNPCModel(), so a single weather_change
// event can re-tune every currently-existing NPC at once (materials are created
// fresh per-instance, never shared). Plain Set: a stale/disposed material left
// here just means one harmless wasted write on the next weather change, not an
// unbounded leak worth a dedicated cleanup hook.
const liveMaterials = new Set();

// Set once by RenderSystem3D after setupEnvironment() — a plain function call, not
// EventBus, because RenderSystem3D already calls into this file directly as a
// visual/generation helper (architecture.test.js whitelist), same as createNPCModel.
let _envMap = null;
export function setSharedEnvironment(envMap) {
    _envMap = envMap;
}

/**
 * Register a freshly-created material's baseline (for reversible wet/dry
 * toggles with no cumulative drift), then track it for weather updates.
 * @param {THREE.MeshStandardMaterial} mat
 */
function trackMaterial(mat) {
    mat.userData.baseRoughness = mat.roughness;
    mat.userData.baseColorHex = mat.color.getHex();
    if (_envMap) {
        mat.envMap = _envMap;
        // Pin explicitly — none of these set their own envMapIntensity, so opting
        // into .envMap without this would jump from environmentIntensity to three's
        // default of 1.
        mat.envMapIntensity = 0.35;
    }
    liveMaterials.add(mat);
}

/**
 * Apply/revert the wet-look to every tracked NPC material.
 * @param {string} weather - 'rain' or 'clear'
 */
function applyWeatherToMaterials(weather) {
    const wet = weather === 'rain';
    for (const mat of liveMaterials) {
        if (!mat) continue;
        if (wet) {
            mat.roughness = mat.userData.baseRoughness * WET_ROUGHNESS_MULT;
            mat.color.setHex(mat.userData.baseColorHex).multiplyScalar(WET_COLOR_MULT);
        } else {
            mat.roughness = mat.userData.baseRoughness;
            mat.color.setHex(mat.userData.baseColorHex);
        }
        mat.needsUpdate = true;
    }
}

// Subscribe once at module load (guarded so repeated imports/HMR don't stack listeners).
if (!globalThis.__npcModelFactoryWeatherSubscribed) {
    EventBus.on(EVENTS.WEATHER_CHANGE, applyWeatherToMaterials);
    globalThis.__npcModelFactoryWeatherSubscribed = true;
}

// Muted 1930s–40s clothing: greys, browns, navy (no neon/bright primaries)
export const NPC_COLOR_PALETTE = [
    0x3d3d3d, // charcoal grey
    0x5a5a5a, // mid grey
    0x5c4033, // brown
    0x4a3728, // chocolate
    0x6b4423, // walnut
    0x1a2744, // deep navy
    0x2c3e50, // slate navy
    0x3e2723, // dark espresso
    0x4a5560  // cool grey-blue
];

/*
 * Rig proportions (metres, world-space Y with feet at 0).
 *
 * Local +X is the character's FORWARD axis: RenderSync3D sets
 * `mesh.rotation.y = -transform.angle` while movement intent is
 * `cos(angle) / sin(angle)`, so the torso's depth axis is front-to-back and
 * the shoulder span runs along Z.
 */
export const NPC_RIG = {
    HIP_Y: 0.85,        // pelvis pivot — legs hang from here down to 0
    LEG_LENGTH: 0.85,
    TORSO_H: 0.62,      // 0.85 → 1.47, head sits flush on top
    SHOULDER_Y: 1.40,
    ARM_LENGTH: 0.62,   // hands land just below the hip
    HEAD_Y: 1.64,       // 0.34 cube → crown of the skull at 1.81 ≈ NPC_HEIGHT
    SHOULDER_Z: 0.275,  // half the shoulder span
    HIP_Z: 0.115
};

/*
 * Every NPC is built from the same handful of boxes/cylinders, so geometry is
 * created once and shared across all of them (materials stay per-instance —
 * the weather registry above re-tints each NPC individually).
 *
 * `userData.shared` is the contract with RenderSync3D.disposeHierarchy: without
 * it, despawning one NPC would dispose geometry still in use by every other.
 */
const geometryCache = new Map();

function sharedGeometry(key, build) {
    let geom = geometryCache.get(key);
    if (!geom) {
        geom = build();
        geom.userData.shared = true;
        geometryCache.set(key, geom);
    }
    return geom;
}

const box = (key, w, h, d) => sharedGeometry(key, () => new THREE.BoxGeometry(w, h, d));

/**
 * Limb pivot group: geometry is offset half a length downward so the joint
 * rotates from the shoulder/hip instead of the middle of the limb.
 * @param {THREE.BufferGeometry} geom
 * @param {THREE.Material} mat
 * @param {number} length - Segment length; geometry is shifted down by half of it.
 * @param {{x: number, y: number, z: number}} pivot - Pivot position in parent space.
 * @returns {THREE.Group}
 */
function makeLimb(geom, mat, length, pivot) {
    const joint = new THREE.Group();
    joint.position.set(pivot.x, pivot.y, pivot.z);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = -length / 2;
    joint.add(mesh);
    return joint;
}

/**
 * Articulated humanoid NPC. Feet at Y=0; head crown at ~1.8m
 * (WorldMetrics.NPC_HEIGHT), fedora above that.
 *
 * Exposes `group.userData.rig` — the joint groups CharacterAnimationSystem
 * rotates around Z (positive Z-rotation swings a limb toward +X = forward).
 * @param {string|number} [color] - Hex number or CSS hex string; random palette color if omitted.
 * @returns {THREE.Group}
 */
export function createNPCModel(color) {
    const group = new THREE.Group();

    let finalColor = color;
    if (finalColor === undefined || finalColor === null) {
        const randIdx = Math.floor(Math.random() * NPC_COLOR_PALETTE.length);
        finalColor = NPC_COLOR_PALETTE[randIdx];
    } else if (typeof finalColor === 'string') {
        finalColor = parseInt(finalColor.replace('#', '0x'), 16);
    }

    const coatMat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.7,
        metalness: 0.1
    });
    trackMaterial(coatMat);

    // Lapels catch more light than the coat body — reads as "this side is the
    // chest" from the isometric camera, where the face itself is barely visible.
    const lapelMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finalColor).lerp(new THREE.Color(0xffffff), 0.16),
        roughness: 0.65,
        metalness: 0.1
    });
    trackMaterial(lapelMat);

    // Sleeves a touch darker than the coat body, otherwise the arms melt into
    // the torso silhouette and the swing is invisible from a distance.
    const sleeveMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finalColor).multiplyScalar(0.82),
        roughness: 0.72,
        metalness: 0.1
    });
    trackMaterial(sleeveMat);

    // Trousers a shade darker than the coat, so legs separate from the skirt.
    const trouserMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(finalColor).multiplyScalar(0.65),
        roughness: 0.8,
        metalness: 0.05
    });
    trackMaterial(trouserMat);

    const skinMat = new THREE.MeshStandardMaterial({
        color: 0xf1c27d,
        roughness: 0.8,
        metalness: 0.0
    });
    trackMaterial(skinMat);

    // Shared by fedora, shoes, collar and belt — the near-black accent parts.
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.85,
        metalness: 0.05
    });
    trackMaterial(darkMat);

    // ---- Pelvis + legs -----------------------------------------------------
    const pelvis = new THREE.Group();
    pelvis.position.y = NPC_RIG.HIP_Y;
    group.add(pelvis);

    const legGeom = box('leg', 0.2, 0.76, 0.2);
    const legL = makeLimb(legGeom, trouserMat, 0.76, { x: 0, y: 0, z: NPC_RIG.HIP_Z });
    const legR = makeLimb(legGeom, trouserMat, 0.76, { x: 0, y: 0, z: -NPC_RIG.HIP_Z });

    // Shoes overhang forward (+X) — a directional cue that survives the walk cycle.
    [legL, legR].forEach(leg => {
        const shoe = new THREE.Mesh(box('shoe', 0.28, 0.09, 0.2), darkMat);
        shoe.position.set(0.04, -0.805, 0);
        leg.add(shoe);
    });
    pelvis.add(legL, legR);

    // ---- Torso (pivots at the hips so the run lean bends the whole upper body) ----
    const torso = new THREE.Group();
    torso.position.y = NPC_RIG.HIP_Y;
    group.add(torso);

    const chest = new THREE.Mesh(box('chest', 0.3, NPC_RIG.TORSO_H, 0.44), coatMat);
    chest.position.y = NPC_RIG.TORSO_H / 2;
    torso.add(chest);

    // Trench skirt: flares below the waist but stops well above the knee,
    // so the leg swing stays readable from the isometric camera.
    const skirt = new THREE.Mesh(box('skirt', 0.38, 0.34, 0.5), coatMat);
    skirt.position.y = 0.03;
    torso.add(skirt);

    const belt = new THREE.Mesh(box('belt', 0.4, 0.07, 0.52), darkMat);
    belt.position.y = 0.19;
    torso.add(belt);

    // Open-coat lapels: two strips splayed into a V on the chest. A single flat
    // panel read as a bright plate glued to the torso; the V reads as clothing.
    [1, -1].forEach(side => {
        const lapel = new THREE.Mesh(box('lapel', 0.06, 0.34, 0.09), lapelMat);
        lapel.position.set(0.145, 0.36, 0.075 * side);
        lapel.rotation.x = 0.22 * side;
        torso.add(lapel);
    });

    // Turned-up collar, pushed back (-X) — from a top-down angle the raised
    // collar behind the head is the clearest back-of-the-character marker.
    const collar = new THREE.Mesh(box('collar', 0.34, 0.1, 0.46), darkMat);
    collar.position.set(-0.03, NPC_RIG.TORSO_H - 0.03, 0);
    torso.add(collar);

    // ---- Arms --------------------------------------------------------------
    const shoulderY = NPC_RIG.SHOULDER_Y - NPC_RIG.HIP_Y;
    const armGeom = box('arm', 0.16, 0.5, 0.15);
    const armL = makeLimb(armGeom, sleeveMat, 0.5, { x: 0, y: shoulderY, z: NPC_RIG.SHOULDER_Z });
    const armR = makeLimb(armGeom, sleeveMat, 0.5, { x: 0, y: shoulderY, z: -NPC_RIG.SHOULDER_Z });

    [armL, armR].forEach(arm => {
        const hand = new THREE.Mesh(box('hand', 0.13, 0.13, 0.13), skinMat);
        hand.position.y = -(NPC_RIG.ARM_LENGTH - 0.065);
        arm.add(hand);
    });
    torso.add(armL, armR);

    // ---- Head + fedora -----------------------------------------------------
    const head = new THREE.Group();
    head.position.y = NPC_RIG.HEAD_Y - NPC_RIG.HIP_Y;
    torso.add(head);

    const skull = new THREE.Mesh(box('skull', 0.34, 0.34, 0.34), skinMat);
    head.add(skull);

    const nose = new THREE.Mesh(box('nose', 0.07, 0.07, 0.09), skinMat);
    nose.position.set(0.19, -0.02, 0);
    head.add(nose);

    const hat = new THREE.Group();
    hat.position.y = 0.19;
    head.add(hat);

    // Brim nudged forward and stretched along X: from overhead the off-centre
    // oval is the strongest facing cue the silhouette has.
    const brim = new THREE.Mesh(sharedGeometry('brim', () => new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12)), darkMat);
    brim.position.x = 0.07;
    brim.scale.x = 1.2;
    hat.add(brim);

    const crown = new THREE.Mesh(sharedGeometry('crown', () => new THREE.CylinderGeometry(0.16, 0.18, 0.16, 10)), darkMat);
    crown.position.y = 0.09;
    hat.add(crown);

    addContactShadow(group, { width: 0.7, depth: 0.7, y: 0.01, opacity: 0.35 });

    group.userData.rig = { pelvis, torso, head, hat, armL, armR, legL, legR };

    return group;
}
