/// <reference types="vite/client" />

declare module '*.glsl' {
  const content: string;
  export default content;
}

declare module '*.vert' {
  const content: string;
  export default content;
}

declare module '*.frag' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
