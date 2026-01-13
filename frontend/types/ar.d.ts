// Declarações de tipo para AR.js
declare module "@ar-js-org/ar.js" {
  export const ARjs: any;
}

// Extensões para window
declare global {
  interface Window {
    AFRAME?: any;
    THREEx?: any;
  }
}

export {};
