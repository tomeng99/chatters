import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import NewChatScreen from '../screens/NewChatScreen';
import { colors, typography } from '../theme';
import { ActivityIndicator, View } from 'react-native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Conversations: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
    isGroup: boolean;
    members: Array<{ id: string; username: string; publicKey?: string | null }>;
  };
  NewChat: undefined;
};

const AuthStack = createStackNavigator<AuthStackParamList>();
const AppStack = createStackNavigator<AppStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigatorStack() {
  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
          shadowColor: colors.border,
          elevation: 1,
        },
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontSize: typography.fontSizeLG,
          fontWeight: typography.fontWeightSemiBold,
          color: colors.text,
        },
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ title: 'Chatters' }}
      />
      <AppStack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.conversationName })}
      />
      <AppStack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{ title: 'New Conversation' }}
      />
    </AppStack.Navigator>
  );
}

export default function AppNavigator() {
  const { token, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? <AppNavigatorStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
