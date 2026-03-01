import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FeedbackSectionLayout, SurveySectionLayout, AnalyticsSectionLayout, AdminSectionLayout } from "@/components/SectionLayouts";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import FeedbackForm from "./pages/FeedbackForm";
import Dashboard from "./pages/Dashboard";
import SubcategoriesPage from "./pages/Subcategories";
import AdminUsers from "./pages/AdminUsers";
import AdminTeams from "./pages/AdminTeams";
import AdminEpisodes from "./pages/AdminEpisodes";
import SurveyList from "./pages/SurveyList";
import HalfYearSurveyForm from "./pages/HalfYearSurveyForm";
import LeaderDiaryForm from "./pages/LeaderDiaryForm";
import LeaderDiaryList from "./pages/LeaderDiaryList";
import SurveyAnalytics from "./pages/SurveyAnalytics";
import CompanyMood from "./pages/CompanyMood";
import CriticalIncidents from "./pages/CriticalIncidents";
import KudosForm from "./pages/KudosForm";
import KudosDashboard from "./pages/KudosDashboard";
import SatisfactionAnalytics from "./pages/SatisfactionAnalytics";
import EngagementAnalytics from "./pages/EngagementAnalytics";
import Recommendations from "./pages/Recommendations";
import EmbedSurvey from "./pages/EmbedSurvey";
import EmbedFeedback from "./pages/EmbedFeedback";
import EmbedKudos from "./pages/EmbedKudos";
import EmbedSettings from "./pages/EmbedSettings";
import Feedback180Form from "./pages/Feedback180Form";
import Feedback180Analytics from "./pages/Feedback180Analytics";
import Review360Cycles from "./pages/Review360Cycles";
import Review360Tasks from "./pages/Review360Tasks";
import Review360Fill from "./pages/Review360Fill";
import Review360Analytics from "./pages/Review360Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AssistantMira } from "./components/AssistantMira";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={role === 'employee' ? '/feedback/new' : '/dashboard'} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RootRedirect />} />

            {/* Feedback section — persistent tabs */}
            <Route element={<ProtectedRoute><FeedbackSectionLayout /></ProtectedRoute>}>
              <Route path="/feedback/new" element={<FeedbackForm />} />
              <Route path="/feedback-180" element={<Feedback180Form />} />
              <Route path="/kudos/new" element={<KudosForm />} />
            </Route>

            {/* Surveys section — persistent tabs */}
            <Route element={<ProtectedRoute><SurveySectionLayout /></ProtectedRoute>}>
              <Route path="/surveys" element={<SurveyList />} />
              <Route path="/review-360/tasks" element={<Review360Tasks />} />
            </Route>

            {/* Survey filling (no section nav, own layout) */}
            <Route path="/surveys/:assignmentId" element={<ProtectedRoute><HalfYearSurveyForm /></ProtectedRoute>} />
            <Route path="/review-360/fill/:assignmentId" element={<ProtectedRoute><Review360Fill /></ProtectedRoute>} />

            {/* Mood — standalone */}
            <Route path="/mood" element={<ProtectedRoute><CompanyMood /></ProtectedRoute>} />

            {/* Analytics section — persistent tabs */}
            <Route element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><AnalyticsSectionLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/kudos/dashboard" element={<KudosDashboard />} />
              <Route path="/satisfaction" element={<SatisfactionAnalytics />} />
              <Route path="/engagement" element={<EngagementAnalytics />} />
              <Route path="/analytics/half-year" element={<SurveyAnalytics />} />
              <Route path="/leader-diary" element={<LeaderDiaryList />} />
              <Route path="/feedback-180/analytics" element={<Feedback180Analytics />} />
              <Route path="/review-360" element={<Review360Cycles />} />
              <Route path="/review-360/:cycleId/analytics" element={<Review360Analytics />} />
              <Route path="/incidents" element={<CriticalIncidents />} />
              <Route path="/recommendations" element={<Recommendations />} />
            </Route>

            {/* Leader diary form (own layout) */}
            <Route path="/leader-diary/:assignmentId" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><LeaderDiaryForm /></ProtectedRoute>} />

            {/* Admin section — persistent tabs */}
            <Route element={<ProtectedRoute allowedRoles={['admin']}><AdminSectionLayout /></ProtectedRoute>}>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/teams" element={<AdminTeams />} />
              <Route path="/admin/episodes" element={<AdminEpisodes />} />
              <Route path="/subcategories" element={<SubcategoriesPage />} />
              <Route path="/admin/embed" element={<EmbedSettings />} />
            </Route>

            {/* Settings — standalone */}
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* Embed (public) */}
            <Route path="/embed/survey/:cycleId" element={<EmbedSurvey />} />
            <Route path="/embed/feedback" element={<EmbedFeedback />} />
            <Route path="/embed/kudos" element={<EmbedKudos />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          <AssistantMira />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;
