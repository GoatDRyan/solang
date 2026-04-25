import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { ROUTES } from './routes';
import LoginPage from '../../features/auth/pages/LoginPage';
import AppShell from '../../components/layout/AppShell';
import OverviewPage from '../../features/overview/pages/OverviewPage';
import AnalyticsPage from '../../features/analytics/pages/AnalyticsPage';
import RoadmapPage from '../../features/roadmap/pages/RoadmapPage';
import WeeklyPlanPage from '../../features/weekly-plan/pages/WeeklyPlanPage';
import ResourcesPage from '../../features/resources/pages/ResourcesPage';
import StudySessionsPage from '../../features/study-sessions/pages/StudySessionsPage';
import AiTutorPage from '../../features/ai-tutor/pages/AiTutorPage';
import ErrorDnaPage from '../../features/error-dna/pages/ErrorDnaPage';
import FlashcardsPage from '../../features/flashcards/pages/FlashcardsPage';
import OfficialExamsPage from '../../features/official-exams/pages/OfficialExamsPage';
import ToeflReadingSessionPage from '../../features/official-exams/pages/ToeflReadingSessionPage';
import ToeflReadingResultsPage from '../../features/official-exams/pages/ToeflReadingResultsPage';
import ToeflListeningSessionPage from '../../features/official-exams/pages/ToeflListeningSessionPage';
import ToeflListeningResultsPage from '../../features/official-exams/pages/ToeflListeningResultsPage';
import ToeflWritingSessionPage from '../../features/official-exams/pages/ToeflWritingSessionPage';
import ToeflWritingResultsPage from '../../features/official-exams/pages/ToeflWritingResultsPage';
import ToeflSpeakingSessionPage from '../../features/official-exams/pages/ToeflSpeakingSessionPage';
import ToeflSpeakingResultsPage from '../../features/official-exams/pages/ToeflSpeakingResultsPage';
import ProfilePage from '../../features/profile/pages/ProfilePage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.login} replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-text">
        Loading...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.app} replace />;
  }

  return children;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path={ROUTES.login}
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/overview" replace />} />

        <Route path="overview" element={<OverviewPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="roadmap" element={<RoadmapPage />} />
        <Route path="weekly-plan" element={<WeeklyPlanPage />} />
        <Route path="official-exams" element={<OfficialExamsPage />} />

        <Route
          path="official-exams/toefl-reading/:attemptId"
          element={<ToeflReadingSessionPage />}
        />
        <Route
          path="official-exams/toefl-reading/:attemptId/results"
          element={<ToeflReadingResultsPage />}
        />

        <Route
          path="official-exams/toefl-listening/:attemptId"
          element={<ToeflListeningSessionPage />}
        />
        <Route
          path="official-exams/toefl-listening/:attemptId/results"
          element={<ToeflListeningResultsPage />}
        />

        <Route
          path="official-exams/toefl-writing/:attemptId"
          element={<ToeflWritingSessionPage />}
        />
        <Route
          path="official-exams/toefl-writing/:attemptId/results"
          element={<ToeflWritingResultsPage />}
        />

        <Route
          path="official-exams/toefl-speaking/:attemptId"
          element={<ToeflSpeakingSessionPage />}
        />
        <Route
          path="official-exams/toefl-speaking/:attemptId/results"
          element={<ToeflSpeakingResultsPage />}
        />

        <Route path="resources" element={<ResourcesPage />} />
        <Route path="study-sessions" element={<StudySessionsPage />} />
        <Route path="ai-tutor" element={<AiTutorPage />} />
        <Route path="error-dna" element={<ErrorDnaPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}