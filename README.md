# Dominion Prototype

## Overview
Dominion is a top-down stealth and infiltration sandbox built with Vite. The playable slice boots a hand-authored yet procedurally dressed swamp province, instantiates villages, terrain, interiors, quests, war simulation, and UI layers, then ties them together in a single render and update loop that runs from input setup through death handling.【F:src/main.js†L3-L181】【F:src/state/gameState.js†L72-L165】

## World & Navigation
- **Swamp province layout** – The overworld spans an 8,000×8,000 grid anchored by five named villages and a Dark Lord castle staging ground, giving every system shared spatial context for patrols, missions, and raids.【F:src/data/world.js†L1-L10】【F:src/state/gameState.js†L92-L118】
- **Readable cartography** – A full-screen map overlay and minimap render roads, patrol paths, settlements, the goblin tavern, POIs, the player marker, and fog-of-war that scales with discovered intel so players can plan infiltration routes at a glance.【F:src/render/map.js†L14-L195】【F:src/render/map.js†L197-L200】

## Player Kit & Interface
- **Player baseline** – Heroes spawn just outside Moonfen with base stats, stealth meters, sprint noise timers, and a six-slot inventory wired into HUD overlays, allowing moment-to-moment tracking of health, detection, gold, and derived combat/stealth values.【F:src/state/gameState.js†L72-L139】【F:src/render/hud.js†L135-L259】
- **Gear and consumables** – The goblin merchant pauses play, lets players buy unique passives and consumables, and updates stats or applies temporary effects when items are consumed, reflecting the curated item list in the shop data.【F:src/systems/shop.js†L14-L131】【F:src/data/items.js†L1-L40】
- **Developer toggles** – URL flags, global switches, and localStorage keys can enable debugging overlays such as NPC FOV visualization, with the resolved state stored alongside other global settings.【F:src/state/gameState.js†L14-L67】【F:src/state/gameState.js†L161-L164】

## Stealth, Noise & Combat
- **Dynamic patrol reactions** – Scouts escalate between patrol, suspicion, search, and alert states, expanding speed and vision with global threat pressure and following search routes when they lose sight of the player.【F:src/npc/npcManager.js†L661-L743】
- **Noise-driven AI** – Every noise event carries radius, responder caps, and cooldown metadata so nearby scouts can be assigned investigation targets unless sight lines are blocked, creating emergent hunts.【F:src/main.js†L111-L124】【F:src/npc/npcManager.js†L793-L817】
- **Threat economy** – Raising or lowering threat automatically adjusts village suspicion and population health, throttling further gains to pace escalation stages that feed into the wider war simulation.【F:src/systems/threat.js†L1-L33】
- **Death loop** – Fatal encounters trigger a staged death sequence before respawning the player at their spawn point with refreshed stealth timers and a recentered camera, keeping runs continuous.【F:src/main.js†L126-L181】

## Missions, Points of Interest & World Events
- **Unified quest log** – Mission definitions register against a shared quest log that tracks discovery, acceptance, readiness, completion, and custom data, while the on-screen log groups quests, objectives, and tracked targets for quick review.【F:src/systems/questLog.js†L1-L120】【F:src/render/questLog.js†L1-L155】
- **Scripted tavern contracts** – Barkeep dialogue chains unlock bespoke infiltration missions that activate world sites, pay out gold, tweak world suspicion, and seed intel hooks once objectives are completed.【F:src/systems/barkeepMissions.js†L1-L185】
- **World events & POIs** – Multi-phase world events spawn interactable props, guard encounters, and quest targets, while points of interest like shady traders, cursed shrines, and fae runestones become available or resolved as events advance.【F:src/systems/worldEvents.js†L1-L120】【F:src/data/pointsOfInterest.js†L1-L80】

## War & World State Simulation
- **Active warfront** – Each village maintains a defender roster whose capacity and spawn cadence react to guard strength and alertness metrics, while the Dark Lord amasses raids based on threat, suspicion, and suppression effects.【F:src/systems/war.js†L16-L120】【F:src/systems/war.js†L180-L222】
- **Persistent world metrics** – Suspicion, guard readiness, morale, economy, rumors, and safehouse access are centralized in the world state system, which clamps values, notifies listeners, and exposes helpers for missions to mutate global conditions.【F:src/systems/worldState.js†L5-L75】【F:src/systems/worldState.js†L92-L154】

## Tooling & Regression Safety
- **Built-in smoke tests** – A lightweight test harness runs on boot to validate house geometry, stair placement, chest counts, noise queuing, and NPC defaults, emitting console output and toasts when assertions fail.【F:src/tests/lightweight.js†L1-L104】【F:src/main.js†L824-L851】

## Development
1. Install dependencies once per workspace:
   ```bash
   npm install
   ```
2. Launch the development server:
   ```bash
   npm run dev
   ```
3. Create a production build or preview it with Vite’s built-in commands:
   ```bash
   npm run build
   npm run preview
   ```
These scripts are defined in the project’s package manifest.【F:package.json†L1-L10】
