// js/modules/contracts/contracts-rewards.js
export const REWARD_TIERS = [
  { count: 5,   reward: "500 ₽ + 5 репутации",    label: "Бронза" },
  { count: 10,  reward: "1 500 ₽ + 15 репутации", label: "Серебро" },
  { count: 20,  reward: "5 000 ₽ + 40 репутации", label: "Золото" },
  { count: 50,  reward: "20 000 ₽ + 100 репутации", label: "Платина" },
  { count: 100, reward: "50 000 ₽ + 300 репутации", label: "Легенда" }
];

export function getNextReward(contractsDone) {
  const next = REWARD_TIERS.find(t => t.count > contractsDone);
  if (!next) return { done: true, count: contractsDone };
  return {
    done: false,
    current: contractsDone,
    target: next.count,
    reward: next.reward,
    label: next.label,
    progress: Math.min(100, Math.round((contractsDone / next.count) * 100))
  };
}

export function getEarnedRewards(contractsDone) {
  return REWARD_TIERS.filter(t => t.count <= contractsDone);
}
