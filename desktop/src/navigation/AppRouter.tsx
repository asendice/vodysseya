import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Onboarding from '../pages/Onboarding';
import Dashboard from '../pages/Dashboard';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
};

export default AppRouter;
