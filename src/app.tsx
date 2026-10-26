import './global.css';

import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, useFonts } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaListener, SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { Uniwind } from 'uniwind';

import { PassTapModal } from '@/components/nfc/pass-tap-modal';
import { NavigationRoot } from '@/routes/navigator';
import { store } from '@/store';

export default function App() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold });

  if (!fontsLoaded) return null;

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        {/* Feeds insets to Uniwind's safe-area classes (pt-safe, pb-safe-offset-3, ...). */}
        <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
          {/* Before <NavigationRoot> so per-screen StatusBars mount later and take precedence. */}
          <StatusBar style="light" />
          <NavigationRoot />
          {/* Above every screen and drawer while a Pass tap runs (Android) */}
          <PassTapModal />
        </SafeAreaListener>
      </SafeAreaProvider>
    </Provider>
  );
}
