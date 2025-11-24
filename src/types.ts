/**
 * Type definitions for Sha of Fear Drill game
 */

export type GamePhase = 'menu' | 'running' | 'game_over'

export type PlayerRole = 'regular' | 'ball_handler'

export interface Raider {
  id: number
  name: string
  element: HTMLDivElement
  badge: HTMLSpanElement
  isPlayer: boolean
  isHuddled: boolean
  isRescued: boolean
  hasBall: boolean
  huddleOrder: number | null
}

export interface DummyPlayer {
  id: number
  name: string
  x: number
  y: number
  hasBall: boolean
  isDead: boolean
  raiderId: number | null // Link to raider element (for raid frame updates)
  deathRolledForSubmerge: boolean // Track if we've already rolled death for current submerge
  deathRolledForStrike: boolean // Track if we've already rolled death for current strike
}

export interface Add {
  id: number
  x: number
  y: number
  pausedUntil: number // Timestamp when pause ends (0 = not paused)
  speed: number // Current speed (reduced after each pass)
}

export interface WaterspoutFountain {
  id: number
  x: number
  y: number
  spawnTime: number // When this fountain spawned
  radius: number // Radius of the fountain
  playerTimeInFountain: number // How long player has been in this fountain (in ms)
}

export interface BossAbilities {
  waterspout: {
    nextCast: number
    active: boolean
    duration: number
    castPlayerX?: number
    castPlayerY?: number
    castTime?: number
  }
  submerge: {
    nextCast: number
    active: boolean
    duration: number
    targetX: number
    targetY: number
    radius: number
    startTime: number
  }
  implacableStrike: {
    nextCast: number
    active: boolean
    duration: number
    angle: number
    coneStartX: number
    coneStartY: number
    startTime: number
  }
}

export interface GameState {
  phase: GamePhase
  elapsedMs: number
  huddleActive: boolean
  timeRemaining: number
  timeToNextHuddle: number
  huddleSequence: number[]
  currentHolderId: number | null
  currentOrderIndex: number
  nextTargetId: number | null
  hoverTargetId: number | null
  botPassTimeout: number | null
  playerX: number // Player X coordinate (always use state.playerX)
  playerY: number // Player Y coordinate (always use state.playerY)
  keysPressed: Set<string>
  bossAbilities: BossAbilities
  bossAngle: number // Direction boss is facing (in radians)
  bossX: number // Boss X position
  bossY: number // Boss Y position
  bossVisible: boolean // Whether boss is visible (hidden during submerge)
  dummyPlayers: DummyPlayer[]
  lastAbilityEndTime: number // Track when last ability ended for queue delay
  adds: Add[]
  addSpawnCount: number // Counter for add spawns (1st = 1 add, 2nd = 2 adds, etc.)
  lastAddSpawnTime: number // Track when adds were last spawned (for 30s interval)
  playerRole: PlayerRole | null
  ballHandlers: number[] // IDs of ball handlers (raider IDs)
  ballHandlerPassCount: number // Count of passes between two ball handlers
  lastBallHandlerPass: [number | null, number | null] // Track last two handlers who passed
  waterspoutFountains: WaterspoutFountain[]
}

export interface HoveredRaider {
  name: string
  x: number
  y: number
}

