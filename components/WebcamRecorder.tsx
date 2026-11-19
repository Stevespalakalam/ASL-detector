
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from './Button';

// MediaPipe globals
declare const Hands: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;
declare const HAND_CONNECTIONS: any;

interface WebcamRecorderProps {
  onClose: () => void;
  onSave: (videoUrl: string) => void;
  signLabel: string;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({ onClose, onSave, signLabel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const handsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [handsDetected, setHandsDetected] = useState(0);

  // ── Draw skeleton ───────────────────────────────────────────────────
  const drawHandSkeleton = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks?.length > 0) {
      setHandsDetected(results.multiHandLandmarks.length);
      for (const landmarks of results.multiHandLandmarks) {
        if (typeof drawConnectors !== 'undefined') {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: 'rgba(14, 165, 233, 0.8)',
            lineWidth: 2,
          });
        }
        if (typeof drawLandmarks !== 'undefined') {
          drawLandmarks(ctx, landmarks, {
            color: 'rgba(167, 139, 250, 0.9)',
            fillColor: 'rgba(255,255,255,0.95)',
            lineWidth: 1,
            radius: 4,
          });
          const fingertips = [4, 8, 12, 16, 20];
          for (const idx of fingertips) {
            const lm = landmarks[idx];
            const x = lm.x * canvas.width;
            const y = lm.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(56, 189, 248, 1)';
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

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const hands = handsRef.current;
    if (!video || !hands || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }
    try { await hands.send({ image: video }); } catch (_) {}
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // ── Init camera + MediaPipe ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

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
          alert('Could not access webcam.');
          onClose();
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      handsRef.current?.close?.();
    };
  }, [drawHandSkeleton, onClose, processFrame]);

  // ── Recording timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) { setRecordingTime(0); return; }
    const id = setInterval(() => setRecordingTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const startRecordingWithCountdown = () => {
    let count = 3;
    setCountdown(count);
    const id = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count === 0) {
        clearInterval(id);
        setCountdown(null);
        startRecording();
      }
    }, 1000);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    setIsRecording(true);
    setRecordedUrl(null);
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => chunks.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setRecordedUrl(URL.createObjectURL(blob));
    };
    mr.start();
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleSave = () => {
    if (!recordedUrl) return;
    fetch(recordedUrl)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => onSave(reader.result as string);
        reader.readAsDataURL(blob);
      });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="glass rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Recording sample</p>
            <h3 className="text-lg font-bold capitalize text-white">"{signLabel}"</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/14 flex items-center justify-center text-gray-400 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera + overlay */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
            src={recordedUrl ?? undefined}
          />
          {/* Hand landmark canvas */}
          {!recordedUrl && <canvas ref={canvasRef} className="hand-overlay" />}

          {/* Countdown overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-9xl font-black text-white" style={{ textShadow: '0 0 40px rgba(14,165,233,0.8)' }}>
                {countdown}
              </div>
            </div>
          )}

          {/* Top status strip */}
          {!recordedUrl && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              {isRecording ? (
                <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-red-500 rec-dot" />
                  <span className="text-xs font-semibold text-red-400">REC {formatTime(recordingTime)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
                  <span className={`w-1.5 h-1.5 rounded-full ${handsDetected > 0 ? 'bg-green-400' : 'bg-gray-500'}`} />
                  <span className="text-xs text-gray-300">
                    {handsDetected > 0 ? `${handsDetected} hand${handsDetected > 1 ? 's' : ''} in frame` : 'Position your hand'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Recorded label */}
          {recordedUrl && (
            <div className="absolute top-3 left-3 glass px-3 py-1.5 rounded-full text-xs font-medium text-green-400">
              ✓ Take recorded
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 px-6 py-5">
          {!recordedUrl ? (
            <>
              {!isRecording ? (
                <Button onClick={startRecordingWithCountdown} disabled={countdown !== null} size="lg">
                  {countdown !== null ? `Starting in ${countdown}…` : '● Start Recording'}
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="danger" size="lg">
                  ■ Stop Recording
                </Button>
              )}
            </>
          ) : (
            <>
              <Button onClick={() => setRecordedUrl(null)} variant="secondary" size="lg">
                ↩ Retake
              </Button>
              <Button onClick={handleSave} size="lg">
                ✓ Save Sample
              </Button>
            </>
          )}
        </div>

        {/* Tip */}
        {!recordedUrl && !isRecording && countdown === null && (
          <p className="text-center text-xs text-gray-600 pb-4">
            Tip: Hold your sign clearly in frame until the landmarks stabilize, then record.
          </p>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;
