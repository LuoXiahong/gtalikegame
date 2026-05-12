/**
 * SYSTEM / FACTORY: NPCModelFactory
 * Responsible for creating 3D capsule-like actor silhouettes for NPCs.
 * Follows the WorldMetrics specifications and integrates with the 3D rendering pipeline.
 */
import * as THREE from 'three';
import { WorldMetrics } from '../world/WorldMetrics.js';

// Predefined palette of 6+ vibrant clothing colors for NPCs
export const NPC_COLOR_PALETTE = [
    0x8e44ad, // Purple
    0x27ae60, // Green
    0xc0392b, // Red
    0xf1c40f, // Yellow
    0xe67e22, // Orange
    0x1abc9c, // Teal
    0x3498db, // Blue
    0xe74c3c, // Coral
    0x2ecc71  // Light Green
];

/**
 * Creates a beautiful capsule/humanoid silhouette NPC model using Three.js primitives.
 * Base of the model is at Y = 0, pivot is centered horizontally.
 * Height is scaled exactly to WorldMetrics.NPC_HEIGHT (~1.8m).
 * 
 * @param {string|number} [color] - Optional hex color code or CSS hex string. If not provided, a random color from the palette is selected.
 * @returns {THREE.Group} A Three.js Group containing the NPC meshes.
 */
export function createNPCModel(color) {
    const group = new THREE.Group();

    // 1. Determine shirt/torso color
    let finalColor = color;
    if (finalColor === undefined || finalColor === null) {
        // Pick random color from palette if none provided
        const randIdx = Math.floor(Math.random() * NPC_COLOR_PALETTE.length);
        finalColor = NPC_COLOR_PALETTE[randIdx];
    } else if (typeof finalColor === 'string') {
        // Parse hex strings like '#8e44ad' or '8e44ad' to integers if needed
        finalColor = parseInt(finalColor.replace('#', '0x'), 16);
    }

    // Ciało (Torso): Pionowy prostopadłościan o wymiarach: grubość (X) = 0.4m, wysokość (Y) = 1.4m, szerokość ramion (Z) = 0.6m
    // Pozwala to uniknąć chodu bokiem ("crab-walking"), gdyż przód postaci jest skierowany wzdłuż osi X.
    const bodyGeom = new THREE.BoxGeometry(0.4, 1.4, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.7,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    // Align base of torso at Y = 0 (origin of BoxGeometry is at center)
    body.position.y = 0.7; // 1.4 / 2
    group.add(body);

    // Głowa: Sześcian o wymiarach 0.4 x 0.4 x 0.4m osadzona na wysokości Y = 1.6m
    const headGeom = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    // Standardowy skórny/neutralny kolor: 0xf1c27d
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xf1c27d,
        roughness: 0.8,
        metalness: 0.0
    });
    const head = new THREE.Mesh(headGeom, headMat);
    // Środek głowy na wysokości Y = 1.6m (dolna krawędź głowy na Y = 1.4m, górna na Y = 1.8m)
    head.position.y = 1.6;
    group.add(head);

    return group;
}
