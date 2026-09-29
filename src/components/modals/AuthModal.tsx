import * as Haptics from 'expo-haptics';
import {
  GoogleSignin,
  statusCodes,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
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
  Alert,
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
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../store/themeStore';
import { useUserStore } from '../../store/userStore';

const GOOGLE_WEB_CLIENT_ID =
  '579068364193-ss0lik4umge8ij8djqc4p6eqagp18thl.apps.googleusercontent.com';

try {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
} catch (e) {
  // Handled gracefully on web / early runtime
}

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
);

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
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const resetForm = () => {
    setDisplayName('');
    setEmail('');
    setPassword('');
    setErrorMessage(null);
    setIsGoogleLoading(false);
  };

  React.useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        offlineAccess: false,
      });
    } catch (e) {
      console.warn('[GoogleSignin] configure error:', e);
    }
  }, []);

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

  const handleGoogleSignIn = async () => {
    if (Platform.OS === 'web') {
      setErrorMessage('Google Sign-In is only supported on Android and iOS devices.');
      return;
    }

    try {
      setErrorMessage(null);
      setIsGoogleLoading(true);

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response) || (response as any)?.type === 'cancelled') {
        return;
      }

      const idToken = isSuccessResponse(response)
        ? response.data.idToken
        : (response as any)?.data?.idToken || (response as any)?.idToken;

      if (!idToken) {
        throw new Error('Google Sign-In did not return an ID token.');
      }

      const result = await useUserStore.getState().signInWithFirebase(idToken);
      if (result.success) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        resetForm();
        onClose();
        if (result.message) {
          setTimeout(() => {
            Alert.alert('Account Restored', result.message);
          }, 350);
        }
      } else {
        setErrorMessage(result.error || 'Failed to authenticate with Google.');
      }
    } catch (error: any) {
      if (
        error?.code === statusCodes.SIGN_IN_CANCELLED ||
        error?.code === '13' ||
        error?.code === '12501'
      ) {
        return;
      } else if (error?.code === statusCodes.IN_PROGRESS) {
        setErrorMessage('Google Sign-In is already in progress.');
      } else if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setErrorMessage('Google Play Services is not available or outdated.');
      } else {
        console.warn('[GoogleSignIn] Error:', error);
        setErrorMessage(error?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
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
        if (result.message) {
          setTimeout(() => {
            Alert.alert('Account Restored', result.message);
          }, 350);
        }
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

            {/* Google Sign In Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              style={[
                styles.googleBtn,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                  opacity: isLoading || isGoogleLoading ? 0.7 : 1,
                },
              ]}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text
                    style={[
                      styles.googleBtnText,
                      { color: isDark ? '#F9FAFB' : '#1F2937' },
                    ]}
                  >
                    Continue with Google
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                {mode === 'signup' ? 'OR SIGN UP WITH EMAIL' : 'OR SIGN IN WITH EMAIL'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

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
                      editable={!isLoading && !isGoogleLoading}
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
                    editable={!isLoading && !isGoogleLoading}
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
                    editable={!isLoading && !isGoogleLoading}
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
                disabled={isLoading || isGoogleLoading}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isLoading || isGoogleLoading ? 0.7 : 1,
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
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
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
