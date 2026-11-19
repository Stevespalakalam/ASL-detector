import React, { useState, useRef, useEffect } from 'react';
import { liveTranslate } from '../services/geminiService';
import { getSettings, updateSettings } from '../services/dataService';
import Button from './Button';
import CopyIcon from './icons/CopyIcon';
import ClearIcon from './icons/ClearIcon';
import { Link } from 'react-router-dom';

const TranslatePage: React.FC = () => {
  const [settings, setSettings] = useState(getSettings());
  const [is100Mode, setIs100Mode] = useState(true);
  const [transcript, setTranscript] = useState<string>('');
  const [currentPrediction, setCurrentPrediction] = useState<{ label: string | null, confidence: number }>({ label: null, confidence: 0 });
  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastWordRef = useRef<string>('');

  // Effect to listen for changes in settings from other tabs/components
  useEffect(() => {
    const handleStorageChange = () => {
        setSettings(getSettings());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);


  // Effect to manage the camera stream based on isCameraOn state
  useEffect(() => {
    if (isCameraOn) {
      let stream: MediaStream | null = null;
      const enableCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Error accessing webcam:", err);
          alert("Could not access the webcam. Please ensure permissions are granted.");
          setIsCameraOn(false); // Turn back off on error
        }
      };
      
      enableCamera();

      return () => {
        // Cleanup: stop all tracks of the stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    }
  }, [isCameraOn]);

  // Effect to manage the translation interval
  useEffect(() => {
    if (!isCameraOn) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const result = await liveTranslate();
      setCurrentPrediction(result);

      if (result.label) {
        const passesThreshold = result.confidence >= settings.confidenceThreshold;
        if ((is100Mode && passesThreshold) || !is100Mode) {
          if (result.label !== lastWordRef.current) {
            setTranscript(prev => `${prev} ${result.label}`.trim());
            lastWordRef.current = result.label;
          }
        } else {
          // Sign detected, but below threshold. Clear lock to allow re-try.
          lastWordRef.current = '';
        }
      } else {
        // No sign detected. Clear lock to allow repeated signs after a pause.
        lastWordRef.current = '';
      }
    }, 500); // Prediction interval

    return () => clearInterval(intervalId);
  }, [isCameraOn, is100Mode, settings.confidenceThreshold]);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
  };

  const handleClear = () => {
    setTranscript('');
    lastWordRef.current = '';
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newThreshold = parseFloat(e.target.value);
    const newSettings = { ...settings, confidenceThreshold: newThreshold };
    setSettings(newSettings);
    updateSettings(newSettings);
  };

  const confidenceColor = currentPrediction.confidence < 0.5 ? 'text-red-400' : currentPrediction.confidence < settings.confidenceThreshold ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="container mx-auto">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Panel: Camera Feed & Controls */}
        <div className="lg:w-2/3">
          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100"></video>
            {!isCameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70">
                    <p className="text-lg text-gray-300 mb-4">Camera is off</p>
                    <Button onClick={() => setIsCameraOn(true)}>Start Camera</Button>
                </div>
            )}
            <div className="absolute bottom-4 left-4 p-3 bg-black bg-opacity-60 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Current Detection</p>
                <p className="text-2xl font-bold capitalize">
                    {currentPrediction.label ?? '...'}
                </p>
                <p className={`text-lg font-mono ${confidenceColor}`}>
                    { (currentPrediction.confidence * 100).toFixed(1) }%
                </p>
                {is100Mode && currentPrediction.label && currentPrediction.confidence < settings.confidenceThreshold &&
                    <p className="text-amber-400 text-sm mt-2">Show the sign again.</p>
                }
                {!currentPrediction.label && currentPrediction.confidence < settings.confidenceThreshold && 
                  <p className="text-sm text-gray-400 mt-2">Unknown sign. <Link to="/library" className="text-primary-400 hover:underline">Enroll now?</Link></p>
                }
            </div>
          </div>
        </div>

        {/* Right Panel: Transcript & Settings */}
        <div className="lg:w-1/3">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-full flex flex-col">
            <h3 className="text-2xl font-bold mb-4">Transcript</h3>
            <div className="flex-grow bg-gray-900 p-4 rounded-md mb-4 min-h-[200px] overflow-y-auto">
              <p className="text-lg leading-relaxed whitespace-pre-wrap">{transcript || '...'}</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Button onClick={handleCopy} variant="secondary" disabled={!transcript}>
                <CopyIcon className="w-5 h-5"/> Copy
              </Button>
              <Button onClick={handleClear} variant="secondary" disabled={!transcript}>
                <ClearIcon className="w-5 h-5"/> Clear
              </Button>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-700">
                <div className="flex items-center justify-between">
                    <label htmlFor="100-mode-toggle" className="font-semibold text-lg">"No Mistake" Mode</label>
                    <button onClick={() => setIs100Mode(!is100Mode)} className={`${is100Mode ? 'bg-primary-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}>
                        <span className={`${is100Mode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}/>
                    </button>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                    When enabled, only translates signs when confidence is above { (settings.confidenceThreshold * 100).toFixed(0) }%.
                </p>
                <div className="mt-4">
                    <label htmlFor="confidence-slider" className="block text-sm font-medium text-gray-300 mb-1">
                        Confidence Threshold: {Math.round(settings.confidenceThreshold * 100)}%
                    </label>
                    <input
                        id="confidence-slider"
                        type="range"
                        min="0.80"
                        max="1.0"
                        step="0.01"
                        value={settings.confidenceThreshold}
                        onChange={handleThresholdChange}
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        disabled={!is100Mode}
                    />
                </div>
            </div>
            { isCameraOn && <Button onClick={() => setIsCameraOn(false)} variant="danger" className="w-full mt-6">Stop Camera</Button> }
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;