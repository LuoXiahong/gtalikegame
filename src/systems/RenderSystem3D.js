/**
 * SYSTEM RENDERINGU 3D (RenderSystem3D)
 * Odpowiedzialny za wyświetlanie świata gry w trójwymiarze przy użyciu Three.js.
 * 
 * KONWENCJA MAPOWANIA WSPÓŁRZĘDNYCH:
 * world2D.x → world3D.x
 * world2D.y → world3D.z (oś głębokości)
 * Oś world3D.y odpowiada wysokości w pionie.
 */
import * as THREE from 'three';
import { World } from '../world/World.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { RenderSync3D } from './RenderSync3D.js';

export const RenderSystem3D = {
    renderer: null,
    scene: null,
    camera: null,
    
    // Elementy środowiska 3D
    groundPlane: null,
    asphaltPlane: null,
    sidewalks: [],
    buildingZones: [],
    buildings: [],
    trees: [],
    billboards: [],
    laneMarkings: [],
    zebras: [],
    
    // Sześcian walidacji ruchu i skali
    box5u: null,
    
    // Punkt początkowy odniesienia (gracz zaczyna na skrzyżowaniu x:1100, y:1100)
    originX: 1100,
    originZ: 1100,

    init() {
        const canvas = document.getElementById('gameCanvas3D');
        if (!canvas) {
            console.error('Nie znaleziono elementu #gameCanvas3D!');
            return;
        }

        const parent = canvas.parentElement;
        const width = parent.clientWidth || 800;
        const height = parent.clientHeight || 600;

        // 1. Inicjalizacja WebGLRenderer (renderowanie czarnej sceny na start)
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(width, height, false);
        this.renderer.setClearColor(0x000000, 1.0);

        // 2. Inicjalizacja Sceny
        this.scene = new THREE.Scene();

        // 3. Konfiguracja OrthographicCamera (Brak perspektywy)
        const aspect = width / height;
        const viewSize = 600; // Zasięg widzenia izometrycznego
        
        this.camera = new THREE.OrthographicCamera(
            -viewSize * aspect / 2, // left
            viewSize * aspect / 2,  // right
            viewSize / 2,           // top
            -viewSize / 2,          // bottom
            -2000,                  // near
            10000                   // far
        );

        this.camera.zoom = 1.0;
        this.camera.updateProjectionMatrix();

        // 4. Obsługa zdarzenia zmiany rozmiaru okna (resize)
        window.addEventListener('resize', () => {
            const w = parent.clientWidth || 800;
            const h = parent.clientHeight || 600;
            
            this.renderer.setSize(w, h, false);
            
            const newAspect = w / h;
            this.camera.left = -viewSize * newAspect / 2;
            this.camera.right = viewSize * newAspect / 2;
            this.camera.top = viewSize / 2;
            this.camera.bottom = -viewSize / 2;
            this.camera.updateProjectionMatrix();
        });

        // 5. Budowa makiety środowiska na bazie WorldGrid
        
        // A. Podłoże trawy (cały świat 3000x3000px)
        const groundGeom = new THREE.PlaneGeometry(3000, 3000);
        const groundMat = new THREE.MeshBasicMaterial({ color: 0x27ae60 }); // Zielona trawa
        this.groundPlane = new THREE.Mesh(groundGeom, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.position.set(1500, -0.05, 1500);
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);

        // B. Podłoże asfaltowe (miejski obszar wewnątrz paddingu, kolor ciemnoszary #222)
        const asphaltSize = 3000 - 2 * WorldGrid.PADDING;
        const asphaltGeom = new THREE.PlaneGeometry(asphaltSize, asphaltSize);
        const asphaltMat = new THREE.MeshBasicMaterial({ color: 0x222222 }); // Ciemny asfalt drogowy
        this.asphaltPlane = new THREE.Mesh(asphaltGeom, asphaltMat);
        this.asphaltPlane.rotation.x = -Math.PI / 2;
        this.asphaltPlane.position.set(1500, -0.01, 1500);
        this.asphaltPlane.receiveShadow = true;
        this.scene.add(this.asphaltPlane);

        // C. Budowa 9 bloków (podniesiony chodnik na 0.05u + wyższa strefa zabudowy na 0.07u)
        this.sidewalks = [];
        this.buildingZones = [];
        this.buildings = []; // Lista budynków 3D
        const shops = []; // Kolekcja sklepów do celów generowania billboardów
        
        const sidewalkMat = new THREE.MeshBasicMaterial({ color: 0x95a5a6 }); // Jaśniejszy beton chodnikowy (#95a5a6)
        const buildingZoneMat = new THREE.MeshBasicMaterial({ color: 0x7f8c8d }); // Ciemniejszy beton strefy budynków (#7f8c8d)
        
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = b.x + b.w / 2;
                const posZ = b.y + b.h / 2;
                
                // 1. Podstawa chodnika (500x500x0.05)
                const swGeom = new THREE.BoxGeometry(b.w, 0.05, b.h);
                const swMesh = new THREE.Mesh(swGeom, sidewalkMat);
                swMesh.position.set(posX, 0.025, posZ);
                swMesh.receiveShadow = true;
                this.scene.add(swMesh);
                this.sidewalks.push(swMesh);
                
                // 2. Podniesiona strefa budynku (300x300x0.02, wysokość sumaryczna 0.07)
                const bzGeom = new THREE.BoxGeometry(300, 0.02, 300);
                const bzMesh = new THREE.Mesh(bzGeom, buildingZoneMat);
                bzMesh.position.set(posX, 0.06, posZ);
                bzMesh.receiveShadow = true;
                this.scene.add(bzMesh);
                this.buildingZones.push(bzMesh);

                // 3. Generowanie proceduralnych budynków na platformie (strefie)
                const pattern = (r + c) % 3;
                if (pattern === 0) {
                    // Wieżowiec na środku + 2 małe sklepy po przekątnej
                    this.createBuilding('skyscraper', posX, posZ, 380, 120, 120);
                    const s1 = this.createBuilding('shop', posX - 80, posZ - 80, 50, 80, 80);
                    const s2 = this.createBuilding('shop', posX + 80, posZ + 80, 50, 80, 80);
                    shops.push({ group: s1, w: 80, d: 80, h: 50 });
                    shops.push({ group: s2, w: 80, d: 80, h: 50 });
                } else if (pattern === 1) {
                    // Dwa bloki mieszkalne ułożone obok siebie
                    this.createBuilding('residential', posX - 60, posZ, 180, 120, 200);
                    this.createBuilding('residential', posX + 60, posZ + 50, 140, 100, 100);
                } else {
                    // Jeden blok mieszkalny + 2 sklepy
                    this.createBuilding('residential', posX, posZ - 50, 200, 180, 120);
                    const s1 = this.createBuilding('shop', posX - 80, posZ + 80, 60, 80, 80);
                    const s2 = this.createBuilding('shop', posX + 80, posZ + 80, 45, 80, 80);
                    shops.push({ group: s1, w: 80, d: 80, h: 60 });
                    shops.push({ group: s2, w: 80, d: 80, h: 45 });
                }
            }
        }

        // D. Generowanie linii przerywanych (Lane Markings) na środkach jezdni
        this.laneMarkings = [];
        const roads = WorldGrid.getStreetCenters(); // [1100, 1800]
        
        // Pionowe linie jezdni (dzielone przez skrzyżowania)
        roads.forEach(rx => {
            this.createDashedLine(rx, 500, rx, 1000, true);
            this.createDashedLine(rx, 1200, rx, 1700, true);
            this.createDashedLine(rx, 1900, rx, 2400, true);
        });
        
        // Poziome linie jezdni (dzielone przez skrzyżowania)
        roads.forEach(rz => {
            this.createDashedLine(500, rz, 1000, rz, false);
            this.createDashedLine(1200, rz, 1700, rz, false);
            this.createDashedLine(1900, rz, 2400, rz, false);
        });

        // E. Generowanie przejść dla pieszych (Zebras) na wlotach skrzyżowań
        this.zebras = [];
        roads.forEach(cx => {
            roads.forEach(cz => {
                // Cztery zebry wokół każdego skrzyżowania (Północ, Południe, Zachód, Wschód)
                this.createZebra(cx, cz - 110, true);  // Północ (droga pionowa)
                this.createZebra(cx, cz + 110, true);  // Południe (droga pionowa)
                this.createZebra(cx - 110, cz, false); // Zachód (droga pozioma)
                this.createZebra(cx + 110, cz, false); // Wschód (droga pozioma)
            });
        });

        // F. Generowanie drzew na chodnikach wokół bloków (dokładnie 18-25 sztuk)
        this.trees = [];
        const treePositions = [];
        const treeOffsets = [
            { x: -200, z: -200 }, { x: 200, z: -200 },
            { x: -200, z: 200 },  { x: 200, z: 200 },
            { x: -200, z: 0 },    { x: 200, z: 0 },
            { x: 0, z: -200 },    { x: 0, z: 200 }
        ];

        // Zbieramy wszystkie potencjalne wolne pozycje na chodnikach
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = b.x + b.w / 2;
                const posZ = b.y + b.h / 2;

                treeOffsets.forEach(offset => {
                    treePositions.push({
                        x: posX + offset.x,
                        z: posZ + offset.z
                    });
                });
            }
        }

        // Tasujemy pozycje i wybieramy losowo stałą liczbę drzew
        treePositions.sort(() => Math.random() - 0.5);
        const totalTreesCount = Math.floor(Math.random() * 8) + 18; // Od 18 do 25 drzew
        for (let i = 0; i < Math.min(totalTreesCount, treePositions.length); i++) {
            const pos = treePositions[i];
            const sizeType = Math.random() < 0.3 ? 'shrub' : 'tree';
            this.createTree(sizeType, pos.x, pos.z);
        }

        // G. Generowanie billboardów na dachach sklepów (dokładnie 2 sztuki w całym mieście)
        this.billboards = [];
        if (shops.length >= 2) {
            shops.sort(() => Math.random() - 0.5);
            this.addBillboard(shops[0].group, shops[0].w, shops[0].d, shops[0].h);
            this.addBillboard(shops[1].group, shops[1].w, shops[1].d, shops[1].h);
        }

        // 6. Testowy sześcian (15u x 15u x 15u) do walidacji ruchu i osi (kolor czerwony)
        const geom5u = new THREE.BoxGeometry(15, 15, 15);
        const mat5u = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
        this.box5u = new THREE.Mesh(geom5u, mat5u);
        this.box5u.position.set(this.originX, 7.5, this.originZ + 200);
        this.scene.add(this.box5u);
    },

    /**
     * Tworzy linię przerywaną na zadanym odcinku jezdni
     */
    createDashedLine(xStart, zStart, xEnd, zEnd, isVertical) {
        const dashLength = 15;
        const dashGap = 15;
        const step = dashLength + dashGap;
        
        const geom = new THREE.BoxGeometry(isVertical ? 2 : dashLength, 0.005, isVertical ? dashLength : 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const start = isVertical ? zStart : xStart;
        const end = isVertical ? zEnd : xEnd;
        
        for (let pos = start + dashGap; pos < end - dashGap; pos += step) {
            const mesh = new THREE.Mesh(geom, mat);
            const posX = isVertical ? xStart : pos;
            const posZ = isVertical ? pos : zStart;
            mesh.position.set(posX, 0.003, posZ); // Lekko ponad asfaltem, poniżej zderzaków aut
            this.scene.add(mesh);
            this.laneMarkings.push(mesh);
        }
    },

    /**
     * Tworzy przejście dla pieszych (zebra) ułożone w poprzek kierunku wchodzenia pieszych
     */
    createZebra(cx, cz, isVerticalRoad) {
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const stripeOffsets = [-60, -30, 0, 30, 60];
        
        if (isVerticalRoad) {
            // Zebra na drodze pionowej (pieszy idzie poziomo X, pasy są ułożone pionowo Z)
            const stripeGeom = new THREE.BoxGeometry(4, 0.005, 20);
            stripeOffsets.forEach(dx => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx + dx, 0.003, cz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        } else {
            // Zebra na drodze poziomej (pieszy idzie pionowo Z, pasy są ułożone poziomo X)
            const stripeGeom = new THREE.BoxGeometry(20, 0.005, 4);
            stripeOffsets.forEach(dz => {
                const mesh = new THREE.Mesh(stripeGeom, stripeMat);
                mesh.position.set(cx, 0.003, cz + dz);
                this.scene.add(mesh);
                this.zebras.push(mesh);
            });
        }
    },

    /**
     * Tworzy budynek określonego typu o zadanych wymiarach i pozycjonuje go na Y=0
     */
    createBuilding(type, x, z, height, width, depth) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        let roofY = height;
        let roofWidth = width;
        let roofDepth = depth;

        if (type === 'skyscraper') {
            const baseHeight = height * 0.75;
            const topHeight = height * 0.25;

            // Baza wieżowca
            const baseGeom = new THREE.BoxGeometry(width, baseHeight, depth);
            const baseMat = new THREE.MeshBasicMaterial({ color: 0x2d3436 }); // Ciemny szary
            const base = new THREE.Mesh(baseGeom, baseMat);
            base.position.y = baseHeight / 2;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // Wyższa, węższa część (setback)
            const topGeom = new THREE.BoxGeometry(width * 0.75, topHeight, depth * 0.75);
            const topMat = new THREE.MeshBasicMaterial({ color: 0x353b48 });
            const topMesh = new THREE.Mesh(topGeom, topMat);
            topMesh.position.y = baseHeight + topHeight / 2;
            topMesh.castShadow = true;
            topMesh.receiveShadow = true;
            group.add(topMesh);

            // Obrysy krawędzi dla kontrastu bez oświetlenia
            const edgesBase = new THREE.EdgesGeometry(baseGeom);
            const lineBase = new THREE.LineSegments(edgesBase, new THREE.LineBasicMaterial({ color: 0x111111 }));
            lineBase.position.y = baseHeight / 2;
            group.add(lineBase);

            const edgesTop = new THREE.EdgesGeometry(topGeom);
            const lineTop = new THREE.LineSegments(edgesTop, new THREE.LineBasicMaterial({ color: 0x111111 }));
            lineTop.position.y = baseHeight + topHeight / 2;
            group.add(lineTop);

            roofWidth = width * 0.75;
            roofDepth = depth * 0.75;
            roofY = height;

        } else if (type === 'residential') {
            // Blok mieszkalny (prostopadłościan o jasnoszarym/beżowym odcieniu)
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMat = new THREE.MeshBasicMaterial({ color: 0xb2bec3 }); // Średni szary
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Krawędzie
            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222 }));
            line.position.y = height / 2;
            group.add(line);

        } else if (type === 'shop') {
            // Niski sklep (szeroki i płaski, ciepły kolor)
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMat = new THREE.MeshBasicMaterial({ color: 0xf5cd79 }); // Ciepły piaskowy/żółty
            const body = new THREE.Mesh(bodyGeom, bodyMat);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Krawędzie
            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x444444 }));
            line.position.y = height / 2;
            group.add(line);
        }

        // Proceduralne HVAC na dachu (prawdopodobieństwo 40%)
        this.addHVACUnits(group, roofWidth, roofDepth, roofY);

        this.scene.add(group);
        this.buildings.push(group);
        return group;
    },

    /**
     * Dodaje proceduralne urządzenia HVAC na dachu budynku
     */
    addHVACUnits(group, roofWidth, roofDepth, roofY) {
        // Prawdopodobieństwo 40%
        if (Math.random() > 0.4) return;

        // Rozmiary urządzeń HVAC
        const sizes = [
            { w: 15, h: 8, d: 12 },
            { w: 10, h: 6, d: 10 },
            { w: 22, h: 10, d: 16 }
        ];

        // Liczba urządzeń na dachu: od 1 do 3
        const count = Math.floor(Math.random() * 3) + 1;
        const hvacMat = new THREE.MeshBasicMaterial({ color: 0x7f8c8d }); // Metaliczny szary
        const hvacEdgeMat = new THREE.LineBasicMaterial({ color: 0x2c3e50 });

        for (let i = 0; i < count; i++) {
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const geom = new THREE.BoxGeometry(size.w, size.h, size.d);
            const mesh = new THREE.Mesh(geom, hvacMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Losowe pozycjonowanie na dachu z marginesem bezpieczeństwa
            const marginX = roofWidth * 0.15 + size.w / 2;
            const marginZ = roofDepth * 0.15 + size.d / 2;
            
            const rangeX = Math.max(0, roofWidth - marginX * 2);
            const rangeZ = Math.max(0, roofDepth - marginZ * 2);

            const rx = rangeX > 0 ? (Math.random() - 0.5) * rangeX : 0;
            const rz = rangeZ > 0 ? (Math.random() - 0.5) * rangeZ : 0;

            mesh.position.set(rx, roofY + size.h / 2, rz);
            group.add(mesh);

            // Krawędzie skrzynki HVAC
            const edges = new THREE.EdgesGeometry(geom);
            const line = new THREE.LineSegments(edges, hvacEdgeMat);
            line.position.copy(mesh.position);
            group.add(line);
        }
    },

    /**
     * Dodaje billboard reklamowy na dachu niskiego budynku
     */
    addBillboard(group, roofWidth, roofDepth, roofY) {
        const billboardGroup = new THREE.Group();
        
        // Stelaż (2 cienkie słupki)
        const legGeom = new THREE.BoxGeometry(2, 20, 2);
        const legMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const legEdgeMat = new THREE.LineBasicMaterial({ color: 0x111111 });

        const leftLeg = new THREE.Mesh(legGeom, legMat);
        leftLeg.position.set(-15, 10, 0);
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        billboardGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, legMat);
        rightLeg.position.set(15, 10, 0);
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        billboardGroup.add(rightLeg);

        [leftLeg, rightLeg].forEach(leg => {
            const edges = new THREE.EdgesGeometry(legGeom);
            const line = new THREE.LineSegments(edges, legEdgeMat);
            line.position.copy(leg.position);
            billboardGroup.add(line);
        });

        // Tablica
        const boardGeom = new THREE.BoxGeometry(50, 25, 3);
        const boardMat = new THREE.MeshBasicMaterial({ color: 0x2c3e50 });
        const board = new THREE.Mesh(boardGeom, boardMat);
        board.position.set(0, 25, 0);
        board.castShadow = true;
        board.receiveShadow = true;
        billboardGroup.add(board);

        const boardEdges = new THREE.EdgesGeometry(boardGeom);
        const boardLine = new THREE.LineSegments(boardEdges, legEdgeMat);
        boardLine.position.copy(board.position);
        billboardGroup.add(boardLine);

        // Kolorowy plakat (cienka płaszczyzna)
        const posterGeom = new THREE.PlaneGeometry(46, 21);
        const posterColors = [0xe74c3c, 0x9b59b6, 0xf1c40f, 0xe67e22, 0x1abc9c, 0xe84393];
        const randomColor = posterColors[Math.floor(Math.random() * posterColors.length)];
        const posterMat = new THREE.MeshBasicMaterial({ 
            color: randomColor,
            side: THREE.DoubleSide
        });
        
        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(0, 25, 1.6); // Minimalne odsunięcie do przodu
        poster.castShadow = true;
        poster.receiveShadow = true;
        billboardGroup.add(poster);

        const posterEdges = new THREE.EdgesGeometry(posterGeom);
        const posterLine = new THREE.LineSegments(posterEdges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        posterLine.position.copy(poster.position);
        billboardGroup.add(posterLine);

        // Pozycja na dachu
        billboardGroup.position.set(0, roofY, 0);

        // Losowy obrót prostopadły do krawędzi budynku (0, 90, 180, 270 stopni)
        const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        billboardGroup.rotation.y = rotations[Math.floor(Math.random() * rotations.length)];

        group.add(billboardGroup);
        this.billboards.push(billboardGroup);
    },

    /**
     * Tworzy i dodaje drzewo na chodniku
     */
    createTree(sizeType, x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0.05, z); // Wysokość chodnika

        const greenShades = [
            0x2ecc71, // Jasnozielony
            0x27ae60, // Średni zielony
            0x1abc9c, // Turkusowy zielony
            0x16a085, // Morski zielony
            0x1e824c, // Ciemnozielony leśny
            0x2d5a27  // Butelkowa zieleń
        ];
        const leafColor = greenShades[Math.floor(Math.random() * greenShades.length)];

        const trunkMat = new THREE.MeshBasicMaterial({ color: 0x795548 }); // Brąz
        const trunkEdgeMat = new THREE.LineBasicMaterial({ color: 0x3d271d });
        const leafMat = new THREE.MeshBasicMaterial({ color: leafColor });
        const leafEdgeMat = new THREE.LineBasicMaterial({ color: 0x145a32 });

        if (sizeType === 'shrub') {
            // Niski krzew
            const trunkGeom = new THREE.CylinderGeometry(1.5, 1.5, 6, 5);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 3;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const trunkEdges = new THREE.EdgesGeometry(trunkGeom);
            const trunkLine = new THREE.LineSegments(trunkEdges, trunkEdgeMat);
            trunkLine.position.copy(trunk.position);
            group.add(trunkLine);

            const leafGeom = new THREE.SphereGeometry(8, 6, 6);
            const leaf = new THREE.Mesh(leafGeom, leafMat);
            leaf.position.y = 8;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);

            const leafEdges = new THREE.EdgesGeometry(leafGeom);
            const leafLine = new THREE.LineSegments(leafEdges, leafEdgeMat);
            leafLine.position.copy(leaf.position);
            group.add(leafLine);
        } else {
            // Średnie drzewo
            const trunkGeom = new THREE.CylinderGeometry(2, 2, 16, 6);
            const trunk = new THREE.Mesh(trunkGeom, trunkMat);
            trunk.position.y = 8;
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);

            const trunkEdges = new THREE.EdgesGeometry(trunkGeom);
            const trunkLine = new THREE.LineSegments(trunkEdges, trunkEdgeMat);
            trunkLine.position.copy(trunk.position);
            group.add(trunkLine);

            // Dolna korona
            const leafGeom1 = new THREE.SphereGeometry(14, 8, 8);
            const leaf1 = new THREE.Mesh(leafGeom1, leafMat);
            leaf1.position.y = 20;
            leaf1.castShadow = true;
            leaf1.receiveShadow = true;
            group.add(leaf1);

            const leafEdges1 = new THREE.EdgesGeometry(leafGeom1);
            const leafLine1 = new THREE.LineSegments(leafEdges1, leafEdgeMat);
            leafLine1.position.copy(leaf1.position);
            group.add(leafLine1);

            // Górna korona
            const leafGeom2 = new THREE.SphereGeometry(10, 8, 8);
            const leaf2 = new THREE.Mesh(leafGeom2, leafMat);
            leaf2.position.y = 28;
            leaf2.castShadow = true;
            leaf2.receiveShadow = true;
            group.add(leaf2);

            const leafEdges2 = new THREE.EdgesGeometry(leafGeom2);
            const leafLine2 = new THREE.LineSegments(leafEdges2, leafEdgeMat);
            leafLine2.position.copy(leaf2.position);
            group.add(leafLine2);
        }

        this.scene.add(group);
        this.trees.push(group);
        return group;
    },

    update() {
        if (!this.renderer || !this.scene || !this.camera) return;

        // 1. Walidacja konwencji - płynny ruch czerwonego sześcianu wzdłuż ulicy (oś X)
        const time = Date.now() * 0.001;
        this.box5u.position.x = 1500 + Math.sin(time) * 1000;
        this.box5u.position.z = 1100;

        // 2. Pobranie pozycji śledzonej encji (gracza lub pojazdu)
        const player = World.getEntitiesByType('player')[0];
        let focusX = this.originX;
        let focusZ = this.originZ;

        if (player && player.transform) {
            focusX = player.transform.x;
            focusZ = player.transform.y;
        }

        // 3. Pozycjonowanie kamery izometrycznej
        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200;

        this.camera.position.x = focusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance;
        this.camera.position.y = Math.sin(tiltAngle) * distance;
        this.camera.position.z = focusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance;
        
        this.camera.lookAt(focusX, 0, focusZ);

        // 4. Synchronizacja modeli 3D z logiką 2D
        RenderSync3D.update(this.scene);

        // 5. Render klatki
        this.renderer.render(this.scene, this.camera);
    }
};
