import {
  HelpCircle, Zap, Clock, MessageCircle, Star, Rocket, Swords,
  EyeOff, AlertTriangle, GraduationCap, Users, HandHeart,
  ShieldAlert, Timer, Bomb, AlertOctagon, FileWarning,
  type LucideIcon, Tag
} from 'lucide-react';

// Map subcategory names to lucide icons
const SUBCATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // Positive
  'Помог разобраться': HelpCircle,
  'Быстро ответил': Zap,
  'Проявил инициативу': Rocket,
  'Качественно сделал': Star,
  'Командная работа': Users,
  // Negative
  'Игнорировал сообщения': EyeOff,
  'Сорвал сроки': Clock,
  'Не держал в курсе': MessageCircle,
  'Низкое качество': AlertTriangle,
  'Конфликтность': Swords,
  // Critical
  'Грубое и неэтичное поведение': ShieldAlert,
  'Систематическое затягивание сроков / игнор': Timer,
  'Саботаж работы': Bomb,
  'Введение в заблуждение': AlertOctagon,
  'Нарушение договорённостей': FileWarning,
  // Generic extras
  'Наставничество': GraduationCap,
  'Поддержка': HandHeart,
};

const DEFAULT_ICON: LucideIcon = Tag;

export function getSubcategoryIcon(name: string): LucideIcon {
  return SUBCATEGORY_ICON_MAP[name] || DEFAULT_ICON;
}
