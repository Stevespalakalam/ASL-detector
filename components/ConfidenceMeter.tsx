
import React from 'react';
import { Sign } from '../types';
import { getSettings } from '../services/dataService';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface ConfidenceMeterProps {
  sign: Sign;
}

const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ sign }) => {
  const { confidenceThreshold, minSamples } = getSettings();
  const isReady = sign.confidence >= confidenceThreshold && sign.takes.length >= minSamples;

  const sampleProgress = Math.min(100, (sign.takes.length / minSamples) * 100);
  const confidenceProgress = Math.min(100, (sign.confidence / confidenceThreshold) * 100);

  const Stat: React.FC<{ label: string; value: string; progress: number; target: string; color: string }> = ({
    label, value, progress, target, color
  }) => (
    <div className="glass rounded-xl p-4 flex-1">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</span>
        <span className="text-xl font-bold text-white">{value}</span>
      </div>
      <div className="w-full bg-white/8 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2 text-right">Target: {target}</p>
    </div>
  );

  return (
    <div className={`rounded-2xl p-5 border transition-all duration-500 ${
      isReady
        ? 'bg-green-500/5 border-green-500/20'
        : 'bg-sky-500/5 border-sky-500/10'
    }`}>
      <div className="flex flex-col md:flex-row items-stretch gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-400' : 'bg-sky-400'} ${!isReady ? 'animate-pulse' : ''}`} />
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Training Progress</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Stat
              label="Samples"
              value={`${sign.takes.length} / ${minSamples}`}
              progress={sampleProgress}
              target={`${minSamples} takes`}
              color="bg-gradient-to-r from-sky-500 to-sky-400"
            />
            <Stat
              label="Confidence"
              value={`${(sign.confidence * 100).toFixed(1)}%`}
              progress={confidenceProgress}
              target={`${(confidenceThreshold * 100).toFixed(0)}%`}
              color="bg-gradient-to-r from-violet-500 to-violet-400"
            />
          </div>
        </div>

        <div className={`flex flex-col items-center justify-center px-6 py-4 rounded-xl min-w-[140px] border ${
          isReady
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-amber-500/5 border-amber-500/10 text-amber-400'
        }`}>
          {isReady ? (
            <>
              <CheckCircleIcon className="w-10 h-10" />
              <p className="text-sm font-bold mt-2 text-center">Ready!</p>
              <p className="text-xs opacity-70 mt-0.5 text-center">All thresholds met</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
                <span className="text-lg font-bold">{minSamples - sign.takes.length > 0 ? minSamples - sign.takes.length : '✓'}</span>
              </div>
              <p className="text-sm font-bold mt-2 text-center">
                {sign.takes.length < minSamples ? 'Needs Samples' : 'Low Confidence'}
              </p>
              <p className="text-xs opacity-70 mt-0.5 text-center">
                {sign.takes.length < minSamples
                  ? `${minSamples - sign.takes.length} more needed`
                  : 'Keep recording'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfidenceMeter;
