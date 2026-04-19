import { useState, useMemo } from 'react';
import { calculateRecipe } from '../utils/calculator';

const RATIO = 15;

const roundToOneDecimal = (value) => {
    return Math.round(value * 10) / 10;
};

export function useRecipe() {
    const [coffeeGrams, setCoffeeGrams] = useState(20);
    const [waterAmount, setWaterAmount] = useState(300);
    const [temperature, setTemperature] = useState(92);
    const [balance, setBalance] = useState('balanced'); // 'sweet', 'balanced', 'acidity'
    const [strengthPours, setStrengthPours] = useState(2); // Default 2 pours

    // Sync Water when Coffee changes
    const updateCoffee = (grams) => {
        setCoffeeGrams(grams);
        setWaterAmount(Math.round(grams * RATIO));
    };

    // Sync Coffee when Water changes
    const updateWater = (ml) => {
        setWaterAmount(ml);
        setCoffeeGrams(roundToOneDecimal(ml / RATIO));
    };

    const recipe = useMemo(() => {
        return {
            ...calculateRecipe(coffeeGrams, waterAmount, balance, strengthPours),
            temperature
        };
    }, [coffeeGrams, waterAmount, balance, strengthPours, temperature]);

    return {
        coffeeGrams,
        setCoffeeGrams: updateCoffee,
        waterAmount,
        setWaterAmount: updateWater,
        temperature,
        setTemperature,
        balance,
        setBalance,
        strengthPours,
        setStrengthPours,
        recipe
    };
}
