
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

// Sync from IndexedDB into memory on startup
(async () => {
  try {
    const idbData = await idbGet<AppData>(DATA_RECORD_KEY);
    if (idbData && Array.isArray(idbData.signs)) {
      cachedData = {
        signs: idbData.signs,
        settings: normalizeSettings(idbData.settings),
      };
      window.dispatchEvent(new Event('storage'));
    } else if (cachedData.signs.length > 0) {
      await idbSet(DATA_RECORD_KEY, cachedData);
    }
  } catch (err) {
    console.warn('IndexedDB sync error:', err);
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

  window.dispatchEvent(new Event('storage'));

  try {
    await idbSet(DATA_RECORD_KEY, data);
  } catch (e) {
    console.error('Failed to save to IndexedDB:', e);
  }

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
