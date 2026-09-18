import { CategoryKey, CategoryMeta } from '../types';
import { THEME } from './theme';

/**
 * Supported Category Registry with FCM Topic Mappings
 * Conforms to notification-arch.md and FastAPI /api/v1/categories.
 */
export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  all: {
    key: 'all',
    name: 'Top Feed',
    description: 'Unified chronological feed across all tech domains.',
    badgeColor: THEME.colors.primary,
    accentColor: THEME.colors.primary,
    fcmTopic: 'topic_breaking_all',
  },
  cybersec: {
    key: 'cybersec',
    name: 'Cybersecurity',
    description: 'Zero-days, critical CVEs, and data breach autopsies.',
    badgeColor: THEME.colors.cybersec,
    accentColor: THEME.colors.cybersec,
    fcmTopic: 'topic_cybersec',
  },
  ai: {
    key: 'ai',
    name: 'Artificial Intelligence',
    description: 'LLM benchmark wars, frontier models, and autonomous agents.',
    badgeColor: THEME.colors.ai,
    accentColor: THEME.colors.ai,
    fcmTopic: 'topic_ai',
  },
  programming: {
    key: 'programming',
    name: 'Engineering',
    description: 'Languages, runtimes, distributed systems, and kernel bugs.',
    badgeColor: THEME.colors.programming,
    accentColor: THEME.colors.programming,
    fcmTopic: 'topic_programming',
  },
  robotics: {
    key: 'robotics',
    name: 'Robotics',
    description: 'Humanoid robotics, autonomous vehicles, and industrial sensors.',
    badgeColor: THEME.colors.robotics,
    accentColor: THEME.colors.robotics,
    fcmTopic: 'topic_robotics',
  },
  defense_aerospace: {
    key: 'defense_aerospace',
    name: 'Defense & Aerospace',
    description: 'Hypersonics, orbital swarms, defense tech, and radar systems.',
    badgeColor: THEME.colors.defense_aerospace,
    accentColor: THEME.colors.defense_aerospace,
    fcmTopic: 'topic_defense_aerospace',
  },
  hardware: {
    key: 'hardware',
    name: 'Hardware & Silicon',
    description: 'Semiconductor tape-outs, GPUs, packaging, and quantum chips.',
    badgeColor: THEME.colors.hardware,
    accentColor: THEME.colors.hardware,
    fcmTopic: 'topic_hardware',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
