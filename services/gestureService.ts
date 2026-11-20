
import { Landmark, Sign, Take, MatchResult } from '../types';

// Standard 21 MediaPipe Hand Joint indices
export const LANDMARK_NAMES = [
  'Wrist',
  'Thumb CMC', 'Thumb MCP', 'Thumb IP', 'Thumb Tip',
  'Index MCP', 'Index PIP', 'Index DIP', 'Index Tip',
  'Middle MCP', 'Middle PIP', 'Middle DIP', 'Middle Tip',
  'Ring MCP', 'Ring PIP', 'Ring DIP', 'Ring Tip',
  'Pinky MCP', 'Pinky PIP', 'Pinky DIP', 'Pinky Tip'
];

/**
 * Normalizes 21 3D hand landmarks to be invariant to:
 * 1. Screen translation (centered at wrist)
 * 2. Distance from camera (scaled by wrist-to-middle-MCP distance)
 * 3. Incorporates finger extension ratios and inter-finger spread distances
 */
export const extractHandFeatureVector = (landmarks: Landmark[]): number[] => {
  if (!landmarks || landmarks.length < 21) {
    return [];
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];

  // Calculate scale factor: distance from wrist to middle finger base (knuckle)
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const dz = (middleMcp.z ?? 0) - (wrist.z ?? 0);
  const rawScale = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const scale = rawScale > 0.005 ? rawScale : 1.0;

  // 1. Position-normalized coordinates for all 21 joints (63 values)
  const normCoords: number[] = [];
  for (let i = 0; i < 21; i++) {
    const pt = landmarks[i];
    normCoords.push((pt.x - wrist.x) / scale);
    normCoords.push((pt.y - wrist.y) / scale);
    normCoords.push(((pt.z ?? 0) - (wrist.z ?? 0)) / scale);
  }

  // 2. Finger extension ratios (tip distance from wrist / knuckle distance from wrist)
  // Indices: Thumb: (4, 2), Index: (8, 5), Middle: (12, 9), Ring: (16, 13), Pinky: (20, 17)
  const fingerPairs = [
    [4, 2],
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ];

  const dist = (a: Landmark, b: Landmark) => {
    const dX = a.x - b.x;
    const dY = a.y - b.y;
    const dZ = (a.z ?? 0) - (b.z ?? 0);
    return Math.sqrt(dX * dX + dY * dY + dZ * dZ);
  };

  const extensionRatios: number[] = [];
  for (const [tipIdx, mcpIdx] of fingerPairs) {
    const tipDist = dist(landmarks[tipIdx], wrist) / scale;
    const mcpDist = dist(landmarks[mcpIdx], wrist) / scale;
    extensionRatios.push(mcpDist > 0.01 ? tipDist / mcpDist : tipDist);
  }

  // 3. Fingertip-to-fingertip spread distances
  const tipSpread: number[] = [
    dist(landmarks[4], landmarks[8]) / scale,  // Thumb to Index
    dist(landmarks[8], landmarks[12]) / scale, // Index to Middle
    dist(landmarks[12], landmarks[16]) / scale,// Middle to Ring
    dist(landmarks[16], landmarks[20]) / scale,// Ring to Pinky
    dist(landmarks[4], landmarks[20]) / scale, // Thumb to Pinky span
  ];

  return [...normCoords, ...extensionRatios, ...tipSpread];
};

/**
 * Computes cosine similarity between two feature vectors
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA <= 0 || normB <= 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Computes normalized Euclidean distance similarity
 */
const euclideanSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSq += diff * diff;
  }
  const meanDistance = Math.sqrt(sumSq / a.length);
  return Math.exp(-1.8 * meanDistance);
};

/**
 * Calculates gesture similarity between live landmarks and template landmarks
 * Returns score between 0.0 and 1.0 (0% to 100%)
 */
export const calculateHandSimilarity = (live: Landmark[], template: Landmark[]): number => {
  if (!live || !template || live.length < 21 || template.length < 21) {
    return 0;
  }

  const liveVec = extractHandFeatureVector(live);
  const tmplVec = extractHandFeatureVector(template);

  if (liveVec.length === 0 || tmplVec.length === 0) return 0;

  const cosSim = Math.max(0, cosineSimilarity(liveVec, tmplVec));
  const eucSim = Math.max(0, euclideanSimilarity(liveVec, tmplVec));

  const combined = 0.55 * cosSim + 0.45 * eucSim;
  return parseFloat(Math.min(1.0, Math.max(0, combined)).toFixed(4));
};

/**
 * Averages landmark points across all recorded takes for a sign to form the master template
 */
export const aggregateTakesToTemplate = (takes: Take[]): Landmark[] | undefined => {
  const takesWithLandmarks = takes.filter((t) => t.landmarks && t.landmarks.length >= 21);
  if (takesWithLandmarks.length === 0) return undefined;

  const avgLandmarks: Landmark[] = [];
  for (let i = 0; i < 21; i++) {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (const take of takesWithLandmarks) {
      const lm = take.landmarks![i];
      sumX += lm.x;
      sumY += lm.y;
      sumZ += lm.z ?? 0;
    }
    const count = takesWithLandmarks.length;
    avgLandmarks.push({
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
    });
  }

  return avgLandmarks;
};

/**
 * Gets effective template landmarks for an enrolled sign strictly from its recorded takes.
 * Does NOT use any unrecorded or hardcoded baseline gestures.
 */
export const getEffectiveTemplate = (sign: Sign): Landmark[] | undefined => {
  if (sign.templateLandmarks && sign.templateLandmarks.length >= 21) {
    return sign.templateLandmarks;
  }
  return aggregateTakesToTemplate(sign.takes);
};

/**
 * Predicts the matching sign from live 21 landmarks against ONLY the signs enrolled in the library.
 * No hardcoded/unrecorded words will ever be predicted.
 */
export const predictGesture = (
  liveLandmarks: Landmark[],
  signs: Sign[],
  confidenceThreshold: number = 0.75
): MatchResult => {
  if (!liveLandmarks || liveLandmarks.length < 21 || !signs || signs.length === 0) {
    return { label: null, confidence: 0, similarities: [] };
  }

  const scores: { label: string; confidence: number }[] = [];

  // ONLY match against signs in the user's library that have recorded takes/landmarks
  for (const sign of signs) {
    // Only consider signs with at least one take recorded
    if (!sign.takes || sign.takes.length === 0) continue;

    const template = getEffectiveTemplate(sign);
    if (!template) continue;

    const sim = calculateHandSimilarity(liveLandmarks, template);
    scores.push({ label: sign.label, confidence: sim });
  }

  if (scores.length === 0) {
    return { label: null, confidence: 0, similarities: [] };
  }

  // Sort descending by similarity
  scores.sort((a, b) => b.confidence - a.confidence);

  const best = scores[0];
  if (best && best.confidence >= confidenceThreshold) {
    return {
      label: best.label,
      confidence: best.confidence,
      similarities: scores.slice(0, 4),
    };
  }

  return {
    label: null,
    confidence: best ? best.confidence : 0,
    similarities: scores.slice(0, 4),
  };
};
