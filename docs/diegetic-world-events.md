# Diegetic World Events Visual Language

This guide defines how to surface emerging world events and "natural quests" through in-world signals rather than HUD icons. The goal is to reward attentive players while keeping the sandbox grounded and readable.

## Core Principles
- **Layered readability:** Each event broadcasts an initial "wide" signal (light, motion, or ambient audio) that becomes more specific as the player draws closer, culminating in interactable detail decals or animations.
- **Contextual consistency:** Reuse motifs so players learn the language: cool-toned light or drifting motes = fae activity, guttering green flames = necrotic corruption, wind-blown pennants = militant presence.
- **Responsive world state:** Events update their cues as steps progress (e.g., a fairy trail dims once followed, shrine whispers intensify before the climax) so players feel their actions matter.
- **360° discoverability:** Favor cues that read from multiple approach angles—tree canopies, volumetric fog, NPC gaze direction—rather than single billboards.

## Cue Palette
| Motif | Usage | Implementation Notes |
| --- | --- | --- |
| **Light & Particles** | Subtle glows, motes, lantern cones telegraph magic or safe spaces. | Use low-opacity bloom that pulses every 4–6 seconds; particles accelerate slightly when the player faces the source. |
| **Soundscapes** | Spatial audio hints—wind chimes, whispers, insect silence. | Blend with swamp ambience; cross-fade in within a 25 m radius to avoid harsh transitions. |
| **Environmental Disturbance** | Footprints, bent reeds, drifting pollen. | Spawn decals procedurally along spline paths so clues persist after reload. |
| **Fauna Behavior** | Birds flushing, fireflies orbiting points of interest. | Tie to AI perception; critters should look toward the event before moving. |
| **NPC Body Language** | Villagers pointing, guards tightening formation. | Trigger short barks or emotes when the player is near but has not yet spotted the event. |

## Event Template
Every dynamic event follows a three-phase arc so players naturally escalate from curiosity to challenge:

1. **Investigation** – The broad cue draws the player across long distances (glows, drifting fog, a sudden hush in the swamp).
2. **Exploration** – Mid-range signals (tracks, animated foliage, NPC murmurs) narrow the search to a small pocket of space.
3. **Challenge / Resolution** – Close-range interactables and AI setups create the gameplay moment (stealth routes, combat arena, dialogue prompt). Rewards and world state updates fire here.

## Event Walkthroughs

### Fae Witness: Runestone Pursuit
- **Investigation:**
  - A soft turquoise bloom pulses through treetops while firefly clusters drift along a loose trail. The goblin can spot this from the village palisade at dusk.
  - Ambient audio layers in airy bells; nearby NPCs pause to look toward the light.
- **Exploration:**
  - Entering the grove reveals motes of light brushing against bark, leaving phosphorescent fingerprints that point deeper in.
  - Scattered boot prints (tiny, splayed toes) and scuffed moss indicate a fairy struggling against the underbrush, guiding the player to a hollow.
- **Challenge:**
  - The fairy hovers behind a root arch. Dialogue offers bribery, trickery, or intimidation, each giving a cryptic clue ("Runestones hum by the twisted oak watched by unseen eyes...").
  - Following the clue, the player searches for an oak whose branches knot like grasping hands; faint vibrations in the controller and a low hum confirm proximity.
  - A Dark scout patrol circles the stones. Players can sneak through reeds highlighted by gently swaying fronds or confront the patrol outright.
  - Interacting with the runestones dispels the glow trail and logs new intel in the quest journal.

### Mire of Whispers: Cursed Shrine Cleanse
- **Investigation:**
  - From the boardwalk, an eerie green shimmer seeps through fog. Dragonflies avoid the zone, leaving a noticeable quiet patch in the soundscape.
  - NPCs mutter about "the swamp breathing wrong" when the player stands nearby.
- **Exploration:**
  - Within the shimmer, clusters of withered cattails create a rough breadcrumb trail. Occasional ghost silhouettes flicker, pointing toward the shrine.
  - Dead wildlife lies beside the path; flies freeze mid-air, resuming motion once the player steps beyond the cursed border.
- **Challenge:**
  - At the shrine, spectral chains coil around an idol. Touching it spawns a defensive ward—rotating beams of sickly light that the goblin must dodge.
  - To lift the curse, the player must acquire moonblossom petals and a bog idol from a nearby hag den. Those sites glow with softer teal light and distant chanting.
  - Delivering the items triggers a banishment animation; the green light clears, and the swamp ambience returns with a hopeful swell.

### Ember Watch: Supply Ambush
- **Investigation:**
  - Plumes of ash drift across the road while distant drums echo—subtle enough to blend with ambient war activity.
  - Banners along the palisade strain in a consistent direction, hinting at nearby troop movement.
- **Exploration:**
  - Wagon ruts veer off the main road, accompanied by broken crate planks that glint in the mud.
  - A nervous merchant paces near Moonfen’s gate, occasionally glancing toward smoke columns.
- **Challenge:**
  - Following the ruts leads to an ambush site where Dark raiders are looting supplies. Guards patrol on a predictable loop, with torchlight briefly illuminating a stealth path through bracken.
  - Players choose to spring a surprise attack, snipe from high ground (flagged by perched hawks), or sabotage the raiders’ powder kegs (marked by faint sulfur sparks).
  - Success redirects the supply wagon to Moonfen, lowering local threat and unlocking discounted goods for a day-night cycle.

## Playtest Checklist
- Observe from multiple approach vectors to ensure primary cues read at range.
- Verify that mid-range breadcrumbs are neither too dense nor too sparse; players should spend ~30–60 seconds in the exploration phase.
- Confirm that NPC barks and animations trigger once per visit to avoid repetition fatigue.
- Adjust lighting intensity for night vs. day readability without breaking stealth-friendly darkness.

Reinforcing these patterns across events teaches players to trust in-world signals, keeping Dominion’s quests discoverable without resorting to explicit HUD markers.
