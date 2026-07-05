import { useState, useMemo } from 'react';
import { calculateRecipe } from '../utils/calculator';

const DEFAULT_RATIO = 15;
const DEFAULT_GRIND_SIZE = 120;
const MIN_RATIO = 10;
const MAX_RATIO = 20;

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

export function useRecipe() {
    const [coffeeGrams, setCoffeeGrams] = useState(20);
    const [waterAmount, setWaterAmount] = useState(300);
    const [temperature, setTemperature] = useState(92);
    const [ratio, setRatioState] = useState(DEFAULT_RATIO);
    const [grindSize, setGrindSize] = useState(DEFAULT_GRIND_SIZE);
    const [balance, setBalance] = useState('balanced'); // 'sweet', 'balanced', 'acidity'
    const [strengthPours, setStrengthPours] = useState(2); // Default 2 pours

    // Sync Water when Coffee changes
    const updateCoffee = (grams) => {
        setCoffeeGrams(grams);
        setWaterAmount(Math.round(grams * ratio));
    };

    // Sync Coffee when Water changes
    const updateWater = (ml) => {
        setWaterAmount(ml);
        setCoffeeGrams(roundToOneDecimal(ml / ratio));
    };

    const updateRatio = (value) => {
        const nextRatio = normalizeRatio(value);

        setRatioState(nextRatio);
        setCoffeeGrams(roundToOneDecimal(waterAmount / nextRatio));
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
        recipe
    };
}
