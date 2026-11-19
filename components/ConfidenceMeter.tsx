
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

    const ProgressPill: React.FC<{label: string; value: string; progress: number; target: string;}> = ({label, value, progress, target}) => (
        <div className="flex-1 bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-baseline">
                <span className="font-semibold text-gray-300">{label}</span>
                <span className="text-lg font-bold text-white">{value}</span>
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                <div className="bg-primary-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">Target: {target}</p>
        </div>
    );
    
    return (
        <div className="bg-gray-900/50 rounded-lg p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 w-full">
                    <h3 className="text-xl font-semibold mb-4 text-center md:text-left">Training Progress</h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <ProgressPill 
                            label="Samples Collected"
                            value={`${sign.takes.length}`}
                            progress={sampleProgress}
                            target={`${minSamples}+`}
                        />
                        <ProgressPill 
                            label="Model Confidence"
                            value={`${(sign.confidence * 100).toFixed(1)}%`}
                            progress={confidenceProgress}
                            target={`${(confidenceThreshold * 100).toFixed(0)}%`}
                        />
                    </div>
                </div>
                <div className={`text-center p-6 rounded-lg transition-colors ${isReady ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {isReady ? (
                        <>
                            <CheckCircleIcon className="w-12 h-12 mx-auto" />
                            <h4 className="text-lg font-bold mt-2">Ready for Live Use</h4>
                            <p className="text-sm text-green-400/80">Thresholds met.</p>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 mx-auto rounded-full border-2 border-current flex items-center justify-center font-bold text-lg">!</div>
                            <h4 className="text-lg font-bold mt-2">Needs More Data</h4>
                            <p className="text-sm text-yellow-400/80">Add more varied samples.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ConfidenceMeter;
