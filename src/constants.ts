/**
 * Game constants and configuration
 */

export const GAME_CONFIG = {
  RAID_SIZE: 25,
  HUDDLE_SIZE: 5,
  HUDDLE_DURATION_MS: 10000, // 10 seconds
  NEXT_HUDDLE_MIN_MS: 11500, // 1.5s + 10s = 11.5s
  NEXT_HUDDLE_MAX_MS: 13200, // 3.2s + 10s = 13.2s
  WIN_TIME_MS: 180000, // 3 minutes
  ADD_SPAWN_INTERVAL_MS: 30000, // 30 seconds
  ADD_PAUSE_DURATION_MS: 500, // 0.5 seconds after ball pass
  ADD_BASE_SPEED: 0.3,
  ADD_SPEED_REDUCTION: 0.05, // Speed reduction after each pass
  DUMMY_DEATH_PROBABILITY: 0.05, // 5% chance to die if not moving out
  DUMMY_MOVEMENT_SPEED: 1.5,
  PLAYER_MOVEMENT_SPEED: 2.5,
  PLAYER_RADIUS: 10,
  DUMMY_RADIUS: 8,
  BOSS_RADIUS: 20,
  ADD_RADIUS: 12,
  FOUNTAIN_RADIUS: 13,
  FOUNTAIN_DEADLY_TIME_MS: 3000, // 3 seconds
  SUBMERGE_RADIUS: 150,
  SUBMERGE_DURATION_MS: 3000,
  IMPLACABLE_STRIKE_DURATION_MS: 3000,
  IMPLACABLE_STRIKE_CONE_ANGLE: Math.PI / 3, // 60 degrees
  IMPLACABLE_STRIKE_RANGE: 400,
  ABILITY_QUEUE_DELAY_MS: 500, // 0.5 seconds between abilities
  WATERSPOUT_DURATION_MS: 9000, // 9 seconds total
  WATERSPOUT_FOUNTAIN_INTERVAL_MS: 3000, // 3 seconds between fountains
  WATERSPOUT_NEXT_CAST_INTERVAL_MS: 20000, // 20 seconds between casts
  WATERSPOUT_BACKGROUND_OPACITY: 0.2, // 20% opacity
  SUBMERGE_TARGET_PLAYER_CHANCE: 0.6, // 60% chance to target player
  IMPLACABLE_STRIKE_TARGET_PLAYER_CHANCE: 0.6, // 60% chance to face player
} as const

export const STORAGE_KEYS = {
  TRIES: 'sha-of-fear-tries',
} as const

export const PLAYER_CONFIG = {
  NAME: 'Deathstone',
  SLOT: 12, // center tile in 5x5 grid
} as const

export const ROSTER_NAMES = [
  'Bojack',
  'Xanadar',
  'Katselas',
  'Reptizar',
  'Masny',
  'Morbodolor',
  'Casinogirl',
  'Plimpsy',
  'Adamant',
  'Quaba',
  'Sweetdog',
  'Ridikool',
  'Stol',
  'Gomaro',
  'Zinoxidus',
  'Jasminna',
  'Lockkstock',
  'Mafias',
  'Jaw',
  'Olriest',
  'Svuup',
  'Peptidopup',
  'Plexmonk',
  'Ranomi',
] as const