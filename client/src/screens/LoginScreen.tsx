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

type Props = { navigation: StackNavigationProp<AuthStackParamList, 'Login'> };

export default function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleLogin = async (): Promise<void> => {
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter your username and password');
      return;
    }
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          <AppText variant="caption">Secure private messaging</AppText>
        </View>

        <Card>
          <AppText variant="title" style={styles.title}>Welcome back</AppText>

          {error ? (
            <Row style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.error}>{error}</Text>
            </Row>
          ) : null}

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
            <AppText variant="caption">{"Don't have an account? "}</AppText>
            <Button
              title="Register"
              variant="text"
              onPress={() => navigation.navigate('Register')}
            />
          </Row>
        </Card>

        <Row style={styles.encryptionNote}>
          <MaterialCommunityIcons name="shield-lock-outline" size={16} color={colors.textTertiary} />
          <AppText variant="caption" color={colors.textTertiary}>End-to-end encrypted by default</AppText>
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
    gap: spacing.xs,
  },
});
