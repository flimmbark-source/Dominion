/**
 * NPC Behavior Setup
 * Initialize schedules, formations, and sentry posts for NPCs
 */

import { state } from '../state/gameState.js';
import {
  squadManager,
  sentryManager,
  initializeSchedule,
  createPatrolRoute,
  createCircularPatrol,
  createRectangularPatrol,
  FORMATION,
  SCHEDULE_TEMPLATES
} from './npcBehavior.js';

/**
 * Setup behaviors for all existing NPCs
 * Call this after setupInitialNPCs() to organize NPCs
 */
export function setupNPCBehaviors() {
  setupVillageNPCBehaviors();
  setupDarkLordBehaviors();
}

/**
 * Setup schedules and patrols for village NPCs
 */
function setupVillageNPCBehaviors() {
  const villageNPCs = state.npcs.filter(npc => npc.faction === 'village');

  for (const npc of villageNPCs) {
    // Assign schedules based on NPC type
    switch (npc.type) {
      case 'villager':
        setupVillagerSchedule(npc);
        break;
      case 'merchant':
        setupMerchantBehavior(npc);
        break;
      case 'scout':
      case 'militia':
        setupVillageGuardBehavior(npc);
        break;
      case 'priest':
        setupPriestSchedule(npc);
        break;
      default:
        // Default villager behavior
        setupVillagerSchedule(npc);
    }
  }
}

/**
 * Setup schedule for regular villagers
 */
function setupVillagerSchedule(npc) {
  // For now, give villagers a simple daily routine
  // In a full implementation, you'd define specific locations for home, work, tavern

  const locations = {
    home: npc.waypoints[0] || { x: npc.x, y: npc.y },
    work: npc.waypoints[1] || npc.waypoints[0] || { x: npc.x, y: npc.y },
    tavern: npc.waypoints[2] || npc.waypoints[0] || { x: npc.x, y: npc.y }
  };

  initializeSchedule(npc, 'villager', locations);

  // Make patrol more purposeful - villagers walk between key locations
  if (npc.waypoints.length < 3) {
    npc.waypoints = [locations.home, locations.work, locations.tavern];
  }
}

/**
 * Setup merchant to stay at their shop
 */
function setupMerchantBehavior(npc) {
  const shopLocation = { x: npc.x, y: npc.y };

  initializeSchedule(npc, 'merchant', {
    shop: shopLocation
  });

  // Merchants are stationary
  npc.waypoints = [shopLocation];
  npc.speed = 0;
  npc.stationary = true;
}

/**
 * Setup priest schedule
 */
function setupPriestSchedule(npc) {
  // Priests spend most time at church
  const churchLocation = npc.waypoints[0] || { x: npc.x, y: npc.y };
  const homeLocation = npc.waypoints[1] || churchLocation;

  initializeSchedule(npc, 'priest', {
    church: churchLocation,
    home: homeLocation
  });

  npc.waypoints = [churchLocation, homeLocation];
}

/**
 * Setup village guard behavior (scouts and militia)
 */
function setupVillageGuardBehavior(npc) {
  // Guards patrol key areas and have sentry posts

  // If guard has 1-2 waypoints, make them a sentry
  if (npc.waypoints.length <= 2) {
    const postLocation = npc.waypoints[0] || { x: npc.x, y: npc.y };

    // Face towards village center (or just face down)
    const facingAngle = Math.PI / 2; // Face down

    const post = sentryManager.createPost(
      postLocation.x,
      postLocation.y,
      facingAngle,
      npc.type
    );

    sentryManager.assignGuardToPost(npc, post);

    // Give guard a schedule with guard duty
    const barracksLocation = npc.waypoints[1] || postLocation;
    initializeSchedule(npc, 'guard', {
      post: postLocation,
      barracks: barracksLocation,
      patrol: postLocation
    });
  } else {
    // Multiple waypoints - this is a patrol guard
    // Keep their existing waypoints but give them a schedule
    const patrolRoute = npc.waypoints;
    const barracksLocation = patrolRoute[0];

    initializeSchedule(npc, 'guard', {
      post: patrolRoute[0],
      barracks: barracksLocation,
      patrol: patrolRoute[0]
    });
  }
}

/**
 * Setup formations and organized patrols for Dark Lord NPCs
 */
function setupDarkLordBehaviors() {
  const darkLordNPCs = state.npcs.filter(npc => npc.faction === 'darkLord');

  // Group nearby Dark Lord NPCs into squads
  const unassigned = [...darkLordNPCs];

  while (unassigned.length >= 2) {
    const leader = unassigned.shift();
    const nearby = [];

    // Find nearby NPCs to form a squad
    for (let i = unassigned.length - 1; i >= 0; i--) {
      const npc = unassigned[i];
      const dist = Math.hypot(npc.x - leader.x, npc.y - leader.y);

      // Group NPCs within 100 pixels of each other
      if (dist < 100) {
        nearby.push(npc);
        unassigned.splice(i, 1);

        // Limit squad size
        if (nearby.length >= 3) break; // Max 4 NPCs per squad (leader + 3)
      }
    }

    if (nearby.length > 0) {
      // Create squad with appropriate formation
      const squadMembers = [leader, ...nearby];
      const formationType = squadMembers.length === 2 ? FORMATION.PAIR :
                           squadMembers.length === 3 ? FORMATION.LINE :
                           FORMATION.BOX;

      const squad = squadManager.createSquad(leader, squadMembers, formationType);

      // Give squad a patrol route
      if (leader.waypoints.length > 0) {
        squad.setWaypoints(leader.waypoints);
      } else {
        // Create a default circular patrol
        const patrolRoute = createCircularPatrol(leader.x, leader.y, 80, 6);
        squad.setWaypoints(patrolRoute);
      }
    }
  }

  // Remaining solo NPCs become sentries
  for (const npc of unassigned) {
    const facingAngle = npc.facing || 0;
    const post = sentryManager.createPost(npc.x, npc.y, facingAngle, npc.type);
    sentryManager.assignGuardToPost(npc, post);
  }
}

/**
 * Organize specific castle guards into formations
 */
export function setupCastleGuards(castleX, castleY, guards) {
  if (guards.length < 2) return;

  // Create gate sentries (2 guards at entrance)
  if (guards.length >= 2) {
    const gateFacing = Math.PI / 2; // Face outward
    const leftPost = sentryManager.createPost(castleX - 30, castleY, gateFacing, guards[0].type);
    const rightPost = sentryManager.createPost(castleX + 30, castleY, gateFacing, guards[1].type);

    sentryManager.assignGuardToPost(guards[0], leftPost);
    sentryManager.assignGuardToPost(guards[1], rightPost);
  }

  // Create wall patrol (remaining guards in formation)
  if (guards.length > 2) {
    const patrolGuards = guards.slice(2);
    const leader = patrolGuards[0];

    // Create rectangular patrol around castle
    const patrolRoute = createRectangularPatrol(
      castleX - 80,
      castleY - 80,
      castleX + 80,
      castleY + 80
    );

    const squad = squadManager.createSquad(leader, patrolGuards, FORMATION.PATROL_COLUMN);
    squad.setWaypoints(patrolRoute);
  }
}

/**
 * Create a patrol squad manually
 */
export function createPatrolSquad(npcs, formationType = FORMATION.PAIR, waypoints = null) {
  if (npcs.length < 2) {
    console.warn('Need at least 2 NPCs for a squad');
    return null;
  }

  const squad = squadManager.createSquad(npcs[0], npcs, formationType);

  if (waypoints) {
    squad.setWaypoints(waypoints);
  }

  return squad;
}
