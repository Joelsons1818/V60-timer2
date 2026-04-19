import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import audioController from '../utils/audioController';

const requestScreenWakeLock = async (wakeLockRef, keepAwakeRef) => {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') {
        return;
    }

    try {
        if (wakeLockRef.current) {
            return;
        }

        const wakeLock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = wakeLock;

        wakeLock.addEventListener('release', () => {
            if (wakeLockRef.current === wakeLock) {
                wakeLockRef.current = null;
            }

            if (keepAwakeRef.current && document.visibilityState === 'visible') {
                window.setTimeout(() => {
                    requestScreenWakeLock(wakeLockRef, keepAwakeRef);
                }, 120);
            }
        }, { once: true });
    } catch (error) {
        console.debug('Wake lock unavailable', error);
    }
};

const releaseScreenWakeLock = async (wakeLockRef) => {
    if (!wakeLockRef.current) {
        return;
    }

    try {
        await wakeLockRef.current.release();
    } catch (error) {
        console.debug('Wake lock release skipped', error);
    } finally {
        wakeLockRef.current = null;
    }
};

export function TimerScreen({ recipe, onReset, onFinish }) {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);

    // Prep Timer State
    const [prepTimeLeft, setPrepTimeLeft] = useState(3);
    const [isPrepping, setIsPrepping] = useState(true);

    const lastPlayedRef = useRef(-1);
    const startTimeRef = useRef(null); // Reference for precise timing
    const finishHandledRef = useRef(false);
    const finishTimeoutRef = useRef(null);
    const wakeLockRef = useRef(null);
    const keepAwakeRef = useRef(false);

    // Sound Function using Persistent Context
    const playTone = useEffectEvent((freq = 800, type = 'sine', duration = 0.1) => {
        audioController.playTone(freq, type, duration);
    });

    // Prep countdown using pure state transitions so it stays stable in React Strict mode.
    useEffect(() => {
        if (!isPrepping) {
            return undefined;
        }

        const prepTimeout = window.setTimeout(() => {
            if (prepTimeLeft <= 1) {
                setPrepTimeLeft(0);
                startTimeRef.current = Date.now();
                setIsPrepping(false);
                setIsRunning(true);
                playTone(1500, 'triangle', 0.12);
                return;
            }

            setPrepTimeLeft(prepTimeLeft - 1);
        }, 1000);

        return () => {
            window.clearTimeout(prepTimeout);
        };
    }, [isPrepping, prepTimeLeft]);

    // Main Timer Effect (Date.now() delta logic)
    useEffect(() => {
        let interval = null;
        if (isRunning && !isFinished && !isPrepping) {
            // If resuming, adjust start time based on already elapsed time
            if (!startTimeRef.current) {
                startTimeRef.current = Date.now() - (elapsedTime * 1000);
            }

            interval = setInterval(() => {
                const now = Date.now();
                const diff = Math.floor((now - startTimeRef.current) / 1000);

                if (diff >= recipe.totalTime) {
                    setElapsedTime(recipe.totalTime);
                    setIsFinished(true);
                    setIsRunning(false);

                    if (!finishHandledRef.current) {
                        finishHandledRef.current = true;
                        playTone(1500, 'triangle', 0.15); // Finish sound

                        if (onFinish) {
                            finishTimeoutRef.current = window.setTimeout(() => {
                                onFinish();
                            }, 1400);
                        }
                    }
                } else {
                    setElapsedTime(diff);
                }
            }, 200); // Check more frequently than 1s to catch up quickly
        } else {
            // When not running (paused), clear the ref so it resets on resume
            startTimeRef.current = null;
        }
        return () => clearInterval(interval);
    }, [elapsedTime, isRunning, isFinished, isPrepping, onFinish, recipe.totalTime]);

    // Derived State for Current Step
    const currentStepIndex = recipe.steps.findIndex((step, index) => {
        const stepStart = recipe.steps.slice(0, index).reduce((acc, s) => acc + s.duration, 0);
        const stepEnd = stepStart + step.duration;
        return elapsedTime >= stepStart && elapsedTime < stepEnd;
    });

    const stepStart = currentStepIndex !== -1
        ? recipe.steps.slice(0, currentStepIndex).reduce((acc, s) => acc + s.duration, 0)
        : 0;

    const currentStep = currentStepIndex !== -1
        ? recipe.steps[currentStepIndex]
        : (elapsedTime >= recipe.totalTime ? null : recipe.steps[0]);

    const stepDuration = currentStep ? currentStep.duration : 0;
    const timeInStep = elapsedTime - stepStart;
    const remainingInStep = Math.max(0, stepDuration - timeInStep);
    const nextStep = recipe.steps[currentStepIndex + 1];
    const shouldKeepAwake = isPrepping || (isRunning && !isFinished);

    useEffect(() => {
        keepAwakeRef.current = shouldKeepAwake;

        if (!shouldKeepAwake) {
            releaseScreenWakeLock(wakeLockRef);
            return undefined;
        }

        requestScreenWakeLock(wakeLockRef, keepAwakeRef);

        return undefined;
    }, [shouldKeepAwake]);

    useEffect(() => {
        if (isFinished) {
            releaseScreenWakeLock(wakeLockRef);
        }
    }, [isFinished]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && keepAwakeRef.current) {
                requestScreenWakeLock(wakeLockRef, keepAwakeRef);
                return;
            }

            if (document.visibilityState !== 'visible') {
                wakeLockRef.current = null;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseScreenWakeLock(wakeLockRef);
        };
    }, []);

    // Sound Effect Logic for Steps (Persistent Check)
    useEffect(() => {
        if (isRunning && !isPrepping && currentStep) {
            // Check if we are in the "alert zone" (last 3 seconds)
            const isAlertZone = remainingInStep <= 3 && remainingInStep > 0;

            // If we entered a new second that hasn't played yet
            if (isAlertZone && lastPlayedRef.current !== remainingInStep) {
                playTone(remainingInStep === 1 ? 1200 : 800, 'sine', 0.1);
                lastPlayedRef.current = remainingInStep;
            }

            // Reset ref if we moved to a new step (remainingInStep jumps back up)
            if (remainingInStep > 3) {
                lastPlayedRef.current = -1;
            }
        }
    }, [remainingInStep, isRunning, isPrepping, currentStep]);


    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const toggleTimer = () => {
        if (isPrepping) return;

        audioController.resume();

        const nextIsRunning = !isRunning;
        setIsRunning(nextIsRunning);

        if (nextIsRunning) {
            requestScreenWakeLock(wakeLockRef, keepAwakeRef);
            return;
        }

        releaseScreenWakeLock(wakeLockRef);
    };

    const handlePrepInteraction = () => {
        audioController.resume();
        requestScreenWakeLock(wakeLockRef, keepAwakeRef);
    };

    useEffect(() => {
        return () => {
            if (finishTimeoutRef.current) {
                window.clearTimeout(finishTimeoutRef.current);
            }
        };
    }, []);

    if (isPrepping) {
        return (
            <div className="timer-container center-content prep-mode" onClick={handlePrepInteraction}>
                <div className="prep-display">
                    <h2>Get Ready</h2>
                    <div className="prep-count">{prepTimeLeft}</div>
                    <p className="hint">(Tap anywhere to unlock audio)</p>
                </div>
            </div>
        )
    }

    return (
        <div className="timer-container center-content">
            <span className="total-time-small timer-total-inline">
                Total: {formatTime(elapsedTime)} / {formatTime(recipe.totalTime)}
            </span>

            <div className="main-timer">
                {isFinished ? formatTime(recipe.totalTime) : formatTime(remainingInStep)}
            </div>

            <div className="instruction-box">
                {isFinished ? (
                    <div className="finished-message">
                        <h3>Enjoy your coffee!</h3>
                        <p>Total Brew Time: {formatTime(elapsedTime)}</p>
                        <button className="btn-primary" onClick={onReset} style={{ marginTop: '1rem' }}>
                            New Recipe
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="step-instruction">
                            {currentStep ? currentStep.instruction : "Ready"}
                        </h2>

                        <div className="water-stats">
                            <div className="stat">
                                <span className="label">Step Pour</span>
                                <span className="value">+{currentStep?.amount || 0}ml</span>
                            </div>
                            <div className="stat divider"></div>
                            <div className="stat">
                                <span className="label">Target</span>
                                <span className="value">{currentStep?.totalAccumulated || 0}ml</span>
                            </div>
                        </div>

                        <div className={`next-step-preview ${remainingInStep <= 5 && nextStep ? 'visible' : ''}`}>
                            {nextStep && (
                                <>
                                    <p className="next-step-title">
                                        Next: <strong>{nextStep.instruction}</strong>
                                    </p>
                                    <p className="next-step-copy">
                                        Pour: <strong>{nextStep.amount} ml</strong> | Target: <strong>{nextStep.totalAccumulated} ml</strong>
                                    </p>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="progress-bar-container">
                {recipe.steps.map((step, idx) => {
                    let status = 'pending';
                    if (idx < currentStepIndex) status = 'completed';
                    else if (idx === currentStepIndex) status = 'active';

                    return (
                        <div
                            key={idx}
                            className={`progress-segment ${status}`}
                            style={{ flex: step.duration }}
                        ></div>
                    );
                })}
            </div>

            <div className="action-buttons">
                {!isFinished && (
                    <button className={`btn-primary ${isRunning ? 'pause' : 'start'}`} onClick={toggleTimer}>
                        {isRunning ? 'Pause' : 'Start'}
                    </button>
                )}
                <button className="btn-secondary" onClick={onReset}>
                    {isFinished ? 'Reset' : 'Stop'}
                </button>
            </div>

            {/* Recipe Footer Summary */}
            <div className="recipe-footer">
                <span>{recipe.coffeeGrams}g Coffee</span>
                <span className="divider">|</span>
                <span>{recipe.totalWater}ml Water</span>
                <span className="divider">|</span>
                <span>1:15 Ratio</span>
                <span className="divider">|</span>
                <span>{recipe.strengthPoursCount} Pours (Phase 2)</span>
            </div>
        </div>
    );
}
