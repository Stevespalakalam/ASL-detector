
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Page } from '../types';

const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5">
      <div className="absolute inset-0 glass" />
      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
              </svg>
            </div>
            <span className="text-lg font-bold gradient-text tracking-tight">ASL Translate</span>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
            <NavLink
              to={Page.Library}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                }`
              }
            >
              Library
            </NavLink>
            <NavLink
              to={Page.Translate}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                }`
              }
            >
              Live Translate
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
