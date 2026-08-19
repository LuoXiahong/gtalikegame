/**
 * StaticInstancer — collapse many static Groups into a few InstancedMeshes.
 *
 * Props and trees already share geometry and material instances, but sharing
 * does not reduce draw calls: every Mesh is still submitted separately. With 72
 * lamp posts, ~140 trees and assorted street furniture that came to ~810 draws
 * per frame out of ~1550, against only ~70k triangles total — the scene was
 * bound by submission count, not by geometry.
 *
 * Baking groups that never move into one InstancedMesh per (geometry, material)
 * pair turns each of those hundreds of draws into a handful, with no visual
 * change. Only ever use this for objects that are static for the lifetime of
 * the scene: instances keep their baked world matrix.
 */
import * as THREE from 'three';

/**
 * Below this many instances, batching is a net loss: an InstancedMesh still
 * costs one draw call, so collapsing three meshes saves two draws while giving
 * up their individual frustum culling. Building roof clutter is the motivating
 * case — each unit generates its own randomly sized geometry, so it bucketed
 * one-per-batch and adding it to the bake raised the draw count instead of
 * lowering it.
 */
export const MIN_INSTANCES = 4;

/**
 * @param {THREE.Object3D} obj
 * @returns {string} identity of the (geometry, material) pair to bucket by
 */
function bucketKey(obj) {
    const matKey = Array.isArray(obj.material)
        ? obj.material.map(m => m.uuid).join(',')
        : obj.material.uuid;
    return `${obj.geometry.uuid}|${matKey}`;
}

/**
 * Bake the meshes of `groups` into InstancedMeshes added to `scene`, and detach
 * the original groups.
 *
 * Meshes that cannot be instanced safely (multi-material, or already instanced)
 * are left in place so nothing silently disappears.
 * @param {THREE.Scene} scene
 * @param {THREE.Object3D[]} groups
 * @returns {THREE.InstancedMesh[]}
 */
export function bakeStaticInstances(scene, groups) {
    if (!scene || !groups || groups.length === 0) return [];

    /** @type {Map<string, { geometry: THREE.BufferGeometry, material: any, matrices: THREE.Matrix4[], castShadow: boolean, receiveShadow: boolean }>} */
    const buckets = new Map();

    // Pass 1 — bucket every candidate, keeping the source mesh so a bucket that
    // turns out too small can simply be left alone.
    for (const group of groups) {
        if (!group) continue;
        group.updateMatrixWorld(true);

        group.traverse(obj => {
            if (!obj.isMesh || obj.isInstancedMesh) return;
            if (!obj.geometry || !obj.material || Array.isArray(obj.material)) return;

            const key = bucketKey(obj);
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = {
                    geometry: obj.geometry,
                    material: obj.material,
                    sources: [],
                    castShadow: obj.castShadow,
                    receiveShadow: obj.receiveShadow
                };
                buckets.set(key, bucket);
            }
            // Shadow flags are a property of the batch, so a batch casts if any
            // member did — losing a shadow is more visible than an extra one.
            bucket.castShadow = bucket.castShadow || obj.castShadow;
            bucket.receiveShadow = bucket.receiveShadow || obj.receiveShadow;
            bucket.sources.push(obj);
        });
    }

    // Pass 2 — materialise only the buckets that actually pay for themselves,
    // and detach just those meshes. Groups may legitimately mix instanceable
    // parts with ones that are not (a building's body uses a per-face material
    // array and is skipped), so survivors stay parented where they are.
    const instanced = [];
    for (const bucket of buckets.values()) {
        if (bucket.sources.length < MIN_INSTANCES) continue;

        const mesh = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.sources.length);
        for (let i = 0; i < bucket.sources.length; i++) {
            mesh.setMatrixAt(i, bucket.sources[i].matrixWorld);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = bucket.castShadow;
        mesh.receiveShadow = bucket.receiveShadow;

        for (const source of bucket.sources) {
            if (source.parent) source.parent.remove(source);
        }
        // Geometry is shared with the pooled originals; disposing one instanced
        // batch must not free buffers another batch still points at.
        mesh.geometry.userData = mesh.geometry.userData || {};
        mesh.geometry.userData.shared = true;
        mesh.userData.isStaticInstance = true;
        scene.add(mesh);
        instanced.push(mesh);
    }

    // Groups fully absorbed into batches are now empty shells. They cost no draw
    // call, but the renderer still walks them every frame — drop them.
    for (const group of groups) {
        if (group && group.children.length === 0 && group.parent) {
            group.parent.remove(group);
        }
    }

    return instanced;
}
