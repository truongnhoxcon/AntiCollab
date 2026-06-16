import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage.js';
import MainAppPage from './pages/MainAppPage.js';

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (route === '#app') {
    return <MainAppPage />;
  }

  return <LandingPage />;
}

export default App;
