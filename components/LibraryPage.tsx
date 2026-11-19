
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DataService from '../services/dataService';
import { Sign, AppData } from '../types';
import SignCard from './SignCard';
import Button from './Button';
import PlusIcon from './icons/PlusIcon';
import ExportIcon from './icons/ExportIcon';
import ImportIcon from './icons/ImportIcon';

const LibraryPage: React.FC = () => {
  const [signs, setSigns] = useState<Sign[]>([]);
  const [newSignLabel, setNewSignLabel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadSigns = useCallback(() => {
    setSigns(DataService.getSigns());
  }, []);

  useEffect(() => {
    loadSigns();
    window.addEventListener('storage', loadSigns);
    return () => {
      window.removeEventListener('storage', loadSigns);
    };
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
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asl-translate-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result;
          if (typeof text === 'string') {
            const importedData = JSON.parse(text) as AppData;
            // Basic validation
            if (importedData.signs && importedData.settings) {
              DataService.saveData(importedData);
              loadSigns();
              alert('Data imported successfully!');
            } else {
              throw new Error('Invalid data format');
            }
          }
        } catch (error) {
          console.error('Failed to import data:', error);
          alert('Failed to import data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };


  const filteredSigns = signs.filter(sign => 
    sign.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-3xl font-bold">Sign Library</h2>
        <div className="flex items-center gap-2">
            <Button onClick={() => setIsModalOpen(true)}>
                <PlusIcon className="w-5 h-5" /> New Sign
            </Button>
            <Button onClick={handleExport} variant="secondary">
                <ExportIcon className="w-5 h-5"/> Export
            </Button>
            <Button onClick={handleImportClick} variant="secondary">
                <ImportIcon className="w-5 h-5"/> Import
            </Button>
            <input
                type="file"
                ref={importInputRef}
                className="hidden"
                accept=".json"
                onChange={handleImport}
            />
        </div>
      </div>
        <input
            type="text"
            placeholder="Search signs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 mb-6 bg-gray-800 border border-gray-700 rounded-lg focus:ring-primary-500 focus:border-primary-500"
        />

      {filteredSigns.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredSigns.map(sign => (
            <SignCard key={sign.id} sign={sign} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-6 bg-gray-800 rounded-lg">
            <h3 className="text-xl font-semibold text-gray-300">Your library is empty.</h3>
            <p className="text-gray-400 mt-2">Create a new sign to start building your personal ASL dictionary.</p>
            <Button onClick={() => setIsModalOpen(true)} className="mt-6">
                <PlusIcon className="w-5 h-5" /> Create First Sign
            </Button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h3 className="text-2xl font-bold mb-4">Create New Sign</h3>
            <p className="text-gray-400 mb-6">Enter a label for the new sign you want to teach the system (e.g., "hello", "thank you").</p>
            <input
              type="text"
              value={newSignLabel}
              onChange={(e) => setNewSignLabel(e.target.value)}
              placeholder="Sign Label"
              autoFocus
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSign()}
            />
            <div className="mt-6 flex justify-end gap-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSign} disabled={!newSignLabel.trim()}>Create & Record</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;
