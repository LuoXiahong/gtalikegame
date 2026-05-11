/**
 * SYSTEM SYNCHRONIZACJI RENDEROWANIA (RenderSync3D)
 * Odpowiada za synchronizację encji z logiki 2D do ich reprezentacji 3D w scenie Three.js.
 */
import * as THREE from 'three';
import { World } from '../world/World.js';
import { MissionSystem } from './MissionSystem.js';

export const RenderSync3D = {
    meshes: new Map(), // entityId -> THREE.Object3D
    targetMesh: null,  // Złoty okrąg celu misji

    /**
     * Główny krok synchronizacji wywoływany w każdej klatce przed renderowaniem 3D
     * @param {THREE.Scene} scene - Scena 3D z RenderSystem3D
     */
    update(scene) {
        if (!scene) return;

        const activeIds = new Set();

        // 1. Synchronizacja wszystkich encji z logiki gry
        (World.entities || []).forEach(ent => {
            if (!ent.transform) return;
            activeIds.add(ent.id);

            let mesh = this.meshes.get(ent.id);
            if (!mesh) {
                mesh = this.createEntityMesh(ent);
                scene.add(mesh);
                this.meshes.set(ent.id, mesh);
            }

            // Mapowanie pozycji: world2D.x -> world3D.x, world2D.y -> world3D.z
            mesh.position.x = ent.transform.x;
            mesh.position.z = ent.transform.y;

            // Obliczanie wysokości podłoża (chodnik vs ulica)
            let groundY = 0;
            if (World.tilemap) {
                const tileType = World.tilemap.getTileAt(ent.transform.x, ent.transform.y);
                if (tileType === 2 || tileType === 3) {
                    groundY = 5.0; // Przesunięcie 5u w górę dla obiektów stojących na krawężniku/chodniku
                }
            }
            mesh.position.y = groundY;

            // Mapowanie rotacji: rotacja 2D (zgodnie z ruchem wskazówek) -> rotacja 3D wokół osi Y (przeciwnie)
            mesh.rotation.y = -ent.transform.angle;

            // Opcjonalne ukrywanie encji (np. gdy gracz siedzi w aucie)
            if (ent.visible === false) {
                mesh.visible = false;
            } else {
                mesh.visible = true;
            }
        });

        // 2. Despawn i zwalnianie pamięci usuniętych encji
        for (const [id, mesh] of this.meshes.entries()) {
            if (!activeIds.has(id)) {
                scene.remove(mesh);
                this.disposeHierarchy(mesh);
                this.meshes.delete(id);
            }
        }

        // 3. Synchronizacja wskaźnika celu misji (Target Zone)
        if (MissionSystem && MissionSystem.targetLocation) {
            const loc = MissionSystem.targetLocation;
            if (!this.targetMesh) {
                const geom = new THREE.TorusGeometry(loc.radius || 40, 4, 8, 24);
                const mat = new THREE.MeshBasicMaterial({ color: 0xf1c40f, side: THREE.DoubleSide });
                this.targetMesh = new THREE.Mesh(geom, mat);
                this.targetMesh.rotation.x = Math.PI / 2; // Poziomo
                scene.add(this.targetMesh);
            }
            this.targetMesh.position.x = loc.x;
            this.targetMesh.position.z = loc.y;
            this.targetMesh.position.y = 10 + Math.sin(Date.now() * 0.005) * 3;
            this.targetMesh.rotation.z = Date.now() * 0.001; // Powolna rotacja
        } else if (this.targetMesh) {
            scene.remove(this.targetMesh);
            this.disposeHierarchy(this.targetMesh);
            this.targetMesh = null;
        }
    },

    /**
     * Tworzy odpowiedni model 3D dla danej encji na podstawie jej typu
     */
    createEntityMesh(ent) {
        const group = new THREE.Group();

        if (ent.type === 'player') {
            // Korpus (niebieski kubik)
            const bodyGeom = new THREE.BoxGeometry(16, 26, 10);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.7, metalness: 0.1 });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = 13; // Pivot na spodzie
            group.add(body);

            // Głowa
            const headGeom = new THREE.SphereGeometry(6, 8, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8, metalness: 0.0 });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.y = 29;
            group.add(head);

        } else if (ent.type === 'npc') {
            // NPC: Unikalny kolor ubrania
            const color = ent.visual?.color ? parseInt(ent.visual.color.replace('#', '0x')) : 0x8e44ad;
            const bodyGeom = new THREE.BoxGeometry(10, 20, 8);
            const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7, metalness: 0.1 });
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = 10;
            group.add(body);

            // Głowa
            const headGeom = new THREE.SphereGeometry(4, 8, 8);
            const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8, metalness: 0.0 });
            const head = new THREE.Mesh(headGeom, headMat);
            head.position.y = 22;
            group.add(head);

        } else if (ent.type === 'car') {
            // Samochód
            const color = ent.visual?.color ? parseInt(ent.visual.color.replace('#', '0x')) : 0xc0392b;
            const w = ent.transform.width || 40;
            const h = ent.transform.height || 80;

            // Dolne podwozie
            const lowerGeom = new THREE.BoxGeometry(w, 12, h);
            const lowerMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.3 });
            const lower = new THREE.Mesh(lowerGeom, lowerMat);
            lower.position.y = 10;
            group.add(lower);

            // Kabina
            const upperGeom = new THREE.BoxGeometry(w * 0.8, 8, h * 0.5);
            const upperMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.3, metalness: 0.5 });
            const upper = new THREE.Mesh(upperGeom, upperMat);
            upper.position.set(0, 20, -h * 0.1);
            group.add(upper);

            // Koła
            const wheelGeom = new THREE.BoxGeometry(8, 8, 12);
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 });
            
            const offsets = [
                { x: -w/2, z: -h/3 },
                { x: w/2, z: -h/3 },
                { x: -w/2, z: h/3 },
                { x: w/2, z: h/3 }
            ];

            offsets.forEach(offset => {
                const wheel = new THREE.Mesh(wheelGeom, wheelMat);
                wheel.position.set(offset.x, 4, offset.z);
                group.add(wheel);
            });
        }

        // Automatyczne włączenie cieni rzucanych i przyjmowanych dla wszystkich części modelu (T-701)
        group.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return group;
    },

    /**
     * Bezpieczne usuwanie geometrii i materiałów dla uniknięcia wycieków pamięci
     */
    disposeHierarchy(obj) {
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
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
