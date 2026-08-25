import { useRef, useState } from 'react';
import { useStore } from '../store';
import { getCharacterClass, getCharacterProgress } from '../lib/rpg';
import { getEquippedBySlot, getGear } from '../lib/gear';
import { ShareCardSvg } from '../components/ShareCardSvg';

const EXPORT_SCALE = 2;
const CARD_WIDTH = 400;
const CARD_HEIGHT = 600;

export function ShareCard({ onClose }: { onClose: () => void }) {
  const character = useStore((s) => s.character);
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const level = getCharacterProgress(character.lifetimeXp).level;
  const { attribute: dominantAttribute, className } = getCharacterClass(
    character.attributes,
    character.preferredClass,
  );
  // Only the gear for the class you're presenting as — that's what the card
  // shows a picture of.
  const loadout = Object.values(getEquippedBySlot(character.cosmetics.equippedGear, dominantAttribute))
    .map((id) => getGear(id)?.name)
    .filter((n): n is string => Boolean(n));

  const renderToBlob = async (): Promise<Blob | null> => {
    const svgEl = svgRef.current;
    if (!svgEl) return null;

    const svgString = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not render card image.'));
      });
      img.src = url;
      await loaded;

      const canvas = document.createElement('canvas');
      canvas.width = CARD_WIDTH * EXPORT_SCALE;
      canvas.height = CARD_HEIGHT * EXPORT_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await renderToBlob();
      if (!blob) throw new Error('Could not generate image.');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questlog-${(character.name || 'character').toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('Could not save the image on this device.');
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const blob = await renderToBlob();
      if (!blob) throw new Error('Could not generate image.');
      const file = new File([blob], 'questlog-character.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Questlog character' });
      } else {
        setMessage('Sharing isn\'t supported here — use Save Image instead.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setMessage('Could not share the image on this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl border-t border-gold-500/40 bg-ink-900 p-5 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        <h2 className="font-display text-lg font-bold text-gold-300">Share Card</h2>

        <div className="mx-auto mt-4 max-w-[280px] overflow-hidden rounded-2xl border border-gold-500/30">
          <ShareCardSvg
            ref={svgRef}
            name={character.name}
            level={level}
            className={className}
            dominantAttribute={dominantAttribute}
            attributes={character.attributes}
            gold={character.gold}
            loadout={loadout}
          />
        </div>

        {message && <p className="mt-3 text-center text-xs text-blood-400">{message}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="flex-1 rounded-lg bg-gold-500 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50"
          >
            Save Image
          </button>
          <button
            onClick={handleShare}
            disabled={busy}
            className="flex-1 rounded-lg border border-gold-500/50 py-2.5 text-sm font-medium text-gold-300 disabled:opacity-50"
          >
            Share
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
