import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { useSync } from "./hooks/useSync";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import LessonPage from "./pages/LessonPage";
import ExerciseSet from "./pages/ExerciseSet";
import BilanPage from "./pages/BilanPage";
import DailyDrill from "./pages/DailyDrill";
import VerbLookup from "./pages/VerbLookup";
import VerbQuiz from "./pages/VerbQuiz";
import SyncIndicator from "./components/SyncIndicator";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(!!s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);
  if (session === null) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppSyncIndicator() {
  const { status } = useSync();
  return (
    <SyncIndicator
      syncing={status === "syncing"}
      synced={status === "online"}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/lesson/:chapterId" element={<ProtectedRoute><LessonPage /></ProtectedRoute>} />
          <Route path="/exercise/:setId" element={<ProtectedRoute><ExerciseSet /></ProtectedRoute>} />
          <Route path="/bilan/:bilanId" element={<ProtectedRoute><BilanPage /></ProtectedRoute>} />
          <Route path="/drill" element={<ProtectedRoute><DailyDrill /></ProtectedRoute>} />
          <Route path="/verbs" element={<ProtectedRoute><VerbLookup /></ProtectedRoute>} />
          <Route path="/verbs/quiz" element={<ProtectedRoute><VerbQuiz /></ProtectedRoute>} />
          <Route path="/verbs/quiz/:tense" element={<ProtectedRoute><VerbQuiz /></ProtectedRoute>} />
        </Routes>
        <AppSyncIndicator />
      </div>
    </BrowserRouter>
  );
}
