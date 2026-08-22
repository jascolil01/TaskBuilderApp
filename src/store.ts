import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AttributeKey,
  BossVictory,
  CharacterState,
  CompletionEntry,
  Frequency,
  Habit,
  RedemptionEntry,
  ReminderSettings,
  Reward,
} from './types';
import { addDays, todayStr } from './lib/date';
import {
  addXp,
  createAttributes,
  getCrossedPerks,
  GOLD_PER_XP,
  isDecaying,
  processHabitDecay,
  removeXp,
  STREAK_SAVE_COST,
} from './lib/rpg';
import { getBossForWeek, getBossGoldReward, getBossThreshold, getWeeklyXpEarned, getWeekStart } from './lib/boss';
import { parseBackup } from './lib/backup';
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
  bossVictories: BossVictory[];
  settings: ReminderSettings;

  setCharacterName: (name: string) => void;
  setReminderSettings: (patch: Partial<Pick<ReminderSettings, 'enabled' | 'time'>>) => void;
  markReminderNotified: (date: string) => void;
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
  buyStreakSave: () => void;
  claimBossVictory: () => void;

  resetAll: () => void;
  exportData: () => string;
  importData: (json: string) => { ok: boolean; error?: string };
}

function createInitialState() {
  return {
    character: {
      name: '',
      createdAt: new Date().toISOString(),
      attributes: createAttributes(),
      gold: 0,
      streakSaves: 0,
      lastDecayCheck: todayStr(),
    },
    habits: starterHabits(),
    completions: [] as CompletionEntry[],
    rewards: starterRewards(),
    redemptions: [] as RedemptionEntry[],
    bossVictories: [] as BossVictory[],
  };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      // Device-level preference, not game progress — deliberately outside
      // createInitialState() so resetAll() never touches it.
      settings: { enabled: false, time: '19:00', lastNotifiedDate: null } as ReminderSettings,

      setCharacterName: (name) =>
        set((state) => ({ character: { ...state.character, name: name.trim().slice(0, 24) } })),

      setReminderSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      markReminderNotified: (date) => set((state) => ({ settings: { ...state.settings, lastNotifiedDate: date } })),

      runDecayCheck: () =>
        set((state) => {
          const today = todayStr();
          let attributes = { ...state.character.attributes };
          let streakSaves = state.character.streakSaves;
          let changed = false;
          const habits = state.habits.map((h) => {
            const wasDecaying = isDecaying(h);
            const { habit: updated, xpLoss } = processHabitDecay(h, today);
            if (xpLoss > 0) {
              const firstCrossing = !wasDecaying && isDecaying(updated);
              if (firstCrossing && streakSaves > 0) {
                streakSaves -= 1;
                changed = true;
                useToastStore.getState().show(`🛡️ Streak Save used to protect ${h.name} — ${streakSaves} left`);
                return { ...updated, missedSinceCompletion: 0 };
              }
              attributes = { ...attributes, [h.attribute]: removeXp(attributes[h.attribute], xpLoss) };
              changed = true;
            }
            if (updated !== h) changed = true;
            return updated;
          });
          if (!changed && state.character.lastDecayCheck === today) return state;
          return {
            habits,
            character: { ...state.character, attributes, streakSaves, lastDecayCheck: today },
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
          prevProgress: {
            streak: habit.streak,
            bestStreak: habit.bestStreak,
            missedSinceCompletion: habit.missedSinceCompletion,
            lastCompletedDate: habit.lastCompletedDate,
            decayedThroughDate: habit.decayedThroughDate,
          },
        };

        const oldLevel = state.character.attributes[habit.attribute].level;
        const newAttrState = addXp(state.character.attributes[habit.attribute], habit.xpReward);
        const crossedPerks = getCrossedPerks(habit.attribute, oldLevel, newAttrState.level);
        if (crossedPerks.length > 0) {
          const perk = crossedPerks[crossedPerks.length - 1];
          useToastStore.getState().show(`🎉 Perk unlocked: ${perk.name} (${habit.attribute} Lv ${perk.level})`);
        } else if (newAttrState.level > oldLevel) {
          useToastStore.getState().show(`⭐ ${habit.attribute} leveled up to ${newAttrState.level}!`);
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
        if (!todaysEntry) return;

        // The gold from this completion may already be spent. Clamping the
        // subtraction at zero would silently let the player keep that value,
        // so refuse the undo instead of quietly minting gold.
        if (state.character.gold < todaysEntry.goldAwarded) {
          useToastStore
            .getState()
            .show(`Can't undo — you've already spent the ${todaysEntry.goldAwarded} gold this quest earned.`);
          return;
        }

        const remaining = state.completions.filter((c) => c.id !== todaysEntry.id);
        const previous = [...remaining]
          .filter((c) => c.habitId === id)
          .sort((a, b) => (a.date < b.date ? 1 : -1))[0];

        // Restoring the snapshot is what keeps decay correct: rebuilding the
        // dates by hand would move the decay cursor back over days that were
        // already charged, and the next decay check would charge them again.
        const restored: Partial<Habit> = todaysEntry.prevProgress
          ? { ...todaysEntry.prevProgress }
          : {
              streak: Math.max(0, habit.streak - 1),
              lastCompletedDate: previous?.date ?? null,
              // No snapshot (entry predates them): park the decay cursor at
              // yesterday so already-charged days can never be re-charged.
              decayedThroughDate: addDays(today, -1),
              missedSinceCompletion: 0,
            };

        set((s) => ({
          character: {
            ...s.character,
            gold: s.character.gold - todaysEntry.goldAwarded,
            attributes: {
              ...s.character.attributes,
              [habit.attribute]: removeXp(s.character.attributes[habit.attribute], todaysEntry.xpAwarded),
            },
          },
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...restored } : h)),
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

      buyStreakSave: () => {
        const state = get();
        if (state.character.gold < STREAK_SAVE_COST) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: 'streak-save',
          rewardName: 'Streak Save Charge',
          cost: STREAK_SAVE_COST,
          date: todayStr(),
        };

        set((s) => ({
          character: {
            ...s.character,
            gold: s.character.gold - STREAK_SAVE_COST,
            streakSaves: s.character.streakSaves + 1,
          },
          redemptions: [...s.redemptions, entry],
        }));
      },

      claimBossVictory: () => {
        const state = get();
        const today = todayStr();
        const weekStart = getWeekStart(today);
        if (state.bossVictories.some((v) => v.weekStart === weekStart)) return;

        const activeHabits = state.habits.filter((h) => !h.archived);
        const threshold = getBossThreshold(activeHabits);
        const xpEarned = getWeeklyXpEarned(state.completions, weekStart);
        if (xpEarned < threshold) return;

        const boss = getBossForWeek(weekStart);
        const goldReward = getBossGoldReward(threshold);
        const victory: BossVictory = {
          id: makeId(),
          weekStart,
          bossName: boss.name,
          xpEarned,
          threshold,
          goldReward,
          defeatedAt: new Date().toISOString(),
        };

        useToastStore.getState().show(`⚔️ ${boss.name} defeated! +${goldReward} gold`);
        set((s) => ({
          character: { ...s.character, gold: s.character.gold + goldReward },
          bossVictories: [...s.bossVictories, victory],
        }));
      },

      resetAll: () => set(createInitialState()),

      exportData: () => {
        const { character, habits, completions, rewards, redemptions, bossVictories, settings } = get();
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            character,
            habits,
            completions,
            rewards,
            redemptions,
            bossVictories,
            settings,
          },
          null,
          2,
        );
      },

      importData: (json) => {
        const result = parseBackup(json);
        if (!result.ok) return { ok: false, error: result.error };

        const { data } = result;
        set({
          character: data.character,
          habits: data.habits,
          completions: data.completions,
          rewards: data.rewards,
          redemptions: data.redemptions,
          bossVictories: data.bossVictories,
          ...(data.settings ? { settings: data.settings } : {}),
        });
        return { ok: true };
      },
    }),
    { name: 'questlog-rpg-storage' },
  ),
);
