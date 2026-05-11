/**
 * CORE: Game - Orkiestrator gry
 * Inicjalizuje systemy i uruchamia główną pętlę.
 */
import { Time } from './Time.js';
import { EventBus } from './EventBus.js';
import { World } from '../world/World.js';
import { Camera } from '../world/Camera.js';
import { InputSystem } from '../input/InputManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js';
import { VehiclePhysicsSystem } from '../systems/VehiclePhysicsSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { TrafficSystem } from '../systems/TrafficSystem.js';
import { CollisionSystem } from '../world/CollisionSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { RenderSystem3D } from '../systems/RenderSystem3D.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { WantedSystem } from '../systems/WantedSystem.js';
import { PoliceSystem } from '../systems/PoliceSystem.js';
import { UISystem } from '../ui/HUD.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { Car } from '../entities/Car.js';

import { GameState, GAME_STATES } from './GameState.js';
import { MenuScreen } from '../ui/MenuScreen.js';

export const Game = {
    is3D: false,

    init() {
        World.init();
        InputSystem.init();
        Camera.init();
        RenderSystem.init();
        RenderSystem3D.init();
        AudioSystem.init();
        UISystem.init();
        MenuScreen.init();
        MissionSystem.init();
        WantedSystem.init();
        PoliceSystem.init();
        AISystem.init();

        // Inicjalizacja instancji
        const p1 = new Player(1000, 1500);
        World.addEntity(p1);

        VehicleSystem.init(p1);

        // Spawnowanie 10 przechodniów (NPC) na chodnikach wokół miasta
        const npcConfigs = [
            { id: 'npc1', x: 1450, y: 1550, color: '#8e44ad' }, // fioletowy
            { id: 'npc2', x: 1750, y: 1450, color: '#27ae60' }, // zielony
            { id: 'npc3', x: 1250, y: 1800, color: '#c0392b' }, // czerwony
            { id: 'npc4', x: 1150, y: 1450, color: '#f1c40f' }, // żółty
            { id: 'npc5', x: 1450, y: 1150, color: '#e67e22' }, // pomarańczowy
            { id: 'npc6', x: 1750, y: 1750, color: '#1abc9c' }, // turkusowy
            { id: 'npc7', x: 1150, y: 1750, color: '#9b59b6' }, // fioletowy (jasny)
            { id: 'npc8', x: 1450, y: 1850, color: '#3498db' }, // niebieski
            { id: 'npc9', x: 1850, y: 1450, color: '#e74c3c' }, // czerwony (jasny)
            { id: 'npc10', x: 950, y: 1450, color: '#2ecc71' } // zielony (jasny)
        ];

        npcConfigs.forEach(cfg => {
            World.addEntity(new NPC(cfg.id, cfg.x, cfg.y, cfg.color));
        });

        World.addEntity(new Car('car1', 2050, 1600, '#c0392b'));

        // Start w MENU
        GameState.setState(GAME_STATES.MENU);

        requestAnimationFrame((ts) => this.loop(ts));
    },

    loop(timestamp) {
        Time.update(timestamp);
        const dt = Time.delta;
        const currentState = GameState.getState();

        if (currentState === GAME_STATES.PLAY) {
            if (InputSystem.consumeDebugAI()) {
                RenderSystem.debugAI = !RenderSystem.debugAI;
            }
            const controlled = VehicleSystem.getControlledEntity();

            // 1. Zbieranie wejścia i aplikacja intencji ruchu (zależy od typu sterowanej encji)
            if (controlled) {
                if (controlled.type === 'player') {
                    PlayerMovementSystem.update(dt, controlled);
                } else if (controlled.type === 'car') {
                    VehiclePhysicsSystem.update(dt, controlled);
                    EventBus.emit('speed_update', Math.abs(controlled.physics.speed));
                }
            }

            // 2. Aktualizacja systemów logiki i fizyki podstawowej
            WantedSystem.update(dt);
            PoliceSystem.update(dt);
            TrafficSystem.update(dt);
            MovementSystem.update(dt);
            AISystem.update(dt);
            MissionSystem.update(dt);
            InteractionSystem.update();

            // 3. Rozwiązywanie kolizji
            CollisionSystem.update();

            // 4. Aktualizacja punktu widzenia
            if (controlled) Camera.follow(controlled, dt);
        }

        if (InputSystem.consumeViewToggle()) {
            this.is3D = !this.is3D;
            const canvas2D = document.getElementById('gameCanvas');
            const canvas3D = document.getElementById('gameCanvas3D');
            if (this.is3D) {
                if (canvas2D) canvas2D.style.display = 'none';
                if (canvas3D) canvas3D.style.display = 'block';
            } else {
                if (canvas2D) canvas2D.style.display = 'block';
                if (canvas3D) canvas3D.style.display = 'none';
            }
        }

        // 5. Renderowanie stanu końcowego na klatkę (zawsze, dla efektów tła)
        if (this.is3D) {
            RenderSystem3D.update();
        } else {
            RenderSystem.update();
        }

        requestAnimationFrame((ts) => this.loop(ts));
    }
};
