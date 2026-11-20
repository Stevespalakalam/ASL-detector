
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as DataService from '../services/dataService';
import { Sign, Landmark } from '../types';
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
  const [sign, setSign] = useState<Sign | null>(() => (signId ? DataService.getSign(signId) ?? null : null));
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSign = useCallback(() => {
    if (signId) {
      const s = DataService.getSign(signId);
      if (s) {
        setSign(s);
      }
    }
  }, [signId]);

  useEffect(() => {
    loadSign();
    window.addEventListener('storage', loadSign);
    return () => window.removeEventListener('storage', loadSign);
  }, [loadSign]);

  const handleAddTake = async (videoUrl: string, landmarks?: Landmark[]) => {
    if (!signId) return;
    setIsLoading(true);
    try {
      const updated = await DataService.addTake(signId, videoUrl, landmarks);
      setSign({ ...updated });
    } catch (err) {
      console.error('Error adding take:', err);
      alert('Failed to save the take. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRecording(false);
    }
  };

  const handleDeleteTake = async (takeId: string) => {
    if (!signId || !window.confirm('Are you sure you want to delete this take?')) return;
    setDeletingId(takeId);
    try {
      const updated = await DataService.deleteTake(signId, takeId);
      setSign({ ...updated });
    } catch (err) {
      console.error('Error deleting take:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSign = () => {
    if (signId && window.confirm(`Permanently delete "${sign?.label}" and all its samples?`)) {
      DataService.deleteSign(signId);
      navigate('/library');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        handleAddTake(e.target.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const { minSamples } = DataService.getSettings();

  if (!sign) {
    return (
      <div className="container mx-auto text-center py-20">
        <h2 className="text-xl font-bold text-gray-300 mb-2">Sign not found</h2>
        <p className="text-sm text-gray-500 mb-6">The requested sign may have been deleted or does not exist.</p>
        <Button onClick={() => navigate('/library')}>Back to Library</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/library')}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors group"
      >
        <BackIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Library
      </button>

      <div className="glass rounded-3xl border border-white/8 overflow-hidden">
        {/* Sign header */}
        <div className="px-6 pt-6 pb-5 border-b border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold capitalize text-white">{sign.label}</h2>
              <p className="text-sm text-gray-400 mt-1">
                {sign.takes.length} sample{sign.takes.length !== 1 ? 's' : ''} recorded ·{' '}
                <span className={sign.takes.length >= minSamples ? 'text-green-400 font-medium' : 'text-sky-400 font-medium'}>
                  {sign.takes.length >= minSamples
                    ? 'Target achieved!'
                    : `${minSamples - sign.takes.length} more needed to reach ${minSamples}`}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsRecording(true)} disabled={isLoading}>
                <VideoIcon className="w-4 h-4" /> Record Sample
              </Button>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                <UploadIcon className="w-4 h-4" /> Upload
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Confidence meter */}
          <ConfidenceMeter sign={sign} />

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 text-sm text-sky-400 glass rounded-xl px-4 py-3">
              <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              Processing MediaPipe landmarks and updating sign confidence...
            </div>
          )}

          {/* Samples grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">
                Collected Samples
                <span className="ml-2 text-sm font-normal text-gray-500">({sign.takes.length} / {minSamples})</span>
              </h3>
              {sign.takes.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        sign.takes.length >= minSamples ? 'bg-green-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, (sign.takes.length / minSamples) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {Math.min(100, Math.round((sign.takes.length / minSamples) * 100))}%
                  </span>
                </div>
              )}
            </div>

            {sign.takes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {sign.takes.map((take, i) => (
                  <div
                    key={take.id}
                    className={`group relative bg-black rounded-xl overflow-hidden border border-white/8 transition-all ${
                      deletingId === take.id ? 'opacity-40 scale-95' : ''
                    }`}
                  >
                    <video
                      src={take.videoUrl}
                      controls
                      playsInline
                      className="w-full aspect-video object-cover bg-black"
                    />
                    <div className="absolute top-2 left-2 glass px-2 py-0.5 rounded-full text-xs text-gray-300 pointer-events-none flex items-center gap-1">
                      <span>#{i + 1}</span>
                      {take.landmarks && <span className="text-[10px] text-sky-400">● 21 pts</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteTake(take.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/20 transition-all z-10"
                      title="Delete take"
                    >
                      <DeleteIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-14 px-6 bg-black/20 rounded-2xl border border-white/5">
                <p className="text-3xl mb-3">🎬</p>
                <p className="text-gray-300 text-sm font-medium">No samples recorded yet</p>
                <p className="text-gray-500 text-xs mt-1">
                  Record 5 short takes. MediaPipe will capture all 21 hand points to train gesture matching.
                </p>
                <Button onClick={() => setIsRecording(true)} className="mt-4">
                  <VideoIcon className="w-4 h-4" /> Record First Sample
                </Button>
              </div>
            )}
          </div>

          {/* Delete sign */}
          <div className="flex justify-end pt-4 border-t border-white/5">
            <Button variant="danger" onClick={handleDeleteSign}>
              <DeleteIcon className="w-4 h-4" /> Delete Sign
            </Button>
          </div>
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
