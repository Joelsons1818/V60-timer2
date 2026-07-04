import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRecipe } from './hooks/useRecipe';
import { AuthScreen } from './components/AuthScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { TimerScreen } from './components/TimerScreen';
import {
  disableGoogleAutoSelect,
  loadSession,
  logoutSession,
} from './utils/auth';
import { buildBrewLog, persistBrewLog } from './utils/storage';
import audioController from './utils/audioController';

const cloneRecipe = (recipe) => {
  return {
    ...recipe,
    steps: recipe.steps.map((step) => ({
      ...step,
    })),
  };
};

function App() {
  const {
    coffeeGrams,
    setCoffeeGrams,
    waterAmount,
    setWaterAmount,
    temperature,
    setTemperature,
    ratio,
    setRatio,
    grindSize,
    setGrindSize,
    balance,
    setBalance,
    strengthPours,
    setStrengthPours,
    recipe,
  } = useRecipe();

  const [screen, setScreen] = useState('config');
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState('loading');
  const [nextScreenAfterAuth, setNextScreenAfterAuth] = useState('config');
  const [user, setUser] = useState(null);

  const isLocalMode = authMode === 'local';
  const canAccessPrivateHistory = isLocalMode || Boolean(user);

  useEffect(() => {
    let cancelled = false;

    const initializeSession = async () => {
      try {
        const session = await loadSession();

        if (cancelled) {
          return;
        }

        setAuthMode(session.mode);
        setUser(session.user);
        setAuthError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAuthMode('remote');
        setUser(null);
        setAuthError(error.message || 'Unable to load Google login.');
      }
    };

    initializeSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = () => {
    setStorageError('');
    audioController.resume();
    setActiveRecipe(cloneRecipe(recipe));
    setScreen('timer');
  };

  const handleReset = () => {
    setActiveRecipe(null);
    setStorageError('');
    setScreen('config');
  };

  const handleFinish = () => {
    setScreen('review');
  };

  const handleOpenAuth = (targetScreen = 'config') => {
    setAuthError('');
    setNextScreenAfterAuth(targetScreen);
    setScreen('auth');
  };

  const handleSignedIn = (signedInUser) => {
    setUser(signedInUser);
    setAuthMode('remote');
    setAuthError('');

    if (screen === 'auth') {
      setScreen(nextScreenAfterAuth);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutSession();
      disableGoogleAutoSelect();
      setUser(null);
      setAuthMode('remote');
      setAuthError('');

      if (screen === 'history') {
        setScreen('config');
      }
    } catch (error) {
      setAuthError(error.message || 'Unable to sign out.');
    }
  };

  const handleHistory = () => {
    if (canAccessPrivateHistory) {
      setScreen('history');
      return;
    }

    handleOpenAuth('history');
  };

  const handleSave = async (details) => {
    if (!activeRecipe) {
      return;
    }

    try {
      setStorageError('');
      await persistBrewLog(buildBrewLog(activeRecipe, details));
      setActiveRecipe(null);
      setScreen('config');
    } catch (error) {
      setStorageError(error.message || 'Unable to save recipe.');
    }
  };

  return (
    <div className="app-container">
      {screen === 'config' && (
        <ConfigScreen
          authError={authError}
          authMode={authMode}
          balance={balance}
          coffeeGrams={coffeeGrams}
          onHistory={handleHistory}
          onLogout={handleLogout}
          onOpenAuth={() => handleOpenAuth('config')}
          onStart={handleStart}
          recipe={recipe}
          setBalance={setBalance}
          setCoffeeGrams={setCoffeeGrams}
          setGrindSize={setGrindSize}
          setRatio={setRatio}
          setStrengthPours={setStrengthPours}
          setTemperature={setTemperature}
          setWaterAmount={setWaterAmount}
          grindSize={grindSize}
          ratio={ratio}
          strengthPours={strengthPours}
          temperature={temperature}
          user={user}
          waterAmount={waterAmount}
        />
      )}

      {screen === 'auth' && (
        <AuthScreen
          authError={authError}
          onBack={handleReset}
          onSignedIn={handleSignedIn}
        />
      )}

      {screen === 'timer' && activeRecipe && (
        <TimerScreen
          onFinish={handleFinish}
          onReset={handleReset}
          recipe={activeRecipe}
        />
      )}

      {screen === 'review' && activeRecipe && (
        <ReviewScreen
          authError={authError}
          isLocalMode={isLocalMode}
          onBackHome={handleReset}
          onSave={handleSave}
          onSignedIn={handleSignedIn}
          recipe={activeRecipe}
          storageError={storageError}
          user={user}
        />
      )}

      {screen === 'history' && (
        <HistoryScreen
          onBack={handleReset}
        />
      )}

      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;
