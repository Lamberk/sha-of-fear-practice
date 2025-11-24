/**
 * Collision detection functions for boss abilities
 */

import type { BossAbilities, WaterspoutFountain } from './types'

const PLAYER_RADIUS = 10
const CONE_LENGTH = 300
const CONE_ANGLE = Math.PI / 3 // 60 degrees

interface StrikeHitParams {
  bossVisible: boolean
  strike: BossAbilities['implacableStrike']
  playerX: number
  playerY: number
}

interface SubmergeHitParams {
  submerge: BossAbilities['submerge']
  playerX: number
  playerY: number
}

interface WaterspoutHitParams {
  fountain: WaterspoutFountain
  playerX: number
  playerY: number
}

/**
 * Check if player is hit by Implacable Strike cone
 * @param params - Strike hit detection parameters
 * @returns true if player is hit, false otherwise
 */
export function checkPlayerHitByImplacableStrike(params: StrikeHitParams): boolean {
  const { bossVisible, strike, playerX, playerY } = params
  
  if (!bossVisible) return false // Boss must be visible for strike to hit
  
  const coneStartX = strike.coneStartX
  const coneStartY = strike.coneStartY
  
  // Vector from cone start to player
  const dx = playerX - coneStartX
  const dy = playerY - coneStartY
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Check if player is within cone range (including player radius)
  if (distance > CONE_LENGTH + PLAYER_RADIUS) {
    return false
  }
  
  // If player is at or very close to cone start position, they are always hit
  // (angle is undefined/ambiguous when distance is 0)
  if (distance < 0.001) {
    return true
  }
  
  // Calculate angle from cone start to player
  const angleToPlayer = Math.atan2(dy, dx)
  
  // Normalize angles to [0, 2π]
  let bossAngle = strike.angle
  while (bossAngle < 0) bossAngle += Math.PI * 2
  while (bossAngle >= Math.PI * 2) bossAngle -= Math.PI * 2
  let playerAngle = angleToPlayer
  while (playerAngle < 0) playerAngle += Math.PI * 2
  while (playerAngle >= Math.PI * 2) playerAngle += Math.PI * 2
  
  // Calculate angle difference (shortest path around circle)
  let angleDiff = Math.abs(playerAngle - bossAngle)
  if (angleDiff > Math.PI) {
    angleDiff = Math.PI * 2 - angleDiff
  }
  
  // Check if player is within cone angle (half cone angle on each side)
  const halfConeAngle = CONE_ANGLE / 2
  return angleDiff <= halfConeAngle
}

/**
 * Check if player is hit by Submerge
 * @param params - Submerge hit detection parameters
 * @returns true if player is hit, false otherwise
 */
export function checkPlayerHitBySubmerge(params: SubmergeHitParams): boolean {
  const { submerge, playerX, playerY } = params
  
  const dx = playerX - submerge.targetX
  const dy = playerY - submerge.targetY
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Damage circle radius
  const damageRadius = submerge.radius
  
  // Player is hit if distance from centers <= (damageRadius + playerRadius)
  const hitDistance = damageRadius + PLAYER_RADIUS
  
  return distance <= hitDistance
}

/**
 * Check if player is in a waterspout fountain
 * @param params - Waterspout hit detection parameters
 * @returns true if player is in the fountain, false otherwise
 */
export function checkPlayerInWaterspoutFountain(params: WaterspoutHitParams): boolean {
  const { fountain, playerX, playerY } = params
  
  const dx = playerX - fountain.x
  const dy = playerY - fountain.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Player is in fountain if distance from centers <= (fountain.radius + playerRadius)
  const hitDistance = fountain.radius + PLAYER_RADIUS
  
  return distance <= hitDistance
}

