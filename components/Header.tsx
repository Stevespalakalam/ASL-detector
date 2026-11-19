
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Page } from '../types';

const Header: React.FC = () => {
  const linkClasses = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeLinkClasses = "bg-primary-600 text-white";
  const inactiveLinkClasses = "text-gray-300 hover:bg-gray-700 hover:text-white";

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">ASL Translate</h1>
          </div>
          <nav className="flex space-x-4">
            <NavLink
              to={Page.Library}
              className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}
            >
              Library
            </NavLink>
            <NavLink
              to={Page.Translate}
              className={({ isActive }) => `${linkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`}
            >
              Translate
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
