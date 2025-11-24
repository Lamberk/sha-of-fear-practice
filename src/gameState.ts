/**
 * Game state management
 */

import { GAME_CONFIG, PLAYER_CONFIG } from './constants'
import type { GameState, DummyPlayer } from './types'

export function createInitialGameState(): GameState {
  return {
    phase: 'menu',
    elapsedMs: 0,
    huddleActive: false,
    timeRemaining: 0,
    timeToNextHuddle: 1500,
    huddleSequence: [],
    currentHolderId: null,
    currentOrderIndex: -1,
    nextTargetId: null,
    hoverTargetId: null,
    botPassTimeout: null,
    playerX: 400,
    playerY: 300,
    keysPressed: new Set(),
    bossAbilities: {
      waterspout: {
        nextCast: 3000,
        active: false,
        duration: 0,
        castPlayerX: 0,
        castPlayerY: 0,
        castTime: 0,
      },
      submerge: {
        nextCast: 5000,
        active: false,
        duration: 0,
        targetX: 0,
        targetY: 0,
        radius: GAME_CONFIG.SUBMERGE_RADIUS,
        startTime: 0,
      },
      implacableStrike: {
        nextCast: 7000,
        active: false,
        duration: 0,
        angle: 0,
        coneStartX: 0,
        coneStartY: 0,
        startTime: 0,
      },
    },
    bossAngle: 0,
    bossX: 0,
    bossY: 0,
    bossVisible: true,
    dummyPlayers: [],
    lastAbilityEndTime: 0,
    adds: [],
    addSpawnCount: 0,
    lastAddSpawnTime: 0,
    playerRole: null,
    ballHandlers: [],
    ballHandlerPassCount: 0,
    lastBallHandlerPass: [null, null],
    waterspoutFountains: [],
  }
}

export function createDummyPlayers(
  canvasWidth: number,
  canvasHeight: number,
  raiderNames: string[]
): DummyPlayer[] {
  const dummies: DummyPlayer[] = []
  const margin = 80
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2
  const minDistFromCenter = 60

  let id = 0
  let attempts = 0
  const maxAttempts = 500

  while (dummies.length < 24 && attempts < maxAttempts) {
    attempts++

    const x = margin + Math.random() * (canvasWidth - 2 * margin)
    const y = margin + Math.random() * (canvasHeight - 2 * margin)

    const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
    if (distFromCenter < minDistFromCenter) continue

    let tooClose = false
    for (const dummy of dummies) {
      const dist = Math.sqrt((x - dummy.x) ** 2 + (y - dummy.y) ** 2)
      if (dist < 40) {
        tooClose = true
        break
      }
    }
    if (tooClose) continue

    const raiderIndex = (id + (id >= PLAYER_CONFIG.SLOT ? 1 : 0)) % GAME_CONFIG.RAID_SIZE
    const name = raiderNames[raiderIndex] ?? `Dummy ${id + 1}`

    dummies.push({
      id: id++,
      name,
      x,
      y,
      hasBall: false,
      isDead: false,
      raiderId: raiderIndex,
      deathRolledForSubmerge: false,
      deathRolledForStrike: false,
    })
  }

  return dummies
}

export function resetGameState(state: GameState, canvasWidth: number, canvasHeight: number): void {
  state.phase = 'menu'
  state.elapsedMs = 0
  state.huddleActive = false
  state.timeRemaining = 0
  state.timeToNextHuddle = 1500
  state.huddleSequence = []
  state.currentHolderId = null
  state.currentOrderIndex = -1
  state.nextTargetId = null
  state.hoverTargetId = null
  state.botPassTimeout = null
  state.playerX = canvasWidth / 2
  state.playerY = canvasHeight / 2
  state.keysPressed.clear()
  state.bossAbilities.waterspout = {
    nextCast: 3000,
    active: false,
    duration: 0,
    castPlayerX: 0,
    castPlayerY: 0,
    castTime: 0,
  }
  state.bossAbilities.submerge = {
    nextCast: 5000,
    active: false,
    duration: 0,
    targetX: 0,
    targetY: 0,
    radius: GAME_CONFIG.SUBMERGE_RADIUS,
    startTime: 0,
  }
  state.bossAbilities.implacableStrike = {
    nextCast: 7000,
    active: false,
    duration: 0,
    angle: 0,
    coneStartX: 0,
    coneStartY: 0,
    startTime: 0,
  }
  state.bossAngle = 0
  state.bossX = canvasWidth / 2
  state.bossY = canvasHeight / 2
  state.bossVisible = true
  state.lastAbilityEndTime = 0
  state.adds = []
  state.addSpawnCount = 0
  state.lastAddSpawnTime = 0
  state.playerRole = null
  state.ballHandlers = []
  state.ballHandlerPassCount = 0
  state.lastBallHandlerPass = [null, null]
  state.waterspoutFountains = []

  // Revive all dummy players
  state.dummyPlayers.forEach((dummy) => {
    dummy.isDead = false
    dummy.hasBall = false
    dummy.deathRolledForSubmerge = false
    dummy.deathRolledForStrike = false
  })
}

