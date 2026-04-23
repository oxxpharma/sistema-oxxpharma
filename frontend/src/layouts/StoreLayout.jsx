import React from 'react';
import { Outlet } from 'react-router-dom';
import StoreHeader from '../components/store/StoreHeader';
import StoreFooter from '../components/store/StoreFooter';

export default function StoreLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      <StoreHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
