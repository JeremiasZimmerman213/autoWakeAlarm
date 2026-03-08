declare module "@zos/storage" {
  export interface LocalStorageLike {
    setItem(key: string, value: string): void;
    getItem(key: string, defaultValue?: string): string;
    removeItem?(key: string): void;
  }

  export const localStorage: LocalStorageLike;
}

declare module "@zos/sensor" {
  export interface SleepInfo {
    score: number;
    deepTime: number;
    startTime: number;
    endTime: number;
    totalTime: number;
  }

  export class Sleep {
    updateInfo(): void;
    getInfo(): SleepInfo | null;
  }
}

declare module "@zos/alarm" {
  export interface AlarmSetOption {
    url: string;
    time?: number;
    delay?: number;
    store?: boolean;
  }

  export function set(option: AlarmSetOption): number;
  export function cancel(id: number | { id: number }): void;
}

declare module "@zos/ui" {
  export const widget: {
    TEXT: number;
    BUTTON: number;
  };

  export const prop: {
    MORE: number | string;
  };

  export interface WidgetInstance {
    setProperty(key: number | string, value: unknown): void;
  }

  export interface WidgetOptions {
    x: number;
    y: number;
    w: number;
    h: number;
    text?: string;
    text_size?: number;
    click_func?: () => void;
  }

  export function createWidget(type: number, options: WidgetOptions): WidgetInstance;
}

interface AppServiceOptions {
  onInit?(options?: unknown): void;
  onDestroy?(): void;
}

declare function AppService(options: AppServiceOptions): void;

interface PageOptions {
  onInit?(): void;
  build?(): void;
  onDestroy?(): void;
}

declare function Page(options: PageOptions): void;
