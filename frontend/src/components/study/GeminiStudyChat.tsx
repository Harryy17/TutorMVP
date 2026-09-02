import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, FileText, X, Loader2, Mic, MicOff,
  Sparkles, ArrowRight, BookOpen, Compass, Layers,
  ChevronRight, ChevronDown, Paperclip, CheckCircle2,
  Menu, PanelRightClose, PanelRightOpen, Volume2, VolumeX, Square,
  Clock, Brain, GraduationCap
} from 'lucide-react'


import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { TopicItem } from './TopicCards'
import StudyMapPanel from './StudyMapPanel'
import ChatInputForm from './ChatInputForm'
import { studyApi } from '../../services/api'
import { cleanAcademicText } from '../../utils/textFormatter'


export interface QuizData {
  question_number: number
  total_questions: number
  question_text: string
  options?: string[]
  correct_option?: string
  evaluation?: string
  is_completed?: boolean
}

export interface Message {
  id: string
  role: 'assistant' | 'user'
  text: string
  attachment?: { name: string; size: string; file?: File }
  isAnalyzing?: boolean
  topics?: TopicItem[]
  isExplanation?: boolean
  feedbackGiven?: 'good' | 'easier'
  thoughtProcess?: string
  quizData?: QuizData
  quickSuggestions?: string[]
}


interface GeminiStudyChatProps {
  userName?: string
  activeSessionId?: string
  onSessionChange?: (sessionId: string) => void
  onSelectTopicMode?: (topic: TopicItem, mode: 'normal' | 'teacher', sessionId: string) => void
  onOpenStudyMap?: (topics: TopicItem[], subject: string, sessionId: string) => void
  onOpenMobileSidebar?: () => void
}

const STARTER_SUGGESTIONS = [
  'Machine Learning',
  'Linear Algebra',
  'Data Structures & Algorithms',
  'Computer Networks',
  'Operating Systems',
]

const getDisplayChatText = (m: Message): string => {
  if (!m.text) return ''
  if (!m.quizData) return m.text

  // When quizData is present, clean out duplicated Question labels, option bullets (A) ... B) ...), and "Type your answer..." prompt
  let cleaned = m.text
  cleaned = cleaned.replace(/(?:^|\n)\s*\**Question\s+\d+\s*(?:of\s+\d+|:)[^\n]*/gi, '')
  cleaned = cleaned.replace(/(?:^|\n)\s*[-*]?\s*[A-D]\)\s+[^\n]*/gi, '')
  cleaned = cleaned.replace(/(?:^|\n)\s*(?:Type|Reply with|Enter)\s+(?:your\s+)?answer[^\n]*/gi, '')
  cleaned = cleaned.replace(/\n{2,}/g, '\n\n')
  return cleaned.trim()
}

export default function GeminiStudyChat({
  userName = 'SREEHARI',
  activeSessionId,
  onSessionChange,
  onSelectTopicMode,
  onOpenStudyMap,
  onOpenMobileSidebar,
}: GeminiStudyChatProps) {
  const [step, setStep] = useState<'ask_subject' | 'conversing' | 'analyzing' | 'topics_ready'>('ask_subject')
  const [subject, setSubject] = useState('')
  const [inputVal, setInputVal] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [sessionId, setSessionId] = useState(activeSessionId || '')
  const [extractedTopics, setExtractedTopics] = useState<TopicItem[]>([])
  const [currentlySpeakingMsgId, setCurrentlySpeakingMsgId] = useState<string | null>(null)


  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // ── Sync with activeSessionId from Left Navbar ──
  useEffect(() => {
    if (!activeSessionId) {
      setSessionId('')
      setMessages([])
      setExtractedTopics([])
      setSubject('')
      setStep('ask_subject')
      return
    }

    if (activeSessionId !== sessionId) {
      setSessionId(activeSessionId)
      studyApi.getSessionState(activeSessionId).then((res) => {
        if (res.data) {
          const { meta, messages: savedMsgs, topics: savedTopics } = res.data
          if (meta?.subject) setSubject(meta.subject)
          if (savedTopics && savedTopics.length > 0) {
            setExtractedTopics(savedTopics)
            setStep('topics_ready')
          }
          if (savedMsgs && savedMsgs.length > 0) {
            setMessages(savedMsgs)
            if (!savedTopics || savedTopics.length === 0) {
              setStep('conversing')
            }
          } else if (!savedTopics || savedTopics.length === 0) {
            setMessages([])
            setStep('ask_subject')
          }
        }
      }).catch((err) => {
        console.error('Failed to load session state:', err)
      })
    }
  }, [activeSessionId])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAgentThinking, isUploading])



  const handleSendMessage = async (textToSend?: string, options?: { difficulty?: 'standard' | 'easier' }) => {
    const text = (textToSend || inputVal).trim()
    if (!text && !attachedFile) return
    if (attachedFile) { handleMaterialUpload(attachedFile, text); return }

    let activeSid = sessionId
    if (!activeSid) {
      try {
        const createRes = await studyApi.createSession({
          subject: subject || text,
          title: `${subject || text} Study Session`
        })
        activeSid = createRes.data.session_id
        setSessionId(activeSid)
        if (onSessionChange) onSessionChange(activeSid)
      } catch (err) {
        console.warn('Auto create session warning:', err)
      }
    }

    const isEasierRequest = options?.difficulty === 'easier'
    let updatedMsgs = messages
    if (!isEasierRequest) {
      const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', text }
      updatedMsgs = [...messages, userMsg]
      setMessages(updatedMsgs)
      setInputVal('')
    }
    setIsAgentThinking(true)
    if (step === 'ask_subject') setStep('conversing')

    try {
      const res = await studyApi.agentMessage({
        message: text,
        current_subject: subject || undefined,
        session_id: activeSid || undefined,
        user_id: userName.toLowerCase().replace(/\s+/g, '_') || 'default_user',
        user_name: userName,
        difficulty: options?.difficulty || 'standard',
        history: messages.map((m) => ({ role: m.role, content: m.text })),
      })
      const decision = res.data

      const newSubject = (decision.extracted_subject && decision.intent === 'SUBJECT_SPECIFIED') ? decision.extracted_subject : subject
      if (decision.extracted_subject && decision.intent === 'SUBJECT_SPECIFIED') setSubject(decision.extracted_subject)

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        text: cleanAcademicText(decision.reply || `Here are the key points regarding **${text}**:\n\n- Key principles and foundational definitions\n- Core application within ${subject || 'this subject'}`),
        isExplanation: decision.is_explanation ?? true,
        thoughtProcess: decision.thought_process || undefined,
        quizData: decision.quiz_data || undefined,
      }

      const allMsgs = [...updatedMsgs, botMsg]
      setMessages(allMsgs)

      if (activeSid) {
        studyApi.saveSessionState(activeSid, {
          messages: allMsgs,
          topics: extractedTopics,
          subject: newSubject || subject || text,
        }).catch(() => {})
      }
    } catch {
      const isQuestion = /\b(what|how|why|when|where|which|explain|describe|types|difference|compare|important|concepts)\b|\?/i.test(text)
      const fallbackText = isQuestion
        ? `Here is a breakdown of the core concepts for **${text.replace(/^[?.,\s]+|[?.,\s]+$/g, '')}**:\n\n1. **Core Intuition**: Foundational principle and mathematical/theoretical structure.\n2. **Key Mechanisms**: How data and operations are computed step-by-step.\n3. **Practical Applications**: Real-world use cases and key tradeoffs.\n\nWould you like me to test your understanding with a practice quiz question?`
        : `Understood. Let's study **${text}**.\n\nYou can attach your course material (PDF, notes, or slides) using the attachment button (📎) below, or ask a question to begin.`

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        text: fallbackText,
        isExplanation: isQuestion,
      }
      if (!isQuestion && !subject) setSubject(text)
      const allMsgs = [...updatedMsgs, botMsg]
      setMessages(allMsgs)

      if (activeSid) {
        studyApi.saveSessionState(activeSid, {
          messages: allMsgs,
          topics: extractedTopics,
          subject: subject || text,
        }).catch(() => {})
      }
    } finally {
      setIsAgentThinking(false)
    }

  }



  const handleFeedbackGood = async (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedbackGiven: 'good' } : m))
    )
    try {
      await studyApi.sendFeedback({
        user_id: userName.toLowerCase().replace(/\s+/g, '_') || 'default_user',
        action: 'confirm_good',
        concept: subject,
        subject,
      })
    } catch (e) {
      console.warn('Feedback logging error', e)
    }
  }

  const handleMakeEasier = async (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedbackGiven: 'easier' } : m))
    )
    try {
      studyApi.sendFeedback({
        user_id: userName.toLowerCase().replace(/\s+/g, '_') || 'default_user',
        action: 'make_easier',
        concept: subject,
        subject,
      })
    } catch {}
    handleSendMessage('Please explain this in a simpler way with everyday analogies.', { difficulty: 'easier' })
  }


  const handleMaterialUpload = async (file: File, userNote?: string) => {
    const currentSubject = subject || 'General Study'
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: userNote || `Attached material: ${file.name}`,
      attachment: { name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`, file },
    }
    const analyzingId = `b_analyzing_${Date.now()}`
    const analyzingMsg: Message = {
      id: analyzingId,
      role: 'assistant',
      text: `📖 **Received ${file.name}** (${(file.size / (1024 * 1024)).toFixed(2)} MB)\n\nIndexing chapters, text, and diagrams into your isolated workspace database in real time...`,
      isAnalyzing: true,
    }
    setMessages((prev) => [...prev, userMsg, analyzingMsg])
    setAttachedFile(null)
    setInputVal('')
    setIsUploading(true)
    setStep('analyzing')

    try {
      const res = await studyApi.upload(currentSubject, file, sessionId || undefined)
      const topics: TopicItem[] = res.data?.topics || []
      const newSessionId = res.data?.study_id || sessionId || `session_${Date.now()}`
      const thoughtProcess = res.data?.thought_process
      setSessionId(newSessionId)
      if (onSessionChange) onSessionChange(newSessionId)
      setExtractedTopics(topics)

      const updatedMessages = [
        ...messages,
        userMsg,
        {
          id: analyzingId,
          role: 'assistant' as const,
          text: `### 📚 Extracted Curriculum Roadmap for **${currentSubject}**\n\nI have analyzed **${file.name}** and structured your course into **${topics.length} core learning modules**. You can explore any topic or start Teacher Mode below:`,
          isAnalyzing: false,
          topics: topics,
          thoughtProcess: thoughtProcess || `Analyzed ${file.name}, identified ${topics.length} core high-yield topics.`,
        }
      ]
      setMessages(updatedMessages)
      setStep('topics_ready')

      studyApi.saveSessionState(newSessionId, {
        messages: updatedMessages,
        topics: topics,
        subject: currentSubject,
        title: res.data?.title,
      }).catch(() => {})

    } catch {
      const fallbackSessionId = sessionId || `session_${Date.now()}`
      setSessionId(fallbackSessionId)
      if (onSessionChange) onSessionChange(fallbackSessionId)
      const fallbackTopics: TopicItem[] = [
        { id: 'topic_1', title: 'Decision Trees & Random Forests', summary: 'Tree-based recursive partitioning and ensemble classification.', difficulty: 'Beginner', key_concepts: ['Entropy', 'Information Gain'], estimated_study_time: '12-15 mins' },
        { id: 'topic_2', title: 'Support Vector Machines', summary: 'Maximum margin hyperplanes and kernel tricks for non-linear boundaries.', difficulty: 'Intermediate', key_concepts: ['Kernel Trick', 'Soft Margin'], estimated_study_time: '15-18 mins' },
        { id: 'topic_3', title: 'Logistic & Linear Regression', summary: 'Parametric modeling, gradient descent optimization, and cost functions.', difficulty: 'Beginner', key_concepts: ['Sigmoid', 'Loss Function'], estimated_study_time: '12-15 mins' },
      ]
      setExtractedTopics(fallbackTopics)

      const fallbackMsgs = [
        ...messages,
        userMsg,
        {
          id: analyzingId,
          role: 'assistant' as const,
          text: `### 📚 Extracted Curriculum Roadmap for **${currentSubject}**\n\nI have extracted **${fallbackTopics.length} core learning modules**. You can explore any topic or start Teacher Mode below:`,
          isAnalyzing: false,
          topics: fallbackTopics,
        }
      ]
      setMessages(fallbackMsgs)
      setStep('topics_ready')

      studyApi.saveSessionState(fallbackSessionId, {
        messages: fallbackMsgs,
        topics: fallbackTopics,
        subject: currentSubject,
      }).catch(() => {})
    } finally {
      setIsUploading(false)
    }



  }

  const handleSelectMode = (topic: TopicItem, mode: 'normal' | 'teacher') => {
    if (onSelectTopicMode) onSelectTopicMode(topic, mode, sessionId)
  }

  const handleOpenStudyMap = () => {
    if (onOpenStudyMap) onOpenStudyMap(extractedTopics, subject, sessionId)
  }

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.')
      return
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      if (transcript) handleSendMessage(transcript)
    }
    recognition.start()
  }

  const handleToggleSpeak = (msgId: string, rawText: string, quiz?: QuizData) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.')
      return
    }

    // If currently speaking this message, toggle off
    if (currentlySpeakingMsgId === msgId) {
      window.speechSynthesis.cancel()
      setCurrentlySpeakingMsgId(null)
      return
    }

    // Cancel any previous speech
    window.speechSynthesis.cancel()

    // Clean text for natural speech synthesis
    let speechText = rawText || ''
    if (quiz) {
      let quizSpeech = ''
      if (quiz.evaluation) quizSpeech += quiz.evaluation + '. '
      if (quiz.question_text) quizSpeech += quiz.question_text + '. '
      if (quiz.options && quiz.options.length > 0) {
        quizSpeech += 'Options are: ' + quiz.options.join('. ')
      }
      speechText = (speechText ? speechText + '. ' : '') + quizSpeech
    }

    speechText = speechText
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1')     // inline code
      .replace(/\[Source:[^\]]*\]/gi, '')
      .replace(/\$([^\$]+)\$/g, '$1')   // inline math
      .replace(/[*_#~>]/g, '')          // markdown characters
      .replace(/- \*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!speechText) return

    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.rate = 0.95
    utterance.pitch = 1.0

    // Prefer natural English voices
    const voices = window.speechSynthesis.getVoices()
    const naturalVoice = voices.find((v) =>
      (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny') || v.name.includes('Guy')) &&
      v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en'))

    if (naturalVoice) {
      utterance.voice = naturalVoice
    }

    utterance.onstart = () => {
      setCurrentlySpeakingMsgId(msgId)
    }
    utterance.onend = () => {
      setCurrentlySpeakingMsgId(null)
    }
    utterance.onerror = () => {
      setCurrentlySpeakingMsgId(null)
    }

    window.speechSynthesis.speak(utterance)
  }


  const assistantMsgCount = messages.filter((m) => m.role === 'assistant').length
  const canUploadMaterial = extractedTopics.length > 0 || assistantMsgCount >= 2

  // ─── INITIAL WELCOME / CONVERSATION VIEW ─────────────────────── //
  return (
    <div className="relative min-h-[90vh] flex flex-col justify-between max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* ── Welcome Screen ── */}
      {step === 'ask_subject' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Mobile Top Bar */}
          {onOpenMobileSidebar && (
            <div className="md:hidden w-full flex items-center justify-between pb-3 border-b border-[var(--paper-rule)] mb-6">
              <button
                onClick={onOpenMobileSidebar}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--white)] border border-[var(--paper-rule)] text-xs font-semibold text-[var(--ink)] shadow-2xs cursor-pointer"
              >
                <Menu size={15} />
                <span>Workspaces</span>
              </button>
              <span className="text-[11px] font-mono text-[var(--ink-soft)] uppercase tracking-wider font-semibold">IndieTutor</span>
            </div>
          )}

          {/* Notebook logo mark */}
          <div className="mb-6 flex flex-col items-center gap-1">
            <div style={{ width: '44px', height: '6px', background: 'var(--margin-red)', borderRadius: '3px', marginBottom: '3px' }} />
            <div style={{ width: '32px', height: '6px', background: 'var(--highlight)', borderRadius: '3px' }} />
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold leading-snug mb-2.5" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
            What would you like to study,
            <span style={{ display: 'block', fontStyle: 'italic', color: 'var(--margin-red)' }}>{userName}?</span>
          </h1>
          <p className="text-xs sm:text-sm max-w-sm mb-6 sm:mb-8 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Type what subject, topic, or exam you want to study to start.
          </p>


          <div className="w-full max-w-xl mb-6">
            <ChatInputForm
              onSendMessage={(txt) => handleSendMessage(txt)}
              onUploadFile={(file, note) => handleMaterialUpload(file, note)}
              allowUpload={true}
              disabled={isAgentThinking || isUploading}
              placeholder="e.g. Machine Learning, or attach syllabus/textbook PDF (📎)..."
              autoFocus
            />
          </div>




          {/* Starter Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
            <span className="text-xs mr-1" style={{ color: 'var(--ink-faint)' }}>Popular:</span>
            {STARTER_SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(sug)}
                className="cursor-pointer transition-all text-xs font-medium"
                style={{ background: 'var(--sage-soft)', border: '1px solid var(--paper-rule)', borderRadius: '20px', padding: '5px 13px', color: 'var(--ink-soft)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--highlight-soft)'; e.currentTarget.style.borderColor = 'var(--highlight)'; e.currentTarget.style.color = 'var(--ink)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--sage-soft)'; e.currentTarget.style.borderColor = 'var(--paper-rule)'; e.currentTarget.style.color = 'var(--ink-soft)' }}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Conversation Screen (Before Materials) ── */}
      {(step === 'conversing' || step === 'topics_ready' || step === 'analyzing') && (
        <div className="flex-1 flex flex-col space-y-4 pb-28 overflow-y-auto pt-2 notebook-lines custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-[var(--paper-rule)]">
            <div className="flex items-center gap-2 min-w-0">
              {onOpenMobileSidebar && (
                <button
                  onClick={onOpenMobileSidebar}
                  className="md:hidden p-1.5 rounded-lg hover:bg-[var(--sage-soft)] text-[var(--ink-soft)] transition-colors cursor-pointer shrink-0"
                  title="Open Workspaces"
                >
                  <Menu size={16} />
                </button>
              )}
              <BookOpen size={13} className="shrink-0" style={{ color: 'var(--margin-red)' }} />
              <span className="truncate max-w-[150px] sm:max-w-xs md:max-w-md" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                {subject ? subject : 'Study Session'}
              </span>
            </div>
            <button
              onClick={() => { setStep('ask_subject'); setMessages([]); setSubject('') }}
              className="text-xs font-medium cursor-pointer transition-colors shrink-0"
              style={{ color: 'var(--ink-faint)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
            >
              ← New Topic
            </button>
          </div>


          {/* Messages */}
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={m.role === 'assistant' ? `relative overflow-hidden transition-all duration-300 ${currentlySpeakingMsgId === m.id ? 'ring-1.5 ring-[var(--sage)]' : ''}` : ''}
                style={m.role === 'user'
                ? {
                    background: 'var(--white)',
                    border: '1.5px solid var(--paper-rule)',
                    borderRadius: '14px 14px 4px 14px',
                    padding: '10px 16px',
                    maxWidth: '80%',
                    boxShadow: '0 2px 8px rgba(27,35,64,0.04)',
                    color: 'var(--ink)',
                  }
                : {
                    background: currentlySpeakingMsgId === m.id ? 'linear-gradient(180deg, #F2F8F4 0%, var(--white) 100%)' : 'var(--white)',
                    border: currentlySpeakingMsgId === m.id ? '1px solid var(--sage)' : '1px solid var(--paper-rule)',
                    borderRadius: '4px 14px 14px 14px',
                    padding: '12px 18px',
                    maxWidth: '88%',
                    borderLeft: currentlySpeakingMsgId === m.id ? '4px solid var(--sage)' : '3px solid var(--highlight)',
                    boxShadow: currentlySpeakingMsgId === m.id ? '0 4px 20px rgba(74, 124, 89, 0.12)' : '0 2px 8px rgba(27,35,64,0.02)',
                  }
              }>
                {/* Animated moving audio light beam when reading */}
                {m.role === 'assistant' && currentlySpeakingMsgId === m.id && (
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-[var(--sage)] to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 2.0, ease: 'linear' }}
                  />
                )}

                {/* Live Speaking Badge */}
                {m.role === 'assistant' && currentlySpeakingMsgId === m.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 mb-2.5 px-2.5 py-0.5 rounded-full w-fit text-[10.5px] font-semibold"
                    style={{ background: 'var(--sage-soft)', border: '1px solid var(--sage)', color: 'var(--sage)' }}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--sage)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--sage)]"></span>
                    </span>
                    <span>Reading aloud...</span>
                  </motion.div>
                )}

                {m.role === 'assistant' && m.thoughtProcess && (

                  <details className="mb-2.5 group cursor-pointer">
                    <summary className="flex items-center gap-1.5 font-medium list-none select-none text-[11px]" style={{ color: 'var(--ink-soft)' }}>
                      <Sparkles size={11} style={{ color: 'var(--margin-red)' }} />
                      <span className="group-hover:underline">Reasoning & Plan</span>
                      <ChevronDown size={10} className="transition-transform group-open:rotate-180" />
                    </summary>
                    <div
                      className="mt-1.5 p-2 rounded-lg text-[11.5px] leading-relaxed italic"
                      style={{ background: 'var(--paper)', border: '1px solid var(--paper-rule)', color: 'var(--ink-soft)' }}
                    >
                      {m.thoughtProcess}
                    </div>
                  </details>
                )}

                {getDisplayChatText(m) && (
                  <div className={m.role === 'user' ? 'text-[14px] leading-relaxed text-[#1B2340]' : 'markdown-content'}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{getDisplayChatText(m)}</ReactMarkdown>
                  </div>
                )}


                {/* Interactive Quiz Card */}
                {m.quizData && (
                  <div className="mt-3 p-3.5 rounded-xl border space-y-3"
                    style={{ background: 'var(--paper)', borderColor: 'var(--paper-rule)' }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                        style={{ background: 'var(--highlight-soft)', color: 'var(--ink)', border: '1px solid var(--highlight)' }}>
                        Question {m.quizData.question_number} of {m.quizData.total_questions}
                      </span>
                      {m.quizData.is_completed && (
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--sage)' }}>
                          ✓ Quiz Completed
                        </span>
                      )}
                    </div>

                    {m.quizData.evaluation && (
                      <div className="p-2.5 rounded-lg text-xs leading-relaxed"
                        style={{ background: 'var(--sage-soft)', border: '1px solid var(--sage)', color: 'var(--ink)' }}>
                        <span className="font-semibold" style={{ color: 'var(--sage)' }}>Previous Answer: </span>
                        {m.quizData.evaluation}
                      </div>
                    )}

                    {m.quizData.question_text && (
                      <p className="font-semibold text-[13.5px] leading-snug" style={{ color: 'var(--ink)' }}>
                        {m.quizData.question_text}
                      </p>
                    )}

                    {m.quizData.options && m.quizData.options.length > 0 && !m.quizData.is_completed && (
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        {m.quizData.options.map((opt, optIdx) => {
                          const optLetter = opt.trim().charAt(0).toUpperCase()
                          const answerText = opt.replace(/^[A-D]\)\s*/i, '').trim()
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSendMessage(answerText)}
                              className="flex items-center text-left p-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer group shadow-2xs"

                              style={{
                                background: 'var(--white)',
                                border: '1px solid var(--paper-rule)',
                                color: 'var(--ink)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--sage)'
                                e.currentTarget.style.background = 'var(--sage-soft)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--paper-rule)'
                                e.currentTarget.style.background = 'var(--white)'
                              }}
                            >
                              <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] mr-2 shrink-0 transition-colors"
                                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}>
                                {optLetter}
                              </span>
                              <span className="flex-1 leading-snug">{opt.replace(/^[A-D]\)\s*/i, '')}</span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}



                {m.attachment && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 text-xs w-fit"
                    style={{ background: 'var(--sage-soft)', border: '1px solid var(--paper-rule)', borderRadius: '6px', color: 'var(--sage)' }}>
                    <FileText size={13} style={{ color: 'var(--sage)' }} />
                    <span className="font-medium truncate max-w-xs">{m.attachment.name}</span>
                    <span style={{ opacity: 0.65 }}>({m.attachment.size})</span>
                  </div>
                )}

                {/* ─── Stitch MCP Scholarly Ambient Curriculum Card List ─── */}
                {m.topics && m.topics.length > 0 && (
                  <div className="mt-4 space-y-3 pt-3 border-t border-[var(--paper-rule)]">
                    {/* Roadmap Header Badge */}
                    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-[var(--paper-rule)] bg-[var(--paper)]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[var(--ink)] flex items-center justify-center text-[var(--highlight)] shrink-0 font-bold text-xs">
                          <BookOpen size={13} />
                        </div>
                        <div className="truncate">
                          <span className="font-semibold text-xs text-[var(--ink)] block truncate" style={{ fontFamily: 'var(--font-serif)' }}>
                            Curriculum Roadmap · {subject || 'Syllabus'}
                          </span>
                          <p className="text-[10.5px] text-[var(--ink-soft)]">
                            {m.topics.length} core learning modules extracted
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenStudyMap}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--sage-soft)] text-[var(--sage)] hover:bg-[var(--sage)] hover:text-white transition-colors cursor-pointer shrink-0 border border-[var(--sage)]"
                      >
                        Full Roadmap →
                      </button>
                    </div>

                    {/* Vertical List of Topic Cards */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {m.topics.map((t, tIdx) => {
                        return (
                          <div
                            key={t.id || `t_${tIdx}`}
                            className="group relative p-3 sm:p-3.5 rounded-xl border border-[var(--paper-rule)] bg-[var(--white)] shadow-2xs hover:shadow-sm hover:border-[var(--sage)] transition-all"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-5 h-5 rounded-full font-bold text-[10.5px] font-mono flex items-center justify-center shrink-0 border"
                                  style={{ background: 'var(--sage-soft)', color: 'var(--sage)', borderColor: 'var(--sage)' }}
                                >
                                  {String(tIdx + 1).padStart(2, '0')}
                                </span>
                                <h4
                                  className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate"
                                  style={{ fontFamily: 'var(--font-serif)' }}
                                >
                                  {t.title}
                                </h4>
                              </div>
                            </div>

                            {t.summary && (
                              <p className="text-[11.5px] leading-relaxed text-[var(--ink-soft)] mb-2.5 pl-7">
                                {t.summary}
                              </p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-center pt-3 mt-2 border-t border-[var(--paper-line)]">
                              <button
                                type="button"
                                onClick={() => handleSelectMode(t, 'normal')}
                                className="w-full sm:w-2/3 max-w-sm flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all bg-[var(--ink)] text-[var(--paper)] hover:bg-slate-800 shadow-2xs active:scale-[0.98]"
                              >
                                <Brain size={12} />
                                <span>Explore Core Idea</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

              </div>

              {/* Action Chips: Speak & Difficulty Toggles */}
              {m.role === 'assistant' && !m.isAnalyzing && (
                <div className="flex items-center gap-2 mt-2 pl-0.5">
                  {/* Speaker Button with Natural Wave Animation */}
                  <button
                    type="button"
                    onClick={() => handleToggleSpeak(m.id, m.text, m.quizData)}
                    className="flex items-center gap-1.5 text-xs font-medium cursor-pointer transition-all px-2.5 py-1 rounded-full shadow-2xs group"
                    style={{
                      background: currentlySpeakingMsgId === m.id ? 'var(--sage-soft)' : 'var(--white)',
                      border: currentlySpeakingMsgId === m.id ? '1px solid var(--sage)' : '1px solid var(--paper-rule)',
                      color: currentlySpeakingMsgId === m.id ? 'var(--sage)' : 'var(--ink-soft)',
                    }}
                    title={currentlySpeakingMsgId === m.id ? "Stop reading" : "Read response aloud"}
                  >
                    {currentlySpeakingMsgId === m.id ? (
                      <>
                        {/* Animated Natural Sound Waves */}
                        <div className="flex items-center gap-[2px] h-3.5 px-0.5">
                          <motion.span
                            animate={{ height: ['4px', '13px', '6px', '11px', '4px'] }}
                            transition={{ repeat: Infinity, duration: 1.0, ease: 'easeInOut' }}
                            className="w-[2px] rounded-full bg-[var(--sage)]"
                          />
                          <motion.span
                            animate={{ height: ['7px', '4px', '14px', '6px', '7px'] }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut', delay: 0.15 }}
                            className="w-[2px] rounded-full bg-[var(--sage)]"
                          />
                          <motion.span
                            animate={{ height: ['4px', '12px', '4px', '13px', '4px'] }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut', delay: 0.3 }}
                            className="w-[2px] rounded-full bg-[var(--sage)]"
                          />
                          <motion.span
                            animate={{ height: ['9px', '5px', '12px', '4px', '9px'] }}
                            transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut', delay: 0.2 }}
                            className="w-[2px] rounded-full bg-[var(--sage)]"
                          />
                        </div>
                        <span className="text-[11px] font-semibold">Speaking</span>
                        <Square size={8} className="fill-[var(--sage)] ml-0.5" />
                      </>
                    ) : (
                      <>
                        <Volume2 size={13} style={{ color: 'var(--sage)' }} />
                        <span className="text-[11px]">Listen</span>
                      </>
                    )}
                  </button>

                  {m.isExplanation && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleFeedbackGood(m.id)}
                        className="flex items-center gap-1 text-xs font-medium cursor-pointer transition-all px-3 py-1 rounded-full shadow-2xs"
                        style={{
                          background: m.feedbackGiven === 'good' ? 'var(--sage-soft)' : 'var(--white)',
                          border: m.feedbackGiven === 'good' ? '1px solid var(--sage)' : '1px solid var(--paper-rule)',
                          color: m.feedbackGiven === 'good' ? 'var(--sage)' : 'var(--ink-soft)',
                        }}
                        onMouseEnter={(e) => {
                          if (m.feedbackGiven !== 'good') {
                            e.currentTarget.style.borderColor = 'var(--ink)'
                            e.currentTarget.style.color = 'var(--ink)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (m.feedbackGiven !== 'good') {
                            e.currentTarget.style.borderColor = 'var(--paper-rule)'
                            e.currentTarget.style.color = 'var(--ink-soft)'
                          }
                        }}
                      >
                        <span>👍 Good</span>
                        {m.feedbackGiven === 'good' && <span className="text-[10px]">✓</span>}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMakeEasier(m.id)}
                        className="flex items-center gap-1 text-xs font-medium cursor-pointer transition-all px-3 py-1 rounded-full shadow-2xs"
                        style={{
                          background: m.feedbackGiven === 'easier' ? 'var(--highlight-soft)' : 'var(--white)',
                          border: m.feedbackGiven === 'easier' ? '1px solid var(--highlight)' : '1px solid var(--paper-rule)',
                          color: m.feedbackGiven === 'easier' ? 'var(--ink)' : 'var(--ink-soft)',
                        }}
                        onMouseEnter={(e) => {
                          if (m.feedbackGiven !== 'easier') {
                            e.currentTarget.style.borderColor = 'var(--ink)'
                            e.currentTarget.style.color = 'var(--ink)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (m.feedbackGiven !== 'easier') {
                            e.currentTarget.style.borderColor = 'var(--paper-rule)'
                            e.currentTarget.style.color = 'var(--ink-soft)'
                          }
                        }}
                      >
                        <span>🔽 Make it easier</span>
                      </button>
                    </>
                  )}
                </div>
              )}

            </motion.div>


          ))}

          {isAgentThinking && (
            <div className="flex items-center gap-2 pl-1" style={{ color: 'var(--ink-faint)', fontSize: '0.8rem' }}>
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span style={{ fontStyle: 'italic' }}>writing...</span>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
      )}

      {/* ── Fixed Input Bar (Single Column) ── */}
      {(step === 'conversing' || step === 'topics_ready' || step === 'analyzing') && (
        <div className="sticky bottom-4 w-full z-20 pb-2">
          <ChatInputForm
            onSendMessage={(txt) => handleSendMessage(txt)}
            onUploadFile={(file, note) => handleMaterialUpload(file, note)}
            disabled={isAgentThinking || isUploading}
            allowUpload={true}
            placeholder="Ask a question or attach course material PDF (📎)..."
          />
        </div>
      )}
    </div>
  )
}




