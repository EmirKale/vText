import type { kalemApi } from '../../preload/index';

declare global {
  interface Window {
    kalem: typeof kalemApi;
    vtext: typeof kalemApi;
  }
}

export {};
