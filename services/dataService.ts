
import { Sign, Take, AppData } from '../types';
import { updateSignConfidence } from './geminiService';
import { CONFIDENCE_THRESHOLD, MIN_SAMPLES } from '../constants';

const APP_DATA_KEY = 'aslTranslateData';

const getDefaultData = (): AppData => ({
    signs: [],
    settings: {
        confidenceThreshold: CONFIDENCE_THRESHOLD,
        minSamples: MIN_SAMPLES
    }
});

export const loadData = (): AppData => {
    try {
        const data = localStorage.getItem(APP_DATA_KEY);
        if (data) {
            const parsed = JSON.parse(data);
            // Ensure settings are present
            if (!parsed.settings) {
                parsed.settings = getDefaultData().settings;
            }
            return parsed;
        }
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
    }
    return getDefaultData();
};

export const saveData = (data: AppData) => {
    try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(data));
        // Dispatch a storage event so other tabs can update
        window.dispatchEvent(new Event('storage'));
    } catch (error) {
        console.error("Failed to save data to localStorage", error);
    }
};

export const getSigns = (): Sign[] => {
    return loadData().signs;
};

export const getSign = (id: string): Sign | undefined => {
    return loadData().signs.find(sign => sign.id === id);
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

export const addTake = async (signId: string, videoUrl: string): Promise<Sign> => {
    const data = loadData();
    const sign = data.signs.find(s => s.id === signId);
    if (!sign) throw new Error("Sign not found");

    const newTake: Take = {
        id: crypto.randomUUID(),
        signId,
        videoUrl,
        createdAt: new Date().toISOString(),
    };
    sign.takes.push(newTake);
    sign.confidence = await updateSignConfidence(sign.takes);
    
    saveData(data);
    return sign;
};

export const deleteTake = async (signId: string, takeId: string): Promise<Sign> => {
    const data = loadData();
    const sign = data.signs.find(s => s.id === signId);
    if (!sign) throw new Error("Sign not found");

    sign.takes = sign.takes.filter(t => t.id !== takeId);
    sign.confidence = await updateSignConfidence(sign.takes);

    saveData(data);
    return sign;
};

export const deleteSign = (signId: string) => {
    const data = loadData();
    data.signs = data.signs.filter(s => s.id !== signId);
    saveData(data);
};

export const deleteAllData = () => {
    saveData(getDefaultData());
};

export const getSettings = () => {
    return loadData().settings;
}

export const updateSettings = (newSettings: { confidenceThreshold: number; minSamples: number }) => {
    const data = loadData();
    data.settings = newSettings;
    saveData(data);
}
