import { useState, useMemo, useEffect } from 'react';
import { calculateRecipe } from '../utils/calculator';
import {
    getSavedRecipeSettings,
    resetRecipeSettings as resetSavedRecipeSettings,
    saveRecipeSettings,
} from '../utils/preferences';

const DEFAULT_RATIO = 15;
const MIN_RATIO = 10;
const MAX_RATIO = 20;
const MIN_WATER = 150;
const MAX_WATER = 1500;
const MIN_TEMPERATURE = 75;
const MAX_TEMPERATURE = 100;
const MIN_GRIND_SIZE = 0;
const MAX_GRIND_SIZE = 200;
const MIN_STRENGTH_POURS = 2;
const MAX_STRENGTH_POURS = 5;

const roundToOneDecimal = (value) => {
    return Math.round(value * 10) / 10;
};

const clamp = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};

const normalizeRatio = (value) => {
    const parsed = Number(value);
    const ratio = Number.isFinite(parsed) ? parsed : DEFAULT_RATIO;

    return Math.round(clamp(ratio, MIN_RATIO, MAX_RATIO) * 2) / 2;
};

const normalizeGrindSize = (value) => {
    if (value === '' || value === null || value === undefined) {
        return '';
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
        return '';
    }

    return clamp(Math.round(parsed), 0, 200);
};

const canPersistRecipeSettings = ({
    waterAmount,
    temperature,
    ratio,
    grindSize,
    strengthPours,
}) => {
    const parsedWater = Number(waterAmount);
    const parsedTemperature = Number(temperature);
    const parsedRatio = Number(ratio);
    const parsedGrindSize = Number(grindSize);
    const parsedStrengthPours = Number(strengthPours);

    return (
        Number.isFinite(parsedWater)
        && parsedWater >= MIN_WATER
        && parsedWater <= MAX_WATER
        && Number.isFinite(parsedTemperature)
        && parsedTemperature >= MIN_TEMPERATURE
        && parsedTemperature <= MAX_TEMPERATURE
        && Number.isFinite(parsedRatio)
        && parsedRatio >= MIN_RATIO
        && parsedRatio <= MAX_RATIO
        && Number.isFinite(parsedGrindSize)
        && parsedGrindSize >= MIN_GRIND_SIZE
        && parsedGrindSize <= MAX_GRIND_SIZE
        && Number.isFinite(parsedStrengthPours)
        && parsedStrengthPours >= MIN_STRENGTH_POURS
        && parsedStrengthPours <= MAX_STRENGTH_POURS
    );
};

export function useRecipe() {
    const [initialSettings] = useState(() => getSavedRecipeSettings());
    const [coffeeGrams, setCoffeeGrams] = useState(() => roundToOneDecimal(initialSettings.totalWater / initialSettings.ratio));
    const [waterAmount, setWaterAmount] = useState(initialSettings.totalWater);
    const [temperature, setTemperature] = useState(initialSettings.temperature);
    const [ratio, setRatioState] = useState(initialSettings.ratio);
    const [grindSize, setGrindSize] = useState(initialSettings.grindSize);
    const [balance, setBalance] = useState('balanced'); // 'sweet', 'balanced', 'acidity'
    const [strengthPours, setStrengthPours] = useState(initialSettings.strengthPours); // Default 3 pours

    useEffect(() => {
        const settings = {
            waterAmount,
            temperature,
            ratio,
            grindSize,
            strengthPours,
        };

        if (!canPersistRecipeSettings(settings)) {
            return;
        }

        saveRecipeSettings({
            totalWater: waterAmount,
            temperature,
            ratio,
            grindSize,
            strengthPours,
        });
    }, [waterAmount, temperature, ratio, grindSize, strengthPours]);

    // Sync Water when Coffee changes
    const updateCoffee = (grams) => {
        if (grams === '') {
            setCoffeeGrams('');
            setWaterAmount('');
            return;
        }

        setCoffeeGrams(grams);
        setWaterAmount(Math.round(grams * ratio));
    };

    // Sync Coffee when Water changes
    const updateWater = (ml) => {
        if (ml === '') {
            setWaterAmount('');
            setCoffeeGrams('');
            return;
        }

        setWaterAmount(ml);
        setCoffeeGrams(roundToOneDecimal(ml / ratio));
    };

    const updateRatio = (value) => {
        const nextRatio = normalizeRatio(value);

        setRatioState(nextRatio);
        setCoffeeGrams(waterAmount === '' ? '' : roundToOneDecimal(waterAmount / nextRatio));
    };

    const resetRecipeSettings = () => {
        const originalSettings = resetSavedRecipeSettings();

        setRatioState(originalSettings.ratio);
        setWaterAmount(originalSettings.totalWater);
        setCoffeeGrams(roundToOneDecimal(originalSettings.totalWater / originalSettings.ratio));
        setTemperature(originalSettings.temperature);
        setGrindSize(originalSettings.grindSize);
        setStrengthPours(originalSettings.strengthPours);
    };

    const recipe = useMemo(() => {
        return {
            ...calculateRecipe(coffeeGrams, waterAmount, balance, strengthPours, ratio),
            temperature,
            grindSize: normalizeGrindSize(grindSize),
        };
    }, [coffeeGrams, waterAmount, balance, strengthPours, temperature, ratio, grindSize]);

    return {
        coffeeGrams,
        setCoffeeGrams: updateCoffee,
        waterAmount,
        setWaterAmount: updateWater,
        temperature,
        setTemperature,
        ratio,
        setRatio: updateRatio,
        grindSize,
        setGrindSize,
        balance,
        setBalance,
        strengthPours,
        setStrengthPours,
        resetRecipeSettings,
        recipe
    };
}
