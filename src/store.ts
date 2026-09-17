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
  Goal,
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
  validateVacation,
} from './lib/vacation';
import { type EffortTier, getEffortXp, inferEffort } from './lib/effort';
import { clampTier, crossesTier, effectiveTier, getTierName, tierForStreak } from './lib/streak';
import { type ClassId, getClassesForAttribute, getClassStanding, isClassId } from './lib/classes';
import { resolveSecondary } from './lib/affinity';
import { haptic } from './lib/haptics';
import { type Suggestion, snoozeUntil } from './lib/coach';
import {
  getGoalStatus,
  getGoalTemplate,
  GOAL_GOLD,
  GOAL_XP,
  suggestedDeadline,
} from './lib/goals';
import { getBossSetup, indexHabits } from './lib/bossContext';
import {
  foldLinkIntoManual,
  goalProgress,
  isLinked,
  manualHeadroom,
  manualProgress,
  settleGoals,
} from './lib/goalLinks';
import { isAwake, isHibernating, wake, wakeDate } from './lib/hibernate';
import { initialRemindedDate, isValidTime } from './lib/questReminders';
import { currentTimeHHMM } from './lib/reminders';
import { getTemplate } from './lib/questCatalog';
import { getForgivenDates, getForgivenSet } from './lib/forgiveness';
import {
  type CosmeticSlot,
  getGear,
  getGearFor,
  isValidGearId,
  withEquipped,
  withoutEquipped,
} from './lib/gear';
import { canChangeTier, getClassReward, getCooldown } from './lib/rewards';
import { parseBackup } from './lib/backup';
import { useToastStore } from './toastStore';

function makeId(): string {
  return crypto.randomUUID();
}

/** Used only when someone skips the picker, so nobody lands on an empty log. */
const DEFAULT_STARTERS = ['con-water', 'wis-bed', 'int-read'];

/** Persisted schema version. Backups are stamped with it, so they agree. */
export const SCHEMA_VERSION = 10;

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
  goals: Goal[];
  /**
   * Quest id -> the date a coaching suggestion for it stops being snoozed.
   * Kept out of Habit so dismissing advice never touches quest data, and so a
   * deleted quest's dismissal simply becomes irrelevant rather than orphaned.
   */
  coachSnoozed: Record<string, string>;
  settings: ReminderSettings;

  setCharacterName: (name: string) => void;
  setPreferredClass: (classId: ClassId | null) => void;
  startJourney: (name: string, templateIds: string[]) => void;
  spendCheatDay: () => void;
  setReminderSettings: (patch: Partial<Pick<ReminderSettings, 'enabled' | 'time' | 'haptics'>>) => void;
  markDecayExplained: () => void;
  markWeekReviewed: (weekStart: string) => void;
  markReminderNotified: (date: string) => void;
  runDecayCheck: () => void;
  addFromTemplates: (templateIds: string[]) => number;
  addHabit: (input: {
    name: string;
    attribute: AttributeKey;
    secondary?: AttributeKey | null;
    frequency: Frequency;
    graceDays: number;
    effort: EffortTier;
    reminderTime?: string | null;
  }) => void;
  updateHabit: (
    id: string,
    patch: Partial<
      Pick<Habit, 'name' | 'attribute' | 'secondary' | 'frequency' | 'graceDays' | 'effort' | 'reminderTime'>
    >,
  ) => void;
  markQuestReminded: (id: string, date: string) => void;
  archiveHabit: (id: string) => void;
  hibernateHabit: (id: string, days: number) => void;
  wakeHabit: (id: string) => void;
  deleteHabit: (id: string) => void;
  completeHabit: (id: string) => void;
  undoCompleteHabit: (id: string, date?: string) => void;
  backfillYesterday: (id: string) => void;
  setCompletionNote: (habitId: string, date: string, note: string) => void;

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
  claimBossVictory: (forWeekStart?: string) => void;

  addGoal: (input: {
    name: string;
    attribute: AttributeKey;
    target: number;
    unit: string;
    scale: Goal['scale'];
    deadline: string;
  }) => void;
  addGoalFromTemplate: (templateId: string) => void;
  setGoalProgress: (id: string, next: number) => void;
  linkGoalHabit: (goalId: string, habitId: string) => void;
  unlinkGoalHabit: (goalId: string, habitId: string) => void;
  settleLinkedGoals: () => void;
  deleteGoal: (id: string) => void;

  applySuggestion: (s: Suggestion) => void;
  dismissSuggestion: (habitId: string) => void;

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
      preferredClass: null as ClassId | null,
      lastDecayCheck: todayStr(),
    },
    // Quests are chosen during onboarding now, not handed out.
    habits: [] as Habit[],
    completions: [] as CompletionEntry[],
    rewards: starterRewards(),
    redemptions: [] as RedemptionEntry[],
    bossVictories: [] as BossVictory[],
    bossWeek: null as BossWeek | null,
    vacations: [] as Vacation[],
    goals: [] as Goal[],
    coachSnoozed: {} as Record<string, string>,
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

/**
 * A finished goal's payout, applied in one place.
 *
 * A goal can now be finished two ways — the by-hand counter or the last
 * completion of a linked quest — and two implementations of "what a goal is
 * worth" would eventually disagree, which with real XP and gold is the kind of
 * bug you only notice from the wrong total months later.
 */
function payGoal(character: CharacterState, goal: Goal): CharacterState {
  const xp = GOAL_XP[goal.scale];
  return {
    ...character,
    attributes: {
      ...character.attributes,
      [goal.attribute]: addXp(character.attributes[goal.attribute], xp),
    },
    gold: character.gold + GOAL_GOLD[goal.scale],
    // Real XP, so it lifts the character level. It is deliberately absent from
    // the completion log, which is what keeps the weekly boss and the
    // per-quest stats from ever seeing it.
    lifetimeXp: character.lifetimeXp + xp,
  };
}

/**
 * The class each of the six original classes became. Four keep their name
 * outright; Warrior and Guardian have no 5e equivalent, so they take the
 * closest fit — and Guardian lands on Barbarian for the same reason a
 * Constitution-led character does.
 */
const LEGACY_CLASS_BY_ATTRIBUTE: Record<AttributeKey, ClassId> = {
  STR: 'fighter',
  DEX: 'rogue',
  CON: 'barbarian',
  INT: 'wizard',
  WIS: 'cleric',
  CHA: 'bard',
};

function legacyPreferredClass(value: unknown): ClassId | null {
  if (typeof value !== 'string') return null;
  return LEGACY_CLASS_BY_ATTRIBUTE[value as AttributeKey] ?? null;
}

/**
 * Carries the six attribute-keyed gear sets into twelve class-keyed ones.
 *
 * The old ids still resolve — those sets were rehoused, not rewritten — but
 * they now belong to one specific class, and a Rogue who bought the Dexterity
 * set would find it had become the Ranger's. Gear you paid for must never be
 * stranded by a class change, so an old piece also grants the same slot in
 * every other class built on that attribute. It is generous, but gear is pure
 * vanity: there is no balance to protect, only a purchase to honour.
 */
function withInheritedGear(owned: string[]): string[] {
  const out = new Set(owned);
  for (const id of owned) {
    const match = /^(str|dex|con|int|wis|cha)-(.+)$/.exec(id);
    if (!match) continue;
    const attribute = match[1].toUpperCase() as AttributeKey;
    const slot = match[2] as CosmeticSlot;
    for (const classId of getClassesForAttribute(attribute)) {
      // Resolved through the catalog, not by building an id: six sets kept
      // their old attribute-derived ids, so `barbarian-boots` is not a real id
      // even though the Barbarian certainly has boots.
      const inherited = getGearFor(classId, slot);
      if (inherited) out.add(inherited.id);
    }
  }
  return [...out];
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

      /**
       * Only meaningful while that class is still on offer; the getter ignores
       * a stale preference, so nothing here needs to police it.
       */
      /**
       * Finishes onboarding. Naming the character is what unlocks the app, so
       * it happens last — after the quests are in — or the first render would
       * flash an empty quest log.
       */
      startJourney: (name, templateIds) => {
        get().addFromTemplates(templateIds.length > 0 ? templateIds : DEFAULT_STARTERS);
        get().setCharacterName(name || 'Adventurer');
      },

      setPreferredClass: (classId) =>
        set((state) => ({ character: { ...state.character, preferredClass: classId } })),

      setReminderSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),

      markReminderNotified: (date) => set((state) => ({ settings: { ...state.settings, lastNotifiedDate: date } })),

      markDecayExplained: () => set((state) => ({ settings: { ...state.settings, decayExplained: true } })),

      markWeekReviewed: (weekStart) =>
        set((state) => ({ settings: { ...state.settings, lastReviewedWeek: weekStart } })),

      runDecayCheck: () =>
        set((state) => {
          const today = todayStr();
          const baseAttributes = state.character.attributes;
          // A vacation is simply a range of forgiven days, so it rides the
          // same path the Cheat Day already uses.
          const forgivenDates = getForgivenDates(state.character.cheatDay, state.vacations);
          let attributes = { ...baseAttributes };
          let streakSaves = state.character.streakSaves;
          let changed = false;

          const habits = state.habits.map((original) => {
            // A quest whose wake date has passed is woken *before* the pass,
            // so decay starts from today instead of walking back over every
            // sleeping day and charging for all of them.
            const justWoke = original.hibernatingUntil && !isHibernating(original, today);
            const h = justWoke ? wake(original, today) : original;
            if (isHibernating(h, today)) return h;

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
              // Momentum is Dexterity's own, so it shields only DEX quests.
              keepBonusTier: h.attribute === 'DEX' && hasSignature(baseAttributes, 'momentum'),
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
            if (updated !== original) changed = true;
            return updated;
          });

          // The boss target is a floor, not a snapshot: archiving a quest can't
          // lower a bar you'd already missed, but adding quests still raises it.
          const weekStart = getWeekStart(today);
          const { modifier, ctx } = getBossSetup(weekStart, baseAttributes);
          const threshold = resolveBossThreshold(
            // A sleeping quest is not due, so it cannot raise the bar.
            habits.filter((h) => isAwake(h, today)),
            weekStart,
            state.bossWeek,
            new Set(forgivenDates),
            modifier,
            ctx,
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

      /**
       * Adds ready-made quests from the catalog. Skips anything already on the
       * list by name, so browsing twice can't quietly give you two copies of
       * the same habit. Returns how many were actually added.
       */
      addFromTemplates: (templateIds) => {
        const state = get();
        const existing = new Set(state.habits.map((h) => h.name.trim().toLowerCase()));
        const now = new Date().toISOString();
        const fresh: Habit[] = [];
        for (const id of templateIds) {
          const template = getTemplate(id);
          if (!template) continue;
          if (existing.has(template.name.trim().toLowerCase())) continue;
          existing.add(template.name.trim().toLowerCase());
          fresh.push({
            id: makeId(),
            name: template.name,
            attribute: template.attribute,
            secondary: resolveSecondary(template.attribute, template.secondary),
            frequency: template.frequency,
            graceDays: template.graceDays,
            effort: template.effort,
            xpReward: getEffortXp(template.effort),
            streak: 0,
            bestStreak: 0,
            bonusTier: 0,
            lastCompletedDate: null,
            decayedThroughDate: null,
            missedSinceCompletion: 0,
            createdAt: now,
            archived: false,
          });
        }
        if (fresh.length > 0) set((s) => ({ habits: [...s.habits, ...fresh] }));
        return fresh.length;
      },

      addHabit: (input) =>
        set((state) => ({
          habits: [
            ...state.habits,
            {
              id: makeId(),
              name: input.name.trim().slice(0, 60),
              attribute: input.attribute,
              // Validated on the way in: a pairing the table doesn't allow is
              // dropped rather than stored, so nothing downstream has to guard.
              secondary: resolveSecondary(input.attribute, input.secondary),
              frequency: input.frequency,
              graceDays: input.graceDays,
              effort: input.effort,
              xpReward: getEffortXp(input.effort),
              streak: 0,
              bestStreak: 0,
              bonusTier: 0,
              lastCompletedDate: null,
              decayedThroughDate: null,
              missedSinceCompletion: 0,
              reminderTime: isValidTime(input.reminderTime) ? input.reminderTime : null,
              lastRemindedDate: initialRemindedDate(input.reminderTime, currentTimeHHMM(), todayStr()),
              createdAt: new Date().toISOString(),
              archived: false,
            },
          ],
        })),

      updateHabit: (id, patch) =>
        set((state) => ({
          habits: state.habits.map((h) => {
            if (h.id !== id) return h;
            // xpReward is derived from the tier, so it has to move with it.
            const merged = { ...h, ...patch, ...(patch.effort ? { xpReward: getEffortXp(patch.effort) } : {}) };
            // Moving a reminder re-decides today from scratch: a time still
            // ahead is left open so this evening's 20:00 is honoured, while a
            // time already gone by counts as handled rather than firing the
            // moment the form is saved.
            const timeChanged = patch.reminderTime !== undefined && patch.reminderTime !== h.reminderTime;
            // Re-checked after the merge, not before: changing the primary can
            // strand a secondary that was valid a moment ago, and a Strength
            // quest moved to Intelligence must not keep Constitution attached.
            return {
              ...merged,
              reminderTime: isValidTime(merged.reminderTime) ? merged.reminderTime : null,
              ...(timeChanged
                ? { lastRemindedDate: initialRemindedDate(patch.reminderTime, currentTimeHHMM(), todayStr()) }
                : {}),
              secondary: resolveSecondary(merged.attribute, merged.secondary),
            };
          }),
        })),

      // Written by the scheduler the moment a quest's own reminder fires, so
      // the same nudge can't arrive again on the next tick.
      markQuestReminded: (id, date) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, lastRemindedDate: date } : h)),
        })),

      archiveHabit: (id) =>
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
        })),

      hibernateHabit: (id, days) => {
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return;
        const until = wakeDate(days);
        haptic('tick');
        useToastStore
          .getState()
          .show(`😴 ${habit.name} is asleep until ${until}. Its streak is safe.`);
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, hibernatingUntil: until } : h)),
        }));
      },

      wakeHabit: (id) => {
        const today = todayStr();
        const habit = get().habits.find((h) => h.id === id);
        if (!habit) return;
        haptic('tick');
        useToastStore.getState().show(`${habit.name} is awake again.`);
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? wake(h, today) : h)),
        }));
      },

      deleteHabit: (id) =>
        set((state) => ({
          habits: state.habits.filter((h) => h.id !== id),
          completions: state.completions.filter((c) => c.habitId !== id),
          // Deleting a quest deletes its completions, so a goal deriving 60 of
          // 100 sessions from it would silently collapse to nothing. The count
          // is folded into the goal's by-hand figure first: deleting the quest
          // you tracked something with is not a claim you never did it.
          goals: state.goals.map((g) => foldLinkIntoManual(g, id, state.completions)),
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
          ...(award.secondaryAttribute
            ? { secondaryAttribute: award.secondaryAttribute, secondaryXp: award.secondaryXp }
            : {}),
          elixirUsed: award.elixirUsed || undefined,
          prevProgress: {
            streak: habit.streak,
            bestStreak: habit.bestStreak,
            missedSinceCompletion: habit.missedSinceCompletion,
            lastCompletedDate: habit.lastCompletedDate,
            decayedThroughDate: habit.decayedThroughDate,
            bonusTier: clampTier(habit.bonusTier ?? 0),
          },
        };

        // The tap that matters most in the whole app, so it gets the tick.
        haptic('tick');

        // Reaching a new rung is rare — four times in a quest's life — so it
        // gets its own toast rather than competing with the usual chain below.
        if (onSchedule && crossesTier(habit.bonusTier, newStreak)) {
          haptic('tier');
          const pct = Math.round(award.streakBonus * 100);
          useToastStore
            .getState()
            .show(`🔥 ${getTierName(award.streakTier)} — ${newStreak}-day streak. This quest now pays +${pct}% XP.`);
        }

        const oldLevel = state.character.attributes[habit.attribute].level;
        const newAttrState = addXp(state.character.attributes[habit.attribute], award.xp);
        const crossedPerks = getCrossedPerks(habit.attribute, oldLevel, newAttrState.level);
        if (crossedPerks.length > 0) {
          const perk = crossedPerks[crossedPerks.length - 1];
          const label = perk.signature ? '✨ Signature perk unlocked' : '🎉 Perk unlocked';
          haptic('levelUp');
          useToastStore.getState().show(`${label}: ${perk.name} (${habit.attribute} Lv ${perk.level})`);
        } else if (newAttrState.level > oldLevel) {
          haptic('levelUp');
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
          // The quest's secondary attribute. Real XP, so it counts toward the
          // lifetime total, but it earns no streak and can never decay.
          if (award.secondaryAttribute && award.secondaryXp > 0) {
            attributes[award.secondaryAttribute] = addXp(
              attributes[award.secondaryAttribute],
              award.secondaryXp,
            );
            spilled += award.secondaryXp;
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
                    // An off-schedule completion earns no streak credit, so it
                    // can't advance the tier either — but it keeps the one
                    // already held, which is what the award was paid at.
                    bonusTier: onSchedule ? effectiveTier(h.bonusTier, newStreak) : clampTier(h.bonusTier ?? 0),
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
        // A completion can be the last session a goal was waiting for.
        get().settleLinkedGoals();
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
          ...(award.secondaryAttribute
            ? { secondaryAttribute: award.secondaryAttribute, secondaryXp: award.secondaryXp }
            : {}),
          backfilled: true,
          ...(plan.xpRefund > 0 ? { xpRefunded: plan.xpRefund } : {}),
          prevProgress: {
            streak: habit.streak,
            bestStreak: habit.bestStreak,
            missedSinceCompletion: habit.missedSinceCompletion,
            lastCompletedDate: habit.lastCompletedDate,
            decayedThroughDate: habit.decayedThroughDate,
            bonusTier: clampTier(habit.bonusTier ?? 0),
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
          // The quest's secondary attribute. Real XP, so it counts toward the
          // lifetime total, but it earns no streak and can never decay.
          if (award.secondaryAttribute && award.secondaryXp > 0) {
            attributes[award.secondaryAttribute] = addXp(
              attributes[award.secondaryAttribute],
              award.secondaryXp,
            );
            spilled += award.secondaryXp;
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
                    // The miss decay charged for turns out not to have
                    // happened, so the tier it stepped down goes back up.
                    bonusTier: plan.newBonusTier,
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
        // The completion landed on yesterday, which may belong to last week.
        const backfilledWeek = getWeekStart(yesterday);
        if (backfilledWeek !== getWeekStart(today)) get().claimBossVictory(backfilledWeek);
        // A backfilled session counts toward a goal exactly as a live one does.
        get().settleLinkedGoals();
      },

      /**
       * `date` defaults to today. A backfilled day can be undone too: it used
       * to be permanent, because the guard demanded lastCompletedDate === today
       * and a backfill leaves that at yesterday.
       */
      undoCompleteHabit: (id, date) => {
        const today = todayStr();
        const target = date ?? today;
        const state = get();
        const habit = state.habits.find((h) => h.id === id);
        if (!habit) return;
        // One day back at most, matching what backfill can create.
        if (target !== today && target !== addDays(today, -1)) return;

        const todaysEntry = [...state.completions].reverse().find((c) => c.habitId === id && c.date === target);
        if (!todaysEntry) return;

        // The gold from this completion may already be spent. Clamping the
        // subtraction at zero would silently let the player keep that value,
        // so refuse the undo instead of quietly minting gold.
        if (state.character.gold < todaysEntry.goldAwarded) {
          useToastStore
            .getState()
            .show(`Can't undo — you've already spent the ${todaysEntry.goldAwarded} gold this quest earned.`);
          haptic('refused');
          return;
        }

        haptic('undo');
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
        // An entry from before streak bonuses has no tier to restore. Leaving
        // the key present but undefined would spread over the live value and
        // silently wipe the bonus, so drop it entirely.
        if (restored.bonusTier === undefined) delete restored.bonusTier;

        set((s) => {
          // The attribute got the award plus any decay refund; lifetime XP got
          // only the award, since a refund is XP returned rather than earned.
          const refunded = todaysEntry.xpRefunded ?? 0;
          const attributes: Attributes = {
            ...s.character.attributes,
            [habit.attribute]: removeXp(s.character.attributes[habit.attribute], todaysEntry.xpAwarded + refunded),
          };

          // Mirror the Deep Work spillover this completion handed out, so the
          // other five attributes don't keep XP from an undone quest.
          let spilled = 0;
          // The secondary is reversed from what the entry recorded, not from
          // what the quest says now — its secondary may have been edited since.
          const secondaryKey = todaysEntry.secondaryAttribute;
          const secondaryAmount = todaysEntry.secondaryXp ?? 0;
          if (secondaryKey && secondaryAmount > 0) {
            attributes[secondaryKey] = removeXp(attributes[secondaryKey], secondaryAmount);
            spilled += secondaryAmount;
          }
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

        // The completion is gone, so anything deriving from it must come back
        // down. A goal already reached keeps its `completedOn` — the reward is
        // not clawed back, the same as ticking a goal down by hand.
        get().settleLinkedGoals();
      },

      /**
       * Attaches (or clears) a line on the completion for that day. Stored on
       * the completion rather than the quest so it belongs to the occasion:
       * "shattered today" is true of one Tuesday, not of running in general.
       */
      setCompletionNote: (habitId, date, note) => {
        const trimmed = note.trim().slice(0, 140);
        set((state) => ({
          completions: state.completions.map((c) =>
            c.habitId === habitId && c.date === date
              ? { ...c, ...(trimmed ? { note: trimmed } : { note: undefined }) }
              : c,
          ),
        }));
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

      updateReward: (id, patch) => {
        const existing = get().rewards.find((r) => r.id === id);
        // A tier can be raised but never lowered. Deciding a treat is worth
        // less the moment you want it is the same self-discounting the fixed
        // tiers exist to stop, just one level up.
        if (existing && patch.tier && !canChangeTier(existing.tier, patch.tier)) {
          useToastStore
            .getState()
            .show("A reward's tier can be raised, but not lowered. Make a new one if it's smaller than you thought.");
          return;
        }
        set((state) => ({
          rewards: state.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        }));
      },

      deleteReward: (id) =>
        set((state) => ({
          rewards: state.rewards.filter((r) => r.id !== id),
        })),

      /**
       * Handles both a reward you wrote and one of your class's curated ones —
       * the curated set lives in a catalog rather than in `rewards`, so it
       * can't be renamed, re-tiered or deleted.
       */
      redeemReward: (id) => {
        const state = get();
        const today = todayStr();
        const custom = state.rewards.find((r) => r.id === id);
        const curated = custom ? null : getClassReward(id);
        if (!custom && !curated) return;

        const tier = custom ? custom.tier : curated!.tier;
        const name = custom ? custom.name : curated!.name;
        // A curated reward belongs to a class; you can only claim your own.
        if (curated) {
          const standing = getClassStanding(state.character.attributes, state.character.preferredClass);
          if (curated.classId !== standing.id) return;
        }

        const cooldown = getCooldown(id, tier, state.redemptions, today, name);
        if (cooldown.active) {
          useToastStore
            .getState()
            .show(`Still resting — claim this again in ${cooldown.daysLeft} day${cooldown.daysLeft === 1 ? '' : 's'}.`);
          return;
        }

        const cost = getRewardCost(tier);
        if (state.character.gold < cost) return;

        const entry: RedemptionEntry = {
          id: makeId(),
          rewardId: id,
          rewardName: name,
          cost,
          date: today,
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
                  // Putting the streak back puts back the standing it implies,
                  // or the feather would hand you a run whose bonus had gone.
                  bonusTier: effectiveTier(h.bonusTier, restored),
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
        const standing = getClassStanding(state.character.attributes, state.character.preferredClass);
        if (gear.classId !== standing.id) return;
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

      /**
       * `forWeekStart` defaults to this week. Backfilling on a Sunday writes a
       * completion into *last* week, and with only the current week ever
       * checked that week's boss could never be paid however far past the
       * threshold the backfill pushed it.
       */
      claimBossVictory: (forWeekStart) => {
        const state = get();
        const today = todayStr();
        const weekStart = forWeekStart ?? getWeekStart(today);
        if (state.bossVictories.some((v) => v.weekStart === weekStart)) return;
        // Resolved the same way the card resolves it, so what you're shown and
        // what you're paid for can't drift apart between decay checks. A
        // vacation shrinks the target; only a week you were away for entirely
        // drops it to zero, and then there is no boss to defeat.
        // The modifier has to reach both sides or the target and the score
        // stop meaning the same thing — the exact failure that once had the
        // card showing 252 against a stored 180.
        const { modifier, ctx } = getBossSetup(weekStart, state.character.attributes);
        const active = state.habits.filter((h) => isAwake(h, today));
        const threshold = resolveBossThreshold(
          active,
          weekStart,
          state.bossWeek,
          getForgivenSet(state.character.cheatDay, state.vacations),
          modifier,
          ctx,
        );
        if (threshold <= 0) return;
        const xpEarned = getWeeklyXpEarned(
          state.completions,
          weekStart,
          indexHabits(state.habits),
          modifier,
          ctx,
        );
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

        haptic('victory');
        useToastStore.getState().show(`⚔️ ${boss.name} defeated! +${goldReward} gold`);
        set((s) => ({
          character: { ...s.character, gold: s.character.gold + goldReward },
          bossVictories: [...s.bossVictories, victory],
        }));
      },

      addGoal: (input) =>
        set((state) => ({
          goals: [
            ...state.goals,
            {
              id: makeId(),
              name: input.name.trim().slice(0, 70),
              attribute: input.attribute,
              target: Math.max(1, Math.floor(input.target)),
              unit: input.unit.trim().slice(0, 20) || 'times',
              progress: 0,
              scale: input.scale,
              startedOn: todayStr(),
              deadline: input.deadline,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      /**
       * Takes on a preset goal, together with the quests that get you there.
       *
       * A goal on its own is an intention with no mechanism. The preset knows
       * which quests are one unit of it, so those are added (or reused, if you
       * already keep them) and linked, and from then on doing the thing is the
       * only step: ticking the quest counts the goal up.
       *
       * Companion quests are deliberately left alone. Ten pages a day is how
       * you read twelve books but it is not twelve books, and a link that
       * counted it would have the goal claiming victory in twelve days.
       */
      addGoalFromTemplate: (templateId) => {
        const template = getGoalTemplate(templateId);
        if (!template) return;
        const state = get();
        // Same rule as the quest catalog: browsing twice must not quietly give
        // you two copies of the same intention.
        if (state.goals.some((g) => g.name.trim().toLowerCase() === template.name.trim().toLowerCase())) {
          useToastStore.getState().show('You already have that goal.');
          return;
        }
        const today = todayStr();
        const goalId = makeId();
        set((s) => ({
          goals: [
            ...s.goals,
            {
              id: goalId,
              name: template.name,
              attribute: template.attribute,
              target: template.target,
              unit: template.unit,
              progress: 0,
              manualProgress: 0,
              scale: template.scale,
              startedOn: today,
              deadline: suggestedDeadline(template, today),
              createdAt: new Date().toISOString(),
            },
          ],
        }));

        // Adds any that are missing; one you already keep is reused rather
        // than duplicated, so taking on a goal never gives you two "Go to the
        // gym"s.
        get().addFromTemplates(template.quests);
        const wanted = new Set(
          template.quests
            .map((id) => getTemplate(id)?.name.trim().toLowerCase())
            .filter((n): n is string => Boolean(n)),
        );
        const linked = get().habits.filter((h) => wanted.has(h.name.trim().toLowerCase()));
        if (linked.length > 0) {
          set((s) => ({
            goals: s.goals.map((g) =>
              g.id === goalId
                ? { ...g, links: linked.map((h) => ({ habitId: h.id, since: today })) }
                : g,
            ),
          }));
        }

        haptic('tick');
        useToastStore
          .getState()
          .show(
            linked.length > 0
              ? `🎯 ${template.name} — ${linked.map((h) => h.name).join(' and ')} now counts toward it.`
              : `🎯 Goal set: ${template.name}`,
          );
      },

      /**
       * Moves the part of a goal you keep by hand.
       *
       * With a quest linked, the total is that count plus this figure, so the
       * by-hand control adjusts only its own half and is capped at whatever the
       * quests have left unclaimed. Otherwise entering 50 on a goal already at
       * 60 from the gym would silently throw away ten sessions you did.
       *
       * `completedOn` is the guard against paying twice: ticking to the target,
       * back down, and up again is a legitimate correction, not a second
       * achievement. The payout is deliberately not reversed on the way back
       * down -- you did reach it.
       */
      setGoalProgress: (id, next) => {
        const state = get();
        const goal = state.goals.find((g) => g.id === id);
        if (!goal) return;

        const headroom = manualHeadroom(goal, state.completions);
        const manual = Math.max(0, Math.min(headroom, Math.floor(next - (goal.progress - manualProgress(goal)))));
        if (manual === manualProgress(goal)) return;

        const today = todayStr();
        const candidate = { ...goal, manualProgress: manual };
        const progress = goalProgress(candidate, state.completions);
        const finishing = progress >= goal.target && !goal.completedOn;
        const expired = getGoalStatus(goal, today) === 'expired';

        if (finishing && expired) {
          // The deadline is the commitment. Landing the last unit after it has
          // passed still counts as done -- it just doesn't pay.
          haptic('refused');
          useToastStore.getState().show('Finished, but past the deadline — no reward this time.');
        } else if (finishing) {
          const xp = GOAL_XP[goal.scale];
          const gold = GOAL_GOLD[goal.scale];
          haptic('victory');
          useToastStore.getState().show(`🏆 ${goal.name} — complete! +${xp} ${goal.attribute}, +${gold} gold`);
        }

        set((s) => {
          const goals = s.goals.map((g) =>
            g.id === id
              ? { ...g, manualProgress: manual, progress, ...(finishing ? { completedOn: today } : {}) }
              : g,
          );
          if (!finishing || expired) return { goals };
          return { goals, character: payGoal(s.character, goal) };
        });
      },

      /**
       * Points a quest at a goal, so completing it counts.
       *
       * The link starts from today rather than from the goal's start date:
       * counting the past would double whatever you had already entered by
       * hand for those same sessions, and a number that jumps the moment you
       * connect two things is a number nobody trusts again.
       */
      linkGoalHabit: (goalId, habitId) => {
        const state = get();
        const goal = state.goals.find((g) => g.id === goalId);
        const habit = state.habits.find((h) => h.id === habitId);
        if (!goal || !habit || isLinked(goal, habitId)) return;

        const today = todayStr();
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId ? { ...g, links: [...(g.links ?? []), { habitId, since: today }] } : g,
          ),
        }));
        haptic('tick');
        useToastStore.getState().show(`🔗 ${habit.name} now counts toward ${goal.name}.`);
        get().settleLinkedGoals();
      },

      /**
       * Unhooks a quest, keeping what it earned.
       *
       * The sessions are folded into the by-hand figure rather than dropped,
       * because unlinking is a change to how a goal is tracked and not a claim
       * that the work never happened.
       */
      unlinkGoalHabit: (goalId, habitId) => {
        const state = get();
        const goal = state.goals.find((g) => g.id === goalId);
        if (!goal || !isLinked(goal, habitId)) return;
        set((s) => ({
          goals: s.goals.map((g) => (g.id === goalId ? foldLinkIntoManual(g, habitId, s.completions) : g)),
        }));
        get().settleLinkedGoals();
      },

      /**
       * Recomputes every goal from the completion log and pays out any that
       * have just arrived.
       *
       * Called after anything that can move a linked quest rather than each of
       * those working out the consequences for itself, so there is exactly one
       * implementation of what a goal's number means.
       */
      settleLinkedGoals: () => {
        const state = get();
        const today = todayStr();
        const settled = settleGoals(state.goals, state.completions, today);
        if (!settled.changed) return;

        for (const goal of settled.finishedLate) {
          useToastStore
            .getState()
            .show(`${goal.name} — finished, but past the deadline. No reward this time.`);
        }
        for (const goal of settled.finished) {
          haptic('victory');
          useToastStore
            .getState()
            .show(
              `🏆 ${goal.name} — complete! +${GOAL_XP[goal.scale]} ${goal.attribute}, +${GOAL_GOLD[goal.scale]} gold`,
            );
        }

        set((s) => {
          // Settled against the state read above; the goals themselves are
          // replaced wholesale, so a completion landing in between would be
          // picked up by that write's own settle call rather than lost here.
          let character = s.character;
          for (const goal of settled.finished) character = payGoal(character, goal);
          return { goals: settled.goals, character };
        });
      },

      deleteGoal: (id) => set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

      /**
       * Applies a coaching suggestion, and snoozes that quest either way.
       *
       * Acting on the advice is also a decision about it, so the quest goes
       * quiet afterwards regardless: a quest just made smaller needs a month
       * at the new size before its rate means anything again.
       */
      applySuggestion: (suggestion) => {
        const state = get();
        const habit = state.habits.find((h) => h.id === suggestion.habitId);
        if (!habit) return;

        haptic('tick');
        if (suggestion.kind === 'retire') {
          get().archiveHabit(habit.id);
          useToastStore.getState().show(`${habit.name} retired. It's in the Chronicle if you want it back.`);
        } else if (suggestion.kind === 'easier' && suggestion.toEffort) {
          get().updateHabit(habit.id, { effort: suggestion.toEffort });
          useToastStore.getState().show(`${habit.name} is now a smaller ask. Easier to keep.`);
        } else if (suggestion.kind === 'less-often' && suggestion.toDays?.length) {
          get().updateHabit(habit.id, { frequency: { type: 'weekly', days: suggestion.toDays } });
          useToastStore
            .getState()
            .show(`${habit.name} now asks ${suggestion.toDays.length} days a week.`);
        }
        set((s) => ({ coachSnoozed: { ...s.coachSnoozed, [habit.id]: snoozeUntil() } }));
      },

      dismissSuggestion: (habitId) =>
        set((state) => ({ coachSnoozed: { ...state.coachSnoozed, [habitId]: snoozeUntil() } })),

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
        const { character, habits, completions, rewards, redemptions, bossVictories, bossWeek, vacations, goals, settings } =
          get();
        // Recorded so the app can tell you when the only copy of all this is
        // getting old. Set here rather than in the UI so every caller counts.
        set((s) => ({ settings: { ...s.settings, lastBackupDate: todayStr() } }));
        return JSON.stringify(
          {
            version: SCHEMA_VERSION,
            exportedAt: new Date().toISOString(),
            character,
            habits,
            completions,
            rewards,
            redemptions,
            bossVictories,
            bossWeek,
            vacations,
            goals,
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
          goals: data.goals,
          ...(data.settings ? { settings: data.settings } : {}),
        });
        return { ok: true };
      },
    }),
    {
      name: 'questlog-rpg-storage',
      version: SCHEMA_VERSION,
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<Store> & { character?: Partial<CharacterState> };
        if (!state?.character) return state as Store;

        // v5: cosmetic gear. This has to run for every older save, including
        // v4 ones that skip the migrations below — the renderer reads these
        // arrays unconditionally, so leaving them undefined would crash.
        const cosmetics = state.character.cosmetics as Partial<Cosmetics> | undefined;
        const ownedGear = (Array.isArray(cosmetics?.unlockedGear) ? cosmetics.unlockedGear : []).filter(
          isValidGearId,
        );
        const withGear: Partial<CharacterState> = {
          ...state.character,
          cosmetics: {
            unlockedTitles: cosmetics?.unlockedTitles ?? [],
            unlockedRings: cosmetics?.unlockedRings ?? [],
            activeTitle: cosmetics?.activeTitle ?? null,
            activeRing: cosmetics?.activeRing ?? null,
            // Unknown ids are dropped rather than trusted; a stale one would
            // otherwise sit in the loadout forever with nothing to render.
            unlockedGear: withInheritedGear(ownedGear),
            equippedGear: (Array.isArray(cosmetics?.equippedGear) ? cosmetics.equippedGear : []).filter(
              isValidGearId,
            ),
          },
          // v8: the class you present as is one of twelve, not one of six.
          preferredClass: isClassId(state.character.preferredClass)
            ? state.character.preferredClass
            : legacyPreferredClass(state.character.preferredClass),
        };
        // v6: quests carry an effort tier. Inferred from the hand-set XP the
        // old slider produced, which can nudge a value to the nearest tier
        // (a 15 XP quest becomes Short at 10 or Real at 20).
        //
        // v7: quests carry a streak-bonus tier, seeded from the streak they
        // already hold — someone forty days into a habit has plainly earned
        // that rung and shouldn't start the ladder from the bottom.
        const upgradedHabits = (Array.isArray(state.habits) ? state.habits : []).map((h) => {
          const withTier =
            h.bonusTier === undefined ? { ...h, bonusTier: tierForStreak(h.streak ?? 0) } : h;
          // v9: quests can name a secondary attribute. Existing ones get none —
          // guessing one for a quest whose name we can't read would attach XP
          // to an attribute the player never agreed to.
          if (withTier.secondary !== undefined) {
            withTier.secondary = resolveSecondary(withTier.attribute, withTier.secondary);
          }
          if (withTier.effort) return withTier;
          const effort = inferEffort(withTier.xpReward ?? 20);
          return { ...withTier, effort, xpReward: getEffortXp(effort) };
        });

        if (fromVersion >= 4) {
          return {
            ...state,
            character: withGear,
            habits: upgradedHabits,
            // v10/v11: both are read unconditionally, so neither can be undefined.
            goals: Array.isArray(state.goals) ? state.goals : [],
            coachSnoozed:
              typeof state.coachSnoozed === 'object' && state.coachSnoozed ? state.coachSnoozed : {},
          } as Store;
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
          // v6/v7: `...state` above carries the untouched habits, so the
          // mapping has to be reapplied here or the oldest saves would skip it.
          habits: upgradedHabits,
          bossWeek: null,
          // v4: vacations.
          vacations: Array.isArray(state.vacations) ? state.vacations : [],
          // v10: long-term goals.
          goals: Array.isArray(state.goals) ? state.goals : [],
          // v11: coaching dismissals.
          coachSnoozed: typeof state.coachSnoozed === 'object' && state.coachSnoozed ? state.coachSnoozed : {},
        } as Store;
      },
    },
  ),
);
