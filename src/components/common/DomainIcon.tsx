import {
  Bot,
  Code2,
  Cog,
  Cpu,
  Flame,
  Rocket,
  Shield,
  TrendingUp,
} from 'lucide-react-native';
import React from 'react';
import { CategoryKey } from '../../types';

interface DomainIconProps {
  category: CategoryKey;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const DomainIcon: React.FC<DomainIconProps> = ({
  category,
  size = 14,
  color,
  strokeWidth = 2.2,
}) => {
  switch (category) {
    case 'all':
      return <Flame size={size} color={color} strokeWidth={strokeWidth} />;
    case 'cybersec':
      return <Shield size={size} color={color} strokeWidth={strokeWidth} />;
    case 'ai':
      return <Bot size={size} color={color} strokeWidth={strokeWidth} />;
    case 'programming':
      return <Code2 size={size} color={color} strokeWidth={strokeWidth} />;
    case 'robotics':
      return <Cog size={size} color={color} strokeWidth={strokeWidth} />;
    case 'defense_aerospace':
      return <Rocket size={size} color={color} strokeWidth={strokeWidth} />;
    case 'hardware':
      return <Cpu size={size} color={color} strokeWidth={strokeWidth} />;
    case 'finance':
      return <TrendingUp size={size} color={color} strokeWidth={strokeWidth} />;
    default:
      return <Flame size={size} color={color} strokeWidth={strokeWidth} />;
  }
};
