import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { bakeStaticInstances, MIN_INSTANCES } from './StaticInstancer.js';

function makeGroup(geom, mat, x) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    group.add(mesh);
    group.position.x = x;
    return group;
}

/** Enough groups to clear the batching threshold. */
function makeGroups(geom, mat, count, offset = 0) {
    return Array.from({ length: count }, (_, i) => makeGroup(geom, mat, offset + i));
}

describe('StaticInstancer', () => {
    it('collapses groups sharing geometry+material into one InstancedMesh', () => {
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial();
        const groups = makeGroups(geom, mat, MIN_INSTANCES);
        groups.forEach(g => scene.add(g));

        const instanced = bakeStaticInstances(scene, groups);

        expect(instanced.length).toBe(1);
        expect(instanced[0].count).toBe(MIN_INSTANCES);
        // Emptied shells are dropped so the renderer stops walking them.
        groups.forEach(g => expect(g.parent).toBe(null));
        expect(scene.children).toContain(instanced[0]);
    });

    it('leaves batches below the threshold alone', () => {
        // An InstancedMesh is still one draw call, so batching a handful of
        // meshes saves almost nothing while giving up their frustum culling.
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial();
        const groups = makeGroups(geom, mat, MIN_INSTANCES - 1);
        groups.forEach(g => scene.add(g));

        const instanced = bakeStaticInstances(scene, groups);

        expect(instanced).toEqual([]);
        groups.forEach(g => {
            expect(g.parent).toBe(scene);
            expect(g.children.length).toBe(1);
        });
    });

    it('keeps distinct geometry/material pairs in separate batches', () => {
        const scene = new THREE.Scene();
        const geomA = new THREE.BoxGeometry(1, 1, 1);
        const geomB = new THREE.SphereGeometry(1, 6, 6);
        const mat = new THREE.MeshBasicMaterial();
        const other = new THREE.MeshBasicMaterial();

        const groups = [
            ...makeGroups(geomA, mat, MIN_INSTANCES, 0),
            ...makeGroups(geomB, mat, MIN_INSTANCES, 100),
            ...makeGroups(geomA, other, MIN_INSTANCES, 200)
        ];
        groups.forEach(g => scene.add(g));

        const instanced = bakeStaticInstances(scene, groups);

        expect(instanced.length).toBe(3);
        expect(instanced.reduce((n, m) => n + m.count, 0)).toBe(MIN_INSTANCES * 3);
    });

    it('preserves each source mesh world matrix', () => {
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial();
        const xs = [3, 7, 11, 15];
        const groups = xs.map(x => makeGroup(geom, mat, x));
        groups.forEach(g => scene.add(g));

        const [batch] = bakeStaticInstances(scene, groups);

        const seen = [];
        const m = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        for (let i = 0; i < batch.count; i++) {
            batch.getMatrixAt(i, m);
            pos.setFromMatrixPosition(m);
            seen.push(pos.x);
        }
        expect(seen.sort((a, b) => a - b)).toEqual(xs);
    });

    it('carries shadow flags over so batches still cast', () => {
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial();
        const groups = makeGroups(geom, mat, MIN_INSTANCES);
        groups.forEach(g => scene.add(g));

        const [batch] = bakeStaticInstances(scene, groups);
        expect(batch.castShadow).toBe(true);
    });

    it('marks batch geometry shared so a dispose cannot free it for others', () => {
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial();
        const groups = makeGroups(geom, mat, MIN_INSTANCES);
        groups.forEach(g => scene.add(g));

        const [batch] = bakeStaticInstances(scene, groups);
        expect(batch.geometry.userData.shared).toBe(true);
    });

    it('keeps non-instanceable siblings when a group is only partly absorbed', () => {
        // A building body uses a per-face material array and cannot be instanced,
        // while its roof clutter can. Dropping the whole group on the first match
        // would delete every wall in the city.
        const scene = new THREE.Scene();
        const geom = new THREE.BoxGeometry(1, 1, 1);
        const shared = new THREE.MeshBasicMaterial();

        const groups = [];
        const bodies = [];
        for (let i = 0; i < MIN_INSTANCES; i++) {
            const group = new THREE.Group();
            const body = new THREE.Mesh(geom, [shared, shared, shared, shared, shared, shared]);
            const clutter = new THREE.Mesh(geom, shared);
            group.add(body, clutter);
            group.position.x = i;
            scene.add(group);
            groups.push(group);
            bodies.push(body);
        }

        const instanced = bakeStaticInstances(scene, groups);

        expect(instanced.length).toBe(1);
        expect(instanced[0].count).toBe(MIN_INSTANCES);
        // Bodies survive, still parented and still in the scene.
        bodies.forEach((body, i) => {
            expect(body.parent).toBe(groups[i]);
            expect(groups[i].parent).toBe(scene);
        });
    });

    it('is a no-op on empty input', () => {
        const scene = new THREE.Scene();
        expect(bakeStaticInstances(scene, [])).toEqual([]);
        expect(bakeStaticInstances(null, [new THREE.Group()])).toEqual([]);
    });
});
