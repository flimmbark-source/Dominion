# Grimm Dominion — Goblin vs. Dark Lord Vertical Slice  
**Codex Prompt Playbook**  
Version: 1.0  
Date: October 2025  

---

## 🎯 Overview

This playbook defines a chain of Codex prompts that will build the **Goblin Village Vertical Slice** — a playable demonstration of the *validated design loop* from the official Grimm Dominion Design Document 4v1.

The goal is to **advance the actual game systems**, not create a throwaway demo.  
Each prompt is self-contained with full design context so Codex can execute them independently.

---

## 🧠 BASE CONTEXT BLOCK  *(prepend to every prompt)*

> **Game Context:**  
> Grimm Dominion is an asymmetric real-time strategy where one AI-controlled **Dark Lord** commands monsters to hunt stealthy **Hero** characters.  
> In this vertical slice we focus on the **Goblin Outlaw**, whose core loop is *sneaking into NPC villages, stealing gold from chests inside houses, and returning to a hidden tavern to buy upgrades* while avoiding the Dark Lord’s scouts.  
> The Dark Lord spawns and directs **Scouts** (fast vision units) and **Tanks** (slow brutes) that patrol, investigate noises, and howl to alert others.  
> 
> Key systems to validate: stealth line-of-sight with detection meter, noise propagation, AI patrol/alert logic, and the gold-to-tavern upgrade economy.

---

## ⚙️ PROMPT 1 — Environment: *Village Slice Scene*

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: Create the playable environment "VillageScene.tsx".
> 
> Implementation Goals:
> • Use React Three Fiber + Three.js to render a 50×50 m terrain: forest edge (spawn), short path to a small village (3 houses), and a random tavern spawn on the edge.  
> • Houses have doorway colliders and 1–2 chests inside tagged “lootable”.  
> • Provide NavAreas (empty meshes with tags) for AI patrol routes.  
> • Lighting: low-moon ambience + flickering torches.  
> • Export as default scene and integrate with current build pipeline.
> ```

---

## 👣 PROMPT 2 — Goblin Controller + Interaction

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: Implement Goblin.ts (player character).
> 
> Mechanics:
> • Default stealth state – invisible unless an enemy keeps line-of-sight for >3 s.  
> • Movement: WASD or click-to-move using R3F controls.  
> • Cloak ability: 5 s invisibility, 15 s cooldown, breaks on interaction.  
> • Chest Interaction: Hold E for 2 s near tagged “lootable” → +Gold (5).  
> • Each looting event calls emitNoise(x,y,10).  
> • State vars: gold, cloakActive, detectionLevel (0–1), isHidden.  
> • Expose callbacks onLoot(), onDetected().
> ```

---

## 👁️ PROMPT 3 — Stealth + Detection System

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: Create StealthSystem.ts.
> 
> Core Logic:
> • For each AI every frame:
>     if (hasLineOfSightTo(goblin)) detection += dt/3; else detection -= 0.3 × dt.
> • When detection ≥ 1 → dispatch "GoblinSpotted" event.  
> • Implement noise system: emitNoise(x,y,radius) → add to globalNoiseQueue; nearest AI with state Idle or Patrol switches to Investigate.  
> • Provide debug toggles to visualize vision cones & noise spheres.
> ```

---

## 🧠 PROMPT 4 — Dark Lord AI Controller

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: DarkLordAI.ts
> 
> Responsibilities:
> • Maintain EvilEnergy += 5 every 10 s (used to spawn minions).  
> • Manage AI unit types:
>     – Scout: patrol NavAreas, investigate noise, howl on sight (alerts others).  
>     – Tank: spawns after a howl, lumbers to lastKnownPos and searches.  
> • Each unit uses a state machine {Idle, Patrol, Investigate, Chase, Return}.  
> • Integrate with StealthSystem events:
>     on GoblinSpotted → alert nearby AIs.  
> • Limit active units to 5 for performance.
> ```

---

## 💰 PROMPT 5 — Tavern & Upgrade System

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: Tavern.ts + UpgradeUI.tsx
> 
> Design Rules:
> • Tavern spawns randomly at map edge; only visible when Goblin < 20 m.  
> • Enter trigger → open Upgrade UI.  
> • Upgrades (cost / effect):
>     – Dagger (10 g): +20% damage  
>     – Boots (10 g): +15% speed  
>     – Cloak (15 g): +2 s duration  
> • Deduct gold on purchase, persist buff in Goblin state.  
> • Stub future “compromised tavern” flag if AI sees Goblin enter.
> ```

---

## 🎯 PROMPT 6 — Game State & HUD

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: GameState.ts + HUD.tsx
> 
> UI Elements:
> • Gold counter (top-left)  
> • Cloak cooldown bar  
> • Detection meter (bottom)  
> • Objective text: “Loot 2 chests → Reach tavern for upgrade”
> 
> GameState logic:
> • Win → purchase any upgrade.  
> • Lose → detectionLevel ≥ 1 and AI collision within 2 s.  
> • Include Restart button.
> ```

---

## 📊 PROMPT 7 — Telemetry & Balance Hooks

> ```
> #agent-task
> [BASE CONTEXT BLOCK]
> 
> Feature: DebugTelemetry.ts
> 
> Collect session metrics:
> • avgDetectionTime  
> • noiseAlertsTriggered  
> • timeBetween firstNoise → AI arrival  
> 
> Save JSON to /public/debug/session.json for balancing analysis.  
> Include console logs to validate stealth thresholds.
> ```

---

## 🚀 Execution Order

1. Copy the **Base Context Block** before every prompt.  
2. Execute the prompts sequentially within Codex on your development branch (e.g. `Attempt-3` or `vertical-slice-goblin`).  
3. After each build step, run `npm run dev` and validate:  
   - Goblin can enter houses and loot chests.  
   - Noise attracts Scouts; Tanks spawn on howls.  
   - Detection meter behaves per spec.  
   - Tavern upgrades function and persist.  
4. Once validated, commit all changes and open a PR → `main`.

---

## ✅ Deliverable Goals for this Vertical Slice

| Validation Focus | Description |
|------------------|-------------|
| **Core Loop Test** | Loot → Noise → Detection → Escape → Tavern Upgrade |
| **Asymmetry Balance** | Goblin stealth duration vs. Scout vision range |
| **Map Readability** | Village and tavern spacing supports stealth movement |
| **Future Extension Ready** | All systems modular for integration with other heroes and full procedural world generation |

---

**End of File — Grimm Dominion Codex Prompt Playbook**
