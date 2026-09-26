import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../store/themeStore';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Functional so the recovery screen can follow the active theme. */
const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void }> = ({
  error,
  onReset,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>System Recovery</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        ZeroDaily encountered an unexpected layout anomaly.
      </Text>

      {/* Raw stack details are a development aid, not user-facing copy. */}
      {__DEV__ && error && (
        <Text
          style={[
            styles.errorMessage,
            { color: colors.danger, backgroundColor: `${colors.danger}15` },
          ]}
        >
          {error.message}
        </Text>
      )}

      <TouchableOpacity
        style={[styles.retryButton, { backgroundColor: colors.primary }]}
        onPress={onReset}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={styles.retryText}>Relaunch Stream</Text>
      </TouchableOpacity>
    </View>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ZeroDaily ErrorBoundary] Uncaught exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorMessage: {
    fontSize: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
});
