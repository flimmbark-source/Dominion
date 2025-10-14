const WORLD_EVENTS = [
  {
    id: 'fae-witness',
    questId: 'world-fae-witness',
    title: 'Fae Witness',
    anchor: { x: 5760, y: 5080 },
    phases: [
      {
        id: 'investigation',
        name: 'Follow the shimmer',
        focus: { x: 5760, y: 5080 },
        radius: 360,
        autoAdvance: 'proximity',
        cues: {
          canopyGlow: { color: '#6be5f2', pulse: 4.8, radius: 220 },
          motes: { count: 18, orbitRadius: 170, color: 'rgba(173, 255, 227, 0.9)', drift: 24 },
          npcGlance: true,
          hush: { intensity: 0.55 }
        }
      },
      {
        id: 'exploration',
        name: 'Bargain with the fairy',
        focus: { x: 5920, y: 5320 },
        radius: 220,
        prompt: 'Press E to offer 6 gold to the anxious fairy.',
        cues: {
          motes: { count: 12, orbitRadius: 120, color: 'rgba(168, 255, 214, 0.85)', drift: 20 },
          barkMarks: { count: 6, arcRadius: 140, color: 'rgba(164, 235, 196, 0.8)' },
          footprints: { count: 7, radius: 110, wobble: 36 }
        },
        interaction: {
          costGold: 6,
          clue: '"Runestones hum by a twisted oak guarded by unseen eyes..."',
          successToast: 'The fairy accepts your bribe and sketches a path deeper in the grove.'
        }
      },
      {
        id: 'challenge',
        name: 'Steal the runestones',
        focus: { x: 6080, y: 5480 },
        radius: 150,
        cues: {
          runeGlow: { color: '#b57bf8', pulse: 3.6, radius: 120 },
          patrolReeds: { sway: 0.5, radius: 160 },
          hum: { intensity: 0.6 }
        },
        spawn: {
          type: 'raider',
          count: 2,
          patrolRadius: 110
        },
        poiId: 'poi-runestone-cache'
      }
    ]
  },
  {
    id: 'mire-whispers',
    questId: 'world-mire-whispers',
    title: 'Mire of Whispers',
    anchor: { x: 3120, y: 6040 },
    phases: [
      {
        id: 'investigation',
        name: 'Notice the curse',
        focus: { x: 3120, y: 6040 },
        radius: 340,
        autoAdvance: 'proximity',
        cues: {
          swampGlow: { color: '#4ee37d', pulse: 5.6, radius: 240 },
          hush: { intensity: 0.65 },
          insectsFlee: true
        }
      },
      {
        id: 'exploration',
        name: 'Trace the whispers',
        focus: { x: 3200, y: 6240 },
        radius: 240,
        cues: {
          witheredTrail: { segments: 6, spread: 90 },
          ghostSilhouettes: { count: 4, radius: 150, drift: 18 }
        },
        tasks: [
          {
            id: 'moonblossom',
            description: 'Harvest moonblossom petals from a luminous patch.',
            position: { x: 3480, y: 6400 },
            radius: 120,
            cues: {
              herbGlow: { color: '#8fffe6', radius: 80 },
              pollen: { count: 14, radius: 90 }
            }
          },
          {
            id: 'bog-idol',
            description: 'Recover a bog idol from the hag den.',
            position: { x: 2980, y: 6580 },
            radius: 120,
            cues: {
              idolLight: { color: '#9cb4ff', radius: 70 },
              clawMarks: { count: 5, arcRadius: 90 }
            }
          }
        ],
        prompt: 'Gather the moonblossom petals and hag idol indicated by the whispers.'
      },
      {
        id: 'challenge',
        name: 'Cleanse the shrine',
        focus: { x: 3200, y: 6200 },
        radius: 170,
        cues: {
          shrineChains: { count: 3, radius: 110 },
          swampGlow: { color: '#8be6c2', pulse: 3.8, radius: 150 }
        },
        poiId: 'poi-cursed-shrine-core'
      }
    ]
  },
  {
    id: 'ember-watch',
    questId: 'world-ember-watch',
    title: 'Ember Watch',
    anchor: { x: 4680, y: 3600 },
    phases: [
      {
        id: 'investigation',
        name: 'Smell the smoke',
        focus: { x: 4680, y: 3600 },
        radius: 360,
        autoAdvance: 'proximity',
        cues: {
          ashPlume: { drift: 60, spread: 160 },
          bannerWind: { strength: 0.8 },
          drums: true
        }
      },
      {
        id: 'exploration',
        name: 'Follow the trail',
        focus: { x: 4480, y: 3320 },
        radius: 240,
        cues: {
          wagonRuts: { length: 200, width: 36 },
          crateShards: { count: 8, radius: 140 }
        },
        prompt: 'Press E to study the overturned supply trail.',
        interaction: {
          clue: 'The ruts veer northwest toward hushed drums—an ambush is staged ahead.',
          successToast: 'You mark the raider trail and ready yourself for the ambush.'
        }
      },
      {
        id: 'challenge',
        name: 'Break the ambush',
        focus: { x: 4300, y: 3120 },
        radius: 190,
        cues: {
          torchGlow: { color: '#ffae62', radius: 150 },
          patrolSmoke: { count: 3, radius: 160 },
          hawks: { count: 2, radius: 130 }
        },
        spawn: {
          type: 'raider',
          count: 3,
          patrolRadius: 140
        },
        poiId: 'poi-ember-ambush'
      }
    ]
  }
];

export { WORLD_EVENTS };
