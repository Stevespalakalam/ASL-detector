
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from './Button';

// MediaPipe globals from index.html CDN
declare const Hands: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;
declare const HAND_CONNECTIONS: any;

interface WebcamRecorderProps {
  onClose: () => void;
  onSave: (videoUrl: string) => Promise<void> | void;
  signLabel: string;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({ onClose, onSave, signLabel }) => {
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isComponentMounted = useRef<boolean>(true);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [handsDetected, setHandsDetected] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // ── Draw Hand Skeleton Overlay ─────────────────────────────────────────
  const drawHandSkeleton = useCallback((results: any) => {
    // Only draw when live camera is visible and active
    if (!isComponentMounted.current || recordedBlobRef.current) return;

    const canvas = canvasRef.current;
    const video = liveVideoRef.current;
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
      setHandsDetected(results.multiHandLandmarks.length);

      for (const landmarks of results.multiHandLandmarks) {
        // Draw bones / connections
        if (typeof drawConnectors !== 'undefined' && typeof HAND_CONNECTIONS !== 'undefined') {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: 'rgba(14, 165, 233, 0.85)', // Sky blue connector lines
            lineWidth: 2.5,
          });
        }

        // Draw joint landmarks
        if (typeof drawLandmarks !== 'undefined') {
          drawLandmarks(ctx, landmarks, {
            color: 'rgba(167, 139, 250, 0.9)', // Violet joint outline
            fillColor: 'rgba(255, 255, 255, 0.95)',
            lineWidth: 1,
            radius: 4,
          });

          // Draw prominent fingertip points
          const fingertips = [4, 8, 12, 16, 20];
          for (const idx of fingertips) {
            const lm = landmarks[idx];
            const x = lm.x * canvas.width;
            const y = lm.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = '#38bdf8';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    } else {
      setHandsDetected(0);
    }
  }, []);

  // ── Frame Processing Loop for MediaPipe ────────────────────────────────
  const processFrame = useCallback(async () => {
    if (!isComponentMounted.current) return;

    // Pause processing when viewing a recorded video preview
    if (!recordedBlobRef.current && liveVideoRef.current && handsRef.current) {
      if (liveVideoRef.current.readyState >= 2) {
        try {
          await handsRef.current.send({ image: liveVideoRef.current });
        } catch (_) {}
      }
    }

    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ── Initialize Camera & MediaPipe ──────────────────────────────────────
  useEffect(() => {
    isComponentMounted.current = true;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isComponentMounted.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          await liveVideoRef.current.play().catch(() => {});
        }
        setCameraReady(true);

        // Initialize MediaPipe Hands
        if (typeof Hands !== 'undefined') {
          const hands = new Hands({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
          });

          hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.65,
            minTrackingConfidence: 0.65,
          });

          hands.onResults(drawHandSkeleton);
          await hands.initialize();

          if (isComponentMounted.current) {
            handsRef.current = hands;
            animFrameRef.current = requestAnimationFrame(processFrame);
          }
        }
      } catch (err) {
        console.error('Webcam initialization failed:', err);
        if (isComponentMounted.current) {
          alert('Could not access webcam. Please make sure camera permissions are enabled in your browser.');
          onClose();
        }
      }
    };

    setupCamera();

    return () => {
      isComponentMounted.current = false;
      cancelAnimationFrame(animFrameRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (handsRef.current) {
        handsRef.current.close?.();
        handsRef.current = null;
      }

      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [drawHandSkeleton, onClose, processFrame]);

  // ── Recording Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      setRecordingTime(0);
      return;
    }
    const timer = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  // ── Countdown and Recording Logic ──────────────────────────────────────
  const startRecordingWithCountdown = () => {
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        startRecording();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    recordedBlobRef.current = null;

    const chunks: Blob[] = [];

    // Support standard WebM formats
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    try {
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        recordedBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };

      mr.start(100); // Collect data every 100ms
      setIsRecording(true);
    } catch (e) {
      console.error('MediaRecorder start error:', e);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleRetake = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedUrl(null);
    recordedBlobRef.current = null;
    // When retaking, live camera is visible again
    if (liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.play().catch(() => {});
    }
  };

  const handleSave = async () => {
    const blob = recordedBlobRef.current;
    if (!blob) return;

    setIsSaving(true);
    try {
      // Convert Blob to Data URL for persistence
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const dataUrl = await dataUrlPromise;

      await onSave(dataUrl);
      onClose();
    } catch (err) {
      console.error('Error saving recorded video take:', err);
      alert('Failed to save take. Please try again.');
      setIsSaving(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/10 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-xs text-sky-400 font-semibold uppercase tracking-wider mb-0.5">Recording Sample</p>
            <h3 className="text-xl font-bold capitalize text-white">"{signLabel}"</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/14 flex items-center justify-center text-gray-400 hover:text-white transition-all disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {/* 1. Live Camera View (when NOT viewing recorded preview) */}
          <div className={`relative w-full h-full ${recordedUrl ? 'hidden' : 'block'}`}>
            <video
              ref={liveVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {/* Hand landmark overlay */}
            <canvas ref={canvasRef} className="hand-overlay" />
          </div>

          {/* 2. Recorded Video Preview (when recording is finished) */}
          {recordedUrl && (
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                key={recordedUrl}
                src={recordedUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Countdown Display */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
              <div
                className="text-9xl font-black text-white animate-bounce"
                style={{ textShadow: '0 0 40px rgba(14,165,233,0.9)' }}
              >
                {countdown}
              </div>
            </div>
          )}

          {/* Top Status Bar (Only in Live Camera Mode) */}
          {!recordedUrl && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
              {isRecording ? (
                <div className="flex items-center gap-2 glass px-3.5 py-1.5 rounded-full pointer-events-auto">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 rec-dot" />
                  <span className="text-xs font-bold text-red-400 tracking-wider">REC {formatTime(recordingTime)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 glass px-3.5 py-1.5 rounded-full pointer-events-auto">
                  <span className={`w-2 h-2 rounded-full ${handsDetected > 0 ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-xs font-medium text-gray-200">
                    {handsDetected > 0
                      ? `${handsDetected} hand${handsDetected > 1 ? 's' : ''} tracked`
                      : 'Show your hand to the camera'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Recorded Success Badge */}
          {recordedUrl && (
            <div className="absolute top-3 left-3 glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-green-400 flex items-center gap-1.5 z-10">
              <span>✓</span> Previewing Take
            </div>
          )}
        </div>

        {/* Controls Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-6 py-5 bg-gray-900/40">
          {!recordedUrl ? (
            <>
              {!isRecording ? (
                <Button
                  onClick={startRecordingWithCountdown}
                  disabled={countdown !== null || !cameraReady}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {countdown !== null ? `Starting in ${countdown}...` : '● Start Recording'}
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  variant="danger"
                  size="lg"
                  className="w-full sm:w-auto animate-pulse"
                >
                  ■ Stop Recording
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={handleRetake}
                variant="secondary"
                size="lg"
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                ↩ Retake
              </Button>
              <Button
                onClick={handleSave}
                size="lg"
                disabled={isSaving}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-500 text-white shadow-green-500/20"
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Take...
                  </span>
                ) : (
                  '✓ Save Take'
                )}
              </Button>
            </>
          )}
        </div>

        {/* Helpful Tip */}
        {!recordedUrl && !isRecording && countdown === null && (
          <p className="text-center text-xs text-gray-500 pb-3">
            Tip: Perform your ASL sign clearly. When tracking lines lock on your hands, start recording.
          </p>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;
