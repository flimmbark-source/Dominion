<!-- /README.md -->
# Grimm Dominion – Vertical Slice (Codespaces)

**Run in your browser**: this repo is prewired for GitHub Codespaces.

## Quick Start (Codespaces)
1. Click **Code → Create codespace on main** (or use the badge below).  
2. Wait ~10–20s. A dev server starts automatically on port **8000** and opens in a new tab.  
3. Play: `WASD` move, `Shift` sprint, `E` loot, `1–6` use items, `0/Esc` exit shop, `F` vision cones.

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://github.com/codespaces/new)

> If the browser tab doesn’t open, open the **Ports** panel and click the **8000** URL.

## Files
- `index.html` — Single-file HTML5/Canvas game (no deps).
- `.devcontainer/devcontainer.json` — Autostart Python HTTP server on port 8000.

## Controls
- **Move:** `W A S D`
- **Sprint/Noise:** `Shift`
- **Loot:** `E`
- **Use Inventory Slot:** `1–6`
- **Toggle Vision Cones:** `F`
- **Tavern Shop:** walk into green zone (bottom-left).  
  - Buy: `1–5` (while shop open)  
  - Exit shop: `0` or `Esc`

## Test Checklist (Prompts 1–7)
- **Stealth & Detection:** Enter/leave NPC FOV; meter fills/decays; sprint near NPC to raise meter.  
- **Obstacles:** Houses block line-of-sight.  
- **Patrols:** Villagers wander; scouts patrol with larger FOV/range.  
- **Looting:** `E` near chest → gold increases; detection spike; threat +12.  
- **Tavern Shop:** Enter green zone → shop pauses world; buy items if enough gold.  
- **Inventory & Stats:** Boots increase Speed; Cloak reduces detection gain; Dagger adds Damage; Invis Potion grants ~6s invisibility; Draught heals 30 HP.  
- **Threat & Castle:** Threat visible top-left; +30 on spotted; reinforcements spawn at **50** and **100**.  
- **HUD:** Bottom panel shows Health, Detection, Gold, Stats, and 6 inventory slots.

## Local Run (optional)
```bash
python3 -m http.server 8000
# open http://localhost:8000
