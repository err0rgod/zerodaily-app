import { Flame, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CATEGORIES } from '../../constants/categories';
import { THEME } from '../../constants/theme';
import { Article } from '../../types';
import { Badge } from '../common/Badge';

interface FullRoastModalProps {
  article: Article | null;
  visible: boolean;
  onClose: () => void;
}

export const FullRoastModal: React.FC<FullRoastModalProps> = ({
  article,
  visible,
  onClose,
}) => {
  if (!article) return null;

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const paragraphs = article.fullSummary.split('\n\n');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Flame size={20} color={THEME.colors.warning} />
              <Text style={styles.modalTitle}>Full Roast Breakdown</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={THEME.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Meta tags */}
            <View style={styles.metaRow}>
              <Badge
                label={categoryMeta.name}
                color={categoryMeta.accentColor}
                size="md"
              />
            </View>

            {/* Headline */}
            <Text style={styles.headline}>{article.heading}</Text>

            {/* Paragraphs */}
            {paragraphs.map((p, idx) => (
              <Text key={idx} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: THEME.typography.sizes.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: THEME.radii.full,
    backgroundColor: THEME.colors.surface,
  },
  scrollArea: {
    flex: 1,
  },
  contentContainer: {
    padding: THEME.spacing.md,
    paddingBottom: 40,
  },
  metaRow: {
    marginBottom: 12,
  },
  headline: {
    fontSize: THEME.typography.sizes.xxl,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    lineHeight: 34,
    marginBottom: 20,
  },
  paragraph: {
    fontSize: THEME.typography.sizes.base,
    color: THEME.colors.textSecondary,
    lineHeight: 26,
    marginBottom: 16,
  },
});
