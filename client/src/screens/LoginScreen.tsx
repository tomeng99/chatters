import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Row from '../components/Row';
import AppText from '../components/AppText';
import { colors, typography, spacing, borderRadius } from '../theme';

type Props = { navigation: StackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password');
      return;
    }
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.appName}>💬 Chatters</Text>
          <AppText variant="caption">Secure private messaging</AppText>
        </View>

        <Card>
          <AppText variant="title" style={styles.title}>Welcome back</AppText>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.button}
          />

          <Row style={styles.footer}>
            <AppText variant="caption">{`Don't have an account? `}</AppText>
            <Button
              title="Register"
              variant="text"
              onPress={() => navigation.navigate('Register')}
            />
          </Row>
        </Card>

        <View style={styles.encryptionNote}>
          <AppText variant="caption">🔒 End-to-end encrypted by default</AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  appName: {
    fontSize: typography.fontSizeXXL + 8,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.lg,
  },
  error: {
    backgroundColor: '#FFEDEC',
    color: colors.error,
    fontSize: typography.fontSizeSM,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
  },
  footer: {
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  encryptionNote: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});
