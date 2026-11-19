
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { liveTranslate } from '../services/geminiService';
import { getSettings, updateSettings } from '../services/dataService';
import Button from './Button';
import CopyIcon from './icons/CopyIcon';
import ClearIcon from './icons/ClearIcon';
import { Link } from 'react-router-dom';

// Declare MediaPipe Hands globals (loaded via CDN in index.html)
declare const Hands: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;
declare const HAND_CONNECTIONS: any;

const TranslatePage: React.FC = () => {
  const [settings, setSettings] = useState(getSettings());
  const [is100Mode, setIs100Mode] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [currentPrediction, setCurrentPrediction] = useState<{ label: string | null; confidence: number }>({ label: null, confidence: 0 });
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastWordRef = useRef<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const handleStorageChange = () => setSettings(getSettings());
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ── Draw hand skeleton on canvas ───────────────────────────────────
  const drawHandSkeleton = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandsDetected(results.multiHandLandmarks.length);

      for (const landmarks of results.multiHandLandmarks) {
        // Draw connection lines (skeleton)
        if (typeof drawConnectors !== 'undefined') {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: 'rgba(14, 165, 233, 0.75)',  // sky-500
            lineWidth: 2,
          });
        }

        // Draw landmark dots
        if (typeof drawLandmarks !== 'undefined') {
          drawLandmarks(ctx, landmarks, {
            color: 'rgba(167, 139, 250, 0.9)',   // violet-400 for joints
            fillColor: 'rgba(255, 255, 255, 0.95)',
            lineWidth: 1,
            radius: 4,
          });

          // Draw fingertip dots larger & brighter
          const fingertips = [4, 8, 12, 16, 20];
          for (const idx of fingertips) {
            const lm = landmarks[idx];
            const x = lm.x * canvas.width;
            const y = lm.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(56, 189, 248, 1)';   // sky-400
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    } else {
      setHandsDetected(0);
    }
  }, []);

  // ── MediaPipe processing loop ────────────────────────────────────────
  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const hands = handsRef.current;
    if (!video || !hands || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    try {
      await hands.send({ image: video });
    } catch (_) {}
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ── Camera lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isCameraOn) return;

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Initialize MediaPipe Hands
        if (typeof Hands !== 'undefined') {
          const h = new Hands({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });
          h.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6,
          });
          h.onResults(drawHandSkeleton);
          await h.initialize();
          handsRef.current = h;
          animFrameRef.current = requestAnimationFrame(processFrame);
        }
      } catch (err) {
        console.error('Camera error:', err);
        if (!cancelled) {
          alert('Could not access webcam. Please allow camera permissions.');
          setIsCameraOn(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      handsRef.current?.close?.();
      handsRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setHandsDetected(0);
    };
  }, [isCameraOn, drawHandSkeleton, processFrame]);

  // ── Translation interval ─────────────────────────────────────────────
  useEffect(() => {
    if (!isCameraOn) return;
    const id = window.setInterval(async () => {
      const result = await liveTranslate();
      setCurrentPrediction(result);
      if (result.label) {
        const passes = result.confidence >= settings.confidenceThreshold;
        if ((is100Mode && passes) || !is100Mode) {
          if (result.label !== lastWordRef.current) {
            setTranscript(prev => `${prev} ${result.label}`.trim());
            lastWordRef.current = result.label!;
          }
        } else {
          lastWordRef.current = '';
        }
      } else {
        lastWordRef.current = '';
      }
    }, 500);
    return () => clearInterval(id);
  }, [isCameraOn, is100Mode, settings.confidenceThreshold]);

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
    currentPrediction.confidence < 0.5 ? 'text-red-400' :
    currentPrediction.confidence < settings.confidenceThreshold ? 'text-amber-400' :
    'text-green-400';

  return (
    <div className="container mx-auto">
      {/* Page title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Live Translation</h2>
        <p className="text-sm text-gray-500 mt-1">Point your hands at the camera. Landmarks appear in real-time.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Camera Panel ── */}
        <div className="lg:w-2/3">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
            {/* Mirrored video */}
            <video
              ref={videoRef}
              autoPlay playsInline muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Hand skeleton canvas (also mirrored via CSS in index.css) */}
            <canvas ref={canvasRef} className="hand-overlay" />

            {/* OFF state overlay */}
            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90">
                <div className="w-20 h-20 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-4">
                  <svg className="w-9 h-9 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
                  </svg>
                </div>
                <p className="text-gray-300 font-medium mb-2">Camera is off</p>
                <p className="text-gray-500 text-sm mb-6">Hand landmarks will appear when camera starts</p>
                <Button onClick={() => setIsCameraOn(true)} size="lg">
                  Start Camera
                </Button>
              </div>
            )}

            {/* Top status bar */}
            {isCameraOn && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className={`w-1.5 h-1.5 rounded-full ${handsDetected > 0 ? 'bg-green-400' : 'bg-gray-500'}`} />
                  {handsDetected > 0 ? `${handsDetected} hand${handsDetected > 1 ? 's' : ''} detected` : 'No hands detected'}
                </div>
                <button
                  onClick={() => setIsCameraOn(false)}
                  className="glass px-3 py-1.5 rounded-full text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Bottom detection badge */}
            {isCameraOn && (
              <div className="absolute bottom-3 left-3">
                <div className="glass px-4 py-3 rounded-xl">
                  <p className="text-xs text-gray-400 mb-0.5">Detected Sign</p>
                  <div className="flex items-baseline gap-3">
                    <p className="text-2xl font-bold capitalize text-white">
                      {currentPrediction.label ?? '—'}
                    </p>
                    <p className={`text-base font-mono font-semibold ${confidenceColor}`}>
                      {(currentPrediction.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                  {is100Mode && currentPrediction.label && currentPrediction.confidence < settings.confidenceThreshold && (
                    <p className="text-amber-400 text-xs mt-1">↻ Show sign again</p>
                  )}
                  {!currentPrediction.label && currentPrediction.confidence < settings.confidenceThreshold && (
                    <p className="text-xs text-gray-500 mt-1">
                      Unknown.{' '}
                      <Link to="/library" className="text-sky-400 hover:underline">Enroll a sign?</Link>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="lg:w-1/3 flex flex-col gap-4">
          {/* Transcript */}
          <div className="glass rounded-2xl p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Transcript</h3>
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
                <p className="text-gray-600 italic text-sm">Signs you perform will appear here…</p>
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
            <h3 className="font-semibold text-white mb-4">Settings</h3>

            {/* No-mistake mode toggle */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-200">"No Mistake" Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">Only adds high-confidence signs</p>
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
                <label>Confidence Threshold</label>
                <span className="font-mono text-sky-400 font-semibold">{Math.round(settings.confidenceThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="1.0"
                step="0.01"
                value={settings.confidenceThreshold}
                onChange={handleThresholdChange}
                className="w-full"
                disabled={!is100Mode}
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;
