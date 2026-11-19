
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
  const progress = Math.min(100, (sign.takes.length / minSamples) * 100);

  return (
    <div
      onClick={() => navigate(`/sign/${sign.id}`)}
      className="glass rounded-2xl p-5 cursor-pointer card-hover group relative overflow-hidden"
    >
      {/* Hover glow */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${
        isReady ? 'bg-green-500/5' : 'bg-sky-500/5'
      }`} />

      {/* Status badge */}
      <div className="relative flex justify-between items-start mb-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
          isReady
            ? 'text-green-400 bg-green-400/10 border-green-400/20'
            : 'text-sky-400 bg-sky-400/10 border-sky-400/20'
        }`}>
          {isReady ? '● Ready' : `${sign.takes.length}/${minSamples} samples`}
        </span>
        {isReady && <CheckCircleIcon className="w-5 h-5 text-green-400" />}
      </div>

      {/* Label */}
      <h3 className="relative text-lg font-bold capitalize truncate text-white group-hover:text-sky-200 transition-colors">
        {sign.label}
      </h3>

      {/* Progress bar */}
      <div className="relative mt-4 w-full bg-white/8 rounded-full h-1 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-green-500' : 'conf-bar'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="relative text-xs text-gray-500 mt-1.5 text-right">
        {Math.round(sign.confidence * 100)}% confidence
      </p>

      {/* Arrow on hover */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-0 -translate-x-2">
        <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </div>
  );
};

export default SignCard;
