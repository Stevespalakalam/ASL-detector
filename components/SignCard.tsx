
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sign } from '../types';
import CheckCircleIcon from './icons/CheckCircleIcon';
import { getSettings } from '../services/dataService';

interface SignCardProps {
  sign: Sign;
}

const SignCard: React.FC<SignCardProps> = ({ sign }) => {
  const navigate = useNavigate();
  const { confidenceThreshold, minSamples } = getSettings();
  const isReady = sign.confidence >= confidenceThreshold && sign.takes.length >= minSamples;

  return (
    <div
      onClick={() => navigate(`/sign/${sign.id}`)}
      className="bg-gray-800 rounded-lg shadow-lg p-4 cursor-pointer transition-all duration-300 hover:shadow-primary-500/20 hover:ring-2 hover:ring-primary-500"
    >
      <div className="flex justify-between items-start">
        <h3 className="text-xl font-bold capitalize truncate pr-2">{sign.label}</h3>
        {isReady && <CheckCircleIcon className="w-6 h-6 text-green-400 flex-shrink-0" />}
      </div>
      <p className="text-sm text-gray-400 mt-2">
        {sign.takes.length} {sign.takes.length === 1 ? 'sample' : 'samples'}
      </p>
      <div className="w-full bg-gray-700 rounded-full h-2.5 mt-3">
        <div
          className={`h-2.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-primary-600'}`}
          style={{ width: `${sign.confidence * 100}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 mt-1 text-right">
        Confidence: {Math.round(sign.confidence * 100)}%
      </p>
    </div>
  );
};

export default SignCard;
