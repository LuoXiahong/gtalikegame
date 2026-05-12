/**
 * CORE: Game - Engine Orchestrator
 * Initializes systems, handles entity creation, and runs the main game loop.
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

        // Spawn player at start intersection
        const p1 = new Player(1100, 1100);
        World.addEntity(p1);

        VehicleSystem.init(p1);

        // Spawn 10 starting NPCs on sidewalks around the 3x3 grid
        const npcConfigs = [
            { id: 'npc1', x: 1000, y: 1000, color: '#8e44ad' }, 
            { id: 'npc2', x: 1200, y: 1000, color: '#27ae60' }, 
            { id: 'npc3', x: 1000, y: 1200, color: '#c0392b' }, 
            { id: 'npc4', x: 1200, y: 1200, color: '#f1c40f' }, 
            { id: 'npc5', x: 1700, y: 1000, color: '#e67e22' }, 
            { id: 'npc6', x: 1900, y: 1000, color: '#1abc9c' }, 
            { id: 'npc7', x: 1000, y: 1700, color: '#9b59b6' }, 
            { id: 'npc8', x: 1200, y: 1700, color: '#3498db' }, 
            { id: 'npc9', x: 1700, y: 1700, color: '#e74c3c' }, 
            { id: 'npc10', x: 1900, y: 1700, color: '#2ecc71' }
        ];

        npcConfigs.forEach(cfg => {
            World.addEntity(new NPC(cfg.id, cfg.x, cfg.y, cfg.color));
        });

        // Spawn starting parked vehicle near the player
        World.addEntity(new Car('car1', 1100, 1300, '#c0392b'));

        // Start in MENU state
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

            // 1. Process inputs and determine movement intentions
            if (controlled) {
                if (controlled.type === 'player') {
                    PlayerMovementSystem.update(dt, controlled);
                } else if (controlled.type === 'car') {
                    VehiclePhysicsSystem.update(dt, controlled);
                    EventBus.emit('speed_update', Math.abs(controlled.physics.speed));
                }
            }

            // 2. Update logic systems
            WantedSystem.update(dt);
            PoliceSystem.update(dt);
            TrafficSystem.update(dt);
            MovementSystem.update(dt);
            AISystem.update(dt);
            MissionSystem.update(dt);
            InteractionSystem.update();

            // 3. Resolve collisions
            CollisionSystem.update();

            // 4. Update camera follow
            if (controlled) Camera.follow(controlled, dt);
        }

        // Toggle 2D vs 3D camera modes
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

        // 5. Render active system
        if (this.is3D) {
            RenderSystem3D.update();
        } else {
            RenderSystem.update();
        }

        // 6. Update UI elements (including canvas minimap)
        UISystem.update();

        requestAnimationFrame((ts) => this.loop(ts));
    }
};
