import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import ChatScreen from '../screens/ChatScreen';
import NewChatScreen from '../screens/NewChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScreenContainer from '../components/ScreenContainer';
import { colors, typography, spacing } from '../theme';
import { ActivityIndicator, StyleSheet } from 'react-native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type TabParamList = {
  ConversationsTab: undefined;
  SettingsTab: undefined;
};

export type AppStackParamList = {
  HomeTabs: undefined;
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
const Tab = createBottomTabNavigator<TabParamList>();

const stackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.surface,
    shadowColor: 'transparent',
    elevation: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTintColor: colors.primary,
  headerTitleStyle: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.text,
  },
  headerBackTitleStyle: { fontSize: 0 },
  cardStyle: { backgroundColor: colors.background },
};

function AuthNavigator(): React.JSX.Element {
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

function HomeTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: stackScreenOptions.headerStyle,
        headerTintColor: stackScreenOptions.headerTintColor,
        headerTitleStyle: stackScreenOptions.headerTitleStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSizeXS,
          fontWeight: typography.fontWeightMedium,
        },
      }}
    >
      <Tab.Screen
        name="ConversationsTab"
        component={ConversationsScreen}
        options={{
          title: 'Chatters',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chat-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AppNavigatorStack(): React.JSX.Element {
  return (
    <AppStack.Navigator screenOptions={stackScreenOptions}>
      <AppStack.Screen
        name="HomeTabs"
        component={HomeTabs}
        options={{ headerShown: false }}
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

export default function AppNavigator(): React.JSX.Element {
  const { token, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return (
      <ScreenContainer centered>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <NavigationContainer>
      {token ? <AppNavigatorStack /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
