
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { liveTranslate } from '../services/geminiService';
import { getSigns, getSettings, updateSettings } from '../services/dataService';
import Button from './Button';
import CopyIcon from './icons/CopyIcon';
import ClearIcon from './icons/ClearIcon';
import { Link } from 'react-router-dom';
import { Landmark } from '../types';

const HAND_CONNECTIONS_MAP: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky finger
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm cross connections
  [5, 9], [9, 13], [13, 17]
];

const TranslatePage: React.FC = () => {
  const [settings, setSettings] = useState(getSettings());
  const [signs, setSigns] = useState(() => getSigns());
  const [is100Mode, setIs100Mode] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [currentPrediction, setCurrentPrediction] = useState<{
    label: string | null;
    confidence: number;
    similarities?: { label: string; confidence: number }[];
  }>({ label: null, confidence: 0, similarities: [] });
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastWordRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const isComponentMounted = useRef<boolean>(true);
  const isProcessingRef = useRef<boolean>(false);
  const latestPredictionTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleStorageChange = () => {
      setSettings(getSettings());
      setSigns(getSigns());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── High Accuracy Hand Skeleton & Joint Tracking ───────────────────────
  const drawHandSkeletonAndPredict = useCallback(async (results: any) => {
    if (!isComponentMounted.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const primaryHand: Landmark[] = results.multiHandLandmarks[0];
      setHandsDetected(results.multiHandLandmarks.length);

      // Perform real gesture similarity prediction against enrolled sign templates
      const now = performance.now();
      if (now - latestPredictionTimeRef.current > 80) { // Update prediction every 80ms for responsiveness
        latestPredictionTimeRef.current = now;
        try {
          const matchResult = await liveTranslate(primaryHand);
          setCurrentPrediction(matchResult);

          // Handle transcript appending on sustained high confidence
          if (matchResult.label) {
            const passes = matchResult.confidence >= settings.confidenceThreshold;
            if ((is100Mode && passes) || !is100Mode) {
              if (matchResult.label !== lastWordRef.current) {
                setTranscript((prev) => `${prev} ${matchResult.label}`.trim());
                lastWordRef.current = matchResult.label!;
              }
            } else {
              lastWordRef.current = '';
            }
          } else {
            lastWordRef.current = '';
          }
        } catch (_) {}
      }

      for (const landmarks of results.multiHandLandmarks) {
        // 1. Draw glowing skeleton connection lines
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00f0ff'; // Neon cyan
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const [startIdx, endIdx] of HAND_CONNECTIONS_MAP) {
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];
          if (start && end) {
            ctx.beginPath();
            ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
            ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
            ctx.stroke();
          }
        }
        ctx.restore();

        // 2. Draw all 21 joint landmark dots
        for (let i = 0; i < landmarks.length; i++) {
          const lm = landmarks[i];
          const x = lm.x * canvas.width;
          const y = lm.y * canvas.height;

          const isFingertip = [4, 8, 12, 16, 20].includes(i);
          const isWrist = i === 0;

          ctx.save();
          if (isFingertip) {
            // Fingertip points
            ctx.beginPath();
            ctx.arc(x, y, 6.5, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e'; // Bright green
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (isWrist) {
            // Wrist anchor point
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, 2 * Math.PI);
            ctx.fillStyle = '#a855f7';
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else {
            // Knuckle and finger joints
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    } else {
      setHandsDetected(0);
      setCurrentPrediction({ label: null, confidence: 0, similarities: [] });
      lastWordRef.current = '';
    }
  }, [is100Mode, settings.confidenceThreshold]);

  // ── Sequential Non-overlapping Frame Inference Loop ────────────────────
  const scheduleNextFrame = useCallback(() => {
    if (!isComponentMounted.current) return;

    animFrameRef.current = requestAnimationFrame(async () => {
      if (!isComponentMounted.current) return;

      const video = videoRef.current;
      const hands = handsRef.current;

      if (video && hands && video.readyState >= 2 && !video.paused && !isProcessingRef.current) {
        isProcessingRef.current = true;
        try {
          await hands.send({ image: video });
        } catch (_) {
          // Ignore dropped frame
        } finally {
          isProcessingRef.current = false;
        }
      }

      scheduleNextFrame();
    });
  }, []);

  // ── Camera Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    isComponentMounted.current = true;
    if (!isCameraOn) return;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        });

        if (!isComponentMounted.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Initialize MediaPipe Hands
        const initMediaPipe = () => {
          const MP_Hands = (window as any).Hands;
          if (typeof MP_Hands !== 'undefined') {
            const hands = new MP_Hands({
              locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });

            hands.setOptions({
              maxNumHands: 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });

            hands.onResults(drawHandSkeletonAndPredict);

            if (isComponentMounted.current) {
              handsRef.current = hands;
              scheduleNextFrame();
            }
          } else {
            setTimeout(initMediaPipe, 100);
          }
        };

        initMediaPipe();
      } catch (err) {
        console.error('Camera error:', err);
        if (isComponentMounted.current) {
          alert('Could not access webcam. Please allow camera permissions.');
          setIsCameraOn(false);
        }
      }
    };

    start();

    return () => {
      isComponentMounted.current = false;
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (handsRef.current) {
        try {
          handsRef.current.close?.();
        } catch (_) {}
        handsRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setHandsDetected(0);
    };
  }, [isCameraOn, drawHandSkeletonAndPredict, scheduleNextFrame]);

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setTranscript('');
    lastWordRef.current = '';
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const s = { ...settings, confidenceThreshold: val };
    setSettings(s);
    updateSettings(s);
  };

  const confidenceColor =
    currentPrediction.confidence < 0.5
      ? 'text-red-400'
      : currentPrediction.confidence < settings.confidenceThreshold
      ? 'text-amber-400'
      : 'text-green-400';

  return (
    <div className="container mx-auto">
      {/* Page title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Translation</h2>
          <p className="text-sm text-gray-400 mt-1">
            Tracking all 21 hand joints in real time. Translating strictly from your enrolled library signs.
          </p>
        </div>
        <div className="glass px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-2 border border-white/10">
          <span className="text-gray-400">Enrolled library signs:</span>
          <span className="font-bold text-sky-400">
            {signs.filter((s) => s.takes && s.takes.length > 0).length} active
          </span>
        </div>
      </div>

      {signs.filter((s) => s.takes && s.takes.length > 0).length === 0 && (
        <div className="mb-6 p-4 glass rounded-2xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-sm font-semibold text-amber-300">Your library has no recorded signs yet</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Translation only recognizes signs you record in your library. Add a sign in the Library to start!
              </p>
            </div>
          </div>
          <Link to="/library" className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-white transition-all">
            Go to Library →
          </Link>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Camera Panel ── */}
        <div className="lg:w-2/3">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
            {/* Mirrored video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />
            {/* Hand skeleton canvas with z-30 */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 z-30"
              style={{ zIndex: 30 }}
            />

            {/* OFF state overlay */}
            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 z-40">
                <div className="w-20 h-20 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-4">
                  <svg className="w-9 h-9 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path
                      strokeLinecap="round"
                      d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"
                    />
                  </svg>
                </div>
                <p className="text-gray-300 font-medium mb-2">Camera is off</p>
                <p className="text-gray-500 text-sm mb-6">Start camera to track hand points and translate signs</p>
                <Button onClick={() => setIsCameraOn(true)} size="lg">
                  Start Camera
                </Button>
              </div>
            )}

            {/* Top status bar */}
            {isCameraOn && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-40">
                <div className="flex items-center gap-2 glass px-3.5 py-1.5 rounded-full text-xs font-medium">
                  <span className={`w-2 h-2 rounded-full ${handsDetected > 0 ? 'bg-green-400' : 'bg-gray-500'}`} />
                  {handsDetected > 0
                    ? `● Tracking 21 points (${handsDetected} hand${handsDetected > 1 ? 's' : ''})`
                    : 'Show hand to camera'}
                </div>
                <button
                  onClick={() => setIsCameraOn(false)}
                  className="glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  Stop Camera
                </button>
              </div>
            )}

            {/* Bottom detection badge with real-time similarity metrics */}
            {isCameraOn && (
              <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-40">
                <div className="glass px-4 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Detected Gesture</p>
                      <p className="text-2xl font-bold capitalize text-white">
                        {currentPrediction.label ?? (handsDetected > 0 ? 'Analyzing gesture...' : '—')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 mb-0.5">Similarity</p>
                      <p className={`text-xl font-mono font-bold ${confidenceColor}`}>
                        {(currentPrediction.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Real-time candidate similarity breakdown */}
                  {currentPrediction.similarities && currentPrediction.similarities.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2 text-xs">
                      {currentPrediction.similarities.map((item) => (
                        <span
                          key={item.label}
                          className={`px-2 py-0.5 rounded-lg border font-mono ${
                            item.label === currentPrediction.label && item.confidence >= settings.confidenceThreshold
                              ? 'bg-green-500/20 border-green-500/40 text-green-300 font-bold'
                              : 'bg-white/5 border-white/10 text-gray-400'
                          }`}
                        >
                          {item.label}: {(item.confidence * 100).toFixed(0)}%
                        </span>
                      ))}
                    </div>
                  )}

                  {is100Mode && currentPrediction.label && currentPrediction.confidence < settings.confidenceThreshold && (
                    <p className="text-amber-400 text-xs mt-1.5 font-medium">↻ Hold pose steady to reach threshold</p>
                  )}
                  {!currentPrediction.label && handsDetected > 0 && currentPrediction.confidence < settings.confidenceThreshold && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Gesture doesn't match library.{' '}
                      <Link to="/library" className="text-sky-400 hover:underline">
                        Enroll this sign?
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Transcript & Settings ── */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          {/* Transcript */}
          <div className="glass rounded-2xl p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Translated Text</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  disabled={!transcript}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Copy"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClear}
                  disabled={!transcript}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Clear"
                >
                  <ClearIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-black/30 rounded-xl p-4 min-h-[160px] overflow-y-auto relative">
              {transcript ? (
                <p className="text-base leading-relaxed text-white/90 whitespace-pre-wrap">{transcript}</p>
              ) : (
                <p className="text-gray-500 italic text-sm">Recognized signs will appear here automatically...</p>
              )}
              {copied && (
                <div className="absolute top-2 right-2 toast glass px-2 py-1 rounded-lg text-xs text-green-400">
                  Copied!
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold text-white mb-4">Detection Settings</h3>

            {/* No-mistake mode toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-200">"No Mistake" Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Only translates when similarity is high</p>
              </div>
              <button
                onClick={() => setIs100Mode(!is100Mode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  is100Mode ? 'bg-sky-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                    is100Mode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Threshold slider */}
            <div className={`transition-opacity ${is100Mode ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <label>Similarity Threshold</label>
                <span className="font-mono text-sky-400 font-semibold">{Math.round(settings.confidenceThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.01"
                value={settings.confidenceThreshold}
                onChange={handleThresholdChange}
                className="w-full"
                disabled={!is100Mode}
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>50% (Fast)</span>
                <span>95% (Strict)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;
