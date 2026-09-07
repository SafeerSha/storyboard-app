export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  createdAt: number;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
  id?: string;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private maxVisible = 3;
  private readonly FLASH_KEY = "storyboard_flash_toast";

  private defaultDurations: Record<ToastType, number> = {
    success: 3000,
    info: 4000,
    warning: 5000,
    error: 5500,
    loading: 0, // 0 indicates no auto-dismiss
  };

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  public show(
    type: ToastType,
    message: string,
    options?: { description?: string; duration?: number; id?: string }
  ): string {
    const id = options?.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration =
      options?.duration !== undefined
        ? options.duration
        : this.defaultDurations[type];

    // Deduplication check: if identical message and type exists within last 1.5s, update it
    const existingIndex = this.toasts.findIndex(
      (t) => t.message === message && t.type === type
    );

    if (existingIndex !== -1) {
      const existing = this.toasts[existingIndex];
      const updatedItem: ToastItem = {
        ...existing,
        description: options?.description ?? existing.description,
        duration,
        createdAt: Date.now(),
      };
      this.toasts.splice(existingIndex, 1);
      this.toasts.push(updatedItem);
      this.notify();
      return existing.id;
    }

    const newItem: ToastItem = {
      id,
      type,
      message,
      description: options?.description,
      duration,
      createdAt: Date.now(),
    };

    // Keep only up to maxVisible
    if (this.toasts.length >= this.maxVisible) {
      this.toasts.shift();
    }

    this.toasts.push(newItem);
    this.notify();

    return id;
  }

  private normalizeOptions(
    opts?: string | ToastOptions,
    duration?: number
  ): ToastOptions | undefined {
    if (!opts && duration === undefined) return undefined;
    if (typeof opts === "string") {
      return { description: opts, duration };
    }
    if (opts && typeof opts === "object") {
      return {
        description: opts.description,
        duration: duration !== undefined ? duration : opts.duration,
      };
    }
    return undefined;
  }

  public success(message: string, options?: string | ToastOptions, duration?: number): string {
    return this.show("success", message, this.normalizeOptions(options, duration));
  }

  public error(message: string, options?: string | ToastOptions, duration?: number): string {
    return this.show("error", message, this.normalizeOptions(options, duration));
  }

  public warning(message: string, options?: string | ToastOptions, duration?: number): string {
    return this.show("warning", message, this.normalizeOptions(options, duration));
  }

  public info(message: string, options?: string | ToastOptions, duration?: number): string {
    return this.show("info", message, this.normalizeOptions(options, duration));
  }

  public loading(message: string, options?: string | ToastOptions): string {
    const opts = this.normalizeOptions(options);
    return this.show("loading", message, { ...opts, duration: 0 });
  }

  public dismiss(id?: string): void {
    if (!id) {
      this.toasts = [];
    } else {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }
    this.notify();
  }

  /**
   * Short-lived global navigation-safe mechanism.
   * Stores a single transient message in sessionStorage to be displayed once on next page load.
   */
  public flash(type: ToastType, message: string, description?: string): void {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        this.FLASH_KEY,
        JSON.stringify({ type, message, description, timestamp: Date.now() })
      );
    } catch {
      // Ignore sessionStorage quota or private browsing errors
    }
  }

  /**
   * Consumes and displays any pending flash toast from sessionStorage.
   */
  public consumeFlash(): void {
    if (typeof window === "undefined") return;
    try {
      const item = sessionStorage.getItem(this.FLASH_KEY);
      if (!item) return;
      sessionStorage.removeItem(this.FLASH_KEY);
      const parsed = JSON.parse(item);
      // Valid if set in the last 15 seconds
      if (parsed && parsed.message && Date.now() - parsed.timestamp < 15000) {
        this.show(parsed.type || "success", parsed.message, {
          description: parsed.description,
        });
      }
    } catch {
      // Ignore
    }
  }
}

export const toast = new ToastManager();
