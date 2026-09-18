import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../../constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

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
      return (
        <View style={styles.container}>
          <Text style={styles.title}>System Recovery</Text>
          <Text style={styles.description}>
            ZeroDaily encountered an unexpected layout anomaly.
          </Text>
          {this.state.error && (
            <Text style={styles.errorMessage}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleReset}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Relaunch Stream</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorMessage: {
    fontSize: 12,
    color: THEME.colors.danger,
    backgroundColor: `${THEME.colors.danger}15`,
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    fontFamily: THEME.typography.monoFont,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radii.md,
  },
  retryText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
});
