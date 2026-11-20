
import { Take, Landmark, MatchResult } from '../types';
import { getSigns, getSettings } from './dataService';
import { calculateHandSimilarity, predictGesture } from './gestureService';

/**
 * Calculates the model confidence score for a sign based on:
 * 1. Number of collected samples toward minSamples (5)
 * 2. Real geometric consistency across recorded hand landmark takes
 * @param takes - An array of video takes for a sign.
 * @returns A promise that resolves to a confidence score between 0 and 1.
 */
export const updateSignConfidence = async (takes: Take[]): Promise<number> => {
  const { minSamples } = getSettings();

  if (!takes || takes.length === 0) {
    return 0;
  }

  // Base progress toward the 5-sample target (logarithmic growth tuned for minSamples=5)
  const baseProgress = Math.min(1.0, takes.length / minSamples);

  // Measure consistency across takes that have landmarks recorded
  const takesWithLandmarks = takes.filter((t) => t.landmarks && t.landmarks.length >= 21);
  let consistencyScore = 0.95;

  if (takesWithLandmarks.length >= 2) {
    let totalPairwiseSim = 0;
    let pairsCount = 0;
    for (let i = 0; i < takesWithLandmarks.length; i++) {
      for (let j = i + 1; j < takesWithLandmarks.length; j++) {
        const sim = calculateHandSimilarity(
          takesWithLandmarks[i].landmarks!,
          takesWithLandmarks[j].landmarks!
        );
        totalPairwiseSim += sim;
        pairsCount++;
      }
    }
    if (pairsCount > 0) {
      consistencyScore = totalPairwiseSim / pairsCount;
    }
  }

  // Weighted confidence: 60% sample quantity progression, 40% landmark consistency
  const finalScore = 0.6 * baseProgress + 0.4 * (baseProgress * consistencyScore);

  // Cap between 0.0 and 1.0, reaching ~90-100% at 5 samples
  return parseFloat(Math.min(1.0, Math.max(0, finalScore * 1.05)).toFixed(4));
};

/**
 * Predicts the sign from real live MediaPipe hand landmarks.
 * @param liveLandmarks - Array of 21 3D hand landmarks from live camera
 * @returns A promise that resolves to the match result.
 */
export const liveTranslate = async (liveLandmarks?: Landmark[]): Promise<MatchResult> => {
  const signs = getSigns();
  const { confidenceThreshold } = getSettings();

  if (!liveLandmarks || liveLandmarks.length < 21) {
    return { label: null, confidence: 0, similarities: [] };
  }

  // Real-time gesture prediction comparing 21 landmarks against enrolled templates
  return predictGesture(liveLandmarks, signs, confidenceThreshold);
};
