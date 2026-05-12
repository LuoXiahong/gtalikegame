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

    const h = WorldMetrics.NPC_HEIGHT || 1.8;
    const w = WorldMetrics.NPC_WIDTH || 0.6;

    // Body: Capsule (Cylinder as torso/legs)
    const bodyHeight = h * 0.75; // 1.35m
    const bodyRadius = w / 3;    // 0.2m (fits nicely inside 0.6m shoulder width)
    
    // Cylinder geometry: radiusTop, radiusBottom, height, radialSegments
    const bodyGeom = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 8);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: finalColor,
        roughness: 0.7,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    // Align base of cylinder at Y = 0 (cylinder origin is at its center)
    body.position.y = bodyHeight / 2; // 0.675m
    group.add(body);

    // Head: Sphere on top of the capsule body
    const headRadius = bodyRadius * 1.1; // ~0.22m (slightly wider than neck/body)
    const headGeom = new THREE.SphereGeometry(headRadius, 8, 8);
    // Standard skin tone/neutral color: 0xf1c27d
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xf1c27d,
        roughness: 0.8,
        metalness: 0.0
    });
    const head = new THREE.Mesh(headGeom, headMat);
    // Position head so top of the head is exactly at Y = NPC_HEIGHT
    head.position.y = h - headRadius; // 1.8 - 0.22 = 1.58m
    group.add(head);

    return group;
}
