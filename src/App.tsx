import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
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
            <Route path="/feedback/new" element={<ProtectedRoute><FeedbackForm /></ProtectedRoute>} />
            <Route path="/feedback-180" element={<ProtectedRoute><Feedback180Form /></ProtectedRoute>} />
            <Route path="/feedback-180/analytics" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><Feedback180Analytics /></ProtectedRoute>} />
            <Route path="/kudos/new" element={<ProtectedRoute><KudosForm /></ProtectedRoute>} />
            <Route path="/mood" element={<ProtectedRoute><CompanyMood /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><Dashboard /></ProtectedRoute>} />
            <Route path="/kudos/dashboard" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><KudosDashboard /></ProtectedRoute>} />
            <Route path="/subcategories" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><SubcategoriesPage /></ProtectedRoute>} />
            <Route path="/surveys" element={<ProtectedRoute><SurveyList /></ProtectedRoute>} />
            <Route path="/surveys/:assignmentId" element={<ProtectedRoute><HalfYearSurveyForm /></ProtectedRoute>} />
            <Route path="/leader-diary" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><LeaderDiaryList /></ProtectedRoute>} />
            <Route path="/leader-diary/:assignmentId" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><LeaderDiaryForm /></ProtectedRoute>} />
            <Route path="/analytics/half-year" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><SurveyAnalytics /></ProtectedRoute>} />
            <Route path="/satisfaction" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><SatisfactionAnalytics /></ProtectedRoute>} />
            <Route path="/engagement" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><EngagementAnalytics /></ProtectedRoute>} />
            <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
            <Route path="/incidents" element={<ProtectedRoute allowedRoles={['hr', 'admin']}><CriticalIncidents /></ProtectedRoute>} />
            <Route path="/review-360" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><Review360Cycles /></ProtectedRoute>} />
            <Route path="/review-360/tasks" element={<ProtectedRoute><Review360Tasks /></ProtectedRoute>} />
            <Route path="/review-360/fill/:assignmentId" element={<ProtectedRoute><Review360Fill /></ProtectedRoute>} />
            <Route path="/review-360/:cycleId/analytics" element={<ProtectedRoute allowedRoles={['manager', 'hr', 'admin']}><Review360Analytics /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/teams" element={<ProtectedRoute allowedRoles={['admin']}><AdminTeams /></ProtectedRoute>} />
            <Route path="/admin/episodes" element={<ProtectedRoute allowedRoles={['admin']}><AdminEpisodes /></ProtectedRoute>} />
            <Route path="/admin/embed" element={<ProtectedRoute allowedRoles={['admin']}><EmbedSettings /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
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
