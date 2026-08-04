/**
 * SYSTEM / FACTORY: VehicleModelFactory
 * Procedural 1930s–40s vehicle silhouettes from archetype data tables.
 * Adding a new car = new archetype entry, not a new code branch.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addContactShadow } from './ContactShadow.js';

/**
 * Soft box with clamped corner radius (2 segments keep cost low).
 * @param {number} w
 * @param {number} h
 * @param {number} d
 * @param {number} radius
 * @returns {RoundedBoxGeometry}
 */
function softBox(w, h, d, radius) {
    const r = Math.min(radius, Math.min(w, h, d) * 0.45);
    return new RoundedBoxGeometry(w, h, d, 2, r);
}

/**
 * Visual archetypes for period vehicles.
 * Dimensions in meters. Car faces +X (hood/grille at +length/2).
 */
export const VEHICLE_ARCHETYPES = {
    sedan_30s: {
        length: 4.4,
        width: 1.7,
        height: 1.6,
        hoodRatio: 0.5,
        cabinLengthRatio: 0.36,
        chassisRatio: 0.55,
        cabinRecess: 0.12,
        cabinWidthRatio: 0.82,
        fendersSeparate: true,
        runningBoard: true,
        headlampStyle: 'round_exposed',
        grilleStyle: 'vertical_slats',
        spareWheel: 'rear',
        whitewallTires: true,
        wheelRadius: 0.34
    },
    coupe_30s: {
        length: 4.2,
        width: 1.65,
        height: 1.5,
        hoodRatio: 0.52,
        cabinLengthRatio: 0.30,
        chassisRatio: 0.55,
        cabinRecess: 0.14,
        cabinWidthRatio: 0.80,
        fendersSeparate: true,
        runningBoard: true,
        headlampStyle: 'round_exposed',
        grilleStyle: 'vertical_slats',
        spareWheel: 'side',
        whitewallTires: true,
        wheelRadius: 0.32
    },
    panel_van_30s: {
        length: 5.0,
        width: 1.9,
        height: 2.0,
        hoodRatio: 0.28,
        cabinLengthRatio: 0.62,
        chassisRatio: 0.45,
        cabinRecess: -0.02,
        cabinWidthRatio: 0.95,
        fendersSeparate: true,
        runningBoard: true,
        headlampStyle: 'round_exposed',
        grilleStyle: 'vertical_slats',
        spareWheel: null,
        whitewallTires: true,
        wheelRadius: 0.36
    }
};

const ARCHETYPE_KEYS = Object.keys(VEHICLE_ARCHETYPES);

/**
 * Stable archetype pick from entity id (same id → same silhouette).
 * @param {string|number} entityId
 * @returns {string}
 */
export function pickArchetypeKey(entityId) {
    const idNum = typeof entityId === 'string'
        ? parseInt(String(entityId).replace(/[^0-9]/g, ''), 10)
        : Number(entityId);
    if (Number.isNaN(idNum)) return ARCHETYPE_KEYS[0];
    return ARCHETYPE_KEYS[Math.abs(idNum) % ARCHETYPE_KEYS.length];
}

/**
 * @param {number} color - Body paint hex
 * @param {string} [archetypeKey] - Key in VEHICLE_ARCHETYPES
 * @returns {THREE.Group}
 */
export function createVehicleModel(color, archetypeKey) {
    const arch = VEHICLE_ARCHETYPES[archetypeKey] || VEHICLE_ARCHETYPES.sedan_30s;
    const group = new THREE.Group();

    const L = arch.length;
    const W = arch.width;
    const H = arch.height;
    const clearance = 0.12;
    const chassisH = H * arch.chassisRatio;
    const cabinH = H * (1 - arch.chassisRatio);
    const chassisY = clearance + chassisH / 2;

    const bodyMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.25
    });
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.35,
        metalness: 0.6
    });
    const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xc0c0c0,
        roughness: 0.25,
        metalness: 0.9
    });

    // --- Chassis (long low body) ---
    const chassis = new THREE.Mesh(
        softBox(L, chassisH, W * 0.88, 0.08),
        bodyMat
    );
    chassis.position.y = chassisY;
    group.add(chassis);

    // --- Cabin (small, recessed toward rear) ---
    const cabinLen = L * arch.cabinLengthRatio;
    const cabinW = W * arch.cabinWidthRatio;
    // Cabin sits behind the long hood: center shifted by recess toward -X
    const cabinCenterX = L * (0.5 - arch.hoodRatio - arch.cabinLengthRatio / 2) - L * arch.cabinRecess * 0.15;
    const cabin = new THREE.Mesh(
        softBox(cabinLen, cabinH, cabinW, 0.10),
        darkMat
    );
    cabin.position.set(cabinCenterX, clearance + chassisH + cabinH / 2, 0);
    group.add(cabin);

    // --- Separate rounded fenders ---
    if (arch.fendersSeparate) {
        const fenderR = arch.wheelRadius * 1.15;
        const fenderGeom = new THREE.CylinderGeometry(fenderR, fenderR, W * 0.22, 10, 1, false, 0, Math.PI);
        const axleX = L * 0.32;
        [[axleX, -1], [axleX, 1], [-axleX, -1], [-axleX, 1]].forEach(([x, side]) => {
            const fender = new THREE.Mesh(fenderGeom, bodyMat);
            fender.rotation.x = Math.PI / 2;
            fender.rotation.y = Math.PI / 2;
            fender.position.set(x, clearance + arch.wheelRadius * 0.55, side * (W * 0.48));
            group.add(fender);
        });
    }

    // --- Running boards ---
    if (arch.runningBoard) {
        const boardLen = L * 0.45;
        const boardGeom = softBox(boardLen, 0.06, 0.12, 0.02);
        [-1, 1].forEach(side => {
            const board = new THREE.Mesh(boardGeom, chromeMat);
            board.position.set(0, clearance + 0.08, side * (W * 0.52));
            group.add(board);
        });
    }

    // --- Vertical-slat grille ---
    if (arch.grilleStyle === 'vertical_slats') {
        const grilleW = W * 0.42;
        const grilleH = chassisH * 0.7;
        const grille = new THREE.Mesh(
            softBox(0.08, grilleH, grilleW, 0.02),
            chromeMat
        );
        grille.position.set(L / 2 + 0.02, chassisY, 0);
        group.add(grille);

        const slatCount = 5;
        const slatGeom = new THREE.BoxGeometry(0.04, grilleH * 0.9, 0.03);
        for (let i = 0; i < slatCount; i++) {
            const t = (i / (slatCount - 1)) - 0.5;
            const slat = new THREE.Mesh(slatGeom, darkMat);
            slat.position.set(L / 2 + 0.06, chassisY, t * grilleW * 0.75);
            group.add(slat);
        }
    }

    // --- Round exposed headlamps ---
    if (arch.headlampStyle === 'round_exposed') {
        const lampGeom = new THREE.SphereGeometry(0.12, 8, 8);
        const lampMat = new THREE.MeshStandardMaterial({
            color: 0xfff8e0,
            emissive: 0xffeeaa,
            emissiveIntensity: 0.85,
            roughness: 0.15,
            metalness: 0.3
        });
        [-1, 1].forEach(side => {
            const lamp = new THREE.Mesh(lampGeom, lampMat);
            lamp.position.set(L / 2 + 0.08, chassisY + chassisH * 0.05, side * W * 0.32);
            group.add(lamp);

            const housing = new THREE.Mesh(
                new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8),
                chromeMat
            );
            housing.rotation.z = Math.PI / 2;
            housing.position.set(L / 2 + 0.02, chassisY + chassisH * 0.05, side * W * 0.32);
            group.add(housing);
        });
    }

    // --- Taillights ---
    const tailMat = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        emissive: 0xff2200,
        emissiveIntensity: 0.7,
        roughness: 0.3
    });
    [-1, 1].forEach(side => {
        const tail = new THREE.Mesh(softBox(0.08, 0.1, 0.12, 0.02), tailMat);
        tail.position.set(-L / 2, chassisY, side * W * 0.35);
        group.add(tail);
    });

    // --- Spare wheel ---
    if (arch.spareWheel === 'rear') {
        addSpareWheel(group, -L / 2 - 0.05, chassisY + 0.1, 0, arch.wheelRadius, chromeMat);
    } else if (arch.spareWheel === 'side') {
        addSpareWheel(group, L * 0.05, chassisY + 0.15, W * 0.55, arch.wheelRadius, chromeMat);
    }

    // --- Wheels (whitewalls optional) ---
    const axleX = L * 0.32;
    const wheelZ = W * 0.48;
    [[axleX, -wheelZ], [axleX, wheelZ], [-axleX, -wheelZ], [-axleX, wheelZ]].forEach(([x, z]) => {
        addWheel(group, x, arch.wheelRadius, z, arch.whitewallTires);
    });

    addContactShadow(group, { width: L * 1.05, depth: W * 1.1, y: 0.01, opacity: 0.4 });

    return group;
}

function addSpareWheel(group, x, y, z, radius, chromeMat) {
    const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.14, 12),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    tire.rotation.z = Math.PI / 2;
    if (Math.abs(z) > 0.01) {
        tire.rotation.y = Math.PI / 2;
    }
    tire.position.set(x, y, z);
    group.add(tire);

    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.35, radius * 0.35, 0.16, 8),
        chromeMat
    );
    hub.rotation.copy(tire.rotation);
    hub.position.copy(tire.position);
    group.add(hub);
}

function addWheel(group, x, radius, z, whitewall) {
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92, metalness: 0 });
    const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.22, 12),
        tireMat
    );
    tire.rotation.x = Math.PI / 2;
    tire.position.set(x, radius, z);
    group.add(tire);

    if (whitewall) {
        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.24, 12),
            new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.7, metalness: 0 })
        );
        wall.rotation.x = Math.PI / 2;
        wall.position.set(x, radius, z);
        group.add(wall);
    }

    const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.26, 8),
        new THREE.MeshStandardMaterial({ color: 0xb0b0b0, roughness: 0.4, metalness: 0.7 })
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, radius, z);
    group.add(hub);
}
