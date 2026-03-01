import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { SectionNav, SectionTab } from '@/components/SectionNav';
import { MessageSquarePlus, UserCheck, Heart, ClipboardList, RotateCcw, BarChart3, Award, ThumbsUp, Zap, PieChart, BookOpen, AlertTriangle, Lightbulb, Users, Layers, FileText, Settings2, Code } from 'lucide-react';

const feedbackTabs: SectionTab[] = [
  { label: 'Отзыв', path: '/feedback/new', icon: MessageSquarePlus },
  { label: 'Отзыв 180', path: '/feedback-180', icon: UserCheck },
  { label: 'Благодарность', path: '/kudos/new', icon: Heart },
];

const surveyTabs: SectionTab[] = [
  { label: 'Опросы', path: '/surveys', icon: ClipboardList },
  { label: 'Задания 360', path: '/review-360/tasks', icon: RotateCcw, matchPrefix: true },
];

const analyticsTabs: SectionTab[] = [
  { label: 'Обзор', path: '/dashboard', icon: BarChart3 },
  { label: 'Благодарности', path: '/kudos/dashboard', icon: Award },
  { label: 'Удовлетворённость', path: '/satisfaction', icon: ThumbsUp },
  { label: 'Вовлечённость', path: '/engagement', icon: Zap },
  { label: 'Полугодовой', path: '/analytics/half-year', icon: PieChart },
  { label: 'Дневник', path: '/leader-diary', icon: BookOpen, matchPrefix: true },
  { label: 'Отзывы 180', path: '/feedback-180/analytics', icon: UserCheck },
  { label: 'Отзывы 360', path: '/review-360', icon: RotateCcw, matchPrefix: true },
  { label: 'Сигналы', path: '/incidents', icon: AlertTriangle },
  { label: 'Рекомендации', path: '/recommendations', icon: Lightbulb },
];

const adminTabs: SectionTab[] = [
  { label: 'Пользователи', path: '/admin/users', icon: Users },
  { label: 'Команды', path: '/admin/teams', icon: Layers },
  { label: 'Эпизоды', path: '/admin/episodes', icon: FileText },
  { label: 'Подкатегории', path: '/subcategories', icon: Settings2 },
  { label: 'Встраивание', path: '/admin/embed', icon: Code },
];

export function FeedbackSectionLayout() {
  return (
    <AppLayout>
      <SectionNav tabs={feedbackTabs} />
      <Outlet />
    </AppLayout>
  );
}

export function SurveySectionLayout() {
  return (
    <AppLayout>
      <SectionNav tabs={surveyTabs} />
      <Outlet />
    </AppLayout>
  );
}

export function AnalyticsSectionLayout() {
  return (
    <AppLayout>
      <SectionNav tabs={analyticsTabs} />
      <Outlet />
    </AppLayout>
  );
}

export function AdminSectionLayout() {
  return (
    <AppLayout>
      <SectionNav tabs={adminTabs} />
      <Outlet />
    </AppLayout>
  );
}
