import './global.css';

import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  useFonts,
} from '@expo-google-fonts/outfit';
import { createURL } from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Navigation, navigationTheme } from './navigation';
import { store } from './store';

// Paths are generated from screen names, e.g. vaultpass://bank/cards/holder-detail?holderId=liam
const linking = { enabled: 'auto' as const, prefixes: [createURL('/')] };

export default function App() {
  const [fontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });

  if (!fontsLoaded) return null;

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        {/* Before <Navigation> so per-screen StatusBars mount later and take precedence. */}
        <StatusBar style="light" />
        <Navigation theme={navigationTheme} linking={linking} />
      </SafeAreaProvider>
    </Provider>
  );
}
