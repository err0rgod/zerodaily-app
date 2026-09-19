import { CategoryKey, CategoryMeta } from '../types';
import { THEME } from './theme';

/**
 * Supported Category Registry with FCM Topic Mappings & Multi-Image Fallback Pools.
 * Every single image URL below is verified (HTTP 200 OK) and optimized for high-DPI mobile screens.
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
    fallbackImages: [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    ],
  },
  cybersec: {
    key: 'cybersec',
    name: 'Cybersecurity',
    description: 'Zero-days, critical CVEs, and data breach autopsies.',
    badgeColor: THEME.colors.cybersec,
    accentColor: THEME.colors.cybersec,
    fcmTopic: 'topic_cybersec',
    fallbackImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&auto=format&fit=crop&q=80',
    ],
  },
  ai: {
    key: 'ai',
    name: 'Artificial Intelligence',
    description: 'LLM benchmark wars, frontier models, and autonomous agents.',
    badgeColor: THEME.colors.ai,
    accentColor: THEME.colors.ai,
    fcmTopic: 'topic_ai',
    fallbackImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    ],
  },
  programming: {
    key: 'programming',
    name: 'Engineering',
    description: 'Languages, runtimes, distributed systems, and kernel bugs.',
    badgeColor: THEME.colors.programming,
    accentColor: THEME.colors.programming,
    fcmTopic: 'topic_programming',
    fallbackImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80',
    ],
  },
  robotics: {
    key: 'robotics',
    name: 'Robotics',
    description: 'Humanoid robotics, autonomous vehicles, and industrial sensors.',
    badgeColor: THEME.colors.robotics,
    accentColor: THEME.colors.robotics,
    fcmTopic: 'topic_robotics',
    fallbackImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589254065878-42c9da997008?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=800&auto=format&fit=crop&q=80',
    ],
  },
  defense_aerospace: {
    key: 'defense_aerospace',
    name: 'Defense & Aerospace',
    description: 'Hypersonics, orbital swarms, defense tech, and radar systems.',
    badgeColor: THEME.colors.defense_aerospace,
    accentColor: THEME.colors.defense_aerospace,
    fcmTopic: 'topic_defense_aerospace',
    fallbackImage: 'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    ],
  },
  hardware: {
    key: 'hardware',
    name: 'Hardware & Silicon',
    description: 'Semiconductor tape-outs, GPUs, packaging, and quantum chips.',
    badgeColor: THEME.colors.hardware,
    accentColor: THEME.colors.hardware,
    fcmTopic: 'topic_hardware',
    fallbackImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
    fallbackImages: [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=800&auto=format&fit=crop&q=80',
    ],
  },
};

export const DEFAULT_FALLBACK_IMAGE = CATEGORIES.all.fallbackImage;

export const CATEGORY_LIST = Object.values(CATEGORIES);

/** Fast, non-cryptographic string hash for deterministic fallback index selection */
function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Returns a dynamic, deterministic fallback image from the specified category's pool.
 * Prevents identical repeated images when multiple articles in the same category lack a hero image.
 */
export function getDynamicFallbackImage(articleId: string = '', category: CategoryKey = 'all'): string {
  const meta = CATEGORIES[category] || CATEGORIES.all;
  const pool = meta.fallbackImages && meta.fallbackImages.length > 0 ? meta.fallbackImages : [meta.fallbackImage];
  const index = hashKey(articleId || 'default') % pool.length;
  return pool[index];
}
