import type { KalemApi } from '../../shared/types';

declare global {
  interface Window {
    kalem: KalemApi;
    vtext: KalemApi;
  }
}

export {};
