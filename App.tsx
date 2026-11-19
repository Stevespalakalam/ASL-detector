
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import LibraryPage from './components/LibraryPage';
import SignDetailPage from './components/SignDetailPage';
import TranslatePage from './components/TranslatePage';
import { Page } from './types';

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen animated-bg text-gray-100 font-sans">
        <Header />
        <main className="p-4 sm:p-6 lg:p-8 max-w-screen-xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to={Page.Library} replace />} />
            <Route path={Page.Library} element={<LibraryPage />} />
            <Route path={`${Page.Sign}/:signId`} element={<SignDetailPage />} />
            <Route path={Page.Translate} element={<TranslatePage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
