import { useMemo } from 'react';
import { useStore } from '../store';
import { getCharacterClass, CLASS_BY_ATTRIBUTE } from '../lib/rpg';
import {
  COSMETIC_SLOTS,
  getEquippedBySlot,
  getGear,
  getGearForClass,
  SLOT_LABELS,
  type CosmeticSlot,
} from '../lib/gear';

/**
 * Everything your class can wear, in one place. Equipping used to mean
 * scrolling the shop past things you already own, and gear you'd bought for a
 * class you've since drifted away from had nowhere to be seen at all.
 */
export function Wardrobe({ onClose }: { onClose: () => void }) {
  const cosmetics = useStore((s) => s.character.cosmetics);
  const attributes = useStore((s) => s.character.attributes);
  const preferredClass = useStore((s) => s.character.preferredClass);
  const setGearEquipped = useStore((s) => s.setGearEquipped);

  const { attribute, className } = useMemo(
    () => getCharacterClass(attributes, preferredClass),
    [attributes, preferredClass],
  );
  const equipped = useMemo(
    () => getEquippedBySlot(cosmetics.equippedGear, attribute),
    [cosmetics.equippedGear, attribute],
  );
  const catalog = useMemo(() => getGearForClass(attribute), [attribute]);

  // Pieces bought for a class you aren't presenting as right now. They're not
  // lost, and saying so is the whole point of showing them.
  const elsewhere = useMemo(
    () =>
      cosmetics.unlockedGear
        .map(getGear)
        .filter((g): g is NonNullable<typeof g> => Boolean(g) && g!.attribute !== attribute),
    [cosmetics.unlockedGear, attribute],
  );

  const ownedCount = catalog.filter((g) => cosmetics.unlockedGear.includes(g.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">Wardrobe</h2>
        <p className="mt-1 text-xs text-white/40">
          {className} gear — {ownedCount} of {catalog.length} owned.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {COSMETIC_SLOTS.map((slot) => {
            const gear = catalog.find((g) => g.slot === slot);
            if (!gear) return null;
            const owned = cosmetics.unlockedGear.includes(gear.id);
            const worn = equipped[slot as CosmeticSlot] === gear.id;
            return (
              <div
                key={slot}
                className={`rounded-xl border p-3.5 ${
                  worn ? 'border-gold-500/50 bg-gold-500/[0.07]' : 'border-white/10 bg-ink-800/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-white/35">{SLOT_LABELS[slot]}</p>
                    <p className={`font-display font-semibold ${owned ? 'text-white/85' : 'text-white/35'}`}>
                      {owned ? gear.name : `${gear.name} — not owned`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/40">
                      {owned ? gear.description : `${gear.cost} gold in the shop`}
                    </p>
                  </div>
                  {owned && (
                    <button
                      onClick={() => setGearEquipped(gear.id, !worn)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold active:scale-95 ${
                        worn ? 'bg-gold-500 text-ink-950' : 'border border-white/20 text-white/70'
                      }`}
                    >
                      {worn ? 'Worn' : 'Wear'}
                    </button>
                  )}
                </div>
                {!worn && owned && (
                  <p className="mt-2 text-[11px] text-white/30">
                    Wearing nothing here shows your {className}&apos;s default {SLOT_LABELS[slot].toLowerCase()}.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {elsewhere.length > 0 && (
          <div className="mt-5 rounded-xl border border-white/10 bg-ink-800/30 p-4">
            <h3 className="font-display text-sm text-white/60">Stored for another class</h3>
            <p className="mt-1 text-[11px] text-white/35">
              Yours for good. It comes back the moment that attribute leads again.
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {elsewhere.map((g) => (
                <li key={g.id} className="text-[11px] text-white/45">
                  {CLASS_BY_ATTRIBUTE[g.attribute]} · {g.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
