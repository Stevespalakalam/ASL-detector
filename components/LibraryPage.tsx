
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DataService from '../services/dataService';
import { Sign, AppData } from '../types';
import SignCard from './SignCard';
import Button from './Button';
import PlusIcon from './icons/PlusIcon';
import ExportIcon from './icons/ExportIcon';
import ImportIcon from './icons/ImportIcon';
import { getSettings } from '../services/dataService';

const LibraryPage: React.FC = () => {
  const [signs, setSigns] = useState<Sign[]>([]);
  const [newSignLabel, setNewSignLabel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);
  const { minSamples, confidenceThreshold } = getSettings();

  const loadSigns = useCallback(() => {
    setSigns(DataService.getSigns());
  }, []);

  useEffect(() => {
    loadSigns();
    window.addEventListener('storage', loadSigns);
    return () => window.removeEventListener('storage', loadSigns);
  }, [loadSigns]);

  const handleCreateSign = () => {
    if (newSignLabel.trim()) {
      const newSign = DataService.addSign(newSignLabel.trim());
      setNewSignLabel('');
      setIsModalOpen(false);
      navigate(`/sign/${newSign.id}`);
    }
  };

  const handleExport = () => {
    const data = DataService.loadData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asl-library-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => importInputRef.current?.click();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const imported = JSON.parse(text) as AppData;
          if (imported.signs && imported.settings) {
            DataService.saveData(imported);
            loadSigns();
            alert('Library imported successfully!');
          } else throw new Error('Invalid format');
        }
      } catch {
        alert('Failed to import. Please check the file format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const filteredSigns = signs.filter(s =>
    s.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const readySigns = signs.filter(s => s.confidence >= confidenceThreshold && s.takes.length >= minSamples);

  return (
    <div className="container mx-auto">
      {/* Stats row */}
      {signs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Signs', value: signs.length, color: 'text-sky-400' },
            { label: 'Ready to Use', value: readySigns.length, color: 'text-green-400' },
            { label: 'In Training', value: signs.length - readySigns.length, color: 'text-amber-400' },
          ].map(stat => (
            <div key={stat.label} className="glass rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <h2 className="text-2xl font-bold text-white">Sign Library</h2>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsModalOpen(true)}>
            <PlusIcon className="w-4 h-4" /> New Sign
          </Button>
          <Button onClick={handleExport} variant="secondary">
            <ExportIcon className="w-4 h-4" /> Export
          </Button>
          <Button onClick={handleImportClick} variant="secondary">
            <ImportIcon className="w-4 h-4" /> Import
          </Button>
          <input type="file" ref={importInputRef} className="hidden" accept=".json" onChange={handleImport} />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search signs…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-sm text-white placeholder-gray-600 border border-white/8 focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
        />
      </div>

      {/* Grid */}
      {filteredSigns.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredSigns.map(sign => (
            <SignCard key={sign.id} sign={sign} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 px-6 glass rounded-3xl border border-white/5">
          {searchTerm ? (
            <>
              <p className="text-4xl mb-4">🔍</p>
              <h3 className="text-lg font-semibold text-gray-300">No signs match "{searchTerm}"</h3>
              <p className="text-gray-500 text-sm mt-2">Try a different search term.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-5">
                <svg className="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Your library is empty</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                Create a sign, record {minSamples} short video samples, and your model will be ready to translate in real-time.
              </p>
              <Button onClick={() => setIsModalOpen(true)} size="lg">
                <PlusIcon className="w-5 h-5" /> Create First Sign
              </Button>
            </>
          )}
        </div>
      )}

      {/* Create Sign Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="glass rounded-3xl shadow-2xl w-full max-w-md border border-white/10 overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-1">Create New Sign</h3>
              <p className="text-sm text-gray-500 mb-6">
                Name the sign (e.g. "hello", "thank you"). You'll record {minSamples} video samples next.
              </p>
              <input
                type="text"
                value={newSignLabel}
                onChange={e => setNewSignLabel(e.target.value)}
                placeholder="Sign label…"
                autoFocus
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-1 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all text-sm"
                onKeyDown={e => e.key === 'Enter' && handleCreateSign()}
              />
              <div className="mt-5 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => { setIsModalOpen(false); setNewSignLabel(''); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSign} disabled={!newSignLabel.trim()}>
                  Create & Record →
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
