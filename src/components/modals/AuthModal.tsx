import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  Bookmark,
  Check,
  Eye,
  EyeOff,
  Flame,
  Lock,
  Mail,
  Sparkles,
  User,
  X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: 'signup' | 'signin';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  onClose,
  initialMode = 'signup',
}) => {
  const { colors, isDark } = useTheme();
  const { signUp, signIn, isLoading } = useUserStore();

  const [mode, setMode] = useState<'signup' | 'signin'>(initialMode);
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setErrorMessage(null);
  };

  React.useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setErrorMessage(null);
    } else {
      resetForm();
    }
  }, [visible, initialMode]);

  const handleSwitchMode = (newMode: 'signup' | 'signin') => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setMode(newMode);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    if (mode === 'signup') {
      const result = await signUp(cleanEmail, cleanPassword, displayName.trim());
      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        resetForm();
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to create account.');
      }
    } else {
      const result = await signIn(cleanEmail, cleanPassword);
      if (result.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        resetForm();
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to sign in.');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Flame size={20} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {mode === 'signup' ? 'Create ZeroDaily Account' : 'Welcome Back'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            >
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mode Switcher Tabs */}
            <View
              style={[
                styles.tabContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSwitchMode('signup')}
                style={[
                  styles.tabButton,
                  mode === 'signup' && {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: mode === 'signup' ? colors.primary : colors.textMuted,
                      fontWeight: mode === 'signup' ? '700' : '500',
                    },
                  ]}
                >
                  Create Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleSwitchMode('signin')}
                style={[
                  styles.tabButton,
                  mode === 'signin' && {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    {
                      color: mode === 'signin' ? colors.primary : colors.textMuted,
                      fontWeight: mode === 'signin' ? '700' : '500',
                    },
                  ]}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>

            {/* Value Proposition Highlights */}
            <View
              style={[
                styles.valueBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.valueRow}>
                <Sparkles size={16} color={colors.primary} />
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  Adaptive roast algorithm tuned to your reading habits
                </Text>
              </View>
              <View style={styles.valueRow}>
                <Bookmark size={16} color={colors.primary} />
                <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                  Bookmarks & saved roasts synced across all your devices
                </Text>
              </View>
            </View>

            {/* Error Message Alert */}
            {errorMessage ? (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: `${colors.danger}15`, borderColor: colors.danger },
                ]}
              >
                <AlertCircle size={16} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.form}>
              {mode === 'signup' && (
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FULL NAME</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <User size={18} color={colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: colors.textPrimary }]}
                      placeholder="e.g. Satoshi Nakamoto"
                      placeholderTextColor={colors.textMuted}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                      editable={!isLoading}
                    />
                  </View>
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>EMAIL ADDRESS</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Mail size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="you@domain.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PASSWORD</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Lock size={18} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.textPrimary }]}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color={colors.textMuted} />
                    ) : (
                      <Eye size={18} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={isLoading}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isLoading ? 0.7 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>
                      {mode === 'signup' ? 'Create Account' : 'Sign In'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Continue As Guest */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={styles.guestBtn}
              >
                <Text style={[styles.guestBtnText, { color: colors.textMuted }]}>
                  Continue reading as Guest
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 9999,
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 14,
  },
  valueBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  valueText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  eyeBtn: {
    padding: 4,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  guestBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  guestBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
