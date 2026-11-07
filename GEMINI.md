# Project Specification: Aristide Benoist-Inspired WebGL Portfolio

## 1. Role & Execution Protocol
You are an expert Creative Developer specializing in WebGL (Three.js), GLSL shaders, GSAP motion design, and smooth virtual scroll physics. Your objective is to build a high-frame-rate portfolio inspired by https://aristidebenoist.com/.

### Mandatory Phase Gate (CRITICAL)
- **Phase 1 (Current Phase): Environment Setup & Dependency Installation ONLY.**
  1. Initialize the Vite + TypeScript project in the current workspace directory.
  2. Install all required production and development dependencies via terminal.
  3. Configure `vite.config.ts`, `tsconfig.json`, and `tailwind.config.js`.
  4. Scaffold the exact folder and empty/boilerplate file structure defined in Section 3.
  5. Run `npm run build` and start the dev server to verify zero configuration errors.
  6. **STOP and ask for user confirmation** before implementing full WebGL scene logic or shaders in Phase 2.

---

## 2. Tech Stack & Dependencies
Use `npm` to install the exact stack below:

### Production Dependencies
- `three` (Core 3D/WebGL rendering engine for orthographic/perspective plane manipulation)
- `gsap` (Timeline transitions, uniform tweening, and staggered text reveals)
- `lenis` (Smooth virtual scroll & inertia velocity tracking)
- `split-type` (Character and line splitting for kinetic typography animations)

### Development Dependencies
- `typescript`
- `vite`
- `vite-plugin-glsl` (Import `.vert` and `.frag` shader files directly as strings)
- `@types/three`
- `tailwindcss`
- `postcss`
- `autoprefixer`

### Installation Commands for Agent
```bash
npm create vite@latest . -- --template vanilla-ts
npm install three gsap lenis split-type
npm install -D @types/three vite-plugin-glsl tailwindcss postcss autoprefixer
npx tailwindcss init -p
.
├── GEMINI.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── fonts/
│   └── textures/
│       ├── project-01.jpg
│       ├── project-02.jpg
│       ├── project-03.jpg
│       ├── project-04.jpg
│       └── project-05.jpg
└── src/
    ├── main.ts                  # Application entry point & single RAF loop
    ├── style.css                # Tailwind directives + fixed viewport lock
    ├── types/
    │   └── glsl.d.ts            # TypeScript declarations for *.vert and *.frag
    ├── data/
    │   └── projects.ts          # Project metadata (title, client, year, texture path)
    ├── utils/
    │   ├── math.ts              # lerp, clamp, map, damp utilities
    │   └── sizes.ts             # Viewport resize observer & pixel-to-WebGL unit mapper
    ├── components/
    │   ├── Hud.ts               # Fixed corners, center '+' crosshair, index counter
    │   └── Navigation.ts        # Index / About view state controller
    ├── gl/
    │   ├── World.ts             # Three.js WebGLRenderer, PerspectiveCamera, Scene
    │   ├── Slider.ts            # Infinite horizontal strip group, drag/wheel physics
    │   └── MediaPlane.ts        # Individual project Mesh, DOM bounds sync, expand state
    └── shaders/
        ├── slider.vert          # Vertex deformation (velocity bend + fullscreen expansion)
        └── slider.frag          # Fragment UV cover scaling, parallax offset, RGB shift
        No Native Scrollbars: Lock html, body to width: 100vw; height: 100vh; overflow: hidden; user-select: none; background-color: #0e0e0e; color: #f4f4f4;.

Canvas Layering: The #webgl-canvas must be position: fixed; inset: 0; pointer-events: none; z-index: 1;. Interactive DOM triggers and HUD overlays sit at z-index: 10.

HUD Chrome:

Top-left: Site title / Designer name.

Top-right: Index and About view toggles.

Center: Fixed 12px × 12px minimal + crosshair SVG (opacity: 0.4).

Bottom-center: Live project counter formatted as 01 — 05 that updates as planes pass the center crosshair.
Narrow Vertical Strips: In the default home state, render projects as a horizontal row of tall, narrow vertical planes centered vertically in the viewport.

Inner Texture Parallax: As the slider translates horizontally, calculate each plane's normalized viewport offset [-1, 1] and shift the texture UV horizontally inside the fragment shader so the image pans smoothly inside its narrow frame.

Velocity Wave Deformation: Pass scroll/drag velocity (uVelocity) to slider.vert. Apply a subtle sine-wave curve along the X/Z axes proportional to uVelocity so planes flex organically during fast scrolling or dragging.

Plane-to-Fullscreen Morph: Clicking a project plane tweens uProgress from 0 to 1 via GSAP (expo.inOut, 1.2s). Inside the vertex shader, interpolate the plane geometry from its strip dimensions/position to full viewport dimensions (uViewportSizes) while adjacent planes translate out of view.
Single requestAnimationFrame Loop: Run exactly one master RAF loop in src/main.ts that updates virtual scroll, slider lerp (ease = 0.075), uniforms, and renderer.render().

Pixel-Accurate DOM-to-WebGL Sync: Compute camera FOV so that 1 Three.js unit = 1 CSS pixel at z = 0 using:fov = 2 * Math.atan((viewportHeight / 2) / cameraZ) * (180 / Math.PI)

Type Safety: Declare *.glsl, *.vert, and *.frag modules in src/types/glsl.d.ts. Never use @ts-ignore.

Placeholders: During Phase 1 setup, generate high-resolution placeholder textures or procedural canvas textures in public/textures/ so the build runs out of the box without missing asset errors.
### 2. Trigger Phase 2 in Antigravity IDE

Once Phase 1 finishes and you have appended Section 5 to `GEMINI.md`, run this prompt in the Antigravity Agent chat:

```text
Phase 1 is verified. Read Section 5 of GEMINI.md and execute Phase 2:
1. Generate 5 high-contrast procedural canvas textures (or load local textures in `public/textures/`) so each project strip has distinct visual patterns and typography.
2. Implement `slider.vert` and `slider.frag` using the exact GLSL uniforms and cover UV math specified in Section 5.
3. Implement `World.ts`, `MediaPlane.ts`, and `Slider.ts` with pixel-accurate camera FOV sync, wheel + pointer drag inertia, velocity wave bending, center crosshair index detection, and the GSAP strip-to-fullscreen expansion state machine.
4. Wire up the HUD overlay (`Hud.ts` and `Navigation.ts`) with the fixed center '+' crosshair, live `01 — 05` counter, kinetic project title transitions using `split-type`, and an 'About' overlay toggle.
5. Run `npm run build` to verify zero TypeScript or GLSL compilation errors, then start the preview server.
---

## 5. Phase 2 Specification: Shaders, Physics & Fullscreen Morph

### A. Coordinate System & Camera Sync (`src/gl/World.ts`)
- Set `camera.position.z = 600`.
- Synchronize camera field-of-view on load and resize so `1 Three.js world unit = 1 CSS pixel` at `z = 0`:
  ```ts
  const fov = 2 * Math.atan((viewportHeight / 2) / this.camera.position.z) * (180 / Math.PI);
  this.camera.fov = fov;
  this.camera.aspect = viewportWidth / viewportHeight;
  this.camera.updateProjectionMatrix();
  ```
- Base geometry for all planes must be a single shared `new THREE.PlaneGeometry(1, 1, 64, 64)` with `mesh.frustumCulled = false`.
- Position and scale each plane inside the vertex shader via uniforms (`uPlaneSize`, `uPlanePosition`, `uViewportSize`) so per-vertex wave interpolation between strip mode and fullscreen mode is seamless.

### B. Vertex Shader (`src/shaders/slider.vert`)
Implement this exact vertex transformation pipeline for the velocity curve and staggered fullscreen expansion:

```glsl
uniform vec2 uPlaneSize;       // Strip width & height in px (e.g., 220.0, 460.0)
uniform vec2 uPlanePosition;   // Strip X & Y position in world px
uniform vec2 uViewportSize;    // Fullscreen width & height in px
uniform float uProgress;       // 0.0 = strip state, 1.0 = expanded fullscreen state
uniform float uVelocity;       // Current scroll/drag inertia velocity
uniform float uAdjacentOffset; // Pushes neighboring strips away when one expands

varying vec2 vUv;
varying float vProgress;

const float PI = 3.1415926535897932384626433832795;

void main() {
  vUv = uv;
  vProgress = uProgress;

  // 1. Staggered per-vertex activation wave during fullscreen morph
  float distFromCenter = length(uv - 0.5);
  float waveProgress = clamp((uProgress * 1.4) - (distFromCenter * 0.4), 0.0, 1.0);
  float smoothWave = smoothstep(0.0, 1.0, waveProgress);

  // 2. Interpolate dimensions & center position from strip to fullscreen
  vec2 currentSize = mix(uPlaneSize, uViewportSize, smoothWave);
  vec2 stripPos = vec2(uPlanePosition.x + uAdjacentOffset, uPlanePosition.y);
  vec2 currentCenter = mix(stripPos, vec2(0.0, 0.0), smoothWave);

  vec3 pos = position;
  pos.xy *= currentSize;
  pos.xy += currentCenter;

  // 3. Horizontal velocity bend (reduced to 0 as plane expands fullscreen)
  float normalizedX = pos.x / (uViewportSize.x * 0.5);
  float bendStrength = (1.0 - smoothWave) * uVelocity * 1.8;
  pos.z += sin(normalizedX * PI * 0.5) * bendStrength * 35.0;
  pos.x -= sin(uv.y * PI) * bendStrength * 12.0;

  // 4. Bring active plane forward in Z space during expansion
  pos.z += smoothWave * 10.0;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

### C. Fragment Shader (`src/shaders/slider.frag`)
Use dynamic `object-fit: cover` UV math that interpolates container dimensions from `uPlaneSize` to `uViewportSize` as `uProgress` moves from `0.0` to `1.0`. This ensures the texture un-crops smoothly without stretching:

```glsl
uniform sampler2D uTexture;
uniform vec2 uImageSize;       // Natural texture width & height (e.g., 1920.0, 1280.0)
uniform vec2 uPlaneSize;       // Strip width & height in px
uniform vec2 uViewportSize;    // Viewport width & height in px
uniform float uProgress;       // 0.0 = strip, 1.0 = fullscreen
uniform float uParallax;       // Normalized horizontal parallax offset [-0.25, 0.25]
uniform float uVelocity;       // Scroll velocity for subtle RGB shift
uniform float uOpacity;        // For fading non-active views

varying vec2 vUv;
varying float vProgress;

vec2 getCoverUv(vec2 uv, vec2 containerSize, vec2 mediaSize) {
  vec2 ratio = vec2(
    min((containerSize.x / containerSize.y) / (mediaSize.x / mediaSize.y), 1.0),
    min((containerSize.y / containerSize.x) / (mediaSize.y / mediaSize.x), 1.0)
  );
  return vec2(
    uv.x * ratio.x + (1.0 - ratio.x) * 0.5,
    uv.y * ratio.y + (1.0 - ratio.y) * 0.5
  );
}

void main() {
  // Dynamically blend container aspect ratio from narrow strip to full viewport
  vec2 activeSize = mix(uPlaneSize, uViewportSize, uProgress);
  vec2 coverUv = getCoverUv(vUv, activeSize, uImageSize);

  // Apply inner horizontal parallax in strip mode; zero out in fullscreen
  float parallaxShift = uParallax * (1.0 - uProgress);
  coverUv.x += parallaxShift;

  // Subtle scale zoom-out during expansion
  vec2 centeredUv = coverUv - 0.5;
  centeredUv *= mix(1.12, 1.0, uProgress);
  vec2 finalUv = centeredUv + 0.5;

  // Subtle velocity-driven RGB shift
  float rgbShift = clamp(abs(uVelocity) * 0.0015 * (1.0 - uProgress), 0.0, 0.012);
  float r = texture2D(uTexture, finalUv + vec2(rgbShift, 0.0)).r;
  float g = texture2D(uTexture, finalUv).g;
  float b = texture2D(uTexture, finalUv - vec2(rgbShift, 0.0)).b;

  gl_FragColor = vec4(vec3(r, g, b), uOpacity);
}
```

### D. Slider Physics & Interaction State Machine (`src/gl/Slider.ts`)
1. **Metrics:**
   - `stripWidth = Math.min(window.innerWidth * 0.16, 220)`
   - `stripHeight = Math.min(window.innerHeight * 0.58, 480)`
   - `gap = Math.min(window.innerWidth * 0.035, 48)`
   - `step = stripWidth + gap`
2. **Scroll & Drag Loop (`main.ts` -> `Slider.update()`):**
   - Listen to `wheel` (`deltaY + deltaX`), `pointerdown`, `pointermove`, and `pointerup`.
   - Accumulate movement into `targetScroll`. Clamp `targetScroll` between `0` and `(projects.length - 1) * step` so the first and last strips can align directly over the center `+` crosshair (`x = 0`).
   - Interpolate every frame: `currentScroll = lerp(currentScroll, targetScroll, 0.075)`.
   - Compute `velocity = (targetScroll - currentScroll) * 0.05` and pass to each plane's `uVelocity`.
3. **Parallax & Center Crosshair Counter:**
   - Each plane's base X position is `planeX = index * step - currentScroll`.
   - Set `uParallax = clamp(planeX / (window.innerWidth * 0.65), -0.22, 0.22)`.
   - Active project index is `Math.round(currentScroll / step) + 1`. Update the bottom HUD counter (`01 — 05`) and project title whenever the active index changes.
4. **2D Hit-Testing & Fullscreen Expansion:**
   - Distinguish a click from a drag (`pointerDownX` vs `pointerUpX` distance `< 6px`).
   - On click, convert pointer coordinates to centered world pixels:
     `worldX = event.clientX - window.innerWidth / 2`
     `worldY = -(event.clientY - window.innerHeight / 2)`
   - If `isExpanded === false`: check which strip contains `(worldX, worldY)`. When matched:
     - Lock slider scrolling (`isExpanded = true`).
     - Tween `targetScroll` to `clickedIndex * step` so the strip centers cleanly.
     - Tween the clicked plane's `uProgress` from `0` to `1` (`gsap.to(..., { value: 1, duration: 1.25, ease: 'expo.inOut' })`).
     - Tween all other planes' `uAdjacentOffset` to `Math.sign(otherIndex - clickedIndex) * window.innerWidth * 0.8` with `expo.inOut` (`1.25s`) so neighboring strips part like curtains.
     - Reveal the expanded project's typography overlay (`SplitType` line reveal) and a top-left `Close` trigger.
   - If `isExpanded === true`: clicking `Close` or pressing `Escape` reverses `uProgress` to `0` and `uAdjacentOffset` to `0`, unlocking slider scrolling on completion.
   ## 6. Phase 3 Specification: Visual Admin Panel & Zero-Dependency Vite CMS

### A. Architecture & Persistence (`public/data/portfolio.json` + Vite Middleware)
- Move all portfolio content into `public/data/portfolio.json` as the single source of truth:
  - `settings`: `{ brandName, aboutBio, contactEmail, socials: [], bendStrength, rgbShiftStrength, scrollEase }`
  - `projects`: Array of `{ id, title, client, role, year, description, textureUrl, imageWidth, imageHeight }`
- In `vite.config.ts`, create a custom Vite plugin (`portfolioCmsPlugin`) using Node's built-in `fs` and `path` modules with two local endpoints:
  1. `POST /api/cms/save`: Writes the updated JSON payload directly to `public/data/portfolio.json`.
  2. `POST /api/cms/upload`: Accepts a base64-encoded image file (`{ filename, base64Data }`), saves the binary file into `public/textures/<filename>`, and returns the public path `/textures/<filename>`.
- Include a `localStorage` fallback (`portfolio_cms_override`) and an "Export JSON" button so the Admin Panel also works in static preview environments.

### B. Admin Panel UI (`src/components/AdminPanel.ts`)
- **Access Trigger:** Toggle the Admin Panel via a subtle `Admin` button in the bottom-right HUD, the URL hash `#admin`, or the keyboard shortcut `Shift + A`.
- **Layout:** A sleek dark-mode slide-over drawer (`z-index: 50`, `backdrop-filter: blur(16px)`, `background: rgba(14, 14, 14, 0.92)`) with isolated pointer/wheel events (`event.stopPropagation()`) so scrolling inside the admin panel does not scroll the WebGL slider behind it.
- **Tabs & Features:**
  1. **Projects Tab (CRUD + Drag/Upload):**
     - List all projects with thumbnail previews, **Move Up / Move Down** reorder buttons, **Delete**, and **+ Add Project**.
     - Editable fields per project: `Title`, `Client`, `Role`, `Year`, and `Description`.
     - **Image Upload Dropzone:** Selecting or dropping a `.jpg/.png/.webp` file reads its natural `width` and `height` via an `Image()` object, uploads it to `/api/cms/upload` (saving it to `public/textures/`), and immediately swaps the Three.js texture in the live WebGL scene.
  2. **Site & About Tab:**
     - Edit top-left `Brand Name`, `About Bio` text, `Contact Email`, and social links.
  3. **WebGL & Shader Tuning Tab:**
     - Live range sliders for `Wave Bend Strength` (`0.0` to `4.0`), `RGB Shift Intensity` (`0.0` to `0.03`), and `Scroll Inertia Ease` (`0.03` to `0.15`) that update the shader uniforms in real time.
- **Save Action:** Clicking **Save Changes** posts the updated state to `/api/cms/save`, flashes a confirmation badge, and hot-reloads the HUD and WebGL strips without refreshing the page.

### C. Live WebGL Hot-Reload (`src/gl/Slider.ts`)
- Add a public `rebuild(projectsData, settingsData)` method on `Slider.ts`:
  - Disposes old Three.js meshes and textures cleanly (`material.dispose()`, `texture.dispose()`).
  - Re-instantiates the `MediaPlane` array from the updated project list and recalculates scroll clamping (`(projects.length - 1) * step`).
  - Updates shader uniforms immediately when the Admin Panel sliders change.