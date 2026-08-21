import { useEffect, useState } from 'react';
import { useStore } from './store';
import { BottomNav, type Screen } from './components/BottomNav';
import { CharacterSheet } from './screens/CharacterSheet';
import { QuestLog } from './screens/QuestLog';
import { Onboarding } from './screens/Onboarding';

function App() {
  const characterName = useStore((s) => s.character.name);
  const runDecayCheck = useStore((s) => s.runDecayCheck);
  const [screen, setScreen] = useState<Screen>('character');

  useEffect(() => {
    runDecayCheck();
    const onFocus = () => runDecayCheck();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [runDecayCheck]);

  if (!characterName) return <Onboarding />;

  return (
    <>
      {screen === 'character' ? <CharacterSheet /> : <QuestLog />}
      <BottomNav screen={screen} onChange={setScreen} />
    </>
  );
}

export default App;
