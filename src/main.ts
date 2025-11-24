import './style.css'
import type {
  PlayerRole,
  WaterspoutFountain,
} from './types'
import {
  GAME_CONFIG,
  PLAYER_CONFIG,
  ROSTER_NAMES,
} from './constants'
import { DOMManager, StorageManager, createRaiders } from './dom'
import { createInitialGameState, createDummyPlayers } from './gameState'

// Initialize DOM manager (this sets up all HTML)
const domManager = new DOMManager()

// Get DOM elements
const raidGrid = domManager.getRaidGrid()
const gamePanel = domManager.getGamePanel()
const gameCanvas = domManager.getGameCanvas()
const ctx = domManager.getCanvasContext()
const restartBtn = domManager.getRestartButton()
const startMenuEl = domManager.getStartMenuElement()
const roleButtons = domManager.getRoleButtons()

// Create raiders
const raiders = createRaiders(raidGrid)
const playerId = PLAYER_CONFIG.SLOT
const playerName = PLAYER_CONFIG.NAME

// Prepare raider names for dummy players
const raiderNames = [...ROSTER_NAMES] as string[]
raiderNames.splice(PLAYER_CONFIG.SLOT, 0, PLAYER_CONFIG.NAME)
if (raiderNames.length > GAME_CONFIG.RAID_SIZE) {
  raiderNames.length = GAME_CONFIG.RAID_SIZE
}

// Initialize game state (must be before event listeners that use it)
const state = createInitialGameState()

// Add event listeners to raiders
for (let i = 0; i < raiders.length; i++) {
  const raider = raiders[i]
  raider.element.addEventListener('pointerenter', () => {
    state.hoverTargetId = i
    updateRaiders()
  })

  raider.element.addEventListener('pointerleave', () => {
    if (state.hoverTargetId === i) {
      state.hoverTargetId = null
      updateRaiders()
    }
  })
}

// HTML setup is handled by DOMManager constructor

// Load tries from localStorage
let tries = StorageManager.loadTries()
domManager.updateTries(tries)

// Setup canvas resize function
let resizeCanvas: () => void

// Setup canvas resize function (after state is initialized)
resizeCanvas = () => {
  const rect = gamePanel.getBoundingClientRect()
  gameCanvas.width = rect.width
  gameCanvas.height = rect.height
  
  // Initialize player position to center if still at default values
  // All player coordinates are stored in state.playerX and state.playerY
  if (state.playerX === 400 && state.playerY === 300) {
    state.playerX = gameCanvas.width / 2
    state.playerY = gameCanvas.height / 2
  } else {
    // If player has moved, clamp position to new canvas bounds
    const playerRadius = 10
    state.playerX = Math.max(playerRadius, Math.min(gameCanvas.width - playerRadius, state.playerX))
    state.playerY = Math.max(playerRadius, Math.min(gameCanvas.height - playerRadius, state.playerY))
  }
  
  // Initialize boss position to center
  state.bossX = gameCanvas.width / 2
  state.bossY = gameCanvas.height / 2
  // Initialize dummy players
  state.dummyPlayers = createDummyPlayers(gameCanvas.width, gameCanvas.height, raiderNames)
}
resizeCanvas()
window.addEventListener('resize', resizeCanvas)

// Canvas hover detection for tooltips
let canvasMouseX = 0
let canvasMouseY = 0

gameCanvas.addEventListener('mousemove', (event) => {
  const rect = gameCanvas.getBoundingClientRect()
  canvasMouseX = event.clientX - rect.left
  canvasMouseY = event.clientY - rect.top
  
  // Check if mouse is over player
  const playerRadius = 10
  const distToPlayer = Math.sqrt((canvasMouseX - state.playerX) ** 2 + (canvasMouseY - state.playerY) ** 2)
  if (distToPlayer < playerRadius + 5) {
    hoveredRaider = { name: playerName, x: state.playerX, y: state.playerY }
    return
  }
  
  // Check if mouse is over any dummy player
  hoveredRaider = null
  for (const dummy of state.dummyPlayers) {
    if (dummy.isDead) continue
    const dummyRadius = 8
    const distToDummy = Math.sqrt((canvasMouseX - dummy.x) ** 2 + (canvasMouseY - dummy.y) ** 2)
    if (distToDummy < dummyRadius + 5) {
      hoveredRaider = { name: dummy.name, x: dummy.x, y: dummy.y }
      break
    }
  }
})

gameCanvas.addEventListener('mouseleave', () => {
  hoveredRaider = null
})

restartBtn.addEventListener('click', () => restartGame())

// Role selection handlers
// startMenuEl and roleButtons are already declared above from domManager

roleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const role = btn.getAttribute('data-role') as PlayerRole
    startGame(role)
  })
})

window.addEventListener('keydown', (event) => {
  if (event.key === '1' || event.code === 'Digit1' || event.code === 'Numpad1') {
    event.preventDefault()
    attemptPass()
  }

  if (event.key.toLowerCase() === 'r') {
    event.preventDefault()
    if (state.phase === 'game_over') {
      restartGame()
    }
  }

  // Phase 2: WASD movement only
  const key = event.key.toLowerCase()
  if (!state.keysPressed.has(key)) {
    state.keysPressed.add(key)
  }
})

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase()
  state.keysPressed.delete(key)
})

function pickHuddleTargets(): number[] {
  // Get all alive raider IDs (exclude raiders linked to dead dummy players)
  const aliveRaiderIds: number[] = []
  for (let i = 0; i < GAME_CONFIG.RAID_SIZE; i++) {
    // Check if this raider is linked to a dead dummy player
    const linkedDummy = state.dummyPlayers.find(d => d.raiderId === i && d.isDead)
    if (!linkedDummy) {
      aliveRaiderIds.push(i)
    }
  }
  
  // If not enough alive raiders, use all raiders (shouldn't happen, but safety check)
  if (aliveRaiderIds.length < GAME_CONFIG.HUDDLE_SIZE) {
    console.warn('[huddle] Not enough alive raiders, using all raiders')
    aliveRaiderIds.length = 0
    for (let i = 0; i < GAME_CONFIG.RAID_SIZE; i++) {
      aliveRaiderIds.push(i)
    }
  }
  
  const ids = new Set<number>([playerId])

  while (ids.size < GAME_CONFIG.HUDDLE_SIZE) {
    const randomIndex = Math.floor(Math.random() * aliveRaiderIds.length)
    ids.add(aliveRaiderIds[randomIndex])
  }

  return Array.from(ids)
}

function startHuddle() {
  clearBotPass()
  state.huddleActive = true
  state.timeRemaining = GAME_CONFIG.HUDDLE_DURATION_MS
  state.timeToNextHuddle = 0
  state.huddleSequence = pickHuddleTargets().sort(() => Math.random() - 0.5)
  
  // Remove current ball holder from huddle sequence (they need to pass, not receive)
  if (state.currentHolderId !== null) {
    const holderIndex = state.huddleSequence.indexOf(state.currentHolderId)
    if (holderIndex !== -1) {
      state.huddleSequence.splice(holderIndex, 1)
      // If we removed someone, we need to ensure we still have HUDDLE_SIZE targets
      // Pick a replacement if needed
      if (state.huddleSequence.length < GAME_CONFIG.HUDDLE_SIZE) {
        const aliveRaiderIds: number[] = []
        for (let i = 0; i < GAME_CONFIG.RAID_SIZE; i++) {
          const linkedDummy = state.dummyPlayers.find(d => d.raiderId === i && d.isDead)
          if (!linkedDummy && i !== state.currentHolderId && !state.huddleSequence.includes(i)) {
            aliveRaiderIds.push(i)
          }
        }
        if (aliveRaiderIds.length > 0) {
          const replacement = aliveRaiderIds[Math.floor(Math.random() * aliveRaiderIds.length)]
          state.huddleSequence.push(replacement)
        }
      }
    }
  }
  
  state.currentOrderIndex = 0
  
  const firstHuddleTarget = state.huddleSequence[0]
  const secondHuddleTarget = state.huddleSequence[1] ?? null
  
  // Check if a dummy player currently holds the ball - if so, force pass to first huddle target
  if (state.currentHolderId !== null && state.currentHolderId !== playerId && firstHuddleTarget !== undefined) {
    // Dummy player has the ball - force pass to first huddle target immediately
    state.nextTargetId = firstHuddleTarget
    
    // Update raiders first so huddle targets are marked
  raiders.forEach((raider) => {
    raider.isHuddled = false
    raider.isRescued = false
    raider.hasBall = false
    raider.huddleOrder = null
  })

  state.huddleSequence.forEach((id, index) => {
    const raider = raiders[id]
    raider.isHuddled = true
    raider.huddleOrder = index + 1
    })
    
    // Perform the pass immediately (bypasses normal validation since we're forcing it)
    performPass(firstHuddleTarget, true)
    return // Exit early - performPass will handle remaining state updates
  }
  
  // If ball handlers exist and regular gamer mode, first ball handler does the first pass to first huddle target
  if (state.ballHandlers.length > 0 && state.playerRole === 'regular') {
    // Regular gamer: ball handler passes to first huddle target
    state.currentHolderId = state.ballHandlers[0]
    state.nextTargetId = firstHuddleTarget
  } else {
    // Normal mode or ball handler role: first huddle target gets ball
    state.currentHolderId = firstHuddleTarget ?? null
    state.nextTargetId = secondHuddleTarget
  }

  raiders.forEach((raider) => {
    raider.isHuddled = false
    raider.isRescued = false
    raider.hasBall = false
    raider.huddleOrder = null
  })

  state.huddleSequence.forEach((id, index) => {
    const raider = raiders[id]
    raider.isHuddled = true
    raider.huddleOrder = index + 1
    // Only set hasBall if not using ball handler system
    if (state.ballHandlers.length === 0 || state.playerRole !== 'regular') {
    raider.hasBall = index === 0
    }
  })
  
  // Set ball holder state
  if (state.currentHolderId !== null) {
    const holder = raiders[state.currentHolderId]
    if (holder) {
      holder.hasBall = true
    }
    const holderDummy = state.dummyPlayers.find(d => d.raiderId === state.currentHolderId)
    if (holderDummy) {
      holderDummy.hasBall = true
    }
  }

  // Audio functionality removed

  informPassState()
  syncPlayerBallFx()
  if (state.currentHolderId !== null && state.currentHolderId !== playerId) {
    scheduleBotPass()
  }
  updateRaiders()
}

function resolveHuddle() {
  clearBotPass()
  state.huddleActive = false
  state.timeToNextHuddle = randomBetween(GAME_CONFIG.NEXT_HUDDLE_MIN_MS, GAME_CONFIG.NEXT_HUDDLE_MAX_MS)
  state.huddleSequence = []
  state.currentOrderIndex = -1
  state.nextTargetId = null
  
  // After huddle, return ball to ball handlers if they exist
  if (state.ballHandlers.length > 0) {
    // Find first alive ball handler
    const aliveHandler = state.ballHandlers.find(id => {
      if (id === playerId) return true
      const dummy = state.dummyPlayers.find(d => d.raiderId === id)
      return dummy && !dummy.isDead
    })
    if (aliveHandler !== undefined) {
      state.currentHolderId = aliveHandler
      const holder = raiders[aliveHandler]
      if (holder) {
        holder.hasBall = true
      }
      const holderDummy = state.dummyPlayers.find(d => d.raiderId === aliveHandler)
      if (holderDummy) {
        holderDummy.hasBall = true
      }
    }
  } else {
    state.currentHolderId = null
  }
  
  setStatus('Great job! Await the next Huddle…')
  raiders.forEach((raider) => {
    raider.isHuddled = false
    if (state.ballHandlers.length === 0) {
    raider.hasBall = false
    }
  })
  syncPlayerBallFx()
  updateRaiders()
}

function attemptPass() {
  if (state.phase !== 'running') return
  if (state.currentHolderId !== playerId) {
    setStatus('Hold tight – an ally is breaking their fear.')
    return
  }

  const targetId = state.hoverTargetId
  if (targetId === null) {
    setStatus('Mouse over the highlighted ally before pressing 1.')
    return
  }

  // In ball handler mode, allow passing to any player (not just during huddle)
  if (state.playerRole === 'ball_handler') {
    // Allow passing to any alive player
    const targetDummy = state.dummyPlayers.find(d => d.raiderId === targetId)
    if (targetDummy && targetDummy.isDead) {
      setStatus('Cannot pass to dead ally.')
      return
    }
    // Pass to any player
    performPass(targetId)
    return
  }

  // Allow passing to ball handler if in ball handler mode
  const isBallHandlerPass = state.ballHandlers.length >= 2 && 
                           state.ballHandlers.includes(playerId) && 
                           state.ballHandlers.includes(targetId)
  
  if (!isBallHandlerPass) {
    // Normal huddle pass validation
    if (!state.huddleActive) return
  if (targetId !== state.nextTargetId) {
    const nextOrder = state.nextTargetId
    if (nextOrder !== null) {
      const label = raiders[nextOrder].huddleOrder
      setStatus(`You must pass to Huddle #${label} next!`)
    }
    return
    }
  }

  performPass(targetId)
}

function performPass(targetIdParam: number, forcePass: boolean = false) {
  const holderId = state.currentHolderId
  if (holderId === null) return
  
  let targetId = targetIdParam
  
  // Check if this is a ball handler pass (not a huddle pass)
  // IMPORTANT: During huddles, even ball handlers follow huddle logic
  const isBallHandlerPass = !state.huddleActive && 
                           state.ballHandlers.length >= 2 && 
                           state.ballHandlers.includes(holderId) && 
                           state.ballHandlers.includes(targetId)
  
  // Track ball handler passes for third handler logic
  if (isBallHandlerPass) {
    // Check if this is a back-and-forth pass (same two handlers)
    const [first, second] = state.lastBallHandlerPass
    if ((first === holderId && second === targetId) || (first === targetId && second === holderId)) {
      // Same two handlers passing back and forth - increment count
      state.ballHandlerPassCount += 1
    } else {
      // Different handlers - reset count
      state.ballHandlerPassCount = 1
    }
    
    // If we've passed back and forth 2 times, switch to third handler
    if (state.ballHandlerPassCount >= 2 && state.ballHandlers.length >= 3) {
      // Find the third handler (not in the last two passes)
      const thirdHandler = state.ballHandlers.find(id => 
        id !== holderId && 
        id !== targetId && 
        !state.dummyPlayers.find(d => d.raiderId === id && d.isDead)
      )
      
      if (thirdHandler !== undefined) {
        // Pass to third handler instead - update target
        targetId = thirdHandler
        state.ballHandlerPassCount = 0 // Reset count
        state.lastBallHandlerPass = [holderId, thirdHandler] // Update tracking
      } else {
        // Update last two handlers normally
        state.lastBallHandlerPass = [holderId, targetId]
      }
    } else {
      // Update last two handlers normally
      state.lastBallHandlerPass = [holderId, targetId]
    }
  }
  
  // For huddle passes, validate target (unless forced)
  // During huddles, always follow huddle logic even if both are ball handlers
  if (!isBallHandlerPass && !forcePass) {
    if (!state.huddleActive || state.nextTargetId === null) return
    if (targetId !== state.nextTargetId) return
  }

  clearBotPass()
  
  // Pause all adds for 0.5 seconds after ball pass
  const pauseDuration = 500 // 0.5 seconds
  state.adds.forEach((add) => {
    add.pausedUntil = state.elapsedMs + pauseDuration
    // Reduce speed after each pass
    add.speed = Math.max(30, add.speed * 0.8) // Slow down, minimum 30 pixels per second
  })

  const holder = raiders[holderId]
  holder.hasBall = false
  holder.isRescued = true
  holder.element.classList.add('pass-flash')
  setTimeout(() => holder.element.classList.remove('pass-flash'), 200)

  // Update dummy player state
  const holderDummy = state.dummyPlayers.find(d => d.raiderId === holderId)
  if (holderDummy) {
    holderDummy.hasBall = false
  }

  state.currentHolderId = targetId

  const target = raiders[targetId]
  target.hasBall = true
  
  // Update dummy player state
  const targetDummy = state.dummyPlayers.find(d => d.raiderId === targetId)
  if (targetDummy) {
    targetDummy.hasBall = true
  }
  
  // Audio functionality removed

  // Handle huddle pass logic
  // During huddles, ALL players (including ball handlers) follow huddle sequence
  if (state.huddleActive && !isBallHandlerPass) {
    // Find the index of the target in the huddle sequence
    const targetIndex = state.huddleSequence.indexOf(targetId)
    
    if (targetIndex !== -1) {
      // Update currentOrderIndex to match where we are in the sequence
      state.currentOrderIndex = targetIndex
      
      // Check if this was the final pass (last person in sequence)
      const isFinalPass = targetIndex >= state.huddleSequence.length - 1
  if (isFinalPass) {
    target.isRescued = true
    state.nextTargetId = null
    updateRaiders()
        resolveHuddle() // This will return ball to ball handlers after successful huddle
    return
  }

      // Set next target to the next person in sequence
      state.nextTargetId = state.huddleSequence[targetIndex + 1]
    }
  }

  informPassState()
  syncPlayerBallFx()
  updateRaiders()

  if (state.currentHolderId !== null && state.currentHolderId !== playerId) {
    scheduleBotPass()
  }
}

function scheduleBotPass() {
  if (state.currentHolderId === null) return
  if (state.currentHolderId === playerId) return
  
  // Don't schedule if there's already a pending pass
  if (state.botPassTimeout !== null) return
  
  // PRIORITY 1: Huddle passes - ball handlers prioritize huddle over everything
  if (state.huddleActive && state.nextTargetId !== null) {
  const delay = randomBetween(500, 2000)
  state.botPassTimeout = window.setTimeout(() => {
    state.botPassTimeout = null
      // Double-check state before executing pass (state might have changed)
      if (state.huddleActive && state.nextTargetId !== null && state.currentHolderId !== null && state.currentHolderId !== playerId) {
      performPass(state.nextTargetId)
    }
  }, delay)
    return
  }
  
  // PRIORITY 2: Ball handler danger passes (only when NOT in huddle)
  // For ball handlers, pass to other ball handler if in danger
  if (state.ballHandlers.length >= 2 && state.ballHandlers.includes(state.currentHolderId)) {
    if (checkBallHandlerNeedsPass()) {
      const otherHandler = state.ballHandlers.find(id => id !== state.currentHolderId && !state.dummyPlayers.find(d => d.raiderId === id && d.isDead))
      if (otherHandler !== undefined) {
        const delay = randomBetween(200, 500) // Faster pass when in danger
        state.botPassTimeout = window.setTimeout(() => {
          state.botPassTimeout = null
          // Double-check state before executing pass
          if (state.currentHolderId !== null && state.currentHolderId !== playerId) {
            performPass(otherHandler)
          }
        }, delay)
        return
      }
    }
  }
}

function clearBotPass() {
  if (state.botPassTimeout !== null) {
    window.clearTimeout(state.botPassTimeout)
    state.botPassTimeout = null
  }
}

function gameOver(reason: string, isWin: boolean = false) {
  clearBotPass()
  state.phase = 'game_over'
  state.huddleActive = false
  syncPlayerBallFx()
  setStatus(reason)
  const title = isWin ? '👑 Victory! 👑' : 'Wipe!'
  const score = formatSeconds(state.elapsedMs)
  domManager.showOverlay(title, reason, score, isWin)
  
  // Update tries counter
  if (isWin) {
    // Reset tries on win
    tries = 0
    StorageManager.saveTries(0)
    domManager.updateTries(0)
  } else {
    // Increment tries on loss
    tries += 1
    StorageManager.saveTries(tries)
    domManager.updateTries(tries)
  }
}

function startGame(role: PlayerRole) {
  state.playerRole = role
  state.phase = 'running'
  startMenuEl.classList.add('hidden')
  
  // Assign ball handlers based on role
  if (role === 'regular') {
    // Regular gamer: assign 3 dummy players as ball handlers
    const aliveDummies = state.dummyPlayers.filter(d => !d.isDead)
    if (aliveDummies.length >= 3) {
      // Pick 3 random dummy players as ball handlers
      const shuffled = [...aliveDummies].sort(() => Math.random() - 0.5)
      state.ballHandlers = [shuffled[0].raiderId!, shuffled[1].raiderId!, shuffled[2].raiderId!]
    } else if (aliveDummies.length >= 2) {
      // Fallback: use first 2-3 dummies available
      state.ballHandlers = aliveDummies.slice(0, Math.min(3, aliveDummies.length)).map(d => d.raiderId!).filter(id => id !== null)
    } else {
      // Fallback: use all available dummies
      state.ballHandlers = aliveDummies.map(d => d.raiderId!).filter(id => id !== null)
    }
    console.log('[game] Regular gamer mode - ball handlers:', state.ballHandlers)
  } else {
    // Ball handler: assign 2 dummy players as ball handlers, player is third
    const aliveDummies = state.dummyPlayers.filter(d => !d.isDead)
    if (aliveDummies.length >= 2) {
      state.ballHandlers = [playerId, aliveDummies[0].raiderId!, aliveDummies[1].raiderId!]
    } else if (aliveDummies.length >= 1) {
      state.ballHandlers = [playerId, aliveDummies[0].raiderId!]
    } else {
      state.ballHandlers = [playerId]
    }
    console.log('[game] Ball handler mode - ball handlers:', state.ballHandlers)
  }
  
  // Assign ball to first ball handler
  if (state.ballHandlers.length > 0) {
    state.currentHolderId = state.ballHandlers[0]
    const holder = raiders[state.ballHandlers[0]]
    if (holder) {
      holder.hasBall = true
    }
    const holderDummy = state.dummyPlayers.find(d => d.raiderId === state.ballHandlers[0])
    if (holderDummy) {
      holderDummy.hasBall = true
    }
  }
  
  // Spawn one add on start
  state.addSpawnCount = 0
  spawnAdds()
  state.lastAddSpawnTime = state.elapsedMs
  
  updateRaiders()
  syncPlayerBallFx()
  
  // Ensure game loop is running (it should already be, but make sure)
  if (state.phase === 'running') {
    requestAnimationFrame(loop)
  }
}

function restartGame() {
  clearBotPass()
  state.phase = 'menu'
  startMenuEl.classList.remove('hidden')
  state.elapsedMs = 0
  // Don't reset tries - they persist until win
  state.huddleActive = false
  state.timeRemaining = 0
  state.timeToNextHuddle = 1200
  state.huddleSequence = []
  state.currentHolderId = null
  state.currentOrderIndex = -1
  state.nextTargetId = null
  state.hoverTargetId = null
  state.playerRole = null
  state.ballHandlers = []
  // Phase 2: Reset movement and boss abilities
  // Reset player coordinates to center (all coordinates stored in state)
  state.playerX = gameCanvas.width / 2
  state.playerY = gameCanvas.height / 2
  state.keysPressed.clear()
  state.bossAngle = 0
  state.bossX = gameCanvas.width / 2
  state.bossY = gameCanvas.height / 2
  state.bossVisible = true
  state.bossAbilities.waterspout = { nextCast: 3000, active: false, duration: 0, castPlayerX: 0, castPlayerY: 0, castTime: 0 }
  state.waterspoutFountains = []
  state.bossAbilities.submerge = { nextCast: 5000, active: false, duration: 0, targetX: 0, targetY: 0, radius: 150, startTime: 0 }
  state.bossAbilities.implacableStrike = { nextCast: 7000, active: false, duration: 0, angle: 0, coneStartX: 0, coneStartY: 0, startTime: 0 }
  state.lastAbilityEndTime = 0
  state.adds = [] // Clear adds on restart
  state.addSpawnCount = 0 // Reset spawn count
  state.lastAddSpawnTime = 0 // Reset add spawn timer
  state.playerRole = null
  state.ballHandlers = []
  state.ballHandlerPassCount = 0
  state.lastBallHandlerPass = [null, null]
  state.waterspoutFountains = []
  domManager.hideOverlay()

  raiders.forEach((raider, index) => {
    raider.isPlayer = index === playerId
    raider.isHuddled = false
    raider.isRescued = false
    raider.hasBall = false
    raider.huddleOrder = null
  })

  // Revive all dummy players
  state.dummyPlayers.forEach((dummy) => {
    dummy.isDead = false
    dummy.hasBall = false
    dummy.deathRolledForSubmerge = false
    dummy.deathRolledForStrike = false
  })
  
  // Remove is-dead class from all raid frames
  raiders.forEach((raider) => {
    raider.element.classList.remove('is-dead')
  })

  updateRaiders()
  syncPlayerBallFx()
  setStatus('Back in – watch for the next Huddle.')
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatSeconds(ms: number) {
  const seconds = ms / 1000
  // For values >= 10 seconds, show integer to avoid jumping
  if (seconds >= 10) {
    return `${Math.floor(seconds)}s`
  }
  return `${seconds.toFixed(1)}s`
}

function setStatus(_message: string) {
  // Status panel removed - function kept for compatibility but does nothing
}

function informPassState() {
  if (!state.huddleActive || state.currentHolderId === null) {
    return
  }

  const holder = raiders[state.currentHolderId]
  if (state.currentHolderId === playerId) {
    if (state.nextTargetId !== null) {
      const order = raiders[state.nextTargetId].huddleOrder
      setStatus(`You have Transfer Light! Pass to Huddle #${order}.`)
    } else {
      setStatus('You broke the fear!')
    }
  } else {
    setStatus(`${holder.name} is passing the light…`)
  }
}

// Audio functionality removed - unused code

function syncPlayerBallFx() {
  const active = state.huddleActive && state.currentHolderId === playerId
  domManager.toggleBallHighlight(active)
}

function updateRaiders() {
  raiders.forEach((raider) => {
    const classes = ['raider-card']
    if (raider.isPlayer) classes.push('is-player')
    if (raider.isHuddled && !raider.isRescued) classes.push('is-huddled')
    if (raider.isRescued) classes.push('is-rescued')
    if (raider.hasBall) {
      classes.push(raider.isPlayer ? 'has-ball-player' : 'has-ball')
    }
    const shouldHighlight =
      state.phase === 'running' &&
      state.huddleActive &&
      state.currentHolderId === playerId &&
      state.nextTargetId === raider.id
    if (shouldHighlight) classes.push('is-target')
    
    // Check if this raider is linked to a dead dummy player
    const linkedDummy = state.dummyPlayers.find(d => d.raiderId === raider.id && d.isDead)
    if (linkedDummy) {
      classes.push('is-dead')
    }
    
    raider.element.className = classes.join(' ')
    
    // Update badge (no special handling for dead players - just show huddle order if applicable)
    raider.badge.textContent =
      raider.isHuddled && raider.huddleOrder ? String(raider.huddleOrder) : ''
    
    // Show/hide star icon for ball handlers
    const starIcon = raider.element.querySelector<HTMLImageElement>('.ball-handler-icon')
    if (starIcon) {
      const isBallHandler = state.ballHandlers.includes(raider.id)
      starIcon.style.display = isBallHandler ? 'inline-block' : 'none'
    }
  })
}

// Phase 2: Boss ability functions (triggered automatically)
function triggerWaterspout() {
  // Spawn 3 fountains under player's current position
  // First fountain spawns immediately, second at 3s, third at 6s
  const playerX = state.playerX
  const playerY = state.playerY
  const fountainRadius = 13 // Radius of each fountain (3x smaller than before)
  
  // Clear any existing fountains
  state.waterspoutFountains = []
  
  // Store player position at cast time
  state.bossAbilities.waterspout.castPlayerX = playerX
  state.bossAbilities.waterspout.castPlayerY = playerY
  state.bossAbilities.waterspout.castTime = state.elapsedMs
  
  // Spawn first fountain immediately
  state.waterspoutFountains.push({
    id: 0,
    x: playerX,
    y: playerY,
    spawnTime: state.elapsedMs,
    radius: fountainRadius,
    playerTimeInFountain: 0
  })
  
  state.bossAbilities.waterspout.active = true
  state.bossAbilities.waterspout.duration = 9000 // 9 seconds total (for all 3 fountains: 0s, 3s, 6s)
  state.bossAbilities.waterspout.nextCast = state.elapsedMs + 20000 // Next cast in 20 seconds
  console.log('[boss] Waterspout cast - spawning 3 fountains under player at', playerX, playerY)
}

function triggerSubmerge() {
  // 60% chance to target player, 40% chance to target random dummy
  let targetX: number
  let targetY: number
  
  if (Math.random() < 0.6) {
    // 60% chance: target player position
    targetX = state.playerX
    targetY = state.playerY
    console.log('[boss] Submerge targeting player at', targetX, targetY)
  } else {
    // 40% chance: target random dummy player
    const aliveDummies = state.dummyPlayers.filter(d => !d.isDead)
    
    if (aliveDummies.length === 0) {
      console.warn('[boss] No alive dummy players available for submerge, targeting player')
      targetX = state.playerX
      targetY = state.playerY
    } else {
      const target = aliveDummies[Math.floor(Math.random() * aliveDummies.length)]
      targetX = target.x
      targetY = target.y
      console.log('[boss] Submerge targeting dummy player at', targetX, targetY)
    }
  }
  
  state.bossAbilities.submerge.targetX = targetX
  state.bossAbilities.submerge.targetY = targetY
  state.bossAbilities.submerge.radius = 150 // Big circle damage
  
  // Hide boss (disappears)
  state.bossVisible = false
  
  state.bossAbilities.submerge.active = true
  state.bossAbilities.submerge.duration = 3000 // 3 second duration
  state.bossAbilities.submerge.startTime = state.elapsedMs // Track when ability started for animation sync
  state.bossAbilities.submerge.nextCast = state.elapsedMs + randomBetween(10000, 15000) // Next cast in 10-15s
  
  console.log('[boss] Submerge cast at target:', targetX, targetY, 'startTime:', state.bossAbilities.submerge.startTime)
}

function triggerImplacableStrike() {
  // Reset death roll flags for all dummies when new strike starts
  state.dummyPlayers.forEach(d => {
    d.deathRolledForStrike = false
  })
  
  // Ensure boss is visible before casting (should be true unless Submerge is active)
  if (!state.bossVisible) {
    console.warn('[boss] Cannot cast Implacable Strike - boss is not visible')
    return
  }
  
  // 60% chance to face towards player, 40% chance random direction
  if (Math.random() < 0.6) {
    // Face towards player
    const dx = state.playerX - state.bossX
    const dy = state.playerY - state.bossY
    state.bossAngle = Math.atan2(dy, dx)
    console.log('[boss] Implacable Strike facing towards player')
  } else {
    // Random direction
    state.bossAngle = Math.random() * Math.PI * 2
    console.log('[boss] Implacable Strike facing random direction')
  }
  state.bossAbilities.implacableStrike.active = true
  state.bossAbilities.implacableStrike.duration = 3000 // 3 second duration
  state.bossAbilities.implacableStrike.startTime = state.elapsedMs // Track when ability started for animation sync
  state.bossAbilities.implacableStrike.angle = state.bossAngle
  
  // Use boss's CURRENT position from state (respects Submerge move if it happened)
  // If boss position is not initialized (0,0), initialize to canvas center
  if (state.bossX === 0 && state.bossY === 0) {
    state.bossX = gameCanvas.width / 2
    state.bossY = gameCanvas.height / 2
    console.log('[boss] Initialized boss position to center:', state.bossX, state.bossY)
  }
  
  // Always use state.bossX and state.bossY (current boss position)
  // This ensures IS comes from where the boss circle is visually located
  state.bossAbilities.implacableStrike.coneStartX = state.bossX
  state.bossAbilities.implacableStrike.coneStartY = state.bossY
  state.bossAbilities.implacableStrike.nextCast = state.elapsedMs + randomBetween(6000, 10000) // Next cast in 6-10s
  
  console.log('[boss] Implacable Strike cast:', {
    angle: state.bossAngle,
    fromBossPosition: { x: state.bossX, y: state.bossY },
    coneStart: { x: state.bossAbilities.implacableStrike.coneStartX, y: state.bossAbilities.implacableStrike.coneStartY },
    bossVisible: state.bossVisible,
    startTime: state.bossAbilities.implacableStrike.startTime
  })
}

// Phase 2: Update boss abilities (check timers and update active states)
function updateBossAbilities(dt: number) {
  const ABILITY_QUEUE_DELAY = 500 // 0.5 second delay between abilities
  
  // Check if enough time has passed since last ability ended (queue delay)
  const canCastNewAbility = state.elapsedMs >= state.lastAbilityEndTime + ABILITY_QUEUE_DELAY
  
  // Check if it's time to cast abilities
  // Waterspout can cast if not active and respecting queue delay
  if (canCastNewAbility &&
      state.elapsedMs >= state.bossAbilities.waterspout.nextCast && 
      !state.bossAbilities.waterspout.active) {
    triggerWaterspout()
  }
  // Submerge can't cast if Implacable Strike is active, and must respect queue delay
  if (canCastNewAbility && 
      state.elapsedMs >= state.bossAbilities.submerge.nextCast && 
      !state.bossAbilities.submerge.active && 
      !state.bossAbilities.implacableStrike.active) {
    triggerSubmerge()
    // 1/10 chance to kill a random dummy player
    if (Math.random() < 0.1) {
      killRandomDummyPlayer()
    }
  }
  // Implacable Strike must respect queue delay and boss must be visible
  // Boss must be visible (not during Submerge) to cast Implacable Strike
  if (canCastNewAbility && 
      state.bossVisible &&
      state.elapsedMs >= state.bossAbilities.implacableStrike.nextCast && 
      !state.bossAbilities.implacableStrike.active) {
    triggerImplacableStrike()
    // 1/10 chance to kill a random dummy player
    if (Math.random() < 0.1) {
      killRandomDummyPlayer()
    }
  }

  // Update active ability durations
  // Update waterspout fountains and check collision
  if (state.bossAbilities.waterspout.active) {
    state.bossAbilities.waterspout.duration -= dt
    
    // Spawn second and third fountains at 3 and 6 seconds (every 3 seconds, 3 times total)
    const timeSinceCast = state.elapsedMs - (state.bossAbilities.waterspout.castTime || 0)
    
    // Spawn second fountain at 3 seconds (if not already spawned)
    const hasSecondFountain = state.waterspoutFountains.some(f => f.id === 1)
    if (!hasSecondFountain && timeSinceCast >= 3000) {
      state.waterspoutFountains.push({
        id: 1,
        x: state.playerX, // Always use current player position from state
        y: state.playerY,
        spawnTime: state.elapsedMs,
        radius: 13,
        playerTimeInFountain: 0
      })
      console.log('[boss] Second waterspout fountain spawned at', state.playerX, state.playerY, 'at 3 seconds')
    }
    
    // Spawn third fountain at 6 seconds (if not already spawned)
    const hasThirdFountain = state.waterspoutFountains.some(f => f.id === 2)
    if (!hasThirdFountain && timeSinceCast >= 6000) {
      state.waterspoutFountains.push({
        id: 2,
        x: state.playerX, // Always use current player position from state
        y: state.playerY,
        spawnTime: state.elapsedMs,
        radius: 13,
        playerTimeInFountain: 0
      })
      console.log('[boss] Third waterspout fountain spawned at', state.playerX, state.playerY, 'at 6 seconds')
    }
    
    // Update each fountain and check player collision
    state.waterspoutFountains.forEach((fountain: WaterspoutFountain) => {
      // Check if player is in this fountain
      const dx = state.playerX - fountain.x
      const dy = state.playerY - fountain.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      const playerRadius = 10
      const hitDistance = fountain.radius + playerRadius
      
      if (distance <= hitDistance) {
        // Player is in fountain - increment time
        fountain.playerTimeInFountain += dt
        
        // If player stays in fountain for 3+ seconds, they die
        if (fountain.playerTimeInFountain >= 3000) {
          console.log('[boss] Player killed by waterspout fountain - stayed in for', fountain.playerTimeInFountain, 'ms')
          gameOver('You were consumed by the waterspout!')
          return
        }
      } else {
        // Player left the fountain - reset timer
        fountain.playerTimeInFountain = 0
      }
    })
    
    // Remove fountains that are older than 9 seconds (all should be done by then)
    state.waterspoutFountains = state.waterspoutFountains.filter(f => state.elapsedMs - f.spawnTime < 9000)
    
    if (state.bossAbilities.waterspout.duration <= 0) {
      state.bossAbilities.waterspout.active = false
      state.lastAbilityEndTime = state.elapsedMs
      // Clear fountains after ability ends
      state.waterspoutFountains = []
    }
  }
  if (state.bossAbilities.submerge.active) {
    state.bossAbilities.submerge.duration -= dt
    
    if (state.bossAbilities.submerge.duration <= 0) {
      // Boss appears at new position (from Submerge target)
      // Update state.bossX and state.bossY to the new location
      state.bossX = state.bossAbilities.submerge.targetX
      state.bossY = state.bossAbilities.submerge.targetY
      state.bossVisible = true
      state.bossAbilities.submerge.active = false
      state.lastAbilityEndTime = state.elapsedMs // Track when ability ended for queue delay
      console.log('[boss] Submerge ended, boss moved to new position (state.bossX:', state.bossX, 'state.bossY:', state.bossY, ')')
      
      // Check collision at END of duration (gives player time to move away)
      // ALWAYS check collision for the player (not dummy players), regardless of ball possession
      // Player coordinates are ALWAYS stored in state.playerX and state.playerY
      console.log('[collision] Submerge collision check at end of duration:', {
        currentHolderId: state.currentHolderId,
        playerId: playerId,
        hasBall: state.currentHolderId === playerId,
        playerX: state.playerX,
        playerY: state.playerY,
        targetX: state.bossAbilities.submerge.targetX,
        targetY: state.bossAbilities.submerge.targetY,
        radius: state.bossAbilities.submerge.radius
      })
      
      // Calculate distance from player center to submerge target center
      const dx = state.playerX - state.bossAbilities.submerge.targetX
      const dy = state.playerY - state.bossAbilities.submerge.targetY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Player hitbox radius (10px)
      const playerRadius = 10
      // Damage circle radius (150px)
      const damageRadius = state.bossAbilities.submerge.radius
      
      // Player is hit if their center is within the damage radius
      // OR if any part of the player (center + radius) overlaps the damage circle
      // This means: distance from centers <= (damageRadius + playerRadius)
      const hitDistance = damageRadius + playerRadius
      
      console.log('[collision] Submerge distance calculation:', {
        playerX: state.playerX.toFixed(2),
        playerY: state.playerY.toFixed(2),
        targetX: state.bossAbilities.submerge.targetX.toFixed(2),
        targetY: state.bossAbilities.submerge.targetY.toFixed(2),
        dx: dx.toFixed(2),
        dy: dy.toFixed(2),
        distance: distance.toFixed(2),
        damageRadius,
        playerRadius,
        hitDistance: hitDistance.toFixed(2),
        condition: `distance (${distance.toFixed(2)}) <= hitDistance (${hitDistance.toFixed(2)})`,
        isHit: distance <= hitDistance
      })
      
      if (distance <= hitDistance) {
        console.log('[collision] Submerge HIT detected at end of duration!', {
          playerX: state.playerX.toFixed(2),
          playerY: state.playerY.toFixed(2),
          targetX: state.bossAbilities.submerge.targetX.toFixed(2),
          targetY: state.bossAbilities.submerge.targetY.toFixed(2),
          distance: distance.toFixed(2),
          damageRadius,
          playerRadius,
          hitDistance: hitDistance.toFixed(2),
          isHit: true,
          hadBall: state.currentHolderId === playerId
        })
        gameOver('You were hit by Submerge!')
        return
      } else {
        console.log('[collision] Submerge MISS - player outside circle', {
          playerX: state.playerX.toFixed(2),
          playerY: state.playerY.toFixed(2),
          targetX: state.bossAbilities.submerge.targetX.toFixed(2),
          targetY: state.bossAbilities.submerge.targetY.toFixed(2),
          distance: distance.toFixed(2),
          damageRadius,
          playerRadius,
          hitDistance: hitDistance.toFixed(2),
          isHit: false,
          difference: (distance - hitDistance).toFixed(2)
        })
      }
      
      // Check collision for dummy players
      checkDummyPlayersHitBySubmerge()
    }
  }
  if (state.bossAbilities.implacableStrike.active && state.bossVisible) {
    state.bossAbilities.implacableStrike.duration -= dt
    
    if (state.bossAbilities.implacableStrike.duration <= 0) {
      state.bossAbilities.implacableStrike.active = false
      state.lastAbilityEndTime = state.elapsedMs // Track when ability ended for queue delay
      
      // Check collision at END of duration (gives player time to move away)
      // Player coordinates are ALWAYS stored in state.playerX and state.playerY
      if (state.currentHolderId === playerId) {
        if (checkPlayerHitByImplacableStrike()) {
          console.log('[collision] Implacable Strike hit detected at end of duration!')
          gameOver('You were hit by Implacable Strike while holding the ball!')
          return
        }
      }
      
      // Check collision for dummy players
      checkDummyPlayersHitByImplacableStrike()
    }
  }
}

// Check if player is hit by Implacable Strike cone
// ONLY checks collision for the player (not dummy players)
// Player coordinates are ALWAYS stored in state.playerX and state.playerY
function checkPlayerHitByImplacableStrike(): boolean {
  if (!state.bossVisible) return false // Boss must be visible for strike to hit
  
  const strike = state.bossAbilities.implacableStrike
  const playerRadius = 10 // Player hitbox radius
  const coneLength = 300 // Length of the cone
  const coneAngle = Math.PI / 3 // 60 degree cone (30 degrees each side)
  
  // Use the cone start position (where boss was when strike was cast)
  // This is important because boss might have moved (e.g., after submerge)
  const coneStartX = strike.coneStartX
  const coneStartY = strike.coneStartY
  
  // Vector from cone start to player (using state.playerX and state.playerY)
  const dx = state.playerX - coneStartX
  const dy = state.playerY - coneStartY
  const distance = Math.sqrt(dx * dx + dy * dy)
  
  // Check if player is within cone range (including player radius)
  if (distance > coneLength + playerRadius) {
    console.log('[collision] Implacable Strike MISS - too far', { distance, maxRange: coneLength + playerRadius })
    return false
  }
  
  // Calculate angle from cone start to player
  const angleToPlayer = Math.atan2(dy, dx)
  
  // Normalize angles to [0, 2π]
  let bossAngle = strike.angle
  while (bossAngle < 0) bossAngle += Math.PI * 2
  while (bossAngle >= Math.PI * 2) bossAngle -= Math.PI * 2
  let playerAngle = angleToPlayer
  while (playerAngle < 0) playerAngle += Math.PI * 2
  while (playerAngle >= Math.PI * 2) playerAngle -= Math.PI * 2
  
  // Calculate angle difference (shortest path around circle)
  let angleDiff = Math.abs(playerAngle - bossAngle)
  if (angleDiff > Math.PI) {
    angleDiff = Math.PI * 2 - angleDiff
  }
  
  // Check if player is within cone angle (half cone angle on each side)
  const halfConeAngle = coneAngle / 2
  const isHit = angleDiff <= halfConeAngle
  
  if (isHit) {
    console.log('[collision] Implacable Strike HIT detected!', {
      playerX: state.playerX,
      playerY: state.playerY,
      coneStartX,
      coneStartY,
      distance,
      bossAngle: strike.angle,
      playerAngle: angleToPlayer,
      angleDiff,
      halfConeAngle
    })
  } else {
    console.log('[collision] Implacable Strike MISS - wrong angle', {
      playerX: state.playerX,
      playerY: state.playerY,
      coneStartX,
      coneStartY,
      distance,
      bossAngle: strike.angle,
      playerAngle: angleToPlayer,
      angleDiff,
      halfConeAngle
    })
  }
  
  return isHit
}

// Check if dummy players are hit by Submerge
function checkDummyPlayersHitBySubmerge() {
  const submerge = state.bossAbilities.submerge
  const damageRadius = submerge.radius
  const dummyRadius = 8
  const hitDistance = damageRadius + dummyRadius
  
  state.dummyPlayers.forEach((dummy) => {
    if (dummy.isDead) return // Skip already dead dummies
    
    const dx = dummy.x - submerge.targetX
    const dy = dummy.y - submerge.targetY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance <= hitDistance) {
      const wasBallHolder = state.currentHolderId === dummy.raiderId
      dummy.isDead = true
      
      // Update raid frame if linked
      if (dummy.raiderId !== null && dummy.raiderId < raiders.length) {
        const raider = raiders[dummy.raiderId]
        raider.element.classList.add('is-dead')
        updateRaiders()
      }
      
      // If this dummy had the ball, transfer it to closest target
      if (wasBallHolder && dummy.raiderId !== null) {
        transferBallToClosestTarget(dummy.raiderId)
      }
      
      console.log('[dummy] Dummy player hit by Submerge:', {
        name: dummy.name,
        x: dummy.x.toFixed(2),
        y: dummy.y.toFixed(2),
        targetX: submerge.targetX.toFixed(2),
        targetY: submerge.targetY.toFixed(2),
        distance: distance.toFixed(2),
        hitDistance: hitDistance.toFixed(2)
      })
    }
  })
}

// Check if dummy players are hit by Implacable Strike
function checkDummyPlayersHitByImplacableStrike() {
  if (!state.bossVisible) return // Boss must be visible for strike to hit
  
  const strike = state.bossAbilities.implacableStrike
  const dummyRadius = 8
  const coneLength = 300
  const coneAngle = Math.PI / 3 // 60 degrees
  
  const coneStartX = strike.coneStartX
  const coneStartY = strike.coneStartY
  
  state.dummyPlayers.forEach((dummy) => {
    if (dummy.isDead) return // Skip already dead dummies
    
    // Vector from cone start to dummy
    const dx = dummy.x - coneStartX
    const dy = dummy.y - coneStartY
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Check if dummy is within cone range
    if (distance > coneLength + dummyRadius) {
      return // Too far
    }
    
    // Calculate angle from cone start to dummy
    const angleToDummy = Math.atan2(dy, dx)
    
    // Normalize angles to [0, 2π]
    let bossAngle = strike.angle
    while (bossAngle < 0) bossAngle += Math.PI * 2
    while (bossAngle >= Math.PI * 2) bossAngle -= Math.PI * 2
    let dummyAngle = angleToDummy
    while (dummyAngle < 0) dummyAngle += Math.PI * 2
    while (dummyAngle >= Math.PI * 2) dummyAngle -= Math.PI * 2
    
    // Calculate angle difference (shortest path around circle)
    let angleDiff = Math.abs(dummyAngle - bossAngle)
    if (angleDiff > Math.PI) {
      angleDiff = Math.PI * 2 - angleDiff
    }
    
    // Check if dummy is within cone angle
    const halfConeAngle = coneAngle / 2
    if (angleDiff <= halfConeAngle) {
      const wasBallHolder = state.currentHolderId === dummy.raiderId
      dummy.isDead = true
      
      // Update raid frame if linked
      if (dummy.raiderId !== null && dummy.raiderId < raiders.length) {
        const raider = raiders[dummy.raiderId]
        raider.element.classList.add('is-dead')
        updateRaiders()
      }
      
      // If this dummy had the ball, transfer it to closest target
      if (wasBallHolder && dummy.raiderId !== null) {
        transferBallToClosestTarget(dummy.raiderId)
      }
      
      console.log('[dummy] Dummy player hit by Implacable Strike:', {
        name: dummy.name,
        x: dummy.x.toFixed(2),
        y: dummy.y.toFixed(2),
        coneStartX: coneStartX.toFixed(2),
        coneStartY: coneStartY.toFixed(2),
        distance: distance.toFixed(2),
        bossAngle: strike.angle,
        dummyAngle: angleToDummy,
        angleDiff: angleDiff.toFixed(2),
        halfConeAngle: halfConeAngle.toFixed(2)
      })
    }
  })
}

// Transfer ball to closest alive target when holder dies
function transferBallToClosestTarget(deadHolderId: number) {
  if (state.currentHolderId !== deadHolderId) return // Not the ball holder
  
  // Get position of dead holder
  let deadX: number, deadY: number
  if (deadHolderId === playerId) {
    deadX = state.playerX
    deadY = state.playerY
  } else {
    const deadDummy = state.dummyPlayers.find(d => d.raiderId === deadHolderId)
    if (!deadDummy) return
    deadX = deadDummy.x
    deadY = deadDummy.y
  }
  
  // Find closest alive target (player or dummy)
  let closestId: number | null = null
  let closestDistance = Infinity
  
  // Check player
  if (!state.dummyPlayers.find(d => d.raiderId === playerId && d.isDead)) {
    const dx = state.playerX - deadX
    const dy = state.playerY - deadY
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < closestDistance) {
      closestDistance = distance
      closestId = playerId
    }
  }
  
  // Check dummy players
  state.dummyPlayers.forEach((dummy) => {
    if (!dummy.isDead && dummy.raiderId !== deadHolderId) {
      const dx = dummy.x - deadX
      const dy = dummy.y - deadY
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < closestDistance) {
        closestDistance = distance
        closestId = dummy.raiderId
      }
    }
  })
  
  if (closestId !== null) {
    // Transfer ball
    const oldHolder = raiders[deadHolderId]
    if (oldHolder) {
      oldHolder.hasBall = false
    }
    
    state.currentHolderId = closestId
    const newHolder = raiders[closestId]
    if (newHolder) {
      newHolder.hasBall = true
    }
    
    // Update dummy player state
    const oldDummy = state.dummyPlayers.find(d => d.raiderId === deadHolderId)
    if (oldDummy) {
      oldDummy.hasBall = false
    }
    const newDummy = state.dummyPlayers.find(d => d.raiderId === closestId)
    if (newDummy) {
      newDummy.hasBall = true
    }
    
    console.log('[ball] Ball transferred from dead holder', deadHolderId, 'to closest target', closestId)
    updateRaiders()
    syncPlayerBallFx()
  } else {
    console.warn('[ball] No alive target found for ball transfer!')
  }
}

// Spawn adds every 30 seconds
function spawnAdds() {
  // Remove previous group completely
  state.adds = []
  
  // Increment spawn count (1st = 1 add, 2nd = 2 adds, 3rd = 3 adds, etc.)
  state.addSpawnCount += 1
  const addCount = state.addSpawnCount
  
  // Spawn adds at random positions around the edges of the canvas
  const margin = 50
  let addId = 0
  
  for (let i = 0; i < addCount; i++) {
    // Random spawn position along the edges
    const side = Math.floor(Math.random() * 4) // 0=top, 1=right, 2=bottom, 3=left
    let x: number, y: number
    
    switch (side) {
      case 0: // Top
        x = margin + Math.random() * (gameCanvas.width - 2 * margin)
        y = margin
        break
      case 1: // Right
        x = gameCanvas.width - margin
        y = margin + Math.random() * (gameCanvas.height - 2 * margin)
        break
      case 2: // Bottom
        x = margin + Math.random() * (gameCanvas.width - 2 * margin)
        y = gameCanvas.height - margin
        break
      case 3: // Left
        x = margin
        y = margin + Math.random() * (gameCanvas.height - 2 * margin)
        break
      default:
        x = margin
        y = margin
    }
    
    state.adds.push({
      id: addId++,
      x,
      y,
      pausedUntil: 0, // Not paused initially
      speed: 40 // Initial speed (pixels per second) - slowed down
    })
  }
  
  console.log('[adds] Spawned', addCount, 'adds')
}

// Check if ball handler needs to pass (in danger from adds or abilities)
function checkBallHandlerNeedsPass() {
  if (state.ballHandlers.length < 2) return false
  if (state.currentHolderId === null) return false
  if (!state.ballHandlers.includes(state.currentHolderId)) return false
  
  const holderId = state.currentHolderId
  let holderX: number, holderY: number
  
  if (holderId === playerId) {
    holderX = state.playerX
    holderY = state.playerY
  } else {
    const holderDummy = state.dummyPlayers.find(d => d.raiderId === holderId)
    if (!holderDummy) return false
    holderX = holderDummy.x
    holderY = holderDummy.y
  }
  
  // Check if adds are close
  const addDangerRadius = 100
  for (const add of state.adds) {
    const dx = add.x - holderX
    const dy = add.y - holderY
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < addDangerRadius) {
      return true // Add is close, need to pass
    }
  }
  
  // Check if in Submerge danger zone
  if (state.bossAbilities.submerge.active) {
    const submerge = state.bossAbilities.submerge
    const dx = holderX - submerge.targetX
    const dy = holderY - submerge.targetY
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < submerge.radius + 50) {
      return true // In submerge danger, need to pass
    }
  }
  
  // Check if in Implacable Strike danger zone
  if (state.bossAbilities.implacableStrike.active) {
    const strike = state.bossAbilities.implacableStrike
    const dx = holderX - strike.coneStartX
    const dy = holderY - strike.coneStartY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const coneLength = 300
    if (distance < coneLength + 50) {
      const angleToHolder = Math.atan2(dy, dx)
      let bossAngle = strike.angle
      while (bossAngle < 0) bossAngle += Math.PI * 2
      while (bossAngle >= Math.PI * 2) bossAngle -= Math.PI * 2
      let holderAngle = angleToHolder
      while (holderAngle < 0) holderAngle += Math.PI * 2
      while (holderAngle >= Math.PI * 2) holderAngle -= Math.PI * 2
      let angleDiff = Math.abs(holderAngle - bossAngle)
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
      const halfConeAngle = (Math.PI / 3) / 2
      if (angleDiff <= halfConeAngle) {
        return true // In strike danger, need to pass
      }
    }
  }
  
  return false
}

// Update adds movement - chase the ball holder
function updateAdds(dt: number) {
  if (state.adds.length === 0) return
  if (state.currentHolderId === null) return
  
  // Adds always chase whoever has the ball (player, dummy, or ball handler)
  // No need to check huddle status or role - just chase the ball holder
  
  // Find target position (ball holder)
  let targetX: number, targetY: number
  
  if (state.currentHolderId === playerId) {
    // Player has ball - use player coordinates
    targetX = state.playerX
    targetY = state.playerY
  } else {
    // Bot has ball - find their dummy player position
    const holderDummy = state.dummyPlayers.find(d => d.raiderId === state.currentHolderId)
    if (!holderDummy) {
      // Can't find target, don't move
      return
    }
    targetX = holderDummy.x
    targetY = holderDummy.y
  }
  
  const addRadius = 10
  const playerRadius = 10
  
  state.adds.forEach((add) => {
    // Check if paused
    if (add.pausedUntil > 0 && state.elapsedMs < add.pausedUntil) {
      return // Still paused, don't move
    }
    
    // Calculate direction to target
    const dx = targetX - add.x
    const dy = targetY - add.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // If add reached ball holder, they die
    if (distance < addRadius + playerRadius) {
      if (state.currentHolderId === playerId) {
        console.log('[adds] Add reached player!')
        // Transfer ball to closest target before game over
        transferBallToClosestTarget(playerId)
        gameOver('You were caught by an add!')
        return
      } else if (state.currentHolderId !== null) {
        // Bot holder was caught - transfer ball
        const holderId = state.currentHolderId
        const holderDummy = state.dummyPlayers.find(d => d.raiderId === holderId)
        if (holderDummy) {
          holderDummy.isDead = true
          if (holderId < raiders.length) {
            const raider = raiders[holderId]
            raider.element.classList.add('is-dead')
            updateRaiders()
          }
          transferBallToClosestTarget(holderId)
          console.log('[adds] Add caught bot holder', holderId)
        }
      }
    }
    
    // Move towards target
    if (distance > 0) {
      const moveDistance = (add.speed * dt) / 1000
      const moveX = (dx / distance) * moveDistance
      const moveY = (dy / distance) * moveDistance
      
      add.x = Math.max(addRadius, Math.min(gameCanvas.width - addRadius, add.x + moveX))
      add.y = Math.max(addRadius, Math.min(gameCanvas.height - addRadius, add.y + moveY))
    }
  })
}

// Phase 2: Movement function
// Updates player coordinates (state.playerX, state.playerY) based on WASD input
// Player coordinates are ALWAYS stored in state.playerX and state.playerY
// Player coordinates are ALWAYS tracked, even when player can't move (has ball)
function updateMovement(dt: number) {
  // Update dummy player movement (avoid danger zones) - always update, regardless of player state
  updateDummyPlayerMovement(dt)
  
  // Player can't move when they have the ball, but coordinates are still tracked in state
  // This ensures collision detection works correctly even when player is stationary
  if (state.currentHolderId === playerId) {
    // Player coordinates (state.playerX, state.playerY) remain at current position
    // These coordinates in state are used for collision detection with boss abilities
    return
  }

  const speed = 200 // pixels per second
  const moveDistance = (speed * dt) / 1000
  const playerRadius = 10 // Player hitbox radius

  // Update player coordinates in state based on input
  // All coordinates are stored in state.playerX and state.playerY
  // Coordinates are clamped to canvas bounds (accounting for player radius)
  if (state.keysPressed.has('w') || state.keysPressed.has('arrowup')) {
    state.playerY = Math.max(playerRadius, state.playerY - moveDistance)
  }
  if (state.keysPressed.has('s') || state.keysPressed.has('arrowdown')) {
    state.playerY = Math.min(gameCanvas.height - playerRadius, state.playerY + moveDistance)
  }
  if (state.keysPressed.has('a') || state.keysPressed.has('arrowleft')) {
    state.playerX = Math.max(playerRadius, state.playerX - moveDistance)
  }
  if (state.keysPressed.has('d') || state.keysPressed.has('arrowright')) {
    state.playerX = Math.min(gameCanvas.width - playerRadius, state.playerX + moveDistance)
  }
}

// Update dummy players to move away from danger zones (frontal cone and submerge)
function updateDummyPlayerMovement(dt: number) {
  const dummySpeed = 150 // pixels per second (slightly slower than player)
  const moveDistance = (dummySpeed * dt) / 1000
  const dummyRadius = 8
  
  state.dummyPlayers.forEach((dummy) => {
    if (dummy.isDead) return // Dead dummies don't move
    
    let moveX = 0
    let moveY = 0
    
    // Check Submerge danger zone
    if (state.bossAbilities.submerge.active) {
      const submerge = state.bossAbilities.submerge
      const dx = dummy.x - submerge.targetX
      const dy = dummy.y - submerge.targetY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const dangerRadius = submerge.radius + dummyRadius + 20 // Extra buffer
      
      if (distance < dangerRadius) {
        // Roll once when first entering danger zone (only roll once per submerge cast)
        if (!dummy.deathRolledForSubmerge) {
          dummy.deathRolledForSubmerge = true // Mark that we've rolled (whether they die or not)
          
          // 5% chance to die immediately
          if (Math.random() < 0.05) {
            dummy.isDead = true
            
            // Update raid frame if linked
            if (dummy.raiderId !== null && dummy.raiderId < raiders.length) {
              const raider = raiders[dummy.raiderId]
              raider.element.classList.add('is-dead')
              updateRaiders()
            }
            
            console.log('[dummy] Dummy player failed to escape Submerge (5% roll):', {
              name: dummy.name,
              x: dummy.x.toFixed(2),
              y: dummy.y.toFixed(2),
              targetX: submerge.targetX.toFixed(2),
              targetY: submerge.targetY.toFixed(2),
              distance: distance.toFixed(2)
            })
            
            return // Don't move, they're dead
          }
          // If they survive the roll, they have time to escape (continue to movement logic below)
        }
        
        // Move away from submerge center (if they survived the roll or already rolled)
        if (!dummy.isDead) {
          const angle = Math.atan2(dy, dx)
          moveX += Math.cos(angle) * moveDistance * 2 // Move faster when in danger
          moveY += Math.sin(angle) * moveDistance * 2
        }
      }
    }
    
    // Check Implacable Strike danger zone
    if (state.bossAbilities.implacableStrike.active) {
      const strike = state.bossAbilities.implacableStrike
      const coneLength = 300
      const coneAngle = Math.PI / 3 // 60 degrees
      
      // Calculate distance from cone start
      const dx = dummy.x - strike.coneStartX
      const dy = dummy.y - strike.coneStartY
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance < coneLength + dummyRadius + 20) {
        // Check if inside cone angle
        const angleToDummy = Math.atan2(dy, dx)
        
        // Normalize angles to [0, 2π]
        let bossAngle = strike.angle
        while (bossAngle < 0) bossAngle += Math.PI * 2
        while (bossAngle >= Math.PI * 2) bossAngle -= Math.PI * 2
        let dummyAngle = angleToDummy
        while (dummyAngle < 0) dummyAngle += Math.PI * 2
        while (dummyAngle >= Math.PI * 2) dummyAngle -= Math.PI * 2
        
        // Calculate angle difference (shortest path around circle)
        let angleDiff = Math.abs(dummyAngle - bossAngle)
        if (angleDiff > Math.PI) {
          angleDiff = Math.PI * 2 - angleDiff
        }
        
        const halfConeAngle = coneAngle / 2
        if (angleDiff <= halfConeAngle) {
          // Roll once when first entering danger zone (only roll once per strike cast)
          if (!dummy.deathRolledForStrike) {
            dummy.deathRolledForStrike = true // Mark that we've rolled (whether they die or not)
            
            // 5% chance to die immediately
            if (Math.random() < 0.05) {
              const wasBallHolder = state.currentHolderId === dummy.raiderId
              dummy.isDead = true
              
              // Update raid frame if linked
              if (dummy.raiderId !== null && dummy.raiderId < raiders.length) {
                const raider = raiders[dummy.raiderId]
                raider.element.classList.add('is-dead')
                updateRaiders()
              }
              
              // If this dummy had the ball, transfer it to closest target
              if (wasBallHolder && dummy.raiderId !== null) {
                transferBallToClosestTarget(dummy.raiderId)
              }
              
              console.log('[dummy] Dummy player failed to escape Implacable Strike (5% roll):', {
                name: dummy.name,
                x: dummy.x.toFixed(2),
                y: dummy.y.toFixed(2),
                coneStartX: strike.coneStartX.toFixed(2),
                coneStartY: strike.coneStartY.toFixed(2),
                distance: distance.toFixed(2),
                angleDiff: angleDiff.toFixed(2)
              })
              
              return // Don't move, they're dead
            }
            // If they survive the roll, they have time to escape (continue to movement logic below)
          }
          
          // Inside cone - calculate smooth escape direction (if they survived the roll or already rolled)
          if (!dummy.isDead) {
            // Move perpendicular to cone direction, away from the cone center line
            
            // Calculate which side of the cone the dummy is on
            const relativeAngle = dummyAngle - bossAngle
            const normalizedRelative = ((relativeAngle + Math.PI) % (Math.PI * 2)) - Math.PI
            const side = normalizedRelative > 0 ? 1 : -1 // Positive = right side, negative = left side
            
            // Move perpendicular to cone direction (90 degrees from boss angle)
            const escapeAngle = bossAngle + (side * Math.PI / 2)
            
            // Also add a component moving away from the cone start (radial escape)
            const radialAngle = angleToDummy + Math.PI // Opposite direction from cone start
            
            // Blend both escape directions for smoother movement
            const perpendicularWeight = 0.6 // More weight on perpendicular (sideways) movement
            const radialWeight = 0.4 // Less weight on radial (away from center) movement
            
            const escapeX = Math.cos(escapeAngle) * perpendicularWeight + Math.cos(radialAngle) * radialWeight
            const escapeY = Math.sin(escapeAngle) * perpendicularWeight + Math.sin(radialAngle) * radialWeight
            
            // Normalize the escape direction vector
            const escapeLength = Math.sqrt(escapeX * escapeX + escapeY * escapeY)
            const normalizedEscapeX = escapeX / escapeLength
            const normalizedEscapeY = escapeY / escapeLength
            
            // Move faster when closer to the cone center line (more danger)
            const dangerFactor = 1 - (angleDiff / halfConeAngle) // 0 at edge, 1 at center
            const speedMultiplier = 1.5 + (dangerFactor * 1.5) // 1.5x to 3x speed based on danger
            
            moveX += normalizedEscapeX * moveDistance * speedMultiplier
            moveY += normalizedEscapeY * moveDistance * speedMultiplier
          }
        }
      }
    }
    
    // Apply movement with some randomness
    if (moveX === 0 && moveY === 0) {
      // No danger - random idle movement
      if (Math.random() < 0.1) { // 10% chance to move randomly
        const randomAngle = Math.random() * Math.PI * 2
        moveX = Math.cos(randomAngle) * moveDistance * 0.5
        moveY = Math.sin(randomAngle) * moveDistance * 0.5
      }
    }
    
    // Update position
    dummy.x = Math.max(dummyRadius, Math.min(gameCanvas.width - dummyRadius, dummy.x + moveX))
    dummy.y = Math.max(dummyRadius, Math.min(gameCanvas.height - dummyRadius, dummy.y + moveY))
  })
}

// Kill a random dummy player (1/10 chance per ability)
function killRandomDummyPlayer() {
  const aliveDummies = state.dummyPlayers.filter(d => !d.isDead)
  if (aliveDummies.length === 0) return
  
  const victim = aliveDummies[Math.floor(Math.random() * aliveDummies.length)]
  victim.isDead = true
  
  // Update raid frame if linked
  if (victim.raiderId !== null && victim.raiderId < raiders.length) {
    const raider = raiders[victim.raiderId]
    raider.element.classList.add('is-dead')
    updateRaiders()
  }
  
  console.log('[dummy] Dummy player killed:', victim.name, 'at', victim.x.toFixed(0), victim.y.toFixed(0))
}

// Phase 2: Boss image loading
// Try to load boss image, but gracefully fall back to placeholder if CORS blocks it
const bossImage = new Image()
let bossImageLoaded = false
let processedBossImage: HTMLImageElement | null = null

// Try loading without crossOrigin first (some servers allow this)
bossImage.onload = () => {
  try {
    // Process image to remove white background
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = bossImage.width
    tempCanvas.height = bossImage.height
    const tempCtx = tempCanvas.getContext('2d')!
    
    // Try to draw the image - this will fail if CORS blocks it
    tempCtx.drawImage(bossImage, 0, 0)
    
    // Try to get image data - this will throw SecurityError if canvas is tainted
    let imageData: ImageData
    try {
      imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
    } catch (corsError) {
      // Canvas is tainted by CORS - use image directly without processing
      console.warn('[boss] CORS blocked image processing, using image directly')
      processedBossImage = bossImage
      bossImageLoaded = true
      return
    }
    
    const data = imageData.data
    
    // Remove white/light pixels (make them transparent)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      // If pixel is very light/white, make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0 // Set alpha to 0 (transparent)
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0)
    
    // Create new image from processed canvas
    processedBossImage = new Image()
    processedBossImage.src = tempCanvas.toDataURL()
    processedBossImage.onload = () => {
      bossImageLoaded = true
      console.log('[boss] Boss image loaded and processed successfully')
    }
  } catch (error) {
    console.warn('[boss] Failed to process boss image, using fallback:', error)
    // Fallback: use the original image if processing fails
    processedBossImage = bossImage
    bossImageLoaded = true
  }
}

bossImage.onerror = () => {
  console.warn('[boss] Failed to load boss image from external source, using fallback circle')
  bossImageLoaded = false
}

// Try to load the image (will fall back to placeholder if CORS blocks it)
try {
  // Try without crossOrigin first - if that fails, the onerror handler will catch it
  bossImage.src = 'https://assets2.mythictrap.com/msv-hof-toes/background_finals/sha-of-fear-custom.png?v=9'
} catch (error) {
  console.warn('[boss] Error setting boss image source:', error)
  bossImageLoaded = false
}

// Tooltip state for canvas hover
let hoveredRaider: { name: string; x: number; y: number } | null = null

// Load star icon for ball handlers
const starIcon = new Image()
starIcon.src = `${import.meta.env.BASE_URL}img/star_icon.png`
let starIconLoaded = false
starIcon.onload = () => {
  starIconLoaded = true
}
starIcon.onerror = () => {
  console.warn('[ui] Failed to load star icon')
  starIconLoaded = false
}

// Phase 2: Render game field
function renderGame() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  
  // Draw dummy players (24 NPCs around the room)
  state.dummyPlayers.forEach((dummy) => {
    if (dummy.isDead) {
      // Draw dead dummy as black circle
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.arc(dummy.x, dummy.y, 8, 0, Math.PI * 2)
      ctx.fill()
      // Draw a small outline
      ctx.strokeStyle = '#333333'
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      // Draw alive dummy
      // Only show yellow if this dummy is the ACTUAL current ball holder (not just hasBall flag)
      const dummyHasBall = dummy.raiderId !== null && state.currentHolderId === dummy.raiderId
      ctx.fillStyle = dummyHasBall ? '#ffff00' : '#666666'
      ctx.beginPath()
      ctx.arc(dummy.x, dummy.y, 8, 0, Math.PI * 2)
      ctx.fill()
      // Draw a small outline
      ctx.strokeStyle = '#888888'
      ctx.lineWidth = 1
      ctx.stroke()
      
      // Draw yellow border if dummy has ball (only current holder)
      if (dummyHasBall) {
        ctx.strokeStyle = '#ffff00'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(dummy.x, dummy.y, 10, 0, Math.PI * 2)
        ctx.stroke()
      }
      
      // Draw star icon if this dummy is a ball handler
      if (dummy.raiderId !== null && state.ballHandlers.includes(dummy.raiderId) && starIconLoaded) {
        ctx.save()
        ctx.translate(dummy.x - 18, dummy.y - 18) // Position at top left corner with more space from circle
        ctx.drawImage(starIcon, 0, 0, 16, 16)
        ctx.restore()
      }
    }
  })
  
  // Draw Submerge circle indicator (if active) - synchronized with timer
  if (state.bossAbilities.submerge.active) {
    const submerge = state.bossAbilities.submerge
    // Calculate elapsed time since ability started (for animation sync)
    const elapsedSinceStart = state.elapsedMs - submerge.startTime
    const progress = Math.min(elapsedSinceStart / submerge.duration, 1) // 0 to 1
    
    // Outer warning circle (pulsing) - synchronized with timer
    const pulse = Math.sin((elapsedSinceStart / 100) % (Math.PI * 2))
    const outerRadius = submerge.radius + pulse * 10
    
    // Draw outer warning ring (intensity increases as timer progresses)
    const ringOpacity = 0.5 + (progress * 0.5) // Fade in from 0.5 to 1.0
    ctx.strokeStyle = `rgba(255, 0, 0, ${ringOpacity})`
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(submerge.targetX, submerge.targetY, outerRadius, 0, Math.PI * 2)
    ctx.stroke()
    
    // Draw inner damage circle (intensity increases as timer progresses)
    // This is the actual damage radius - player must be within this circle to be hit
    const circleOpacity = 0.2 + (progress * 0.3) // Fade in from 0.2 to 0.5
    ctx.fillStyle = `rgba(255, 0, 0, ${circleOpacity})`
    ctx.beginPath()
    ctx.arc(submerge.targetX, submerge.targetY, submerge.radius, 0, Math.PI * 2)
    ctx.fill()
    
    // Draw a more visible inner edge to show exact damage boundary
    ctx.strokeStyle = `rgba(255, 255, 0, ${0.3 + progress * 0.4})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(submerge.targetX, submerge.targetY, submerge.radius, 0, Math.PI * 2)
    ctx.stroke()
    
    // Draw center target marker
    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(submerge.targetX, submerge.targetY, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // Draw adds (purple circles that chase ball holder)
  state.adds.forEach((add) => {
    ctx.fillStyle = '#800080' // Purple
    ctx.beginPath()
    ctx.arc(add.x, add.y, 10, 0, Math.PI * 2)
    ctx.fill()
    // Draw outline
    ctx.strokeStyle = '#a000a0'
    ctx.lineWidth = 2
    ctx.stroke()
  })
  
  // Draw boss (only if visible)
  if (state.bossVisible) {
    const bossSize = 40 // Small icon size
    
    if (bossImageLoaded && processedBossImage) {
      // Draw processed boss image (white background removed)
      ctx.save()
      ctx.translate(state.bossX, state.bossY)
      ctx.rotate(state.bossAngle)
      ctx.drawImage(processedBossImage, -bossSize / 2, -bossSize / 2, bossSize, bossSize)
      ctx.restore()
    } else {
      // Fallback: draw placeholder circle
      ctx.fillStyle = '#8b0000'
      ctx.beginPath()
      ctx.arc(state.bossX, state.bossY, bossSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Draw direction arrow on boss
    ctx.save()
    ctx.translate(state.bossX, state.bossY)
    ctx.rotate(state.bossAngle)
    ctx.fillStyle = '#ffff00'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.beginPath()
    // Arrow pointing right (will be rotated by bossAngle)
    ctx.moveTo(bossSize / 2 + 5, 0)
    ctx.lineTo(bossSize / 2 - 3, -4)
    ctx.lineTo(bossSize / 2 - 3, 4)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  
  // Draw Implacable Strike cone - synchronized with timer
  // Cone should always be drawn from where the boss circle is (state.bossX, state.bossY)
  if (state.bossAbilities.implacableStrike.active && state.bossVisible) {
    const strike = state.bossAbilities.implacableStrike
    const coneLength = 300
    const coneAngle = Math.PI / 3 // 60 degrees
    
    // Calculate elapsed time since ability started (for animation sync)
    const elapsedSinceStart = state.elapsedMs - strike.startTime
    const progress = Math.min(elapsedSinceStart / strike.duration, 1) // 0 to 1
    
    // Use cone start position from strike (where boss was when strike was cast)
    // This should match state.bossX and state.bossY
    const coneStartX = strike.coneStartX
    const coneStartY = strike.coneStartY
    
    // Debug: Verify cone position matches boss position
    if (Math.abs(coneStartX - state.bossX) > 1 || Math.abs(coneStartY - state.bossY) > 1) {
      console.warn('[boss] Position mismatch! Cone at:', coneStartX, coneStartY, 'Boss at:', state.bossX, state.bossY)
    }
    
    ctx.save()
    ctx.translate(coneStartX, coneStartY)
    ctx.rotate(strike.angle)
    
    // Draw purple cone (intensity increases as timer progresses)
    const coneOpacity = 0.3 + (progress * 0.4) // Fade in from 0.3 to 0.7
    const strokeOpacity = 0.5 + (progress * 0.5) // Fade in from 0.5 to 1.0
    ctx.fillStyle = `rgba(128, 0, 128, ${coneOpacity})`
    ctx.strokeStyle = `rgba(200, 0, 200, ${strokeOpacity})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(coneLength, -coneLength * Math.tan(coneAngle / 2))
    ctx.lineTo(coneLength, coneLength * Math.tan(coneAngle / 2))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    
    ctx.restore()
  }
  
  // Draw player (using state.playerX and state.playerY - all coordinates stored in state)
  // Log player position periodically for debugging (only when submerge is active)
  if (state.bossAbilities.submerge.active) {
    // Log every 500ms to avoid spam
    if (Math.floor(state.elapsedMs / 500) !== Math.floor((state.elapsedMs - 16) / 500)) {
      console.log('[player] Player position during Submerge:', {
        playerX: state.playerX.toFixed(2),
        playerY: state.playerY.toFixed(2),
        targetX: state.bossAbilities.submerge.targetX.toFixed(2),
        targetY: state.bossAbilities.submerge.targetY.toFixed(2),
        radius: state.bossAbilities.submerge.radius,
        distance: Math.sqrt(
          Math.pow(state.playerX - state.bossAbilities.submerge.targetX, 2) +
          Math.pow(state.playerY - state.bossAbilities.submerge.targetY, 2)
        ).toFixed(2),
        hasBall: state.currentHolderId === playerId
      })
    }
  }
  
  // Only draw player yellow if they are the ACTUAL current ball holder
  const playerHasBall = state.currentHolderId === playerId
  ctx.fillStyle = playerHasBall ? '#ffff00' : '#4a9eff'
  ctx.beginPath()
  ctx.arc(state.playerX, state.playerY, 10, 0, Math.PI * 2)
  ctx.fill()
  
  // Draw yellow border if player has ball (only current holder)
  if (playerHasBall) {
    ctx.strokeStyle = '#ffff00'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(state.playerX, state.playerY, 12, 0, Math.PI * 2)
    ctx.stroke()
  }
  
  // Draw star icon if player is a ball handler (top left corner, with more space)
  if (state.ballHandlers.includes(playerId) && starIconLoaded) {
    ctx.save()
    ctx.translate(state.playerX - 18, state.playerY - 18) // Position at top left corner with more space from circle
    ctx.drawImage(starIcon, 0, 0, 16, 16)
    ctx.restore()
  }
  
  // Debug: Draw player hitbox circle (for collision visualization)
  // Uses state.playerX and state.playerY
  if (state.currentHolderId === playerId) {
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(state.playerX, state.playerY, 10, 0, Math.PI * 2)
    ctx.stroke()
  }
  
  // Draw boss ability effects
  // Draw blue overlay when waterspout fountains are active (fades over 9 seconds)
  if (state.bossAbilities.waterspout.active && state.bossAbilities.waterspout.castTime !== undefined) {
    const timeSinceCast = state.elapsedMs - state.bossAbilities.waterspout.castTime
    const fadeDuration = 9000 // Fade out over 9 seconds
    const fadeProgress = Math.min(timeSinceCast / fadeDuration, 1) // 0 to 1
    const opacity = 0.2 * (1 - fadeProgress) // Start at 20%, fade to 0%
    ctx.fillStyle = `rgba(100, 150, 255, ${opacity})` // Blue-ish, fading opacity
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height)
  }
  
  // Draw waterspout fountains
  state.waterspoutFountains.forEach((fountain: WaterspoutFountain) => {
    // Draw fountain circle (blue)
    const timeSinceSpawn = state.elapsedMs - fountain.spawnTime
    const pulse = Math.sin((timeSinceSpawn / 200) % (Math.PI * 2))
    const opacity = 0.4 + pulse * 0.2 // Pulsing opacity
    
    // Outer ring
    ctx.strokeStyle = `rgba(100, 200, 255, ${opacity})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(fountain.x, fountain.y, fountain.radius, 0, Math.PI * 2)
    ctx.stroke()
    
    // Inner fill
    ctx.fillStyle = `rgba(100, 200, 255, ${opacity * 0.3})`
    ctx.beginPath()
    ctx.arc(fountain.x, fountain.y, fountain.radius, 0, Math.PI * 2)
    ctx.fill()
    
    // Center indicator
    ctx.fillStyle = `rgba(100, 200, 255, ${opacity})`
    ctx.beginPath()
    ctx.arc(fountain.x, fountain.y, 5, 0, Math.PI * 2)
    ctx.fill()
  })
  // Submerge visual effect is drawn above (circle indicator)
  if (state.bossAbilities.implacableStrike.active) {
    // TODO: Draw implacable strike visual effect
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'
    ctx.lineWidth = 5
    ctx.strokeRect(0, 0, gameCanvas.width, gameCanvas.height)
  }
  
  // Draw hover tooltip LAST so it appears on top of everything
  if (hoveredRaider) {
    const tooltipX = hoveredRaider.x
    const tooltipY = hoveredRaider.y - 30 // Above the raider
    
    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 1
    
    // Measure text to size the tooltip
    ctx.font = '12px Roboto, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const textMetrics = ctx.measureText(hoveredRaider.name)
    const textWidth = textMetrics.width
    const padding = 8
    const tooltipWidth = textWidth + padding * 2
    const tooltipHeight = 20
    
    // Draw rounded rectangle background
    const cornerRadius = 4
    ctx.beginPath()
    ctx.moveTo(tooltipX - tooltipWidth / 2 + cornerRadius, tooltipY - tooltipHeight / 2)
    ctx.lineTo(tooltipX + tooltipWidth / 2 - cornerRadius, tooltipY - tooltipHeight / 2)
    ctx.quadraticCurveTo(tooltipX + tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipX + tooltipWidth / 2, tooltipY - tooltipHeight / 2 + cornerRadius)
    ctx.lineTo(tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2 - cornerRadius)
    ctx.quadraticCurveTo(tooltipX + tooltipWidth / 2, tooltipY + tooltipHeight / 2, tooltipX + tooltipWidth / 2 - cornerRadius, tooltipY + tooltipHeight / 2)
    ctx.lineTo(tooltipX - tooltipWidth / 2 + cornerRadius, tooltipY + tooltipHeight / 2)
    ctx.quadraticCurveTo(tooltipX - tooltipWidth / 2, tooltipY + tooltipHeight / 2, tooltipX - tooltipWidth / 2, tooltipY + tooltipHeight / 2 - cornerRadius)
    ctx.lineTo(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2 + cornerRadius)
    ctx.quadraticCurveTo(tooltipX - tooltipWidth / 2, tooltipY - tooltipHeight / 2, tooltipX - tooltipWidth / 2 + cornerRadius, tooltipY - tooltipHeight / 2)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    
    // Draw text
    ctx.fillStyle = '#eef2ff'
    ctx.fillText(hoveredRaider.name, tooltipX, tooltipY)
  }
}


let lastFrame = performance.now()
function loop(now: number) {
  const dt = now - lastFrame
  lastFrame = now

  if (state.phase === 'menu') {
    // Show menu, don't update game, but keep loop running
    requestAnimationFrame(loop)
    return
  }

  if (state.phase === 'running') {
    state.elapsedMs += dt

    // Check for win condition: survive 3 minutes (180000ms)
    const WIN_TIME_MS = 180000 // 3 minutes
    if (state.elapsedMs >= WIN_TIME_MS) {
      gameOver('Victory! You survived 3 minutes!', true)
      return
    }

    // Phase 2: Update movement and boss abilities
    updateMovement(dt)
    updateBossAbilities(dt)
    updateAdds(dt)
    
    // Schedule bot pass (handles both huddle passes and ball handler danger passes)
    // Only schedule if not already scheduled (avoid clearing pending passes)
    if (state.currentHolderId !== null && state.currentHolderId !== playerId && state.botPassTimeout === null) {
      scheduleBotPass()
    }
    
    // Spawn adds every 30 seconds
    const ADD_SPAWN_INTERVAL = 30000 // 30 seconds
    if (state.elapsedMs - state.lastAddSpawnTime >= ADD_SPAWN_INTERVAL) {
      spawnAdds()
      state.lastAddSpawnTime = state.elapsedMs
    }
    
    renderGame()

    if (state.huddleActive) {
      state.timeRemaining -= dt
      if (state.timeRemaining <= 0) {
        gameOver('Huddled allies succumbed to terror.')
      }
    } else {
      state.timeToNextHuddle -= dt
      if (state.timeToNextHuddle <= 0) {
        startHuddle()
      }
    }
  }

  domManager.updateScore(formatSeconds(state.elapsedMs))

  if (state.huddleActive) {
    domManager.updateTimer(formatSeconds(Math.max(state.timeRemaining, 0)))
  } else if (state.phase === 'running') {
    domManager.updateTimer(
      state.timeToNextHuddle > 0 ? `Next in ${(state.timeToNextHuddle / 1000).toFixed(1)}s` : '—'
    )
  } else {
    domManager.updateTimer('—')
  }

  requestAnimationFrame(loop)
}

updateRaiders()
requestAnimationFrame(loop)

