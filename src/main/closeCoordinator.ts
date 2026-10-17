/**
 * closeCoordinator.ts - Window and application close state coordinator.
 * Manages closing timeout, unsaved tabs prompt signals, and update installations.
 */

export class CloseCoordinator {
  private isAppQuitting = false;
  private isClosePending = false;
  private isInstallPendingAfterSave = false;
  private closeTimeout: NodeJS.Timeout | null = null;

  public setAppQuitting(val: boolean = true): void {
    this.isAppQuitting = val;
  }

  public isQuitting(): boolean {
    return this.isAppQuitting;
  }

  public setClosePending(val: boolean): void {
    this.isClosePending = val;
  }

  public isClosing(): boolean {
    return this.isClosePending;
  }

  public setInstallPendingAfterSave(val: boolean): void {
    this.isInstallPendingAfterSave = val;
  }

  public isInstallPending(): boolean {
    return this.isInstallPendingAfterSave;
  }

  /**
   * Starts timeout countdown (default 3500ms).
   * If renderer does NOT reply at all within this duration, onTimeout callback is fired.
   */
  public startCloseTimeout(onTimeout: () => void, ms: number = 3500): void {
    this.stopCloseTimeout();
    this.closeTimeout = setTimeout(() => {
      this.closeTimeout = null;
      if (this.isClosePending) {
        onTimeout();
      }
    }, ms);
  }

  /**
   * Called when renderer sends "promptingClose" signal indicating it received the
   * close request and is actively asking the user. Stops the unresponsive timer.
   */
  public stopCloseTimeout(): void {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  /**
   * Called when close is canceled or window is forcibly closed/cleaned up.
   */
  public clearCloseTimeout(): void {
    this.stopCloseTimeout();
    this.isClosePending = false;
  }

  /**
   * Resets all state (useful for tests or app restarts).
   */
  public reset(): void {
    this.clearCloseTimeout();
    this.isAppQuitting = false;
    this.isInstallPendingAfterSave = false;
  }
}

export const closeCoordinator = new CloseCoordinator();
