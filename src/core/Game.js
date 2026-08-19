/**
 * Game — engine orchestrator: systems, entities, main loop.
 */
import { Time } from './Time.js';
import { EventBus } from './EventBus.js';
import { GameConfig } from './GameConfig.js';
import { AssetLoader } from './AssetLoader.js';
import { World } from '../world/World.js';
import { Camera } from '../world/Camera.js';
import { InputSystem } from '../input/InputManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js';
import { CharacterAnimationSystem } from '../systems/CharacterAnimationSystem.js';
import { VehiclePhysicsSystem } from '../systems/VehiclePhysicsSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { TrafficSystem } from '../systems/TrafficSystem.js';
import { CollisionSystem } from '../world/CollisionSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { RenderSystem3D } from '../systems/RenderSystem3D.js';
import { RenderSync3D } from '../systems/RenderSync3D.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { WantedSystem } from '../systems/WantedSystem.js';
import { PoliceSystem } from '../systems/PoliceSystem.js';
import { HealthSystem } from '../systems/HealthSystem.js';
import { UISystem } from '../ui/HUD.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { Car } from '../entities/Car.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';

import { GameState, GAME_STATES } from './GameState.js';
import { MenuScreen } from '../ui/MenuScreen.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { KeyboardHelpOverlay } from '../ui/KeyboardHelpOverlay.js';
import { OptionsOverlay } from '../ui/OptionsOverlay.js';
import { FilmGateOverlay } from '../ui/FilmGateOverlay.js';
import { FpsOverlay } from '../ui/FpsOverlay.js';
import { UISettings } from '../ui/UISettings.js';
import { I18n } from '../i18n/I18n.js';
import { RetroFilmSettings } from '../systems/RetroFilmSettings.js';
import { TimeOfDaySettings } from '../systems/TimeOfDaySettings.js';
import { ScreenshotCapture } from '../systems/ScreenshotCapture.js';

export const Game = {
    is3D: true,

    async init() {
        UISettings.init();
        RetroFilmSettings.init();
        TimeOfDaySettings.init();
        I18n.init(UISettings.getLocale());

        this.screenshotMode = new URLSearchParams(window.location.search).get('screenshot');

        LoadingScreen.init();
        LoadingScreen.show();

        const assetTasks = [
            () => AssetLoader.loadFont("16px 'Yomogi'"),
            () => AssetLoader.loadImage('./assets/logo.png')
        ];
        const onProgress = (done, total) => LoadingScreen.setProgress(total ? done / total : 1);

        // Screenshot automation shouldn't wait on the artificial min-display offset.
        if (this.screenshotMode) {
            await AssetLoader.load(assetTasks, onProgress);
        } else {
            await AssetLoader.loadWithMinDelay(assetTasks, onProgress);
        }

        World.init();
        InputSystem.init();
        Camera.init();
        RenderSystem.init();
        RenderSystem.debugAI = UISettings.getDebugAI();
        RenderSystem3D.init();

        // Sync canvas visibility with default render mode (is3D)
        const canvas2D = document.getElementById('gameCanvas');
        const canvas3D = document.getElementById('gameCanvas3D');
        if (this.is3D) {
            if (canvas2D) canvas2D.style.display = 'none';
            if (canvas3D) canvas3D.style.display = 'block';
        } else {
            if (canvas2D) canvas2D.style.display = 'block';
            if (canvas3D) canvas3D.style.display = 'none';
        }
        AudioSystem.init();
        UISystem.init();
        MenuScreen.init();
        MissionSystem.init();
        WantedSystem.init();
        PoliceSystem.init();
        HealthSystem.init();
        AISystem.init();
        KeyboardHelpOverlay.init();
        OptionsOverlay.init();
        FilmGateOverlay.init();
        FpsOverlay.init();

        if (!this.screenshotMode) {
            this.spawnEntities();
        } else {
            // Still spawn entities for screenshots so cars/NPCs appear in the world
            this.spawnEntities();
            window.__SCREENSHOT_READY__ = false;
            this._screenshotFrames = 0;
            // Auto-download only for a human browsing with ?screenshot= directly (fast
            // iteration, no manual F9 + rename). `npm run screenshots` drives this same
            // page via Playwright (navigator.webdriver === true) and grabs pixels itself
            // via CDP, so it must not also trigger a browser download here.
            this._markScreenshotReady = () => {
                if (window.__SCREENSHOT_READY__) return;
                window.__SCREENSHOT_READY__ = true;
                if (!navigator.webdriver) ScreenshotCapture.request();
            };
            // Failsafe if rAF is starved (software GL / GPU stalls)
            setTimeout(this._markScreenshotReady, 2500);
            const uiElements = ['menuLayer', 'mobileHUD'];
            uiElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        if (this._onRestart) EventBus.off('game_restart', this._onRestart);
        this._onRestart = () => this.restart();
        EventBus.on('game_restart', this._onRestart);

        // Prime WebGL shader compilation (city/prop materials + bloom/tiltshift/retro-film
        // passes) while the loader is still up. Without this, the first frame drawn by the
        // real game loop below pays the compile cost, which can stall the main thread long
        // enough to visibly stutter the menu's CSS blink right as it appears.
        if (this.is3D) {
            RenderSystem3D.update();
            RenderSystem3D.update();
        }

        // Hide right as the menu/scene is about to paint — no blank gap between
        // the loader disappearing and the (heavy, synchronous) scene bootstrap above.
        LoadingScreen.hide();

        if (this.screenshotMode) {
            GameState.setState(GAME_STATES.PLAY);
        } else {
            GameState.setState(GAME_STATES.MENU);
        }

        requestAnimationFrame((ts) => this.loop(ts));
    },

    spawnEntities() {
        const p1 = new Player(GameConfig.SPAWN.PLAYER_X, GameConfig.SPAWN.PLAYER_Y);
        World.addEntity(p1);

        VehicleSystem.init(p1);

        // Sidewalk NPCs; some paths cross the street to a neighboring block
        const npcConfigs = [
            { id: 'npc1', row: 0, col: 0, corner: 0, color: '#3d3d3d', cross: false },
            { id: 'npc2', row: 0, col: 0, corner: 2, color: '#5c4033', cross: true },
            { id: 'npc3', row: 0, col: 1, corner: 0, color: '#1a2744', cross: true },
            { id: 'npc4', row: 0, col: 1, corner: 1, color: '#5a5a5a', cross: false },
            { id: 'npc5', row: 0, col: 2, corner: 0, color: '#6b4423', cross: true },
            { id: 'npc6', row: 1, col: 0, corner: 1, color: '#2c3e50', cross: false },
            { id: 'npc7', row: 1, col: 1, corner: 0, color: '#4a3728', cross: true },
            { id: 'npc8', row: 1, col: 2, corner: 3, color: '#4a5560', cross: false },
            { id: 'npc9', row: 2, col: 0, corner: 2, color: '#3e2723', cross: true },
            { id: 'npc10', row: 2, col: 2, corner: 1, color: '#5a5a5a', cross: false }
        ];

        npcConfigs.forEach(cfg => {
            const patrol = PedestrianPaths.buildPatrol(cfg.row, cfg.col, cfg.cross);
            const start = patrol[cfg.corner % Math.min(4, patrol.length)];
            World.addEntity(new NPC(cfg.id, start.x, start.y, cfg.color, patrol));
        });

        World.addEntity(new Car('car1', GameConfig.SPAWN.CAR_X, GameConfig.SPAWN.CAR_Y, '#c0392b'));
    },

    restart() {
        RenderSync3D.reset(RenderSystem3D.scene);
        World.init();
        PoliceSystem.reset();
        WantedSystem.reset();
        MissionSystem.init();
        InteractionSystem.reset();
        InputSystem.resetAll();
        this.spawnEntities();
        EventBus.emit('ui_show_dialogue', null);
        EventBus.emit('ui_show_action_hint', null);
        EventBus.emit('speed_update', 0);
        EventBus.emit('vehicle_exited', { carId: null });
    },

    isPausedByOverlay() {
        return KeyboardHelpOverlay.isVisible() || OptionsOverlay.isVisible();
    },

    loop(timestamp) {
        Time.update(timestamp);
        const dt = Time.delta;
        const currentState = GameState.getState();
        const paused = this.isPausedByOverlay();

        if (currentState === GAME_STATES.PLAY && !paused) {
            if (InputSystem.consumeDebugAI()) {
                RenderSystem.debugAI = !RenderSystem.debugAI;
                UISettings.setDebugAI(RenderSystem.debugAI);
            }
            const controlled = VehicleSystem.getControlledEntity();

            if (controlled) {
                if (controlled.type === 'player') {
                    PlayerMovementSystem.update(dt, controlled);
                } else if (controlled.type === 'car') {
                    VehiclePhysicsSystem.update(dt, controlled);
                    EventBus.emit('speed_update', Math.abs(controlled.physics.speed));
                }
            }

            WantedSystem.update(dt);
            PoliceSystem.update(dt);
            TrafficSystem.update(dt);
            MovementSystem.update(dt);
            AISystem.update(dt);
            MissionSystem.update(dt);
            InteractionSystem.update();

            CollisionSystem.update();

            // After collisions so the gait reflects the velocity actually applied.
            CharacterAnimationSystem.update(dt);

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

        if (InputSystem.consumeScreenshot()) {
            ScreenshotCapture.request();
        }

        if (this.is3D) {
            RenderSystem3D.update();
        } else {
            RenderSystem.update();
        }

        UISystem.update();
        FilmGateOverlay.update(timestamp);
        FpsOverlay.update(dt);

        if (this.screenshotMode && !window.__SCREENSHOT_READY__) {
            this._screenshotFrames = (this._screenshotFrames || 0) + 1;
            // 2 painted frames is enough — long waits starve under software GL
            if (this._screenshotFrames >= 2) {
                this._markScreenshotReady();
            }
        }

        requestAnimationFrame((ts) => this.loop(ts));
    }
};
