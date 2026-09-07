/**
 * Synchronizes 2D logic entities with Three.js meshes.
 * Uses WorldMetrics scale (1u = 1m).
 */
import * as THREE from 'three';
import { World } from '../world/World.js';
import { Time } from '../core/Time.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { createNPCModel } from './NPCModelFactory.js';
import { createVehicleModel, pickArchetypeKey } from './VehicleModelFactory.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';

// Wet-street mirror ghost (T53): a squashed, translucent silhouette clone sitting
// below every character/vehicle, visible only on rain and only on asphalt (not
// sidewalk, where there's no puddle sheen to reflect in). Not SSR (closed
// decision, see meta/STATUS.md) — same static-silhouette trick as
// PuddleReflector's inverted lamp ghost, just applied to moving entities instead
// of a fixed lamp. Cloned once at mesh-creation time (pre-pose), so NPC limbs
// stay in their idle stance rather than tracking the live walk cycle — an
// acceptable trade at 0.25 opacity and -0.55 squash, where fine limb articulation
// doesn't read anyway.
const MIRROR_Y_SCALE = -0.55;
const MIRROR_OPACITY = 0.25;

/**
 * Builds a squashed, unlit silhouette clone of a freshly-created model group for
 * use as its wet-street reflection. One shared material across every cloned mesh
 * (it's a flat silhouette, not a lit surface) keeps the material count from
 * doubling on every rainy frame.
 * @param {THREE.Group} sourceGroup
 * @returns {THREE.Group}
 */
function createMirrorGhost(sourceGroup) {
    const mirror = sourceGroup.clone(true);
    const ghostMat = new THREE.MeshBasicMaterial({
        color: 0x0a0c10,
        transparent: true,
        opacity: MIRROR_OPACITY,
        depthWrite: false,
        fog: false
    });
    mirror.traverse(child => {
        if (!child.isMesh) return;
        if (child.name === 'contactShadow') {
            child.visible = false;
            return;
        }
        child.material = ghostMat;
        child.castShadow = false;
        child.receiveShadow = false;
    });
    mirror.scale.set(1, MIRROR_Y_SCALE, 1);
    mirror.renderOrder = 3;
    mirror.userData.isMirrorGhost = true;
    mirror.visible = false;
    return mirror;
}

export const RenderSync3D = {
    meshes: new Map(), // entityId -> THREE.Object3D
    targetMesh: null,  // Mission target golden circle

    reset(scene) {
        if (scene) {
            for (const [id, mesh] of this.meshes.entries()) {
                scene.remove(mesh);
                this.disposeHierarchy(mesh);
            }
            if (this.targetMesh) {
                scene.remove(this.targetMesh);
                this.disposeHierarchy(this.targetMesh);
                this.targetMesh = null;
            }
        }
        this.meshes.clear();
        this.targetMesh = null;
    },

    /**
     * Main sync step invoked each frame before rendering the 3D scene.
     * @param {THREE.Scene} scene - The active 3D Scene
     */
    update(scene) {
        if (!scene) return;

        const activeIds = new Set();
        const SF = WorldMetrics.SCALE_FACTOR;

        (World.entities || []).forEach(ent => {
            if (!ent.transform) return;
            activeIds.add(ent.id);

            let mesh = this.meshes.get(ent.id);
            if (!mesh) {
                mesh = this.createEntityMesh(ent);
                scene.add(mesh);
                this.meshes.set(ent.id, mesh);
            }

            // world2D.x → world3D.x, world2D.y → world3D.z
            mesh.position.x = ent.transform.x * SF;
            mesh.position.z = ent.transform.y * SF;

            let groundY = 0;
            if (World.tilemap) {
                const tileType = World.tilemap.getTileAt(ent.transform.x, ent.transform.y);
                if (tileType === 2 || tileType === 3) {
                    groundY = WorldMetrics.SIDEWALK_HEIGHT;
                }
            }

            // Pose comes from CharacterAnimationSystem; absent for non-characters
            // and for entities that have not been animated yet.
            const pose = ent.visual?.pose;
            mesh.position.y = groundY + (pose?.bounce || 0);
            this.applyPose(mesh, pose);

            if (mesh.userData.mirror) {
                // Reflections read as puddle sheen on the street — not on the
                // raised, dry sidewalk slab.
                mesh.userData.mirror.visible = groundY === 0 && TimeOfDaySettings.isRaining();
            }

            // 2D angle → 3D yaw (Y)
            mesh.rotation.y = -ent.transform.angle;

            if (ent.visible === false) {
                mesh.visible = false;
            } else {
                mesh.visible = true;
            }
        });

        for (const [id, mesh] of this.meshes.entries()) {
            if (!activeIds.has(id)) {
                scene.remove(mesh);
                this.disposeHierarchy(mesh);
                this.meshes.delete(id);
            }
        }

        if (World.missionMarker) {
            const loc = World.missionMarker;
            if (!this.targetMesh) {
                const geom = new THREE.TorusGeometry((loc.radius || 40) * SF, 0.4, 8, 24);
                const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, side: THREE.DoubleSide });
                this.targetMesh = new THREE.Mesh(geom, mat);
                this.targetMesh.rotation.x = Math.PI / 2;
                scene.add(this.targetMesh);
            }
            this.targetMesh.position.x = loc.x * SF;
            this.targetMesh.position.z = loc.y * SF;
            this.targetMesh.position.y = 1.0 + Math.sin(Time.time * 5) * 0.3;
            this.targetMesh.rotation.z = Time.time;
        } else if (this.targetMesh) {
            scene.remove(this.targetMesh);
            this.disposeHierarchy(this.targetMesh);
            this.targetMesh = null;
        }
    },

    /**
     * Copies pose angles onto the character rig. Pure data → transforms; all
     * cycle math lives in CharacterAnimationSystem.
     * @param {THREE.Object3D} mesh - Model root (may be a non-character).
     * @param {object} [pose] - `visual.pose` produced by CharacterAnimationSystem.
     */
    applyPose(mesh, pose) {
        const rig = mesh.userData?.rig;
        if (!rig || !pose) return;

        rig.legL.rotation.z = pose.legL;
        rig.legR.rotation.z = pose.legR;
        rig.armL.rotation.z = pose.armL;
        rig.armR.rotation.z = pose.armR;
        rig.torso.rotation.z = pose.lean;
        rig.head.rotation.z = pose.head;
    },

    /**
     * Instantiates a 3D visual representation for a given entity based on type
     */
    createEntityMesh(ent) {
        let group = new THREE.Group();

        if (ent.type === 'player') {
            // Same NPC body/head layout; navy accent for the player
            group = createNPCModel(0x1a2744);

        } else if (ent.type === 'npc') {
            group = createNPCModel(ent.visual?.color);

        } else if (ent.type === 'car') {
            const color = ent.visual?.color ? parseInt(ent.visual.color.replace('#', '0x')) : 0x1a1a1a;
            const archetypeKey = ent.archetype || pickArchetypeKey(ent.id);
            group = createVehicleModel(color, archetypeKey);
        }

        group.traverse(child => {
            if (child.isMesh && child.name !== 'contactShadow') {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        if (ent.type === 'player' || ent.type === 'npc' || ent.type === 'car') {
            const mirror = createMirrorGhost(group);
            group.add(mirror);
            group.userData.mirror = mirror;
        }

        return group;
    },

    /**
     * Safely disposes geometry and materials to prevent WebGL memory leaks.
     * Geometry flagged `userData.shared` is owned by its factory's cache and is
     * still in use by every other instance — despawning one must not free it.
     */
    disposeHierarchy(obj) {
        if (!obj || !obj.traverse) return;
        obj.traverse(child => {
            if (child.geometry && !child.geometry.userData?.shared) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
};
