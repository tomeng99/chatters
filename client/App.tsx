import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { useAuthStore } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import { paperTheme } from './src/theme';

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <PaperProvider theme={paperTheme}>
      <StatusBar style="dark" />
      <AppNavigator />
    </PaperProvider>
  );
}
