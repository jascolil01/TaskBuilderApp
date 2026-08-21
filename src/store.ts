import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AttributeKey,
  CharacterState,
  CompletionEntry,
  Frequency,
  Habit,
  RedemptionEntry,
  Reward,
} from './types';
import { todayStr } from './lib/date';
import { addXp, createAttributes, getCrossedPerks, GOLD_PER_XP, processHabitDecay, removeXp } from './lib/rpg';
import { useToastStore } from './toastStore';

function makeId(): string {
  return crypto.randomUUID();
}

function starterHabits(): Habit[] {
  const now = new Date().toISOString();
  const base = (
    name: string,
    attribute: AttributeKey,
    xpReward: number,
    frequency: Frequency = { type: 'daily' },
  ): Habit => ({
    id: makeId(),
    name,
    attribute,
    frequency,
    graceDays: 2,
    xpReward,
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
    decayedThroughDate: null,
    missedSinceCompletion: 0,
    createdAt: now,
    archived: false,
  });

  return [
    base('Morning workout', 'STR', 20),
    base('Read for 20 minutes', 'INT', 15),
    base('Lights out by midnight', 'CON', 10),
  ];
}

function starterRewards(): Reward[] {
  const now = new Date().toISOString();
  const base = (name: string, cost: number): Reward => ({ id: makeId(), name, cost, createdAt: now });
  return [base('Guilt-free hour of gaming', 30), base('Order takeout', 60), base('New book or game', 200)];
}

interface Store {
  character: CharacterState;
  habits: Habit[];
  completions: CompletionEntry[];
  rewards: Reward[];
  redemptions: RedemptionEntry[];

  setCharacterName: (name: string) => void;
  runDecayCheck: () => void;
  addHabit: (input: {
    name: string;
    attribute: AttributeKey;
    frequency: Frequency;
    graceDays: number;
    xpReward: number;
  }) => void;
  updateHabit: (id: string, patch: Partial<Pick<Habit, 'name' | 'attribute' | 'frequency' | 'graceDays' | 'xpReward'>>) => void;
  archiveHabit: (id: string) => void;
  deleteHabit: (id: string) => void;
  completeHabit: (id: string) => void;
  undoCompleteHabit: (id: string) => void;

  addReward: (input: { name: string; cost: number }) => void;
  updateReward: (id: string, patch: Partial<Pick<Reward, 'name' | 'cost'>>) => void;
  deleteReward: (id: string) => void;
  redeemReward: (id: string) => void;

  resetAll: () => void;
}

function createInitialState() {
  return {
    character: {
      name: '',
      createdAt: new Date().toISOString(),
      attributes: createAttributes(),
      gold: 0,
      lastDecayCheck: todayStr(),
    },
    habits: starterHabits(),
    completions: [] as CompletionEntry[],
    rewards: starterRewards(),
    redemptions: [] as RedemptionEntry[],
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      setCharacterName: (name) =>
        set((state) => ({ character: { ...state.character, name: name.trim().slice(0, 24) } })),

      runDecayCheck: () =>
        set((state) => {
          const today = todayStr();
          let attributes = { ...state.character.attributes };
          let changed = false;
          const habits = state.habits.map((h) => {
            const { habit: updated, xpLoss } = processHabitDecay(h, today);
            if (xpLoss > 0) {
              attributes = { ...attributes, [h.attribute]: removeXp(attributes[h.attribute], xpLoss) };
              changed = true;
            }
            if (updated !== h) changed = true;
            return updated;
          });
          if (!changed && state.character.lastDecayCheck === today) return state;
          return {
            habits,
            character: { ...state.character, attributes, lastDecayCheck: today },
          };
        }),

      addHabit: (input) =>
        set((state) => ({
          habits: [
            ...state.habits,
            {
              id: makeId(),
              name: input.name.trim().slice(0, 60),
              attribute: input.attribute,
              frequency: input.frequency,
              graceDays: input.graceDays,
              xpReward: input.xpReward,
              streak: 0,
              bestStreak: 0,
              lastCompletedDate: null,
              decayedThroughDate: null,
              missedSinceCompletion: 0,
              createdAt: new Date().toISOString(),
              archived: false,
            },
          ],
        })),

      updateHabit: (id, patch) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        })),

      archiveHabit: (id) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
        })),

      deleteHabit: (id) =>
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
          completions: state.completions.filter((c) => c.habitId !== id),
        })),

      completeHabit: (id) => {
        const today = todayStr();
        const state = get();
        const habit = state.habits.find((h) => h.id === id);
        if (!habit || habit.lastCompletedDate === today) return;

        const newStreak = habit.streak + 1;
        const goldAwarded = habit.xpReward * GOLD_PER_XP;
        const entry: CompletionEntry = {
          id: makeId(),
          habitId: id,
          date: today,
          xpAwarded: habit.xpReward,
          goldAwarded,
        };

        const oldLevel = state.character.attributes[habit.attribute].level;
        const newAttrState = addXp(state.character.attributes[habit.attribute], habit.xpReward);
        const crossedPerks = getCrossedPerks(habit.attribute, oldLevel, newAttrState.level);
        if (crossedPerks.length > 0) {
          const perk = crossedPerks[crossedPerks.length - 1];
          useToastStore.getState().show(`🎉 Perk unlocked: ${perk.name} (${habit.attribute} Lv ${perk.level})`);
        }

        set((s) => ({
          character: {
            ...s.character,
            gold: s.character.gold + goldAwarded,
            attributes: {
              ...s.character.attributes,
              [habit.attribute]: addXp(s.character.attributes[habit.attribute], habit.xpReward),
            },
          },
          habits: s.habits.map((h) =>
            h.id === id
              ? {
                  ...h,
                  streak: newStreak,
                  bestStreak: Math.max(h.bestStreak, newStreak),
                  lastCompletedDate: today,
                  decayedThroughDate: today,
                  missedSinceCompletion: 0,
                }
              : h,
          ),
          completions: [...s.completions, entry],
        }));
      },

      undoCompleteHabit: (id) => {
        const today = todayStr();
        const state = get();
        const habit = state.habits.find((h) => h.id === id);
        if (!habit || habit.lastCompletedDate !== today) return;

        const todaysEntry = [...state.completions].reverse().find((c) => c.habitId === id && c.date === today);
        const remaining = state.completions.filter((c) => c.id !== todaysEntry?.id);
        const previous = [...remaining]
          .filter((c) => c.habitId === id)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

        set((s) => ({
          character: {
            ...s.character,
            gold: todaysEntry ? Math.max(0, s.character.gold - todaysEntry.goldAwarded) : s.character.gold,
            attributes: todaysEntry
              ? {
                  ...s.character.attributes,
                  [habit.attribute]: removeXp(s.character.attributes[habit.attribute], todaysEntry.xpAwarded),
                }
              : s.character.attributes,
          },
          habits: s.habits.map((h) =>
            h.id === id
              ? {
                  ...h,
                  streak: Math.max(0, h.streak - 1),
                  lastCompletedDate: previous?.date ?? null,
                  decayedThroughDate: previous?.date ?? null,
                  missedSinceCompletion: 0,
                }
              : h,
          ),
          completions: remaining,
        }));
      },

      addReward: (input) =>
        set((state) => ({
          rewards: [
            ...state.rewards,
            {
              id: makeId(),
              name: input.name.trim().slice(0, 60),
              cost: Math.max(1, Math.round(input.cost)),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateReward: (id, patch) =>
        set((state) => ({
          rewards: state.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteReward: (id) =>
        set((state) => ({
          rewards: state.rewards.filter((r) => r.id !== id),
        })),

      redeemReward: (id) => {
        const state = get();
        const reward = state.rewards.find((r) => r.id === id);
        if (!reward || state.character.gold < reward.cost) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: reward.id,
          rewardName: reward.name,
          cost: reward.cost,
          date: todayStr(),
        };

        set((s) => ({
          character: { ...s.character, gold: s.character.gold - reward.cost },
          redemptions: [...s.redemptions, entry],
        }));
      },

      resetAll: () => set(createInitialState()),
    }),
    { name: 'questlog-rpg-storage' },
  ),
);
