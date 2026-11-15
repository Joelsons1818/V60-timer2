import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRecipe } from './hooks/useRecipe';
import { AuthScreen } from './components/AuthScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { SharedRecipeScreen } from './components/SharedRecipeScreen';
import { TimerScreen } from './components/TimerScreen';
import {
  disableGoogleAutoSelect,
  loadSession,
  logoutSession,
} from './utils/auth';
import {
  buildBrewLog,
  clearSyncedCache,
  persistBrewLog,
  syncPendingChanges,
} from './utils/storage';
import { clearSharedRecipeFromUrl, parseSharedRecipe } from './utils/share';
import { saveLastCoffeeName } from './utils/preferences';
import audioController from './utils/audioController';
import screenKeeper from './utils/keepAwake';

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
    applyRecipeSettings,
    resetRecipeSettings,
    recipe,
  } = useRecipe();

  const [sharedRecipe, setSharedRecipe] = useState(() => parseSharedRecipe());
  const [screen, setScreen] = useState(sharedRecipe ? 'shared' : 'config');
  const [activeRecipe, setActiveRecipe] = useState(null);
  const [storageError, setStorageError] = useState('');
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMode, setAuthMode] = useState('loading');
  const [nextScreenAfterAuth, setNextScreenAfterAuth] = useState('config');
  const [user, setUser] = useState(null);

  // Whenever a login becomes available, send anything still waiting on this device.
  useEffect(() => {
    if (user) {
      syncPendingChanges();
    }
  }, [user]);

  const describeSaveResult = (result) => {
    if (result.synced) {
      return 'Recipe saved to your history.';
    }

    return `Recipe saved on this device. ${result.message} It will sync automatically.`;
  };

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
    setNotice('');
    // Both need to start from this tap to be allowed by the phone.
    audioController.resume();
    screenKeeper.enable();
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
      clearSyncedCache();
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

  // History always opens: without a login it shows what is stored on this
  // device and offers the Google sign-in right there.
  const handleHistory = () => {
    setNotice('');
    setScreen('history');
  };

  const closeSharedRecipe = () => {
    clearSharedRecipeFromUrl();
    setSharedRecipe(null);
    setScreen('config');
  };

  const handleUseSharedRecipe = () => {
    applyRecipeSettings(sharedRecipe);
    closeSharedRecipe();
  };

  const handleSaveSharedRecipe = async () => {
    const result = await persistBrewLog(sharedRecipe);

    applyRecipeSettings(sharedRecipe);
    setNotice(describeSaveResult(result));
    closeSharedRecipe();
  };

  const handleUseHistoryRecipe = (historyRecipe) => {
    applyRecipeSettings(historyRecipe);
    setActiveRecipe(null);
    setStorageError('');
    setScreen('config');
  };

  const handleSave = async (details) => {
    if (!activeRecipe) {
      return;
    }

    try {
      setStorageError('');
      const result = await persistBrewLog(buildBrewLog(activeRecipe, details));

      setNotice(describeSaveResult(result));
      saveLastCoffeeName(details.coffeeName);
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
          notice={notice}
          balance={balance}
          coffeeGrams={coffeeGrams}
          onHistory={handleHistory}
          onLogout={handleLogout}
          onOpenAuth={() => handleOpenAuth('config')}
          onResetDefaults={resetRecipeSettings}
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
          onSignedIn={handleSignedIn}
          onUseRecipe={handleUseHistoryRecipe}
          user={user}
        />
      )}

      {screen === 'shared' && sharedRecipe && (
        <SharedRecipeScreen
          onDismiss={closeSharedRecipe}
          onSave={handleSaveSharedRecipe}
          onUse={handleUseSharedRecipe}
          recipe={sharedRecipe}
        />
      )}

      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;
