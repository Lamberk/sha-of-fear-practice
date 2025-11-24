/**
 * DOM element management and utilities
 */

import { GAME_CONFIG, STORAGE_KEYS, PLAYER_CONFIG, ROSTER_NAMES } from './constants'
import type { Raider } from './types'

export class DOMManager {
  private app: HTMLDivElement
  private raidGrid!: HTMLDivElement
  private gamePanel!: HTMLDivElement
  private gameCanvas!: HTMLCanvasElement
  private scoreEl!: HTMLSpanElement
  private timerEl!: HTMLSpanElement
  private triesEl!: HTMLSpanElement
  private overlayEl!: HTMLDivElement
  private overlayTitle!: HTMLHeadingElement
  private overlayReason!: HTMLParagraphElement
  private overlayScore!: HTMLSpanElement
  private restartBtn!: HTMLButtonElement
  private startMenuEl!: HTMLDivElement
  private roleButtons!: NodeListOf<HTMLButtonElement>
  private ballHighlightFrame!: HTMLDivElement
  private canvasContext!: CanvasRenderingContext2D

  constructor() {
    const appElement = document.querySelector<HTMLDivElement>('#app')
    if (!appElement) throw new Error('Missing #app container')
    this.app = appElement

    this.initializeHTML()
    this.initializeElements()
    this.initializeCanvas()
  }

  private initializeHTML(): void {
    this.app.innerHTML = `
      <main class="game-shell">
        <section class="left-panel">
          <header class="control-panel__header">
            <h1>Sha of Fear Drill</h1>
            <p class="subtitle">Phase 2 · Transfer Light practice</p>
          </header>
          <div class="stat-grid">
            <article class="stat-card">
              <span class="label">Score</span>
              <strong id="scoreValue">0.0s</strong>
            </article>
            <article class="stat-card">
              <span class="label">Huddle timer</span>
              <strong id="timerValue">—</strong>
            </article>
            <article class="stat-card">
              <span class="label">Tries</span>
              <strong id="triesValue">0</strong>
            </article>
          </div>
          <div class="raid-grid" data-element="raid-grid"></div>
        </section>
        <section class="game-panel">
          <div class="game-field" data-element="game-field">
            <canvas id="game-canvas" data-element="game-canvas"></canvas>
          </div>
          <div class="game-overlay hidden" data-element="game-over">
            <div class="game-overlay__card">
              <h2 class="game-over__title" data-element="game-over-title">Wipe!</h2>
              <p class="game-over__reason" data-element="game-over-reason"></p>
              <p class="game-over__score">Final score: <span data-element="game-over-score">0.0s</span></p>
              <button type="button" data-element="restart-btn">Restart (R)</button>
            </div>
          </div>
          <div class="start-menu" data-element="start-menu">
            <div class="start-menu__card">
              <h2>Sha of Fear Drill</h2>
              <p>Select your role:</p>
              <div class="role-selector">
                <button type="button" data-role="regular" class="role-btn">Regular Gamer</button>
                <button type="button" data-role="ball_handler" class="role-btn">Ball Handler</button>
              </div>
              <section class="instructions">
                <h3>How to play</h3>
                <ul>
                  <li>WASD: move (can't move when holding ball)</li>
                  <li>Boss casts abilities automatically: Submerge, Implacable Strike</li>
                  <li>Mouseover: choose ally</li>
                  <li>Press <kbd>1</kbd>: pass Transfer Light</li>
                </ul>
                <div class="win-lose-conditions">
                  <h3>Winning Condition</h3>
                  <p>Survive for <strong>3 minutes</strong> without dying.</p>
                  <h3>Losing Conditions</h3>
                  <ul>
                    <li>Fail to clear all five huddled allies within 5 seconds</li>
                    <li>Get hit by boss abilities (Submerge or Implacable Strike) while holding the ball</li>
                    <li>Get caught by purple adds while holding the ball</li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    `
  }

  private initializeElements(): void {
    this.raidGrid = this.app.querySelector<HTMLDivElement>('[data-element="raid-grid"]')!
    this.gamePanel = this.app.querySelector<HTMLDivElement>('.game-panel')!
    this.gameCanvas = this.app.querySelector<HTMLCanvasElement>('[data-element="game-canvas"]')!
    this.scoreEl = this.app.querySelector<HTMLSpanElement>('#scoreValue')!
    this.timerEl = this.app.querySelector<HTMLSpanElement>('#timerValue')!
    this.triesEl = this.app.querySelector<HTMLSpanElement>('#triesValue')!
    this.overlayEl = this.app.querySelector<HTMLDivElement>('[data-element="game-over"]')!
    this.overlayTitle = this.app.querySelector<HTMLHeadingElement>('[data-element="game-over-title"]')!
    this.overlayReason = this.app.querySelector<HTMLParagraphElement>('[data-element="game-over-reason"]')!
    this.overlayScore = this.app.querySelector<HTMLSpanElement>('[data-element="game-over-score"]')!
    this.restartBtn = this.app.querySelector<HTMLButtonElement>('[data-element="restart-btn"]')!
    this.startMenuEl = this.app.querySelector<HTMLDivElement>('[data-element="start-menu"]')!
    this.roleButtons = this.app.querySelectorAll<HTMLButtonElement>('[data-role]')!

    // Create ball highlight frame
    this.ballHighlightFrame = document.createElement('div')
    this.ballHighlightFrame.className = 'ball-highlight-frame'
    this.gamePanel.appendChild(this.ballHighlightFrame)
  }

  private initializeCanvas(): void {
    const ctx = this.gameCanvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')
    this.canvasContext = ctx
  }

  getApp(): HTMLDivElement {
    return this.app
  }

  getRaidGrid(): HTMLDivElement {
    return this.raidGrid
  }

  getGamePanel(): HTMLDivElement {
    return this.gamePanel
  }

  getGameCanvas(): HTMLCanvasElement {
    return this.gameCanvas
  }

  getCanvasContext(): CanvasRenderingContext2D {
    return this.canvasContext
  }

  getScoreElement(): HTMLSpanElement {
    return this.scoreEl
  }

  getTimerElement(): HTMLSpanElement {
    return this.timerEl
  }

  getTriesElement(): HTMLSpanElement {
    return this.triesEl
  }

  getOverlayElement(): HTMLDivElement {
    return this.overlayEl
  }

  getOverlayTitle(): HTMLHeadingElement {
    return this.overlayTitle
  }

  getOverlayReason(): HTMLParagraphElement {
    return this.overlayReason
  }

  getOverlayScore(): HTMLSpanElement {
    return this.overlayScore
  }

  getRestartButton(): HTMLButtonElement {
    return this.restartBtn
  }

  getStartMenuElement(): HTMLDivElement {
    return this.startMenuEl
  }

  getRoleButtons(): NodeListOf<HTMLButtonElement> {
    return this.roleButtons
  }

  getBallHighlightFrame(): HTMLDivElement {
    return this.ballHighlightFrame
  }

  updateScore(score: string): void {
    this.scoreEl.textContent = score
  }

  updateTimer(timer: string): void {
    this.timerEl.textContent = timer
  }

  updateTries(tries: number): void {
    this.triesEl.textContent = String(tries)
  }

  showOverlay(title: string, reason: string, score: string, isVictory: boolean = false): void {
    this.overlayTitle.textContent = title
    this.overlayReason.textContent = reason
    this.overlayScore.textContent = score

    if (isVictory) {
      this.overlayTitle.classList.add('game-over__title--victory')
      this.overlayEl.classList.add('game-overlay--victory')
      this.overlayReason.classList.add('game-over__reason--victory')
    } else {
      this.overlayTitle.classList.remove('game-over__title--victory')
      this.overlayEl.classList.remove('game-overlay--victory')
      this.overlayReason.classList.remove('game-over__reason--victory')
    }

    this.overlayEl.classList.remove('hidden')
  }

  hideOverlay(): void {
    this.overlayEl.classList.add('hidden')
  }

  showStartMenu(): void {
    this.startMenuEl.classList.remove('hidden')
  }

  hideStartMenu(): void {
    this.startMenuEl.classList.add('hidden')
  }

  toggleBallHighlight(active: boolean): void {
    if (active) {
      this.ballHighlightFrame.classList.add('active')
    } else {
      this.ballHighlightFrame.classList.remove('active')
    }
  }
}

export class StorageManager {
  static loadTries(): number {
    const stored = localStorage.getItem(STORAGE_KEYS.TRIES)
    return stored ? parseInt(stored, 10) : 0
  }

  static saveTries(tries: number): void {
    localStorage.setItem(STORAGE_KEYS.TRIES, String(tries))
  }
}

export function createRaiders(raidGrid: HTMLDivElement): Raider[] {
  const raiders: Raider[] = []
  const raiderNames: string[] = [...ROSTER_NAMES]
  raiderNames.splice(PLAYER_CONFIG.SLOT, 0, PLAYER_CONFIG.NAME)
  if (raiderNames.length > GAME_CONFIG.RAID_SIZE) {
    raiderNames.length = GAME_CONFIG.RAID_SIZE
  }

  for (let i = 0; i < GAME_CONFIG.RAID_SIZE; i++) {
    const name = raiderNames[i] ?? `Raider ${i + 1}`
    const card = document.createElement('div')
    card.className = 'raider-card'
    card.setAttribute('data-id', String(i))

    const badge = document.createElement('span')
    badge.className = 'raider-badge'
    badge.textContent = ''

    const label = document.createElement('p')
    label.textContent = name

    // Create star icon for ball handlers
    const starIcon = document.createElement('img')
    starIcon.className = 'ball-handler-icon'
    starIcon.src = `${import.meta.env.BASE_URL}img/star_icon.png`
    starIcon.alt = 'Ball Handler'
    starIcon.style.display = 'none'
    starIcon.style.width = '16px'
    starIcon.style.height = '16px'
    starIcon.style.marginLeft = '4px'
    starIcon.style.verticalAlign = 'middle'

    // Wrap label and star icon in a container
    const labelContainer = document.createElement('span')
    labelContainer.style.display = 'flex'
    labelContainer.style.alignItems = 'center'
    labelContainer.style.justifyContent = 'center'
    labelContainer.style.width = '100%'
    labelContainer.appendChild(label)
    labelContainer.appendChild(starIcon)

    card.append(badge, labelContainer)
    raidGrid.appendChild(card)

    raiders.push({
      id: i,
      name,
      element: card,
      badge,
      isPlayer: i === PLAYER_CONFIG.SLOT,
      isHuddled: false,
      isRescued: false,
      hasBall: false,
      huddleOrder: null,
    })
  }

  return raiders
}

