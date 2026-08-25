import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AttributeKey,
  Attributes,
  BossVictory,
  BossWeek,
  CharacterState,
  CompletionEntry,
  Cosmetics,
  Frequency,
  Habit,
  Inventory,
  RedemptionEntry,
  ReminderSettings,
  Reward,
  Vacation,
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
  getCharacterClass,
  getEffectiveGraceDays,
  hasSignature,
  isDecaying,
  isScheduledDay,
  planBackfill,
  processHabitDecay,
  removeXp,
  SIGNATURE_LEVEL,
} from './lib/rpg';
import {
  getBossForWeek,
  getBossGoldReward,
  getWeeklyXpEarned,
  getWeekStart,
  resolveBossThreshold,
} from './lib/boss';
import {
  COSMETIC_COST,
  COSMETIC_RINGS,
  COSMETIC_TITLES,
  ELIXIR_COMPLETIONS,
  getRewardCost,
  getShopItem,
  inferRewardTier,
  type RewardTier,
  type ShopItemId,
} from './lib/shop';
import {
  getActiveVacation,
  getVacationDates,
  isWeekOnVacation,
  validateVacation,
} from './lib/vacation';
import { getGear, isValidGearId, withEquipped, withoutEquipped } from './lib/gear';
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
  const base = (name: string, tier: RewardTier): Reward => ({ id: makeId(), name, tier, createdAt: now });
  return [
    base('Guilt-free hour of gaming', 'minor'),
    base('Order takeout', 'standard'),
    base('New book or game', 'major'),
  ];
}

const EMPTY_INVENTORY: Inventory = { restDayTokens: 0, phoenixFeathers: 0, elixirCompletions: 0 };

interface Store {
  character: CharacterState;
  habits: Habit[];
  completions: CompletionEntry[];
  rewards: Reward[];
  redemptions: RedemptionEntry[];
  bossVictories: BossVictory[];
  bossWeek: BossWeek | null;
  vacations: Vacation[];
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
  backfillYesterday: (id: string) => void;

  addReward: (input: { name: string; tier: RewardTier }) => void;
  updateReward: (id: string, patch: Partial<Pick<Reward, 'name' | 'tier'>>) => void;
  deleteReward: (id: string) => void;
  redeemReward: (id: string) => void;
  buyShopItem: (id: ShopItemId) => void;
  spendRestDay: () => void;
  restoreStreakWithFeather: (habitId: string) => void;
  buyCosmetic: (kind: 'title' | 'ring', id: string) => void;
  setCosmetic: (kind: 'title' | 'ring', id: string | null) => void;
  buyGear: (id: string) => void;
  setGearEquipped: (id: string, equipped: boolean) => void;
  claimBossVictory: () => void;

  scheduleVacation: (startDate: string, endDate: string) => { ok: boolean; error?: string };
  cancelVacation: (id: string) => void;
  endVacationEarly: () => void;

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
      inventory: { ...EMPTY_INVENTORY },
      cosmetics: {
        unlockedTitles: [] as string[],
        unlockedRings: [] as string[],
        activeTitle: null as string | null,
        activeRing: null as string | null,
        unlockedGear: [] as string[],
        equippedGear: [] as string[],
      },
      lastDecayCheck: todayStr(),
    },
    habits: starterHabits(),
    completions: [] as CompletionEntry[],
    rewards: starterRewards(),
    redemptions: [] as RedemptionEntry[],
    bossVictories: [] as BossVictory[],
    bossWeek: null as BossWeek | null,
    vacations: [] as Vacation[],
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
          // A vacation is simply a range of forgiven days, so it rides the
          // same path the Cheat Day already uses.
          const forgivenDates = [
            ...state.character.cheatDay.usedDates,
            ...getVacationDates(state.vacations),
          ];
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
              // Constitution earns the perk, but a rest day is a rest day —
              // it forgives every quest that was due, not just CON ones.
              forgivenDates,
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

          // The boss target is a floor, not a snapshot: archiving a quest can't
          // lower a bar you'd already missed, but adding quests still raises it.
          const weekStart = getWeekStart(today);
          const threshold = resolveBossThreshold(
            habits.filter((h) => !h.archived),
            weekStart,
            state.bossWeek,
          );
          const bossWeek =
            state.bossWeek?.weekStart === weekStart && state.bossWeek.threshold === threshold
              ? state.bossWeek
              : { weekStart, threshold };
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

        useToastStore.getState().show('🍰 Cheat Day spent — every quest is forgiven today. Rest up.');
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

        const elixirActive = state.character.inventory.elixirCompletions > 0;
        const award = getCompletionAward(
          habit,
          state.character.attributes,
          onSchedule ? newStreak : 0,
          elixirActive,
        );
        const entry: CompletionEntry = {
          id: makeId(),
          habitId: id,
          date: today,
          xpAwarded: award.xp,
          baseXp: award.baseXp,
          goldAwarded: award.gold,
          elixirUsed: award.elixirUsed || undefined,
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
        } else if (award.elixirUsed) {
          const left = state.character.inventory.elixirCompletions - 1;
          useToastStore
            .getState()
            .show(`⚗️ Elixir of Might — double XP. ${left} ${left === 1 ? 'use' : 'uses'} left.`);
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
            inventory: award.elixirUsed
              ? {
                  ...s.character.inventory,
                  elixirCompletions: Math.max(0, s.character.inventory.elixirCompletions - 1),
                }
              : s.character.inventory,
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

      /**
       * Logs a quest for yesterday — the "I did it, I just never opened the
       * app" case. Capped at one day so it stays a repair rather than a way to
       * reconstruct a week you didn't do.
       *
       * The decay pass has already run over yesterday by now, so this can't
       * just append a completion: it has to hand back the XP that miss cost
       * and rebuild the streak from the completion log, which is the only
       * record of what the streak should have been.
       */
      backfillYesterday: (id) => {
        const today = todayStr();
        const yesterday = addDays(today, -1);
        const state = get();
        const habit = state.habits.find((h) => h.id === id);
        if (!habit) return;

        const completedDates = new Set(
          state.completions.filter((c) => c.habitId === id).map((c) => c.date),
        );
        const forgiven = new Set([
          ...state.character.cheatDay.usedDates,
          ...getVacationDates(state.vacations),
        ]);
        const graceDays = getEffectiveGraceDays(habit, state.character.attributes);
        const perMiss = getDecayPerMiss(habit, state.character.attributes);

        const plan = planBackfill(habit, yesterday, {
          graceDays,
          perMiss,
          forgiven,
          completedDates,
          today,
        });
        if (!plan.ok) {
          if (plan.reason) useToastStore.getState().show(plan.reason);
          return;
        }

        // Backfilling deliberately doesn't touch an Elixir: those charges were
        // bought for effort still to come, and spending one on a day already
        // past would be a surprise.
        const award = getCompletionAward(habit, state.character.attributes, plan.newStreak, false);
        const entry: CompletionEntry = {
          id: makeId(),
          habitId: id,
          date: yesterday,
          xpAwarded: award.xp,
          baseXp: award.baseXp,
          goldAwarded: award.gold,
          backfilled: true,
          prevProgress: {
            streak: habit.streak,
            bestStreak: habit.bestStreak,
            missedSinceCompletion: habit.missedSinceCompletion,
            lastCompletedDate: habit.lastCompletedDate,
            decayedThroughDate: habit.decayedThroughDate,
          },
        };

        const total = award.xp + plan.xpRefund;
        const oldLevel = state.character.attributes[habit.attribute].level;
        const newAttrState = addXp(state.character.attributes[habit.attribute], total);
        const crossed = getCrossedPerks(habit.attribute, oldLevel, newAttrState.level);
        useToastStore
          .getState()
          .show(
            plan.xpRefund > 0
              ? `📜 Logged for yesterday — streak restored and ${plan.xpRefund} XP given back.`
              : '📜 Logged for yesterday — streak restored.',
          );
        if (crossed.length > 0) {
          const perk = crossed[crossed.length - 1];
          useToastStore.getState().show(`🎉 Perk unlocked: ${perk.name}`);
        }

        set((s) => {
          const attributes: Attributes = {
            ...s.character.attributes,
            [habit.attribute]: addXp(s.character.attributes[habit.attribute], total),
          };
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
            // The refund is XP returned, not newly earned, so it must not
            // inflate the lifetime total that drives character level.
            lifetimeXp: s.character.lifetimeXp + award.xp + spilled,
            attributes,
          };
          character = withCheatDayUnlock(character);
          character = advanceCheatDayRecharge(character);

          const doneToday = completedDates.has(today);
          return {
            character,
            habits: s.habits.map((h) =>
              h.id === id
                ? {
                    ...h,
                    streak: plan.newStreak,
                    bestStreak: Math.max(h.bestStreak, plan.newStreak),
                    // Today's completion, if there is one, still owns these.
                    lastCompletedDate: doneToday ? h.lastCompletedDate : yesterday,
                    decayedThroughDate: doneToday ? h.decayedThroughDate : yesterday,
                    missedSinceCompletion: 0,
                    lastBrokenStreak: undefined,
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
              // Give the Elixir charge back if this completion consumed one.
              inventory: todaysEntry.elixirUsed
                ? {
                    ...s.character.inventory,
                    elixirCompletions: s.character.inventory.elixirCompletions + 1,
                  }
                : s.character.inventory,
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
              tier: input.tier,
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
        if (!reward) return;
        const cost = getRewardCost(reward.tier);
        if (state.character.gold < cost) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: reward.id,
          rewardName: reward.name,
          cost,
          date: todayStr(),
          kind: 'reward',
        };

        set((s) => ({
          character: { ...s.character, gold: s.character.gold - cost },
          redemptions: [...s.redemptions, entry],
        }));
      },

      buyShopItem: (itemId) => {
        const state = get();
        const item = getShopItem(itemId);
        if (state.character.gold < item.cost) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: item.id,
          rewardName: item.name,
          cost: item.cost,
          date: todayStr(),
          kind: 'utility',
        };

        set((s) => {
          const character: CharacterState = { ...s.character, gold: s.character.gold - item.cost };
          const inventory = { ...character.inventory };
          switch (item.id) {
            case 'streak-save':
              character.streakSaves = character.streakSaves + 1;
              break;
            case 'elixir-of-might':
              inventory.elixirCompletions += ELIXIR_COMPLETIONS;
              break;
            case 'rest-day-token':
              inventory.restDayTokens += 1;
              break;
            case 'phoenix-feather':
              inventory.phoenixFeathers += 1;
              break;
          }
          character.inventory = inventory;
          return { character, redemptions: [...s.redemptions, entry] };
        });
        useToastStore.getState().show(`${item.icon} ${item.name} purchased.`);
      },

      spendRestDay: () => {
        const state = get();
        const today = todayStr();
        if (state.character.inventory.restDayTokens < 1) return;
        // Already a rest day, whether from a token or the Cheat Day perk.
        if (state.character.cheatDay.usedDates.includes(today)) return;

        useToastStore.getState().show('🌙 Rest Day claimed — every quest is forgiven today.');
        set((s) => ({
          character: {
            ...s.character,
            inventory: { ...s.character.inventory, restDayTokens: s.character.inventory.restDayTokens - 1 },
            cheatDay: {
              ...s.character.cheatDay,
              usedDates: [...s.character.cheatDay.usedDates, today],
            },
          },
        }));
      },

      restoreStreakWithFeather: (habitId) => {
        const state = get();
        if (state.character.inventory.phoenixFeathers < 1) return;
        const habit = state.habits.find((h) => h.id === habitId);
        const restored = habit?.lastBrokenStreak ?? 0;
        if (!habit || restored <= 0) return;

        useToastStore.getState().show(`🪶 ${habit.name} restored to a ${restored}-day streak.`);
        set((s) => ({
          character: {
            ...s.character,
            inventory: { ...s.character.inventory, phoenixFeathers: s.character.inventory.phoenixFeathers - 1 },
          },
          habits: s.habits.map((h) =>
            h.id === habitId
              ? {
                  ...h,
                  streak: restored,
                  bestStreak: Math.max(h.bestStreak, restored),
                  // A restored streak implies the gap is forgiven, so decay
                  // stops too — otherwise the streak would break again at once.
                  missedSinceCompletion: 0,
                  lastBrokenStreak: undefined,
                }
              : h,
          ),
        }));
      },

      buyCosmetic: (kind, cosmeticId) => {
        const state = get();
        const catalog = kind === 'title' ? COSMETIC_TITLES : COSMETIC_RINGS;
        if (!catalog.some((c) => c.id === cosmeticId)) return;
        const owned =
          kind === 'title'
            ? state.character.cosmetics.unlockedTitles
            : state.character.cosmetics.unlockedRings;
        if (owned.includes(cosmeticId)) return;
        if (state.character.gold < COSMETIC_COST) return;

        const label =
          kind === 'title'
            ? COSMETIC_TITLES.find((c) => c.id === cosmeticId)!.label
            : COSMETIC_RINGS.find((c) => c.id === cosmeticId)!.label;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: `cosmetic-${kind}-${cosmeticId}`,
          rewardName: `${label} (${kind})`,
          cost: COSMETIC_COST,
          date: todayStr(),
          kind: 'utility',
        };

        useToastStore.getState().show(`✨ Unlocked ${label}.`);
        set((s) => ({
          character: {
            ...s.character,
            gold: s.character.gold - COSMETIC_COST,
            cosmetics: {
              ...s.character.cosmetics,
              ...(kind === 'title'
                ? {
                    unlockedTitles: [...s.character.cosmetics.unlockedTitles, cosmeticId],
                    activeTitle: s.character.cosmetics.activeTitle ?? cosmeticId,
                  }
                : {
                    unlockedRings: [...s.character.cosmetics.unlockedRings, cosmeticId],
                    activeRing: s.character.cosmetics.activeRing ?? cosmeticId,
                  }),
            },
          },
          redemptions: [...s.redemptions, entry],
        }));
      },

      buyGear: (id) => {
        const state = get();
        const gear = getGear(id);
        if (!gear) return;
        // Gear is bought for the class you are now. Another class's pieces are
        // hidden from the shop, and this is the guard behind that.
        if (getCharacterClass(state.character.attributes).attribute !== gear.attribute) return;
        if (state.character.cosmetics.unlockedGear.includes(id)) return;
        if (state.character.gold < gear.cost) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: `gear-${id}`,
          rewardName: gear.name,
          cost: gear.cost,
          date: todayStr(),
          kind: 'utility',
        };

        useToastStore.getState().show(`${gear.legendary ? '🌟' : '✨'} Unlocked ${gear.name}.`);
        set((s) => ({
          character: {
            ...s.character,
            gold: s.character.gold - gear.cost,
            cosmetics: {
              ...s.character.cosmetics,
              unlockedGear: [...s.character.cosmetics.unlockedGear, id],
              // Wearing it straight away is what you paid to see.
              equippedGear: withEquipped(s.character.cosmetics.equippedGear, id),
            },
          },
          redemptions: [...s.redemptions, entry],
        }));
      },

      setGearEquipped: (id, equipped) =>
        set((s) => {
          if (!s.character.cosmetics.unlockedGear.includes(id)) return s;
          return {
            character: {
              ...s.character,
              cosmetics: {
                ...s.character.cosmetics,
                equippedGear: equipped
                  ? withEquipped(s.character.cosmetics.equippedGear, id)
                  : withoutEquipped(s.character.cosmetics.equippedGear, id),
              },
            },
          };
        }),

      setCosmetic: (kind, cosmeticId) =>
        set((s) => {
          const owned =
            kind === 'title' ? s.character.cosmetics.unlockedTitles : s.character.cosmetics.unlockedRings;
          if (cosmeticId !== null && !owned.includes(cosmeticId)) return s;
          return {
            character: {
              ...s.character,
              cosmetics: {
                ...s.character.cosmetics,
                ...(kind === 'title' ? { activeTitle: cosmeticId } : { activeRing: cosmeticId }),
              },
            },
          };
        }),

      claimBossVictory: () => {
        const state = get();
        const today = todayStr();
        const weekStart = getWeekStart(today);
        if (state.bossVictories.some((v) => v.weekStart === weekStart)) return;
        // A week you were away for has no boss to defeat, so there is nothing
        // to claim and nothing missed.
        if (isWeekOnVacation(state.vacations, weekStart)) return;

        // Resolved the same way the card resolves it, so what you're shown and
        // what you're paid for can't drift apart between decay checks.
        const threshold = resolveBossThreshold(
          state.habits.filter((h) => !h.archived),
          weekStart,
          state.bossWeek,
        );
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

      scheduleVacation: (startDate, endDate) => {
        const state = get();
        const check = validateVacation(state.vacations, startDate, endDate, todayStr());
        if (!check.ok) return { ok: false, error: check.error };

        const vacation: Vacation = {
          id: makeId(),
          startDate,
          endDate,
          createdAt: new Date().toISOString(),
        };
        useToastStore.getState().show('🏝️ Vacation scheduled — your streaks are safe.');
        set((s) => ({ vacations: [...s.vacations, vacation] }));
        return { ok: true };
      },

      cancelVacation: (id) => {
        const state = get();
        const vacation = state.vacations.find((v) => v.id === id);
        // Only a trip that hasn't begun can be cancelled outright; once it has
        // started it is ended early instead, so it still counts for the year.
        if (!vacation || vacation.startDate <= todayStr()) return;
        set((s) => ({ vacations: s.vacations.filter((v) => v.id !== id) }));
      },

      endVacationEarly: () => {
        const today = todayStr();
        const state = get();
        const active = getActiveVacation(state.vacations, today);
        if (!active) return;

        useToastStore.getState().show('🏠 Welcome back — quests resume tomorrow.');
        set((s) => ({
          vacations: s.vacations.map((v) => (v.id === active.id ? { ...v, endedEarlyOn: today } : v)),
        }));
      },

      resetAll: () => set(createInitialState()),

      exportData: () => {
        const { character, habits, completions, rewards, redemptions, bossVictories, bossWeek, vacations, settings } =
          get();
        return JSON.stringify(
          {
            version: 5,
            exportedAt: new Date().toISOString(),
            character,
            habits,
            completions,
            rewards,
            redemptions,
            bossVictories,
            bossWeek,
            vacations,
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
          vacations: data.vacations,
          ...(data.settings ? { settings: data.settings } : {}),
        });
        return { ok: true };
      },
    }),
    {
      name: 'questlog-rpg-storage',
      version: 5,
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<Store> & { character?: Partial<CharacterState> };
        if (!state?.character) return state as Store;

        // v5: cosmetic gear. This has to run for every older save, including
        // v4 ones that skip the migrations below — the renderer reads these
        // arrays unconditionally, so leaving them undefined would crash.
        const cosmetics = state.character.cosmetics as Partial<Cosmetics> | undefined;
        const withGear: Partial<CharacterState> = {
          ...state.character,
          cosmetics: {
            unlockedTitles: cosmetics?.unlockedTitles ?? [],
            unlockedRings: cosmetics?.unlockedRings ?? [],
            activeTitle: cosmetics?.activeTitle ?? null,
            activeRing: cosmetics?.activeRing ?? null,
            // Unknown ids are dropped rather than trusted; a stale one would
            // otherwise sit in the loadout forever with nothing to render.
            unlockedGear: (Array.isArray(cosmetics?.unlockedGear) ? cosmetics.unlockedGear : []).filter(
              isValidGearId,
            ),
            equippedGear: (Array.isArray(cosmetics?.equippedGear) ? cosmetics.equippedGear : []).filter(
              isValidGearId,
            ),
          },
        };
        if (fromVersion >= 4) {
          return { ...state, character: withGear } as Store;
        }

        // v1 had no lifetimeXp and no cheat-day state. Seed lifetime XP from
        // the completion log so existing players keep the progress they
        // earned rather than restarting at character level 1.
        const completions = Array.isArray(state.completions) ? state.completions : [];
        const character = withGear;
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
            // v3: shop consumables and cosmetics.
            inventory: character.inventory ?? { ...EMPTY_INVENTORY },
          },
          // v3: reward prices moved from a free-form number to fixed tiers.
          rewards: (Array.isArray(state.rewards) ? state.rewards : []).map((r) => {
            const legacy = r as Reward & { cost?: number };
            return {
              id: legacy.id,
              name: legacy.name,
              tier: legacy.tier ?? inferRewardTier(legacy.cost ?? 0),
              createdAt: legacy.createdAt,
            };
          }),
          bossWeek: null,
          // v4: vacations.
          vacations: Array.isArray(state.vacations) ? state.vacations : [],
        } as Store;
      },
    },
  ),
);
