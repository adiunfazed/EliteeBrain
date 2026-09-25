/** Mounts individual screens for light/dark checks. Not shipped. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WelcomeScreen } from '../src/components/WelcomeScreen';
import { Header } from '../src/components/Header';
import { XpProvider } from '../src/components/XpToast';
import { loadProfile } from '../src/utils/storage';

const params = new URLSearchParams(location.search);
const light = params.get('light') === '1';
const screen = params.get('screen') || 'welcome';

if (light) document.documentElement.classList.remove('dark');
else document.documentElement.classList.add('dark');

const profile = { ...loadProfile(), displayName: 'Aditya' } as any;

const Demo: React.FC = () => {
  const [dark, setDark] = useState(!light);

  const applyTheme = (value: boolean) => {
    setDark(value);
    document.documentElement.classList.toggle('dark', value);
  };

  if (screen === 'header') {
    return (
      <div style={{ background: 'var(--ground)', minHeight: '100vh' }}>
        <Header
          profile={profile}
          isHydrated
          currentUser={{ uid: 'u1', email: 'a@b.com', displayName: 'Aditya' } as any}
          onToggleSound={() => {}}
          onOpenSettings={() => {}}
          onOpenAuthModal={() => {}}
          onOpenSignOutModal={() => {}}
          onOpenAICoach={() => {}}
          onOpenProModal={() => {}}
          onOpenAdminPortal={() => {}}
          onOpenNotifications={() => {}}
          onOpenBadgesGallery={() => {}}
          isDarkMode={dark}
          onToggleDarkMode={() => applyTheme(!dark)}
        />
      </div>
    );
  }

  return (
    <WelcomeScreen suggested="Aditya Singh" dark={dark} onTheme={applyTheme} onDone={() => {}} />
  );
};

createRoot(document.getElementById('root')!).render(
  <XpProvider>
    <Demo />
  </XpProvider>
);
