import { CategoryKey, CategoryMeta } from '../types';
import { THEME } from './theme';

/**
 * Supported Category Registry with FCM Topic Mappings & High-Res Fallback Images
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
    fallbackImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80',
  },
  cybersec: {
    key: 'cybersec',
    name: 'Cybersecurity',
    description: 'Zero-days, critical CVEs, and data breach autopsies.',
    badgeColor: THEME.colors.cybersec,
    accentColor: THEME.colors.cybersec,
    fcmTopic: 'topic_cybersec',
    fallbackImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
  },
  ai: {
    key: 'ai',
    name: 'Artificial Intelligence',
    description: 'LLM benchmark wars, frontier models, and autonomous agents.',
    badgeColor: THEME.colors.ai,
    accentColor: THEME.colors.ai,
    fcmTopic: 'topic_ai',
    fallbackImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
  },
  programming: {
    key: 'programming',
    name: 'Engineering',
    description: 'Languages, runtimes, distributed systems, and kernel bugs.',
    badgeColor: THEME.colors.programming,
    accentColor: THEME.colors.programming,
    fcmTopic: 'topic_programming',
    fallbackImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
  },
  robotics: {
    key: 'robotics',
    name: 'Robotics',
    description: 'Humanoid robotics, autonomous vehicles, and industrial sensors.',
    badgeColor: THEME.colors.robotics,
    accentColor: THEME.colors.robotics,
    fcmTopic: 'topic_robotics',
    fallbackImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
  },
  defense_aerospace: {
    key: 'defense_aerospace',
    name: 'Defense & Aerospace',
    description: 'Hypersonics, orbital swarms, defense tech, and radar systems.',
    badgeColor: THEME.colors.defense_aerospace,
    accentColor: THEME.colors.defense_aerospace,
    fcmTopic: 'topic_defense_aerospace',
    fallbackImage: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=800&auto=format&fit=crop&q=80',
  },
  hardware: {
    key: 'hardware',
    name: 'Hardware & Silicon',
    description: 'Semiconductor tape-outs, GPUs, packaging, and quantum chips.',
    badgeColor: THEME.colors.hardware,
    accentColor: THEME.colors.hardware,
    fcmTopic: 'topic_hardware',
    fallbackImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
  },
};

export const DEFAULT_FALLBACK_IMAGE = CATEGORIES.all.fallbackImage;

export const CATEGORY_LIST = Object.values(CATEGORIES);

