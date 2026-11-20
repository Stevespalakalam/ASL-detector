
import { Sign, Take, AppData, Landmark } from '../types';
import { updateSignConfidence } from './geminiService';
import { CONFIDENCE_THRESHOLD, MIN_SAMPLES } from '../constants';
import { aggregateTakesToTemplate } from './gestureService';

const APP_DATA_KEY = 'aslTranslateData';
const DB_NAME = 'ASLTranslateDB';
const DB_VERSION = 1;
const STORE_NAME = 'appDataStore';
const DATA_RECORD_KEY = 'primary_app_data';

const getDefaultData = (): AppData => ({
  signs: [],
  settings: {
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    minSamples: MIN_SAMPLES,
  },
});

// Normalize settings to ensure minSamples is 5
const normalizeSettings = (settings?: { confidenceThreshold: number; minSamples: number }) => {
  if (!settings) {
    return { confidenceThreshold: CONFIDENCE_THRESHOLD, minSamples: MIN_SAMPLES };
  }
  return {
    confidenceThreshold: typeof settings.confidenceThreshold === 'number' ? settings.confidenceThreshold : CONFIDENCE_THRESHOLD,
    minSamples: settings.minSamples === 20 || !settings.minSamples ? MIN_SAMPLES : settings.minSamples,
  };
};

// ── In-Memory Fast Cache ──────────────────────────────────────────────────
let cachedData: AppData = (() => {
  try {
    const raw = localStorage.getItem(APP_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        signs: Array.isArray(parsed.signs) ? parsed.signs : [],
        settings: normalizeSettings(parsed.settings),
      };
    }
  } catch (e) {
    console.warn('Initial localStorage read failed:', e);
  }
  return getDefaultData();
})();

// ── IndexedDB Helpers ──────────────────────────────────────────────────────
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const idbGet = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

const idbSet = async <T>(key: string, value: T): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB write failed:', e);
  }
};

// ── Disk Persistence API via Local Vite Server ────────────────────────────
const fetchFromDisk = async (): Promise<AppData | null> => {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.signs)) {
        return {
          signs: data.signs,
          settings: normalizeSettings(data.settings),
        };
      }
    }
  } catch (_) {
    // If running in production preview or offline, falls back to IndexedDB
  }
  return null;
};

const saveToDisk = async (data: AppData): Promise<void> => {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('Disk save warning:', err);
  }
};

// Asynchronously sync data from Disk > IndexedDB > LocalStorage on startup
(async () => {
  try {
    // 1. Try loading from persistent disk file first
    const diskData = await fetchFromDisk();
    if (diskData && diskData.signs.length > 0) {
      cachedData = diskData;
      window.dispatchEvent(new Event('storage'));
      await idbSet(DATA_RECORD_KEY, diskData);
      return;
    }

    // 2. Try loading from IndexedDB
    const idbData = await idbGet<AppData>(DATA_RECORD_KEY);
    if (idbData && Array.isArray(idbData.signs) && idbData.signs.length > 0) {
      cachedData = {
        signs: idbData.signs,
        settings: normalizeSettings(idbData.settings),
      };
      window.dispatchEvent(new Event('storage'));
      // Sync to disk
      await saveToDisk(cachedData);
      return;
    }

    // 3. If cachedData has items from localStorage, persist to disk and IndexedDB
    if (cachedData.signs.length > 0) {
      await idbSet(DATA_RECORD_KEY, cachedData);
      await saveToDisk(cachedData);
    }
  } catch (err) {
    console.warn('Storage sync error:', err);
  }
})();

// ── Public Data Operations ─────────────────────────────────────────────────

export const loadData = (): AppData => {
  cachedData.settings = normalizeSettings(cachedData.settings);
  return cachedData;
};

export const saveData = async (data: AppData): Promise<void> => {
  data.settings = normalizeSettings(data.settings);
  cachedData = data;

  // Immediately notify all active UI components
  window.dispatchEvent(new Event('storage'));

  // 1. Save directly to local hard drive (library-data.json)
  await saveToDisk(data);

  // 2. Persist in IndexedDB (gigabytes quota, persists across tab close)
  try {
    await idbSet(DATA_RECORD_KEY, data);
  } catch (e) {
    console.error('Failed to save to IndexedDB:', e);
  }

  // 3. Fallback cache in localStorage
  try {
    const lightweightData: AppData = {
      settings: data.settings,
      signs: data.signs.map((s) => ({
        ...s,
        takes: s.takes.map((t) => ({
          ...t,
          videoUrl: t.videoUrl.length > 500 ? '' : t.videoUrl,
        })),
      })),
    };
    localStorage.setItem(APP_DATA_KEY, JSON.stringify(lightweightData));
  } catch {}
};

export const getSigns = (): Sign[] => {
  return loadData().signs;
};

export const getSign = (id: string): Sign | undefined => {
  return loadData().signs.find((sign) => sign.id === id);
};

export const addSign = (label: string): Sign => {
  const data = loadData();
  const newSign: Sign = {
    id: crypto.randomUUID(),
    label,
    createdAt: new Date().toISOString(),
    takes: [],
    confidence: 0,
  };
  data.signs.push(newSign);
  saveData(data);
  return newSign;
};

export const addTake = async (signId: string, videoUrl: string, landmarks?: Landmark[]): Promise<Sign> => {
  const data = loadData();
  const sign = data.signs.find((s) => s.id === signId);
  if (!sign) throw new Error('Sign not found');

  const newTake: Take = {
    id: crypto.randomUUID(),
    signId,
    videoUrl,
    createdAt: new Date().toISOString(),
    landmarks,
  };

  sign.takes.push(newTake);
  sign.templateLandmarks = aggregateTakesToTemplate(sign.takes);
  sign.confidence = await updateSignConfidence(sign.takes);

  await saveData(data);
  return sign;
};

export const deleteTake = async (signId: string, takeId: string): Promise<Sign> => {
  const data = loadData();
  const sign = data.signs.find((s) => s.id === signId);
  if (!sign) throw new Error('Sign not found');

  sign.takes = sign.takes.filter((t) => t.id !== takeId);
  sign.templateLandmarks = aggregateTakesToTemplate(sign.takes);
  sign.confidence = await updateSignConfidence(sign.takes);

  await saveData(data);
  return sign;
};

export const deleteSign = (signId: string) => {
  const data = loadData();
  data.signs = data.signs.filter((s) => s.id !== signId);
  saveData(data);
};

export const deleteAllData = () => {
  saveData(getDefaultData());
};

export const getSettings = () => {
  return loadData().settings;
};

export const updateSettings = (newSettings: { confidenceThreshold: number; minSamples: number }) => {
  const data = loadData();
  data.settings = normalizeSettings(newSettings);
  saveData(data);
};
