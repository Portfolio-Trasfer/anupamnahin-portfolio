uniform sampler2D uTexture;
uniform vec2 uImageSize;          // Natural texture width & height (e.g., 1920.0, 1280.0)
uniform vec2 uPlaneSize;          // Strip width & height in px
uniform vec2 uViewportSize;       // Viewport width & height in px
uniform float uProgress;          // 0.0 = strip, 1.0 = fullscreen
uniform float uParallax;          // Normalized horizontal parallax offset [-0.25, 0.25]
uniform float uVelocity;          // Scroll velocity for subtle RGB shift
uniform float uOpacity;           // For fading non-active views
uniform float uRgbShiftStrength;  // Live chromatic aberration strength

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
  float rgbShift = clamp(abs(uVelocity) * uRgbShiftStrength * (1.0 - uProgress), 0.0, 0.012);
  float r = texture2D(uTexture, finalUv + vec2(rgbShift, 0.0)).r;
  float g = texture2D(uTexture, finalUv).g;
  float b = texture2D(uTexture, finalUv - vec2(rgbShift, 0.0)).b;

  gl_FragColor = vec4(vec3(r, g, b), uOpacity);
}
