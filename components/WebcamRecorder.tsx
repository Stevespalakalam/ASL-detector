import React, { useState, useRef, useEffect } from 'react';
import Button from './Button';

interface WebcamRecorderProps {
  onClose: () => void;
  onSave: (videoUrl: string) => void;
  signLabel: string;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({ onClose, onSave, signLabel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    let mediaStream: MediaStream | null = null;
    const initializeCamera = async () => {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          alert("Could not access webcam. Please check permissions.");
          onClose();
        }
    };
    
    initializeCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // This effect runs only once on mount to initialize the camera.

  const startRecordingWithCountdown = () => {
    let count = 3;
    setCountdown(count);
    const countdownInterval = setInterval(() => {
        count -= 1;
        setCountdown(count);
        if (count === 0) {
            clearInterval(countdownInterval);
            setCountdown(null);
            startRecording();
        }
    }, 1000);
  };


  const startRecording = () => {
    if (stream) {
      setIsRecording(true);
      setRecordedUrl(null);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
      };
      mediaRecorderRef.current.start();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = () => {
    if (recordedUrl) {
        fetch(recordedUrl)
            .then(res => res.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    onSave(reader.result as string);
                };
                reader.readAsDataURL(blob);
            });
    }
  };

  const handleRetake = () => {
    setRecordedUrl(null);
    // The camera stream is still active, so we just need to clear the recorded video URL.
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-2xl">
        <h3 className="text-2xl font-bold mb-4 text-center">Record Sample for "{signLabel}"</h3>
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" src={recordedUrl ?? undefined}></video>
           {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-8xl font-bold text-white">{countdown}</div>
                </div>
            )}
           {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-white font-semibold">REC</span>
                </div>
            )}
        </div>
        <div className="mt-6 flex justify-center gap-4">
          {!recordedUrl ? (
            <>
              {!isRecording ? (
                <Button onClick={startRecordingWithCountdown} disabled={countdown !== null}>
                  {countdown !== null ? `Starting...` : `Start Recording`}
                </Button>
              ) : (
                <Button onClick={stopRecording} variant="danger">Stop Recording</Button>
              )}
            </>
          ) : (
            <>
              <Button onClick={handleRetake} variant="secondary">Retake</Button>
              <Button onClick={handleSave}>Save Sample</Button>
            </>
          )}
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">&times;</button>
      </div>
    </div>
  );
};

export default WebcamRecorder;