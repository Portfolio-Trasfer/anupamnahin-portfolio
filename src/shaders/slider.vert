uniform vec2 uPlaneSize;       // Strip width & height in px (e.g., 220.0, 460.0)
uniform vec2 uPlanePosition;   // Strip X & Y position in world px
uniform vec2 uViewportSize;    // Fullscreen width & height in px
uniform float uProgress;       // 0.0 = strip state, 1.0 = expanded fullscreen state
uniform float uVelocity;       // Current scroll/drag inertia velocity
uniform float uAdjacentOffset; // Pushes neighboring strips away when one expands
uniform float uBendStrength;   // Live wave bend tuning multiplier

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
  float bendStrength = (1.0 - smoothWave) * uVelocity * uBendStrength;
  pos.z += sin(normalizedX * PI * 0.5) * bendStrength * 35.0;
  pos.x -= sin(uv.y * PI) * bendStrength * 12.0;

  // 4. Bring active plane forward in Z space during expansion
  pos.z += smoothWave * 10.0;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
