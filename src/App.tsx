import { useEffect, useState } from 'react';
import { useStore } from './store';
import { BottomNav, type Screen } from './components/BottomNav';
import { CharacterSheet } from './screens/CharacterSheet';
import { QuestLog } from './screens/QuestLog';
import { Shop } from './screens/Shop';
import { Chronicle } from './screens/Chronicle';
import { Onboarding } from './screens/Onboarding';
import { Toast } from './components/Toast';
import { ReminderScheduler } from './components/ReminderScheduler';

function App() {
  const characterName = useStore((s) => s.character.name);
  const runDecayCheck = useStore((s) => s.runDecayCheck);
  const claimBossVictory = useStore((s) => s.claimBossVictory);
  const [screen, setScreen] = useState<Screen>('character');
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    return useStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Boss rewards are awarded automatically. Checking on open as well as on
    // completion means a week's target that was already met — including one
    // met before this version, or on a device that was closed at the time —
    // still pays out instead of expiring unclaimed.
    const sync = () => {
      runDecayCheck();
      claimBossVictory();
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [hydrated, runDecayCheck, claimBossVictory]);

  // localStorage hydration is synchronous in practice, but guard anyway so
  // decay processing never runs against pre-hydration default state.
  if (!hydrated) return null;

  if (!characterName) return <><Onboarding /><Toast /></>;

  return (
    <>
      {screen === 'character' && <CharacterSheet />}
      {screen === 'quests' && <QuestLog />}
      {screen === 'shop' && <Shop />}
      {screen === 'chronicle' && <Chronicle />}
      <BottomNav screen={screen} onChange={setScreen} />
      <Toast />
      <ReminderScheduler />
    </>
  );
}

export default App;
