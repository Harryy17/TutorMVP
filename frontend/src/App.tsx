import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TutorMvpLanding from './pages/TutorMvpLanding'
import StudyPage from './pages/StudyPage'

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

          {/* Interactive AI Study Room Studio */}
          <Route path="/study" element={<StudyPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
