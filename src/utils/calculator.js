/**
 * Calculates the Tetsu Kasuya 4:6 method recipe.
 *
 * @param {number} coffeeGrams - Amount of coffee in grams.
 * @param {number} totalWaterInput - Total water in ml.
 * @param {string} balance - 'sweet', 'balanced', or 'acidity'.
 * @param {number} strengthPoursCount - Number of pours for strength phase (2, 3, 4, 5).
 * @param {number} ratioInput - Brew ratio, from 1:10 to 1:20.
 * @returns {object} Recipe details including steps, total water, and ratio.
 */
export function calculateRecipe(
  coffeeGrams,
  totalWaterInput,
  balance = 'balanced',
  strengthPoursCount = 3,
  ratioInput = 15,
) {
  const ratio = Math.max(10, Math.min(20, Number(ratioInput) || 15));
  const inputCoffee = Number(coffeeGrams) || 0;
  const inputWater = Number(totalWaterInput) || 0;
  const totalWater = Math.round(inputWater || inputCoffee * ratio);
  const normalizedCoffee = inputCoffee || (totalWater ? totalWater / ratio : 0);

  // Phase 1: Balance (40% of total water)
  // FIXED TIME: 90 seconds total (45s per pour)
  const phase1Total = Math.round(totalWater * 0.4);
  const phase1Interval = 45;
  let pour1, pour2;

  switch (balance) {
    case 'sweet':
      pour1 = Math.round(phase1Total / 3);
      pour2 = phase1Total - pour1;
      break;
    case 'acidity':
      pour1 = Math.round((phase1Total * 2) / 3);
      pour2 = phase1Total - pour1;
      break;
    case 'balanced':
    default:
      pour1 = Math.round(phase1Total * 0.5);
      pour2 = phase1Total - pour1;
      break;
  }

  // Phase 2: Strength (60% of total water)
  // FIXED TIME: 120 seconds total (To reach 3:30 total brew time)
  const phase2Total = totalWater - phase1Total;
  const phase2TimeAvailable = 120;

  // Ensure strengthPoursCount is valid (default 3 if weird input)
  const numPours = Math.max(2, Math.min(5, Number(strengthPoursCount) || 3));
  const timePerPour = phase2TimeAvailable / numPours;

  // Generate Steps
  const steps = [];
  let accumulatedWater = 0;
  let accumulatedTime = 0;

  // Step 1: First Pour (Balance 1)
  accumulatedWater += pour1;
  steps.push({
    type: 'pour',
    phase: 'balance',
    amount: pour1,
    totalAccumulated: accumulatedWater,
    timeStart: 0,
    duration: phase1Interval,
    instruction: 'First Pour (Bloom)'
  });
  accumulatedTime += phase1Interval;

  // Step 2: Second Pour (Balance 2 - Decides sweetness/acidity)
  accumulatedWater += pour2;
  steps.push({
    type: 'pour',
    phase: 'balance',
    amount: pour2,
    totalAccumulated: accumulatedWater,
    timeStart: accumulatedTime,
    duration: phase1Interval,
    instruction: 'Second Pour (Sweetness/Acidity)'
  });
  accumulatedTime += phase1Interval;

  // Step 3+: Strength Pours
  let remainingStrengthWater = phase2Total;

  for (let i = 0; i < numPours; i++) {
    const poursLeft = numPours - i;
    const amount = Math.round(remainingStrengthWater / poursLeft);

    remainingStrengthWater -= amount;
    accumulatedWater += amount;

    steps.push({
      type: 'pour',
      phase: 'strength',
      amount,
      totalAccumulated: accumulatedWater,
      timeStart: accumulatedTime,
      duration: timePerPour,
      instruction: i === numPours - 1 ? 'Final Pour' : `Strength Pour ${i + 1}`
    });
    accumulatedTime += timePerPour;
  }

  return {
    totalWater,
    coffeeGrams: Math.round(normalizedCoffee * 10) / 10,
    balance,
    strengthPoursCount: numPours,
    steps,
    totalTime: accumulatedTime,
    ratio,
  };
}
