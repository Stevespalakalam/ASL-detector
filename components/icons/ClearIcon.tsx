
import React from 'react';

const ClearIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12L12 14.25m-2.25-2.25L12 9.75M14.25 12L16.5 9.75M12 14.25L9.75 16.5m-3-3L9 12m0 0L6.75 9.75M12 12h.008v.008H12V12Zm0 0h.008v.008H12V12Zm0 0h.008v.008H12V12Zm0 0h.008v.008H12V12Z" />
    </svg>
);

export default ClearIcon;
