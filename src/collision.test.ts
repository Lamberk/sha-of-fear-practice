import { describe, it, expect } from 'vitest'
import {
  checkPlayerHitByImplacableStrike,
  checkPlayerHitBySubmerge,
  checkPlayerInWaterspoutFountain,
} from './collision'
import type { BossAbilities, WaterspoutFountain } from './types'

describe('checkPlayerHitByImplacableStrike', () => {
  const createStrike = (
    angle: number,
    coneStartX: number = 0,
    coneStartY: number = 0
  ): BossAbilities['implacableStrike'] => ({
    nextCast: 0,
    active: true,
    duration: 3000,
    angle,
    coneStartX,
    coneStartY,
    startTime: 0,
  })

  describe('boss visibility', () => {
    it('should return false when boss is not visible', () => {
      const strike = createStrike(0)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: false,
        strike,
        playerX: 0,
        playerY: 0,
      })
      expect(result).toBe(false)
    })

    it('should check collision when boss is visible', () => {
      const strike = createStrike(0)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0,
        playerY: 0,
      })
      expect(result).toBe(true) // Player at origin, strike at origin, angle 0 = hit
    })
  })

  describe('distance checks', () => {
    it('should return false when player is too far away', () => {
      const strike = createStrike(0, 0, 0)
      // Player at distance 320 (cone length 300 + player radius 10 = 310 max)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 320,
        playerY: 0,
      })
      expect(result).toBe(false)
    })

    it('should return true when player is at maximum range', () => {
      const strike = createStrike(0, 0, 0)
      // Player at distance 310 (cone length 300 + player radius 10)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 310,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should return true when player is within range', () => {
      const strike = createStrike(0, 0, 0)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 150,
        playerY: 0,
      })
      expect(result).toBe(true)
    })
  })

  describe('angle checks', () => {
    it('should hit player directly in front of strike (0 degrees)', () => {
      const strike = createStrike(0, 0, 0) // Strike facing right (0 radians)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 100,
        playerY: 0, // Directly to the right
      })
      expect(result).toBe(true)
    })

    it('should hit player at edge of cone (30 degrees)', () => {
      const strike = createStrike(0, 0, 0) // Strike facing right
      // 30 degrees = Math.PI / 6
      const angle = Math.PI / 6
      const distance = 100
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: Math.cos(angle) * distance,
        playerY: Math.sin(angle) * distance,
      })
      expect(result).toBe(true)
    })

    it('should miss player outside cone (45 degrees)', () => {
      const strike = createStrike(0, 0, 0) // Strike facing right
      // 45 degrees = Math.PI / 4 (outside 30 degree half-angle)
      const angle = Math.PI / 4
      const distance = 100
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: Math.cos(angle) * distance,
        playerY: Math.sin(angle) * distance,
      })
      expect(result).toBe(false)
    })

    it('should hit player directly behind strike (180 degrees)', () => {
      const strike = createStrike(Math.PI, 0, 0) // Strike facing left (π radians)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: -100,
        playerY: 0, // Directly to the left
      })
      expect(result).toBe(true)
    })

    it('should hit player at 90 degrees (up)', () => {
      const strike = createStrike(Math.PI / 2, 0, 0) // Strike facing up
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0,
        playerY: 100, // Directly above
      })
      expect(result).toBe(true)
    })

    it('should handle negative angles correctly', () => {
      const strike = createStrike(-Math.PI / 2, 0, 0) // Strike facing down (-90 degrees)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0,
        playerY: -100, // Directly below
      })
      expect(result).toBe(true)
    })

    it('should handle angles wrapping around 2π', () => {
      const strike = createStrike(2 * Math.PI + 0.1, 0, 0) // Angle > 2π
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 100,
        playerY: 0,
      })
      expect(result).toBe(true) // Should normalize and hit
    })
  })

  describe('cone start position', () => {
    it('should use cone start position, not current boss position', () => {
      // Strike cast at (100, 100) but boss might have moved
      const strike = createStrike(0, 100, 100)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 200, // 100 units to the right of cone start
        playerY: 100,
      })
      expect(result).toBe(true)
    })

    it('should correctly calculate distance from cone start', () => {
      const strike = createStrike(0, 50, 50)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 250, // 200 units to the right of cone start
        playerY: 50,
      })
      expect(result).toBe(true) // Within range
    })
  })

  describe('edge cases', () => {
    it('should handle player at exact cone start position', () => {
      const strike = createStrike(0, 0, 0)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0,
        playerY: 0,
      })
      expect(result).toBe(true) // At origin, any angle should hit
    })

    it('should handle player very close to cone start position', () => {
      const strike = createStrike(Math.PI, 0, 0) // Strike facing left (180 degrees)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0.0001,
        playerY: 0.0001,
      })
      expect(result).toBe(true) // Very close to origin, should always hit
    })

    it('should hit player at cone start regardless of strike angle', () => {
      // Test with different angles to ensure angle doesn't matter when at start
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI * 2]
      angles.forEach((angle) => {
        const strike = createStrike(angle, 100, 200)
        const result = checkPlayerHitByImplacableStrike({
          bossVisible: true,
          strike,
          playerX: 100,
          playerY: 200,
        })
        expect(result).toBe(true)
      })
    })

    it('should handle very small distances', () => {
      const strike = createStrike(0, 0, 0)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 0.1,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player exactly at boundary distance', () => {
      const strike = createStrike(0, 0, 0)
      // Exactly at max range (310)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 310,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player just beyond boundary distance', () => {
      const strike = createStrike(0, 0, 0)
      // Just beyond max range (310.1)
      const result = checkPlayerHitByImplacableStrike({
        bossVisible: true,
        strike,
        playerX: 310.1,
        playerY: 0,
      })
      expect(result).toBe(false)
    })
  })
})

describe('checkPlayerHitBySubmerge', () => {
  const createSubmerge = (
    targetX: number = 0,
    targetY: number = 0,
    radius: number = 150
  ): BossAbilities['submerge'] => ({
    nextCast: 0,
    active: true,
    duration: 3000,
    targetX,
    targetY,
    radius,
    startTime: 0,
  })

  describe('distance checks', () => {
    it('should return false when player is too far away', () => {
      const submerge = createSubmerge(0, 0, 150)
      // Player at distance 161 (radius 150 + player radius 10 = 160 max)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 161,
        playerY: 0,
      })
      expect(result).toBe(false)
    })

    it('should return true when player is at maximum range', () => {
      const submerge = createSubmerge(0, 0, 150)
      // Player at distance 160 (radius 150 + player radius 10)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 160,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should return true when player is within range', () => {
      const submerge = createSubmerge(0, 0, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 100,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should return true when player is at exact center', () => {
      const submerge = createSubmerge(0, 0, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 0,
        playerY: 0,
      })
      expect(result).toBe(true)
    })
  })

  describe('position checks', () => {
    it('should hit player at different target positions', () => {
      const submerge = createSubmerge(100, 200, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 100,
        playerY: 200,
      })
      expect(result).toBe(true)
    })

    it('should hit player near target edge', () => {
      const submerge = createSubmerge(0, 0, 150)
      // Player at edge of hit distance
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 0,
        playerY: 160,
      })
      expect(result).toBe(true)
    })

    it('should miss player just outside hit distance', () => {
      const submerge = createSubmerge(0, 0, 150)
      // Player just outside
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 0,
        playerY: 160.1,
      })
      expect(result).toBe(false)
    })

    it('should handle negative coordinates', () => {
      const submerge = createSubmerge(-100, -100, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: -100,
        playerY: -100,
      })
      expect(result).toBe(true)
    })
  })

  describe('radius variations', () => {
    it('should work with different submerge radii', () => {
      const submerge = createSubmerge(0, 0, 200)
      // Player at distance 210 (radius 200 + player radius 10)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 210,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should work with smaller radii', () => {
      const submerge = createSubmerge(0, 0, 50)
      // Player at distance 60 (radius 50 + player radius 10)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 60,
        playerY: 0,
      })
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle very small distances', () => {
      const submerge = createSubmerge(0, 0, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 0.1,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player exactly at boundary', () => {
      const submerge = createSubmerge(0, 0, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 160,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player just beyond boundary', () => {
      const submerge = createSubmerge(0, 0, 150)
      const result = checkPlayerHitBySubmerge({
        submerge,
        playerX: 160.1,
        playerY: 0,
      })
      expect(result).toBe(false)
    })
  })
})

describe('checkPlayerInWaterspoutFountain', () => {
  const createFountain = (
    x: number = 0,
    y: number = 0,
    radius: number = 13
  ): WaterspoutFountain => ({
    id: 0,
    x,
    y,
    spawnTime: 0,
    radius,
    playerTimeInFountain: 0,
  })

  describe('distance checks', () => {
    it('should return false when player is too far away', () => {
      const fountain = createFountain(0, 0, 13)
      // Player at distance 24 (radius 13 + player radius 10 = 23 max)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 24,
        playerY: 0,
      })
      expect(result).toBe(false)
    })

    it('should return true when player is at maximum range', () => {
      const fountain = createFountain(0, 0, 13)
      // Player at distance 23 (radius 13 + player radius 10)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 23,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should return true when player is within range', () => {
      const fountain = createFountain(0, 0, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 10,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should return true when player is at exact center', () => {
      const fountain = createFountain(0, 0, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 0,
        playerY: 0,
      })
      expect(result).toBe(true)
    })
  })

  describe('position checks', () => {
    it('should detect player at different fountain positions', () => {
      const fountain = createFountain(100, 200, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 100,
        playerY: 200,
      })
      expect(result).toBe(true)
    })

    it('should detect player near fountain edge', () => {
      const fountain = createFountain(0, 0, 13)
      // Player at edge of hit distance
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 0,
        playerY: 23,
      })
      expect(result).toBe(true)
    })

    it('should miss player just outside hit distance', () => {
      const fountain = createFountain(0, 0, 13)
      // Player just outside
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 0,
        playerY: 23.1,
      })
      expect(result).toBe(false)
    })

    it('should handle negative coordinates', () => {
      const fountain = createFountain(-50, -50, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: -50,
        playerY: -50,
      })
      expect(result).toBe(true)
    })
  })

  describe('radius variations', () => {
    it('should work with different fountain radii', () => {
      const fountain = createFountain(0, 0, 20)
      // Player at distance 30 (radius 20 + player radius 10)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 30,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should work with smaller radii', () => {
      const fountain = createFountain(0, 0, 5)
      // Player at distance 15 (radius 5 + player radius 10)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 15,
        playerY: 0,
      })
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle very small distances', () => {
      const fountain = createFountain(0, 0, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 0.1,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player exactly at boundary', () => {
      const fountain = createFountain(0, 0, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 23,
        playerY: 0,
      })
      expect(result).toBe(true)
    })

    it('should handle player just beyond boundary', () => {
      const fountain = createFountain(0, 0, 13)
      const result = checkPlayerInWaterspoutFountain({
        fountain,
        playerX: 23.1,
        playerY: 0,
      })
      expect(result).toBe(false)
    })

    it('should handle multiple fountains independently', () => {
      const fountain1 = createFountain(0, 0, 13)
      const fountain2 = createFountain(100, 100, 13)
      
      const result1 = checkPlayerInWaterspoutFountain({
        fountain: fountain1,
        playerX: 0,
        playerY: 0,
      })
      const result2 = checkPlayerInWaterspoutFountain({
        fountain: fountain2,
        playerX: 0,
        playerY: 0,
      })
      
      expect(result1).toBe(true)
      expect(result2).toBe(false)
    })
  })
})

