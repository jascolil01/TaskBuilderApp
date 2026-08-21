import { useEffect, useState } from 'react';
import { useStore } from './store';
import { BottomNav, type Screen } from './components/BottomNav';
import { CharacterSheet } from './screens/CharacterSheet';
import { QuestLog } from './screens/QuestLog';
import { Shop } from './screens/Shop';
import { Onboarding } from './screens/Onboarding';
import { Toast } from './components/Toast';

function App() {
  const characterName = useStore((s) => s.character.name);
  const runDecayCheck = useStore((s) => s.runDecayCheck);
  const [screen, setScreen] = useState<Screen>('character');
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    return useStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    runDecayCheck();
    const onFocus = () => runDecayCheck();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [hydrated, runDecayCheck]);

  // localStorage hydration is synchronous in practice, but guard anyway so
  // decay processing never runs against pre-hydration default state.
  if (!hydrated) return null;

  if (!characterName) return <><Onboarding /><Toast /></>;

  return (
    <>
      {screen === 'character' && <CharacterSheet />}
      {screen === 'quests' && <QuestLog />}
      {screen === 'shop' && <Shop />}
      <BottomNav screen={screen} onChange={setScreen} />
      <Toast />
    </>
  );
}

export default App;
