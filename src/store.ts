import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AttributeKey,
  Attributes,
  BossVictory,
  BossWeek,
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
  ATTRIBUTE_KEYS,
  CHEAT_DAY_RECHARGE_COMPLETIONS,
  createAttributes,
  DEEP_WORK_SPILL,
  getCompletionAward,
  getCrossedPerks,
  getDecayPerMiss,
  getEffectiveGraceDays,
  hasSignature,
  isDecaying,
  isScheduledDay,
  processHabitDecay,
  removeXp,
  SIGNATURE_LEVEL,
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
  bossWeek: BossWeek | null;
  settings: ReminderSettings;

  setCharacterName: (name: string) => void;
  spendCheatDay: () => void;
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
      lifetimeXp: 0,
      cheatDay: { unlocked: false, charges: 0, progressToNext: 0, usedDates: [] as string[] },
      lastDecayCheck: todayStr(),
    },
    habits: starterHabits(),
    completions: [] as CompletionEntry[],
    rewards: starterRewards(),
    redemptions: [] as RedemptionEntry[],
    bossVictories: [] as BossVictory[],
    bossWeek: null as BossWeek | null,
  };
}

/**
 * Grants the Cheat Day charge the first time Constitution reaches the
 * signature level. Runs on every state change that could have crossed it.
 */
function withCheatDayUnlock(character: CharacterState): CharacterState {
  if (character.cheatDay.unlocked) return character;
  if (character.attributes.CON.level < SIGNATURE_LEVEL) return character;
  return { ...character, cheatDay: { ...character.cheatDay, unlocked: true, charges: 1 } };
}

/** Cheat Day charges are re-earned through completions, not elapsed time. */
function advanceCheatDayRecharge(character: CharacterState): CharacterState {
  const { cheatDay } = character;
  if (!cheatDay.unlocked || cheatDay.charges > 0) return character;
  const progress = cheatDay.progressToNext + 1;
  if (progress < CHEAT_DAY_RECHARGE_COMPLETIONS) {
    return { ...character, cheatDay: { ...cheatDay, progressToNext: progress } };
  }
  useToastStore.getState().show('🍰 Cheat Day recharged — you have a rest day banked.');
  return { ...character, cheatDay: { ...cheatDay, charges: 1, progressToNext: 0 } };
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
          const baseAttributes = state.character.attributes;
          const cheatDates = state.character.cheatDay.usedDates;
          let attributes = { ...baseAttributes };
          let streakSaves = state.character.streakSaves;
          let changed = false;

          const habits = state.habits.map((h) => {
            // Perk bonuses are read from the pre-decay attributes so that one
            // habit's decay can't silently weaken another habit's grace
            // period in the middle of the same pass.
            const graceDays = getEffectiveGraceDays(h, baseAttributes);
            const wasDecaying = isDecaying(h, baseAttributes);
            const { habit: updated, xpLoss } = processHabitDecay(h, today, {
              graceDays,
              perMiss: getDecayPerMiss(h, baseAttributes),
              forgivenDates: h.attribute === 'CON' ? cheatDates : undefined,
            });

            if (xpLoss > 0) {
              const firstCrossing = !wasDecaying && isDecaying(updated, baseAttributes);
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

          // Freeze this week's boss target. Recomputing it live let a player
          // archive a habit mid-week to lower a bar they'd already missed.
          const weekStart = getWeekStart(today);
          const bossWeek =
            state.bossWeek?.weekStart === weekStart
              ? state.bossWeek
              : { weekStart, threshold: getBossThreshold(habits.filter((h) => !h.archived)) };
          if (bossWeek !== state.bossWeek) changed = true;

          if (!changed && state.character.lastDecayCheck === today) return state;
          return {
            habits,
            bossWeek,
            character: { ...state.character, attributes, streakSaves, lastDecayCheck: today },
          };
        }),

      spendCheatDay: () => {
        const state = get();
        const today = todayStr();
        const { cheatDay } = state.character;
        if (!cheatDay.unlocked || cheatDay.charges < 1) return;
        if (cheatDay.usedDates.includes(today)) return;

        useToastStore.getState().show('🍰 Cheat Day spent — Constitution quests are forgiven today.');
        set((s) => ({
          character: {
            ...s.character,
            cheatDay: {
              ...s.character.cheatDay,
              charges: s.character.cheatDay.charges - 1,
              progressToNext: 0,
              usedDates: [...s.character.cheatDay.usedDates, today],
            },
          },
        }));
      },

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

        // Completing on a day the quest isn't scheduled still earns its
        // rewards — extra effort should count — but it must not build a
        // streak or wipe out misses on the days it actually was due.
        const onSchedule = isScheduledDay(habit, today);
        const newStreak = onSchedule ? habit.streak + 1 : habit.streak;

        const award = getCompletionAward(habit, state.character.attributes, onSchedule ? newStreak : 0);
        const entry: CompletionEntry = {
          id: makeId(),
          habitId: id,
          date: today,
          xpAwarded: award.xp,
          goldAwarded: award.gold,
          prevProgress: {
            streak: habit.streak,
            bestStreak: habit.bestStreak,
            missedSinceCompletion: habit.missedSinceCompletion,
            lastCompletedDate: habit.lastCompletedDate,
            decayedThroughDate: habit.decayedThroughDate,
          },
        };

        const oldLevel = state.character.attributes[habit.attribute].level;
        const newAttrState = addXp(state.character.attributes[habit.attribute], award.xp);
        const crossedPerks = getCrossedPerks(habit.attribute, oldLevel, newAttrState.level);
        if (crossedPerks.length > 0) {
          const perk = crossedPerks[crossedPerks.length - 1];
          const label = perk.signature ? '✨ Signature perk unlocked' : '🎉 Perk unlocked';
          useToastStore.getState().show(`${label}: ${perk.name} (${habit.attribute} Lv ${perk.level})`);
        } else if (newAttrState.level > oldLevel) {
          useToastStore.getState().show(`⭐ ${habit.attribute} leveled up to ${newAttrState.level}!`);
        } else if (award.doubled) {
          useToastStore.getState().show(`⚔️ Berserker! ${newStreak}-day streak paid double XP.`);
        }

        set((s) => {
          const attributes: Attributes = {
            ...s.character.attributes,
            [habit.attribute]: addXp(s.character.attributes[habit.attribute], award.xp),
          };

          // Deep Work: Intelligence quests lift every other attribute too.
          let spilled = 0;
          if (award.spilloverXp > 0) {
            for (const key of ATTRIBUTE_KEYS) {
              if (key === habit.attribute) continue;
              attributes[key] = addXp(attributes[key], award.spilloverXp);
              spilled += award.spilloverXp;
            }
          }

          let character: CharacterState = {
            ...s.character,
            gold: s.character.gold + award.gold,
            lifetimeXp: s.character.lifetimeXp + award.xp + spilled,
            attributes,
          };
          character = withCheatDayUnlock(character);
          character = advanceCheatDayRecharge(character);

          return {
            character,
            habits: s.habits.map((h) =>
              h.id === id
                ? {
                    ...h,
                    streak: newStreak,
                    bestStreak: Math.max(h.bestStreak, newStreak),
                    lastCompletedDate: today,
                    decayedThroughDate: today,
                    missedSinceCompletion: onSchedule ? 0 : h.missedSinceCompletion,
                  }
                : h,
            ),
            completions: [...s.completions, entry],
          };
        });

        get().claimBossVictory();
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

        set((s) => {
          const attributes: Attributes = {
            ...s.character.attributes,
            [habit.attribute]: removeXp(s.character.attributes[habit.attribute], todaysEntry.xpAwarded),
          };

          // Mirror the Deep Work spillover this completion handed out, so the
          // other five attributes don't keep XP from an undone quest.
          let spilled = 0;
          if (habit.attribute === 'INT' && hasSignature(s.character.attributes, 'deep-work')) {
            const spill = Math.floor(todaysEntry.xpAwarded * DEEP_WORK_SPILL);
            if (spill > 0) {
              for (const key of ATTRIBUTE_KEYS) {
                if (key === habit.attribute) continue;
                attributes[key] = removeXp(attributes[key], spill);
                spilled += spill;
              }
            }
          }

          return {
            character: {
              ...s.character,
              gold: s.character.gold - todaysEntry.goldAwarded,
              lifetimeXp: Math.max(0, s.character.lifetimeXp - todaysEntry.xpAwarded - spilled),
              attributes,
            },
            habits: s.habits.map((h) => (h.id === id ? { ...h, ...restored } : h)),
            completions: remaining,
          };
        });
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
          kind: 'reward',
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
          kind: 'utility',
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

        // Use the target frozen at the start of the week; fall back to a live
        // figure only if this is the very first check of a fresh week.
        const threshold =
          state.bossWeek?.weekStart === weekStart
            ? state.bossWeek.threshold
            : getBossThreshold(state.habits.filter((h) => !h.archived));
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
        const { character, habits, completions, rewards, redemptions, bossVictories, bossWeek, settings } = get();
        return JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            character,
            habits,
            completions,
            rewards,
            redemptions,
            bossVictories,
            bossWeek,
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
          bossWeek: null,
          ...(data.settings ? { settings: data.settings } : {}),
        });
        return { ok: true };
      },
    }),
    {
      name: 'questlog-rpg-storage',
      version: 2,
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<Store> & { character?: Partial<CharacterState> };
        if (fromVersion >= 2 || !state?.character) return state as Store;

        // v1 had no lifetimeXp and no cheat-day state. Seed lifetime XP from
        // the completion log so existing players keep the progress they
        // earned rather than restarting at character level 1.
        const completions = Array.isArray(state.completions) ? state.completions : [];
        const character = state.character;
        return {
          ...state,
          character: {
            ...character,
            lifetimeXp:
              typeof character.lifetimeXp === 'number'
                ? character.lifetimeXp
                : completions.reduce((sum, c) => sum + (c?.xpAwarded ?? 0), 0),
            cheatDay: character.cheatDay ?? {
              unlocked: (character.attributes?.CON?.level ?? 1) >= SIGNATURE_LEVEL,
              charges: (character.attributes?.CON?.level ?? 1) >= SIGNATURE_LEVEL ? 1 : 0,
              progressToNext: 0,
              usedDates: [],
            },
          },
          bossWeek: null,
        } as Store;
      },
    },
  ),
);
