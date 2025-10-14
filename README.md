# Dominion Prototype

## Overview
Dominion is a top-down stealth and infiltration sandbox built with Vite. The current slice drops the player into a hand-authored but procedurally assembled swamp province filled with patrolling NPCs, multi-storey village homes, and a looming war front. Core systems such as stealth detection, village threat, dynamic raids, and tavern missions are wired together to support moment-to-moment sneaking, trading, and sabotage. 【F:src/main.js†L3-L76】【F:src/state/gameState.js†L14-L79】

## Current Game Features
- **Living overworld** – The map spans an 8,000×8,000 swamp dotted with five key villages, castle staging grounds, and road networks rendered on both the minimap and full-screen world map overlay. 【F:src/data/world.js†L1-L9】【F:src/render/map.js†L14-L188】
- **Player stats, HUD, and inventory** – Players spawn near Moonfen with base health, damage, stealth, and a six-slot inventory, with the HUD tracking health, detection, gold, and derived stats in real time. 【F:src/state/gameState.js†L20-L67】【F:src/render/hud.js†L135-L199】
- **Stealth pressure & village threat** – Detection, threat, and noise mechanics let NPCs escalate hunts; talking to villagers, pickpocketing, and disarming alarm traps all manipulate these meters. 【F:src/systems/threat.js†L1-L23】【F:src/systems/villageInteractions.js†L71-L193】
- **Unified quest threads** – Tavern contracts and free-roam discoveries share a quest log that advances trigger → objective → resolution stages while paying out threat and Dark muster relief on completion. 【F:src/systems/questLog.js†L1-L278】【F:src/systems/barkeepMissions.js†L1-L289】【F:src/systems/pointsOfInterest.js†L1-L272】
- **Shops and gear progression** – A pauseable goblin shop sells passive gear and consumables, updating player stats on purchase or use; current inventory includes speed boots, stealth cloaks, damage daggers, invisibility potions, and moonleaf draughts. 【F:src/systems/shop.js†L14-L131】【F:src/data/items.js†L1-L58】
- **Dynamic war front** – Each village maintains a defender roster while the Dark Lord musters raiding parties in response to threat, enabling ongoing raids and militia reinforcements across the region. 【F:src/systems/war.js†L8-L133】
- **Exploration points of interest** – Optional encounters such as shady traders, wandering merchants, cursed shrines, and bog sprites now plug into the shared quest log, revealing locations, unlocking quests, and shifting threat or Dark muster when resolved. 【F:src/systems/pointsOfInterest.js†L19-L272】
- **Continuous regression checks** – A lightweight test suite validates house interiors, stair placement, village templates, NPC defaults, and noise queuing every time the client boots. 【F:src/tests/lightweight.js†L1-L123】【F:src/main.js†L793-L794】

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
These scripts are defined in the project’s package manifest. 【F:package.json†L1-L13】

## Next Steps
Planned work includes tightening NPC combat loops, expanding the mission roster, and polishing input prompts so first-time players understand how to interact with the growing number of systems in the province.
