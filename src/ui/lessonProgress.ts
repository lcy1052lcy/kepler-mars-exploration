import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const STORAGE_ROOT = 'kepler-mars-learning:v1';
const resetEpoch = new Map<string, number>();
const activeWriters = new Map<string, () => void>();

function storageKey(scope: string, field: string): string {
  return `${STORAGE_ROOT}:${scope}:${field}`;
}

function readStoredValue<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const serialized = window.localStorage.getItem(key);
    if (serialized === null) return fallback;
    const value: unknown = JSON.parse(serialized);
    if (isValid(value)) return value;
    window.localStorage.removeItem(key);
  } catch {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
  return fallback;
}

function writeStoredValue<T>(key: string, value: T, fallbackJSON: string): void {
  try {
    if (JSON.stringify(value) === fallbackJSON) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory lesson usable when storage is unavailable or full.
  }
}

export function useLessonStoredState<T>(
  lessonId: string | 'app',
  field: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const key = storageKey(lessonId === 'app' ? 'app' : `lesson-${lessonId}`, field);
  const fallbackJSON = JSON.stringify(fallback);
  const scope = lessonId === 'app' ? 'app' : `lesson-${lessonId}`;
  const epoch = resetEpoch.get(scope) ?? 0;
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback, isValid));
  const currentValue = useRef(value);
  currentValue.current = value;

  useEffect(() => {
    const flush = () => {
      if ((resetEpoch.get(scope) ?? 0) === epoch) writeStoredValue(key, currentValue.current, fallbackJSON);
    };
    activeWriters.set(key, flush);
    return () => {
      if (activeWriters.get(key) === flush) activeWriters.delete(key);
    };
  }, [key, fallbackJSON, scope, epoch]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if ((resetEpoch.get(scope) ?? 0) === epoch) writeStoredValue(key, value, fallbackJSON);
    }, 120);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [key, value, fallbackJSON, scope, epoch]);

  useEffect(() => {
    const flush = () => {
      if ((resetEpoch.get(scope) ?? 0) === epoch) writeStoredValue(key, currentValue.current, fallbackJSON);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [key, fallbackJSON, scope, epoch]);

  useEffect(() => () => {
    if ((resetEpoch.get(scope) ?? 0) === epoch) writeStoredValue(key, currentValue.current, fallbackJSON);
  }, [key, fallbackJSON, scope, epoch]);

  return [value, setValue];
}

export function clearLessonStoredState(lessonId: string | 'app'): void {
  const scope = lessonId === 'app' ? 'app' : `lesson-${lessonId}`;
  resetEpoch.set(scope, (resetEpoch.get(scope) ?? 0) + 1);
  const prefix = `${STORAGE_ROOT}:${scope}:`;
  try {
    const keys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index));
    keys.forEach((key) => { if (key?.startsWith(prefix)) window.localStorage.removeItem(key); });
  } catch {
    // Resetting visible lesson state must still work if storage is unavailable.
  }
}

/** Flush the current in-memory values of mounted hooks before a report reads saved snapshots. */
export function flushLessonStoredState(lessonIds: Array<string | 'app'>): void {
  const scopes = new Set(lessonIds.map((lessonId) => lessonId === 'app' ? 'app' : `lesson-${lessonId}`));
  activeWriters.forEach((flush, key) => {
    if ([...scopes].some((scope) => key.startsWith(`${STORAGE_ROOT}:${scope}:`))) flush();
  });
}

/** Read a lesson's existing localStorage fields without changing or resetting them. */
export function readLessonStoredSnapshot(lessonId: string): Record<string, unknown> {
  const prefix = `${STORAGE_ROOT}:lesson-${lessonId}:`;
  const snapshot: Record<string, unknown> = {};
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        snapshot[key.slice(prefix.length)] = JSON.parse(window.localStorage.getItem(key) ?? 'null');
      } catch {
        // Ignore only the malformed field and keep other saved lesson answers available.
      }
    }
  } catch {
    // Return an empty snapshot if localStorage is unavailable.
  }
  return snapshot;
}

export function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

export function isNumberBetween(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function isString(value: unknown): value is string { return typeof value === 'string'; }
export function isNullableString(value: unknown): value is string | null { return value === null || typeof value === 'string'; }
export function isBoolean(value: unknown): value is boolean { return typeof value === 'boolean'; }

export function isStringRecord<T extends string>(keys: readonly T[]) {
  return (value: unknown): value is Record<T, string> => typeof value === 'object' && value !== null
    && keys.every((key) => typeof (value as Record<string, unknown>)[key] === 'string');
}

export function isIndexList(value: unknown, maxIndex: number): value is number[] {
  return Array.isArray(value) && value.every((item) => isIntegerBetween(item, 0, maxIndex))
    && new Set(value).size === value.length;
}
