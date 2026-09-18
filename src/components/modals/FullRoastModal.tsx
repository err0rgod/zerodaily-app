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
import { useTheme } from '../../store/themeStore';
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
  const { colors } = useTheme();

  if (!article) return null;

  const categoryMeta = CATEGORIES[article.category] || CATEGORIES.all;
  const categoryAccent = colors[article.category] || categoryMeta.accentColor;
  const paragraphs = article.fullSummary.split('\n\n');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.titleRow}>
              <Flame size={20} color={colors.warning} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Full Roast Breakdown</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <X size={20} color={colors.textPrimary} />
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
                color={categoryAccent}
                size="md"
              />
            </View>

            {/* Headline */}
            <Text style={[styles.headline, { color: colors.textPrimary }]}>{article.heading}</Text>

            {/* Paragraphs */}
            {paragraphs.map((p, idx) => (
              <Text key={idx} style={[styles.paragraph, { color: colors.textSecondary }]}>
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
  },
  container: {
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
  modalTitle: {
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
    padding: 16,
    paddingBottom: 40,
  },
  metaRow: {
    marginBottom: 12,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 33,
    marginBottom: 20,
    letterSpacing: -0.4,
  },
  paragraph: {
    fontSize: 15.5,
    lineHeight: 26,
    marginBottom: 16,
    letterSpacing: 0.1,
  },
});
