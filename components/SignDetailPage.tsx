
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as DataService from '../services/dataService';
import { Sign, Take } from '../types';
import Button from './Button';
import WebcamRecorder from './WebcamRecorder';
import ConfidenceMeter from './ConfidenceMeter';
import BackIcon from './icons/BackIcon';
import VideoIcon from './icons/VideoIcon';
import UploadIcon from './icons/UploadIcon';
import DeleteIcon from './icons/DeleteIcon';

const SignDetailPage: React.FC = () => {
  const { signId } = useParams<{ signId: string }>();
  const navigate = useNavigate();
  const [sign, setSign] = useState<Sign | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSign = useCallback(() => {
    if (signId) {
      const currentSign = DataService.getSign(signId);
      if (currentSign) {
        setSign(currentSign);
      } else {
        navigate('/library');
      }
    }
  }, [signId, navigate]);

  useEffect(() => {
    loadSign();
    window.addEventListener('storage', loadSign);
    return () => {
        window.removeEventListener('storage', loadSign);
    }
  }, [loadSign]);

  const handleAddTake = async (videoUrl: string) => {
    if (signId) {
      setIsLoading(true);
      try {
        const updatedSign = await DataService.addTake(signId, videoUrl);
        setSign(updatedSign);
      } catch (error) {
        console.error("Error adding take:", error);
      } finally {
        setIsLoading(false);
        setIsRecording(false);
      }
    }
  };

  const handleDeleteTake = async (takeId: string) => {
    if (signId && window.confirm("Are you sure you want to delete this take?")) {
      setIsLoading(true);
      try {
        const updatedSign = await DataService.deleteTake(signId, takeId);
        setSign(updatedSign);
      } catch (error) {
        console.error("Error deleting take:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleDeleteSign = () => {
     if (signId && window.confirm(`Are you sure you want to permanently delete the sign "${sign?.label}" and all its data?`)) {
       DataService.deleteSign(signId);
       navigate('/library');
     }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result && typeof e.target.result === 'string') {
                handleAddTake(e.target.result);
            }
        };
        reader.readAsDataURL(file);
    } else {
        alert("Please select a valid video file.");
    }
  };

  if (!sign) {
    return <div className="text-center">Loading sign details...</div>;
  }

  return (
    <div className="container mx-auto">
        <Button variant="secondary" onClick={() => navigate('/library')} className="mb-6">
            <BackIcon className="w-5 h-5"/>
            Back to Library
        </Button>
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
                <h2 className="text-4xl font-bold capitalize">{sign.label}</h2>
                <div className="flex gap-2">
                    <Button onClick={() => setIsRecording(true)}>
                        <VideoIcon className="w-5 h-5" /> Record More
                    </Button>
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                        <UploadIcon className="w-5 h-5" /> Upload
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
                </div>
            </div>

            <ConfidenceMeter sign={sign} />
            
            {isLoading && <div className="text-center my-4 text-primary-400">Updating model confidence...</div>}

            <h3 className="text-2xl font-semibold mt-10 mb-4 border-b-2 border-gray-700 pb-2">Collected Samples ({sign.takes.length})</h3>
            {sign.takes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {sign.takes.map(take => (
                        <div key={take.id} className="group relative bg-gray-900 rounded-lg overflow-hidden shadow-lg">
                            <video src={take.videoUrl} controls className="w-full h-auto aspect-video"></video>
                            <button onClick={() => handleDeleteTake(take.id)} className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                                <DeleteIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 px-6 bg-gray-900/50 rounded-lg">
                    <p className="text-gray-400">No samples recorded yet. Add your first take to begin training.</p>
                </div>
            )}
             <div className="mt-12 pt-6 border-t border-gray-700 text-right">
                <Button variant="danger" onClick={handleDeleteSign}>
                    <DeleteIcon className="w-5 h-5"/> Delete Sign
                </Button>
            </div>
        </div>

        {isRecording && (
            <WebcamRecorder
                onClose={() => setIsRecording(false)}
                onSave={handleAddTake}
                signLabel={sign.label}
            />
        )}
    </div>
  );
};

export default SignDetailPage;
