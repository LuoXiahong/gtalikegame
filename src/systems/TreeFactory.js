/**
 * TreeFactory — low-poly sidewalk trees and shrubs.
 */
import * as THREE from 'three';
import { WorldMetrics } from '../world/WorldMetrics.js';

/** Canonical plant archetypes. */
export const TREE_TYPES = [
    'oak',
    'pine',
    'round',
    'birch',
    'bush',
    'hedge',
    'tallBush'
];

/** Legacy aliases used by older call sites / screenshots. */
export const TREE_TYPE_ALIASES = {
    tree: 'oak',
    shrub: 'bush'
};

/** Muted canopy greens (reads under night/noir grading). */
const LEAF_PALETTE = [
    0x2d5a27,
    0x1e4a32,
    0x3a5c3a,
    0x245038,
    0x2f4f2f,
    0x1a3d2a
];

const TRUNK_OAK = 0x5c4033;
const TRUNK_BIRCH = 0xc8c0b0;
const TRUNK_PINE = 0x4a3728;

/**
 * Every plant shape/color combo repeats ~100+ times across the city with
 * identical parameters — share geometry/material instances instead of
 * allocating a fresh GPU buffer + material per tree.
 */
const _geomCache = new Map();
function sharedGeom(key, factory) {
    let g = _geomCache.get(key);
    if (!g) {
        g = factory();
        _geomCache.set(key, g);
    }
    return g;
}

const _matCache = new Map();
function sharedLeafMat(color) {
    const key = `leaf-${color}`;
    let m = _matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.0, flatShading: true });
        _matCache.set(key, m);
    }
    return m;
}

/**
 * Stable uint hash for deterministic variant picks.
 * @param {number} a
 * @param {number} b
 * @param {number} c
 */
export function plantHash(a, b, c = 0) {
    return ((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0);
}

/**
 * @param {string} type
 * @returns {string}
 */
export function resolveTreeType(type) {
    return TREE_TYPE_ALIASES[type] || type;
}

/**
 * @param {string} type
 * @param {number} [x]
 * @param {number} [z]
 * @param {number} [variantSeed]
 * @returns {THREE.Group}
 */
export function createTree(type, x = 0, z = 0, variantSeed = 0) {
    const resolved = resolveTreeType(type);
    const group = new THREE.Group();
    group.userData.treeType = resolved;
    group.position.set(x, WorldMetrics.SIDEWALK_HEIGHT, z);

    const leafColor = LEAF_PALETTE[plantHash(Math.round(x * 10), Math.round(z * 10), variantSeed) % LEAF_PALETTE.length];
    const leafMat = sharedLeafMat(leafColor);

    switch (resolved) {
        case 'pine':
            addPine(group, leafMat);
            break;
        case 'round':
            addRound(group, leafMat);
            break;
        case 'birch':
            addBirch(group, leafMat);
            break;
        case 'bush':
            addBush(group, leafMat);
            break;
        case 'hedge':
            addHedge(group, leafMat);
            break;
        case 'tallBush':
            addTallBush(group, leafMat);
            break;
        case 'oak':
        default:
            addOak(group, leafMat);
            group.userData.treeType = 'oak';
            break;
    }

    return group;
}

function trunkMat(color) {
    const key = `trunk-${color}`;
    let m = _matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.0 });
        _matCache.set(key, m);
    }
    return m;
}

function addMesh(group, geom, mat, y, cast = true) {
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = y;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
}

function addOak(group, leafMat) {
    addMesh(group, sharedGeom('oak-trunk', () => new THREE.CylinderGeometry(0.2, 0.24, 1.6, 6)), trunkMat(TRUNK_OAK), 0.8);
    addMesh(group, sharedGeom('oak-leaf-lo', () => new THREE.SphereGeometry(1.4, 8, 8)), leafMat, 2.0);
    addMesh(group, sharedGeom('oak-leaf-hi', () => new THREE.SphereGeometry(1.0, 8, 8)), leafMat, 2.85);
}

function addPine(group, leafMat) {
    addMesh(group, sharedGeom('pine-trunk', () => new THREE.CylinderGeometry(0.14, 0.2, 1.9, 6)), trunkMat(TRUNK_PINE), 0.95);
    addMesh(group, sharedGeom('pine-tier-1', () => new THREE.ConeGeometry(1.15, 1.5, 7)), leafMat, 1.85);
    addMesh(group, sharedGeom('pine-tier-2', () => new THREE.ConeGeometry(0.9, 1.2, 7)), leafMat, 2.75);
    addMesh(group, sharedGeom('pine-tier-3', () => new THREE.ConeGeometry(0.55, 0.9, 7)), leafMat, 3.45);
}

function addRound(group, leafMat) {
    addMesh(group, sharedGeom('round-trunk', () => new THREE.CylinderGeometry(0.18, 0.22, 1.2, 6)), trunkMat(TRUNK_OAK), 0.6);
    addMesh(group, sharedGeom('round-leaf', () => new THREE.SphereGeometry(1.35, 8, 8)), leafMat, 1.85);
}

function addBirch(group, leafMat) {
    addMesh(group, sharedGeom('birch-trunk', () => new THREE.CylinderGeometry(0.1, 0.14, 2.2, 6)), trunkMat(TRUNK_BIRCH), 1.1);
    addMesh(group, sharedGeom('birch-leaf-lo', () => new THREE.SphereGeometry(0.85, 7, 7)), leafMat, 2.35);
    addMesh(group, sharedGeom('birch-leaf-hi', () => new THREE.SphereGeometry(0.7, 7, 7)), leafMat, 2.95);
}

function addBush(group, leafMat) {
    addMesh(group, sharedGeom('bush-trunk', () => new THREE.CylinderGeometry(0.12, 0.14, 0.45, 5)), trunkMat(TRUNK_OAK), 0.22);
    addMesh(group, sharedGeom('bush-leaf', () => new THREE.SphereGeometry(0.75, 6, 6)), leafMat, 0.75);
}

function addHedge(group, leafMat) {
    addMesh(group, sharedGeom('hedge-box', () => new THREE.BoxGeometry(1.6, 0.85, 0.55)), leafMat, 0.45);
    const leafBall = sharedGeom('hedge-leaf', () => new THREE.SphereGeometry(0.4, 5, 5));
    const left = addMesh(group, leafBall, leafMat, 0.5);
    left.position.x = -0.7;
    const right = addMesh(group, leafBall, leafMat, 0.5);
    right.position.x = 0.7;
}

function addTallBush(group, leafMat) {
    addMesh(group, sharedGeom('tallbush-trunk', () => new THREE.CylinderGeometry(0.12, 0.16, 0.7, 5)), trunkMat(TRUNK_OAK), 0.35);
    addMesh(group, sharedGeom('tallbush-leaf-lo', () => new THREE.SphereGeometry(0.7, 6, 6)), leafMat, 0.95);
    addMesh(group, sharedGeom('tallbush-leaf-hi', () => new THREE.SphereGeometry(0.55, 6, 6)), leafMat, 1.45);
}

/**
 * @param {string} type
 * @param {number} x
 * @param {number} z
 * @param {number} [rotationY]
 * @param {number} [variantSeed]
 * @returns {THREE.Group}
 */
export function createTreeAt(type, x, z, rotationY = 0, variantSeed = 0) {
    const group = createTree(type, x, z, variantSeed);
    group.rotation.y = rotationY;
    return group;
}
