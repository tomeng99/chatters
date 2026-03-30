import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/authStore';
import Button from '../components/Button';
import Input from '../components/Input';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

type Props = { navigation: StackNavigationProp<AuthStackParamList, 'Register'> };

export default function RegisterScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading } = useAuthStore();

  const handleRegister = async () => {
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
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="chat-processing" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>Chatters</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Get started</Text>

          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </View>
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

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Button
              title="Sign In"
              variant="text"
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </View>

        <View style={styles.encryptionNote}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color={colors.textTertiary} />
          <Text style={styles.encryptionText}>
            Your messages are end-to-end encrypted. Your private key never leaves your device.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  appName: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  title: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '0D',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  error: {
    color: colors.error,
    fontSize: typography.fontSizeSM,
    flex: 1,
  },
  button: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeSM,
  },
  encryptionNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  encryptionText: {
    fontSize: typography.fontSizeSM,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    flex: 1,
  },
});
