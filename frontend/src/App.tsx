import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TutorMvpLanding from './pages/TutorMvpLanding'
import StudyPage from './pages/StudyPage'
import LoginPage from './pages/LoginPage'
import CurriculumPage from './pages/CurriculumPage'
import MethodologyPage from './pages/MethodologyPage'
import ProtectedRoute from './components/auth/ProtectedRoute'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Main Luxury Hero & Landing Page */}
          <Route path="/" element={<TutorMvpLanding />} />

          {/* Dedicated Luxury Academic Curricula Explorer */}
          <Route path="/curriculum" element={<CurriculumPage />} />

          {/* Cognitive Science & AI Methodology */}
          <Route path="/methodology" element={<MethodologyPage />} />

          {/* Dedicated Luxury Login / Signup Page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Interactive AI Study Room Studio */}
          <Route
            path="/study"
            element={
              <ProtectedRoute>
                <StudyPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
