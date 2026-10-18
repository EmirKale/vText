import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloseCoordinator } from '../src/main/closeCoordinator';

describe('CloseCoordinator (Pencere Kapatma Koordinatörü ve Zaman Aşımı)', () => {
  let coordinator: CloseCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();
    coordinator = new CloseCoordinator();
  });

  afterEach(() => {
    coordinator.reset();
    vi.restoreAllMocks();
  });

  it('closePending true iken 3500ms sonra onTimeout tetiklenmelidir', () => {
    let timeoutFired = false;
    coordinator.setClosePending(true);

    coordinator.startCloseTimeout(() => {
      timeoutFired = true;
    }, 3500);

    expect(timeoutFired).toBe(false);

    // 3499ms sonra henüz tetiklenmemeli
    vi.advanceTimersByTime(3499);
    expect(timeoutFired).toBe(false);

    // 3500ms dolduğunda tetiklenmeli
    vi.advanceTimersByTime(1);
    expect(timeoutFired).toBe(true);
  });

  it('Renderer yanıt verdiğinde (promptingClose/stopCloseTimeout), zaman aşımı durmalı ve onTimeout tetiklenmemelidir', () => {
    let timeoutFired = false;
    coordinator.setClosePending(true);

    coordinator.startCloseTimeout(() => {
      timeoutFired = true;
    }, 3500);

    // 1000ms sonra renderer yanıt verir ve prompt açtığını bildirir
    vi.advanceTimersByTime(1000);
    coordinator.stopCloseTimeout();

    // Süre aşılsa bile timeout artık çalışmamalıdır
    vi.advanceTimersByTime(5000);
    expect(timeoutFired).toBe(false);
  });

  it('"Bekle" seçildiğinde closePending sıfırlanmalı ve yeni kapatma isteklerine izin verilmelidir', () => {
    coordinator.setClosePending(true);
    expect(coordinator.isClosing()).toBe(true);

    // Kullanıcıya dialog gösterildiğinde "Bekle" seçti:
    coordinator.setClosePending(false);
    expect(coordinator.isClosing()).toBe(false);

    // Kullanıcı tekrar kapatmayı denediğinde kilit kalkmış olmalıdır
    coordinator.setClosePending(true);
    expect(coordinator.isClosing()).toBe(true);
  });

  it('clearCloseTimeout hem sayacı durdurmalı hem de closePending durumunu temizlemelidir', () => {
    let timeoutFired = false;
    coordinator.setClosePending(true);

    coordinator.startCloseTimeout(() => {
      timeoutFired = true;
    }, 3500);

    coordinator.clearCloseTimeout();
    expect(coordinator.isClosing()).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(timeoutFired).toBe(false);
  });
});
