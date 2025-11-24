# Sha of Fear Drill

A 2D browser-based training game for practicing the **Transfer Light** mechanic during the **Sha of Fear** encounter in World of Warcraft: Mists of Pandaria Classic.

## Overview

This game simulates Phase 2 of the Sha of Fear encounter, where players must quickly pass the "Transfer Light" ball to huddled allies to prevent them from dying. The game helps raiders practice:

- Quick target selection and ball passing
- Movement while avoiding boss abilities
- Coordination with ball handlers
- Managing multiple threats simultaneously

## Features

- **25-man raid simulation** with realistic raid frames
- **Huddle mechanic**: 5 random raiders get "Huddled in Terror" and must be rescued within 5 seconds
- **Boss abilities**:
  - **Submerge**: Boss disappears and reappears at a random location, dealing damage in a large circle
  - **Implacable Strike**: Frontal cone attack that must be avoided
  - **Waterspout**: Multiple fountains spawn under the player that deal damage if stood in too long
- **Adds**: Purple circles that chase the ball holder
- **Two roles**:
  - **Regular Gamer**: Focus on avoiding abilities and passing during huddles
  - **Ball Handler**: Responsible for managing the ball between huddles
- **Win condition**: Survive for 3 minutes without dying

## Installation

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd ball
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Building for Production

### Local Build

```bash
npm run build
npm run preview
```

### GitHub Pages Deployment

#### Option 1: Automatic Deployment with GitHub Actions (Recommended)

1. **Update the base path** in `vite.config.ts` to match your repository name:
```typescript
base: '/your-repo-name/', // Change 'ball' to your actual repository name
```

2. **Enable GitHub Pages FIRST** (this is required before the workflow can run):
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions** (not "Deploy from a branch")
   - Click **Save**
   - ⚠️ **Important**: You must enable Pages before pushing the workflow, or the first workflow run will fail

3. **Push your code** to the `main` branch:
```bash
git add .
git commit -m "Setup GitHub Pages deployment"
git push origin main
```

4. **The workflow will automatically deploy** your site whenever you push to `main`. You can view the deployment status in the **Actions** tab of your repository.

5. **Your site will be available at**: `https://your-username.github.io/your-repo-name/`

#### Option 2: Manual Deployment

1. **Update the base path** in `vite.config.ts`:
```typescript
base: '/your-repo-name/', // Change to match your repository name
```

2. **Build the project**:
```bash
npm run build
```

3. **Deploy using git subtree**:
```bash
# Create orphan branch (if it doesn't exist)
git checkout --orphan gh-pages
git rm -rf .

# Copy dist contents to root
cp -r dist/* .

# Commit and push
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages --force

# Switch back to main branch
git checkout main
```

4. **Enable GitHub Pages**:
   - Go to **Settings** → **Pages**
   - Select **Deploy from a branch**
   - Choose `gh-pages` branch and `/ (root)` folder
   - Click **Save**

#### Important Notes

- **Repository name**: Make sure the `base` path in `vite.config.ts` matches your repository name exactly (case-sensitive)
- **Custom domain**: If using a custom domain, set `base: '/'` in `vite.config.ts`
- **Build artifacts**: The `dist` folder is automatically generated and should not be committed to git

## How to Play

### Controls

- **WASD**: Move your character (cannot move while holding the ball)
- **Mouse**: Hover over allies to select them
- **1**: Pass Transfer Light to the selected ally
- **R**: Restart the game

### Gameplay

1. **Select your role** at the start menu:
   - **Regular Gamer**: You'll focus on avoiding abilities and passing during huddles
   - **Ball Handler**: You'll manage the ball between huddles and coordinate with other ball handlers

2. **During Huddles**:
   - 5 random raiders will be marked with numbers (1-5)
   - You must pass the ball to each huddled raider in order
   - If you fail to clear all 5 within 5 seconds, the game ends

3. **Avoiding Boss Abilities**:
   - **Submerge**: Move away from the yellow circle before the boss reappears
   - **Implacable Strike**: Move out of the red frontal cone
   - **Waterspout**: Don't stand in the blue fountains for more than 3 seconds

4. **Managing Adds**:
   - Purple circles will chase whoever has the ball
   - Pass the ball to another player if adds get too close
   - Adds pause briefly after each ball pass

5. **Winning**:
   - Survive for 3 minutes without dying
   - Your tries counter tracks attempts until you win

### Tips

- When you have the ball, you cannot move - plan your passes carefully
- Ball handlers should coordinate to avoid dangerous situations
- Watch for boss ability indicators and move preemptively
- The game gets harder as more adds spawn over time

## Project Structure

```
ball/
├── src/
│   ├── main.ts          # Main game loop and orchestration
│   ├── types.ts         # TypeScript type definitions
│   ├── constants.ts     # Game constants and configuration
│   ├── gameState.ts     # Game state management
│   ├── dom.ts           # DOM element management
│   └── style.css        # Game styles
├── img/
│   └── star_icon.png    # Ball handler indicator icon
├── index.html
├── package.json
├── vite.config.ts       # Vite configuration for GitHub Pages
└── README.md
```

## Development

### Code Style

The project follows SOLID principles and DRY (Don't Repeat Yourself) best practices:

- **Separation of Concerns**: Logic is separated into focused modules
- **Single Responsibility**: Each module has a clear, single purpose
- **Type Safety**: Full TypeScript coverage with proper type definitions
- **Clear Naming**: All variables and functions use descriptive names

### Key Modules

- **types.ts**: All TypeScript interfaces and types
- **constants.ts**: Game configuration and constants
- **gameState.ts**: State initialization and management
- **dom.ts**: DOM manipulation and element management
- **main.ts**: Game loop, event handling, and coordination

## Browser Compatibility

- Modern browsers with ES6+ support
- Canvas API support required
- LocalStorage for saving tries counter

## License

This project is created for educational and training purposes related to World of Warcraft gameplay.

## Credits

- Based on the Sha of Fear encounter from World of Warcraft: Mists of Pandaria
- Boss image from [MythicTrap](https://mythictrap.com)

## Contributing

Feel free to submit issues or pull requests for improvements!