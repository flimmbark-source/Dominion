/**
 * Advanced NPC Behavior System
 * Handles schedules for villagers and formations for Dark Lord units
 */

import { state } from '../state/gameState.js';

// ==================== SCHEDULE SYSTEM ====================
// Time of day is represented as 0-24 hours

/**
 * Activity types for villagers
 */
export const ACTIVITY = {
  SLEEP: 'SLEEP',
  WAKE_UP: 'WAKE_UP',
  WORK: 'WORK',
  BREAK: 'BREAK',
  LUNCH: 'LUNCH',
  SOCIALIZE: 'SOCIALIZE',
  GUARD_DUTY: 'GUARD_DUTY',
  PRAY: 'PRAY',
  SHOP: 'SHOP',
  DINNER: 'DINNER',
  EVENING: 'EVENING',
  PATROL: 'PATROL'
};

/**
 * Schedule templates for different NPC roles
 */
export const SCHEDULE_TEMPLATES = {
  villager: [
    { startHour: 0, endHour: 7, activity: ACTIVITY.SLEEP, location: 'home' },
    { startHour: 7, endHour: 8, activity: ACTIVITY.WAKE_UP, location: 'home' },
    { startHour: 8, endHour: 12, activity: ACTIVITY.WORK, location: 'work' },
    { startHour: 12, endHour: 13, activity: ACTIVITY.LUNCH, location: 'tavern' },
    { startHour: 13, endHour: 17, activity: ACTIVITY.WORK, location: 'work' },
    { startHour: 17, endHour: 19, activity: ACTIVITY.SOCIALIZE, location: 'tavern' },
    { startHour: 19, endHour: 20, activity: ACTIVITY.DINNER, location: 'home' },
    { startHour: 20, endHour: 22, activity: ACTIVITY.EVENING, location: 'home' },
    { startHour: 22, endHour: 24, activity: ACTIVITY.SLEEP, location: 'home' }
  ],

  merchant: [
    { startHour: 0, endHour: 24, activity: ACTIVITY.WORK, location: 'shop', stationary: true }
  ],

  guard: [
    { startHour: 0, endHour: 6, activity: ACTIVITY.GUARD_DUTY, location: 'post', stationary: true },
    { startHour: 6, endHour: 7, activity: ACTIVITY.BREAK, location: 'barracks' },
    { startHour: 7, endHour: 8, activity: ACTIVITY.LUNCH, location: 'barracks' },
    { startHour: 8, endHour: 14, activity: ACTIVITY.GUARD_DUTY, location: 'post', stationary: true },
    { startHour: 14, endHour: 15, activity: ACTIVITY.BREAK, location: 'barracks' },
    { startHour: 15, endHour: 16, activity: ACTIVITY.DINNER, location: 'barracks' },
    { startHour: 16, endHour: 22, activity: ACTIVITY.GUARD_DUTY, location: 'post', stationary: true },
    { startHour: 22, endHour: 24, activity: ACTIVITY.PATROL, location: 'patrol' }
  ],

  priest: [
    { startHour: 0, endHour: 6, activity: ACTIVITY.SLEEP, location: 'home' },
    { startHour: 6, endHour: 7, activity: ACTIVITY.WAKE_UP, location: 'home' },
    { startHour: 7, endHour: 9, activity: ACTIVITY.PRAY, location: 'church' },
    { startHour: 9, endHour: 12, activity: ACTIVITY.WORK, location: 'church' },
    { startHour: 12, endHour: 13, activity: ACTIVITY.LUNCH, location: 'home' },
    { startHour: 13, endHour: 18, activity: ACTIVITY.WORK, location: 'church' },
    { startHour: 18, endHour: 19, activity: ACTIVITY.PRAY, location: 'church' },
    { startHour: 19, endHour: 20, activity: ACTIVITY.DINNER, location: 'home' },
    { startHour: 20, endHour: 22, activity: ACTIVITY.EVENING, location: 'home' },
    { startHour: 22, endHour: 24, activity: ACTIVITY.SLEEP, location: 'home' }
  ]
};

/**
 * Get current activity for an NPC based on time of day
 */
export function getCurrentActivity(npc) {
  if (!npc.schedule) return null;

  const gameTime = state.time || 0;
  const hoursPerDay = 24;
  const hour = (gameTime / 60) % hoursPerDay; // Convert game time to hours

  for (const scheduleEntry of npc.schedule) {
    if (hour >= scheduleEntry.startHour && hour < scheduleEntry.endHour) {
      return scheduleEntry;
    }
  }

  return npc.schedule[0]; // Default to first entry
}

/**
 * Initialize schedule for an NPC
 */
export function initializeSchedule(npc, role = 'villager', locations = {}) {
  const template = SCHEDULE_TEMPLATES[role] || SCHEDULE_TEMPLATES.villager;
  npc.schedule = template.map(entry => ({
    ...entry,
    location: locations[entry.location] || entry.location
  }));
  npc.scheduleRole = role;
  npc.scheduleLocations = locations;
}

// ==================== FORMATION SYSTEM ====================

/**
 * Formation types for Dark Lord units
 */
export const FORMATION = {
  PAIR: 'PAIR',           // Two guards side by side
  LINE: 'LINE',           // Guards in a line
  BOX: 'BOX',             // Four guards in a square
  WEDGE: 'WEDGE',         // V-formation
  PATROL_COLUMN: 'PATROL_COLUMN'  // Guards in a column
};

/**
 * Formation offset patterns (relative positions)
 */
const FORMATION_PATTERNS = {
  [FORMATION.PAIR]: [
    { offsetX: -20, offsetY: 0 },
    { offsetX: 20, offsetY: 0 }
  ],
  [FORMATION.LINE]: [
    { offsetX: -30, offsetY: 0 },
    { offsetX: -10, offsetY: 0 },
    { offsetX: 10, offsetY: 0 },
    { offsetX: 30, offsetY: 0 }
  ],
  [FORMATION.BOX]: [
    { offsetX: -20, offsetY: -20 },
    { offsetX: 20, offsetY: -20 },
    { offsetX: -20, offsetY: 20 },
    { offsetX: 20, offsetY: 20 }
  ],
  [FORMATION.WEDGE]: [
    { offsetX: 0, offsetY: -30 },
    { offsetX: -20, offsetY: 0 },
    { offsetX: 20, offsetY: 0 },
    { offsetX: -30, offsetY: 30 },
    { offsetX: 30, offsetY: 30 }
  ],
  [FORMATION.PATROL_COLUMN]: [
    { offsetX: 0, offsetY: -40 },
    { offsetX: 0, offsetY: -20 },
    { offsetX: 0, offsetY: 0 },
    { offsetX: 0, offsetY: 20 }
  ]
};

/**
 * Squad class - manages a group of NPCs in formation
 */
export class Squad {
  constructor(leader, members, formationType) {
    this.id = `squad_${Date.now()}_${Math.random()}`;
    this.leader = leader;
    this.members = members;
    this.formationType = formationType;
    this.formationPattern = FORMATION_PATTERNS[formationType] || FORMATION_PATTERNS[FORMATION.PAIR];
    this.waypoints = [];
    this.waypointIndex = 0;
    this.isPatrolling = true;

    // Assign formation positions to members
    this.assignFormationPositions();
  }

  assignFormationPositions() {
    this.members.forEach((member, index) => {
      const pattern = this.formationPattern[index % this.formationPattern.length];
      member.formationOffset = pattern;
      member.squadId = this.id;
      member.isSquadMember = true;
      member.squadRole = index === 0 ? 'leader' : 'member';
    });
  }

  getFormationPosition(member) {
    if (!member.formationOffset) return { x: this.leader.x, y: this.leader.y };

    // Calculate formation position based on leader's position and facing
    const leaderFacing = this.leader.facing || 0;
    const cos = Math.cos(leaderFacing);
    const sin = Math.sin(leaderFacing);

    // Rotate offset based on leader's facing direction
    const rotatedX = member.formationOffset.offsetX * cos - member.formationOffset.offsetY * sin;
    const rotatedY = member.formationOffset.offsetX * sin + member.formationOffset.offsetY * cos;

    return {
      x: this.leader.x + rotatedX,
      y: this.leader.y + rotatedY
    };
  }

  update(deltaTime) {
    // Leader follows waypoints normally
    // Members follow their formation positions relative to leader

    // Update each member's target to formation position
    this.members.forEach(member => {
      if (member === this.leader) return; // Leader uses normal waypoint system

      const formationPos = this.getFormationPosition(member);
      member.formationTarget = formationPos;
    });
  }

  setWaypoints(waypoints) {
    this.waypoints = waypoints;
    this.leader.waypoints = waypoints;
  }
}

/**
 * Squad Manager - manages all active squads
 */
class SquadManager {
  constructor() {
    this.squads = [];
  }

  createSquad(leader, members, formationType = FORMATION.PAIR) {
    const squad = new Squad(leader, members, formationType);
    this.squads.push(squad);
    return squad;
  }

  getSquad(npc) {
    return this.squads.find(squad => squad.members.includes(npc));
  }

  update(deltaTime) {
    for (const squad of this.squads) {
      squad.update(deltaTime);
    }
  }

  removeSquad(squadId) {
    const index = this.squads.findIndex(s => s.id === squadId);
    if (index !== -1) {
      // Clean up member references
      const squad = this.squads[index];
      squad.members.forEach(member => {
        member.isSquadMember = false;
        member.squadId = null;
        member.formationTarget = null;
        member.formationOffset = null;
      });
      this.squads.splice(index, 1);
    }
  }
}

export const squadManager = new SquadManager();

// ==================== SENTRY POST SYSTEM ====================

/**
 * Sentry post - a position where a guard stands watch
 */
export class SentryPost {
  constructor(x, y, facingAngle, guardType = 'scout') {
    this.x = x;
    this.y = y;
    this.facingAngle = facingAngle;
    this.guardType = guardType;
    this.assignedGuard = null;
    this.isOccupied = false;
  }

  assignGuard(npc) {
    this.assignedGuard = npc;
    this.isOccupied = true;
    npc.sentryPost = this;
    npc.isSentry = true;
    npc.waypoints = [{ x: this.x, y: this.y }];
    npc.facing = this.facingAngle;
  }

  releaseGuard() {
    if (this.assignedGuard) {
      this.assignedGuard.sentryPost = null;
      this.assignedGuard.isSentry = false;
      this.assignedGuard = null;
    }
    this.isOccupied = false;
  }
}

/**
 * Sentry Manager - manages all sentry posts
 */
class SentryManager {
  constructor() {
    this.posts = [];
  }

  createPost(x, y, facingAngle, guardType) {
    const post = new SentryPost(x, y, facingAngle, guardType);
    this.posts.push(post);
    return post;
  }

  assignGuardToPost(npc, post) {
    if (post.isOccupied) {
      console.warn('Sentry post already occupied');
      return false;
    }
    post.assignGuard(npc);
    return true;
  }

  findNearestUnoccupiedPost(x, y, guardType = null) {
    let nearest = null;
    let nearestDist = Infinity;

    for (const post of this.posts) {
      if (post.isOccupied) continue;
      if (guardType && post.guardType !== guardType) continue;

      const dist = Math.hypot(post.x - x, post.y - y);
      if (dist < nearestDist) {
        nearest = post;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  removePost(post) {
    const index = this.posts.indexOf(post);
    if (index !== -1) {
      post.releaseGuard();
      this.posts.splice(index, 1);
    }
  }
}

export const sentryManager = new SentryManager();

// ==================== HELPER FUNCTIONS ====================

/**
 * Create a patrol route between waypoints
 */
export function createPatrolRoute(waypoints, loops = true) {
  if (loops) {
    return waypoints;
  } else {
    // Back-and-forth patrol
    return [...waypoints, ...waypoints.slice(0, -1).reverse()];
  }
}

/**
 * Create a circular patrol route around a point
 */
export function createCircularPatrol(centerX, centerY, radius, numPoints = 8) {
  const waypoints = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    waypoints.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    });
  }
  return waypoints;
}

/**
 * Create a rectangular patrol route
 */
export function createRectangularPatrol(x1, y1, x2, y2) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 }
  ];
}
