import './global.css';

import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { Navigation } from './navigation';
import { store } from './store';

export default function App() {
  const colorScheme = useColorScheme();

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <Navigation theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </Provider>
  );
}
