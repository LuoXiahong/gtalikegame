/**
 * NPCModelFactory — boxy 3D NPC silhouettes (muted period clothing + fedora).
 */
import * as THREE from 'three';
import { addContactShadow } from './ContactShadow.js';
import { EventBus } from '../core/EventBus.js';

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

/**
 * Register a freshly-created material's baseline (for reversible wet/dry
 * toggles with no cumulative drift), then track it for weather updates.
 * @param {THREE.MeshStandardMaterial} mat
 */
function trackMaterial(mat) {
    mat.userData.baseRoughness = mat.roughness;
    mat.userData.baseColorHex = mat.color.getHex();
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
    EventBus.on('weather_change', applyWeatherToMaterials);
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

/**
 * Boxy humanoid NPC. Base at Y=0, pivot centered; height matches WorldMetrics.NPC_HEIGHT (~1.8m).
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

    // Torso: depth X=0.4m, height Y=1.4m, shoulder width Z=0.6m
    const bodyGeom = new THREE.BoxGeometry(0.4, 1.4, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.7,
        metalness: 0.1
    });
    trackMaterial(bodyMat);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.7;
    group.add(body);

    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xf1c27d,
        roughness: 0.8,
        metalness: 0.0
    });
    trackMaterial(headMat);
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.6;
    group.add(head);

    // Fedora (brim + crown) — period silhouette cue
    const hatMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        roughness: 0.85,
        metalness: 0.05
    });
    trackMaterial(hatMat);
    const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12),
        hatMat
    );
    brim.position.y = 1.82;
    group.add(brim);

    const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.18, 0.16, 10),
        hatMat
    );
    crown.position.y = 1.92;
    group.add(crown);

    addContactShadow(group, { width: 0.7, depth: 0.7, y: 0.01, opacity: 0.35 });

    return group;
}
