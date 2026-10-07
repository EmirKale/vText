import { kalemApi } from './index';

declare global {
  interface Window {
    kalem: typeof kalemApi;
  }
}
