import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import Row from '../components/Row';
import AppText from '../components/AppText';
import { colors, spacing, shadows } from '../theme';

type Props = { navigation: StackNavigationProp<AuthStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();

  const handleRegister = async (): Promise<void> => {
    setError('');

    if (!username.trim() || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="chat-processing" size={40} color="#FFFFFF" />
          </View>
          <AppText variant="heading">Chatters</AppText>
          <AppText variant="caption">Create your account</AppText>
        </View>

        <Card>
          <AppText variant="title" style={styles.title}>Get started</AppText>

          {error ? (
            <Row style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </Row>
          ) : null}

          <Input
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />
          <Input
            label="Password"
            placeholder="Choose a password (min 6 chars)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />
          <Input
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={isLoading}
            style={styles.button}
          />

          <Row style={styles.footer}>
            <AppText variant="caption">Already have an account? </AppText>
            <Button
              title="Sign In"
              variant="text"
              onPress={() => navigation.navigate('Login')}
            />
          </Row>
        </Card>

        <Row style={styles.encryptionNote}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color={colors.textTertiary} />
          <AppText variant="caption" color={colors.textTertiary} style={styles.encryptionText}>
            Your messages are end-to-end encrypted. Your private key never leaves your device.
          </AppText>
        </Row>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl + 8,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  title: {
    marginBottom: spacing.lg,
  },
  errorContainer: {
    backgroundColor: colors.error + '0D',
    padding: spacing.sm + 2,
    borderRadius: 6,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    flex: 1,
  },
  button: {
    marginTop: spacing.sm,
  },
  footer: {
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  encryptionNote: {
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  encryptionText: {
    textAlign: 'center',
    lineHeight: 20,
    flex: 1,
  },
});
