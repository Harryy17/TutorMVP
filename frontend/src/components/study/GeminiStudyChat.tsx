import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, FileText, X, Loader2, Mic, MicOff,
  Sparkles, ArrowRight, ArrowDown, BookOpen, Compass, Layers,
  ChevronRight, ChevronDown, Paperclip, CheckCircle2,
  Menu, PanelRightClose, PanelRightOpen, Volume2, VolumeX, Square,
  Clock, Brain, GraduationCap, Download, Code2, Maximize2
} from 'lucide-react'


import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { TopicItem } from './TopicCards'
import StudyMapPanel from './StudyMapPanel'
import ChatInputForm from './ChatInputForm'
import MarkdownArtifactViewer from './MarkdownArtifactViewer'
import { studyApi } from '../../services/api'
import { cleanAcademicText } from '../../utils/textFormatter'
import { exportNotesToPdf } from '../../utils/exportPdf'


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
  response_format?: string
  export_ready?: boolean
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
  const [spokenWordIndex, setSpokenWordIndex] = useState<number | null>(null)
  const [speechWords, setSpeechWords] = useState<string[]>([])
  const speechIntervalRef = useRef<any>(null)
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const speechCancelRef = useRef<boolean>(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [isDownloadingMd, setIsDownloadingMd] = useState<string | null>(null)
  const [activeArtifact, setActiveArtifact] = useState<{ title: string; markdown: string } | null>(null)
  const [viewerPosition, setViewerPosition] = useState<'left' | 'right'>('right')

  const isStudyNotesMessage = (m: Message): boolean => {
    if (m.role !== 'assistant') return false
    if (m.response_format === 'study_notes' || m.export_ready) return true
    const txt = m.text || ''
    return (
      txt.includes('— Study Notes') ||
      txt.includes('Quick-Reference Glossary') ||
      (txt.includes('## 1.') && txt.includes('Suggested next step:'))
    )
  }

  const getStudyNotesTitle = (m: Message): string => {
    const h1Match = m.text.match(/^#\s+(.*?)(?:\s+—\s+Study Notes)?$/m)
    if (h1Match && h1Match[1]) return h1Match[1].trim()
    return subject || 'Study Notes'
  }

  const getStudyNotesChatIntro = (m: Message): string => {
    const text = m.text || ''
    let topic = subject || 'this topic'
    const h1Match = text.match(/^#\s+(.*?)(?:\s+—\s+Study Notes)?$/m)
    if (h1Match && h1Match[1]) topic = h1Match[1].trim()

    const buildsOnMatch = text.match(/\*Builds on:\s*(.*?)\*/i)
    const buildsOn = buildsOnMatch ? buildsOnMatch[1].trim() : ''

    const h2Matches = Array.from(text.matchAll(/##\s+\d*\.?\s*([^\n]+)/g))
      .map(match => match[1].replace(/Quick-Reference Glossary/i, '').trim())
      .filter(Boolean)
    const keyHighlights = h2Matches.slice(0, 3).join(', ')

    let intro = `I built these notes on top of what you've already studied${buildsOn ? ` (${buildsOn})` : ''}, focusing on the core principles, ${keyHighlights ? keyHighlights.toLowerCase() + ', ' : ''}practical applications, comparison tables, and a quick-reference glossary at the end for quick lookup.`

    intro += `\n\nLet me know if you'd like this turned into flashcards or a quiz to test yourself on it.`
    return intro
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const handleDownloadStudyNotes = async (m: Message) => {
    setIsDownloadingMd(m.id)
    try {
      let docTitle = subject || 'study_notes'
      const h1Match = m.text.match(/^#\s+(.*?)(?:\s+—\s+Study Notes)?$/m)
      if (h1Match && h1Match[1]) docTitle = h1Match[1].trim()

      const res = await studyApi.exportNotesMd(m.text, docTitle)
      const blob = new Blob([res.data], { type: 'text/markdown; charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const slug = docTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '_')
      a.download = `${slug}_notes.md`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download via API failed, using fallback:', err)
      // Robust client-side fallback
      try {
        let docTitle = subject || 'study_notes'
        const h1Match = m.text.match(/^#\s+(.*?)(?:\s+—\s+Study Notes)?$/m)
        if (h1Match && h1Match[1]) docTitle = h1Match[1].trim()
        const blob = new Blob([m.text], { type: 'text/markdown; charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const slug = docTitle.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[-\s]+/g, '_')
        a.download = `${slug}_notes.md`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (e) {
        alert('Could not download .md file.')
      }
    } finally {
      setIsDownloadingMd(null)
    }
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const isUp = el.scrollHeight - el.scrollTop - el.clientHeight > 140
    setShowScrollBottom(isUp)
  }

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

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
            // Restore topics on curriculum message if missing from legacy records
            const restoredMsgs = savedMsgs.map((m: Message) => {
              if ((!m.topics || m.topics.length === 0) && savedTopics && savedTopics.length > 0 && (m.text.includes('Extracted Curriculum Roadmap') || m.text.includes('core learning modules'))) {
                return { ...m, topics: savedTopics }
              }
              return m
            })
            setMessages(restoredMsgs)
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
        const cleanInitialTitle = subject || (text.length > 32 ? `${text.slice(0, 32).trim()}...` : text)
        const createRes = await studyApi.createSession({
          subject: subject || 'Study Session',
          title: cleanInitialTitle
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
        history: messages.map((m) => {
          let content = m.text
          if (m.quizData && m.quizData.question_text) {
            content += `\n[Quiz Question ${m.quizData.question_number} of ${m.quizData.total_questions}: ${m.quizData.question_text}]`
          }
          return { role: m.role, content }
        }),
      })
      const decision = res.data

      const newSubject = (decision.extracted_subject && decision.intent === 'SUBJECT_SPECIFIED') ? decision.extracted_subject : subject
      if (decision.extracted_subject && decision.intent === 'SUBJECT_SPECIFIED') setSubject(decision.extracted_subject)

      const isStudyNotes = decision.response_format === 'study_notes' || decision.export_ready
      const messageText = isStudyNotes
        ? (decision.reply || '')
        : cleanAcademicText(decision.reply || `Here are the key points regarding **${text}**:\n\n- Key principles and foundational definitions\n- Core application within ${subject || 'this subject'}`)

      const botMsg: Message = {
        id: `b_${Date.now()}`,
        role: 'assistant',
        text: messageText,
        isExplanation: decision.is_explanation ?? true,
        thoughtProcess: decision.thought_process || undefined,
        quizData: decision.quiz_data || undefined,
        response_format: decision.response_format,
        export_ready: Boolean(decision.export_ready),
      }

      const allMsgs = [...updatedMsgs, botMsg]
      setMessages(allMsgs)

      if (activeSid) {
        const cleanTitle = newSubject || subject || (text.length > 32 ? `${text.slice(0, 32).trim()}...` : text)
        studyApi.saveSessionState(activeSid, {
          messages: allMsgs,
          topics: extractedTopics,
          subject: newSubject || subject || 'Study Session',
          title: cleanTitle,
        }).catch(() => { })
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
        }).catch(() => { })
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
    } catch { }
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
      const isStudyMaterial = res.data?.is_study_material !== false
      const topics: TopicItem[] = res.data?.topics || []
      const newSessionId = res.data?.study_id || sessionId || `session_${Date.now()}`
      const thoughtProcess = res.data?.thought_process
      setSessionId(newSessionId)
      if (onSessionChange) onSessionChange(newSessionId)

      // ── Non-Study Material Validation Guardrail ──
      if (!isStudyMaterial) {
        const detectedType = res.data?.detected_document_type || 'Non-Educational Document'
        const reason = res.data?.validation_reason || 'This document does not appear to contain academic course concepts or syllabus materials.'

        const rejectionMsg = {
          id: analyzingId,
          role: 'assistant' as const,
          text: `### 📄 Non-Academic Material Detected\n\nI analyzed **${file.name}** and classified it as **${detectedType}**.\n\n> **Academic Guardrail Notice:**\n> ${reason}\n\n**Recommended Next Steps:**\n- 📘 Upload a textbook chapter, lecture slides, syllabus, or notes (`+` button).\n- 💬 Or type any topic or question directly below to begin learning!`,
          isAnalyzing: false,
          thoughtProcess: thoughtProcess || `Document classification identified ${detectedType}. Rejection guardrail triggered.`,
        }

        const updatedMessages = [...messages, userMsg, rejectionMsg]
        setMessages(updatedMessages)
        setStep('conversing')

        studyApi.saveSessionState(newSessionId, {
          messages: updatedMessages,
          topics: [],
          subject: currentSubject,
          title: res.data?.title,
        }).catch(() => { })
        return
      }

      setExtractedTopics(topics)

      const updatedMessages = [
        ...messages,
        userMsg,
        {
          id: analyzingId,
          role: 'assistant' as const,
          text: `###  Extracted Curriculum Roadmap for **${currentSubject}**\n\nI have analyzed **${file.name}** and structured your course into **${topics.length} core learning modules**. You can explore any topic below:`,
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
      }).catch(() => { })

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
          text: `### Extracted Curriculum Roadmap for **${currentSubject}**\n\nI have extracted **${fallbackTopics.length} core learning modules**. You can explore any topic below:`,
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
      }).catch(() => { })
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
      speechCancelRef.current = true
      if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
      window.speechSynthesis.cancel()
      currentUtteranceRef.current = null
      setCurrentlySpeakingMsgId(null)
      setSpokenWordIndex(null)
      return
    }

    // Cancel any previous speech
    speechCancelRef.current = false
    if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()

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
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[Source:[^\]]*\]/gi, ' ')
      .replace(/\$([^\$]+)\$/g, '$1')
      .replace(/[*_#~>]/g, '')
      .replace(/- \*\*/g, '')
      .replace(/^#+\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!speechText) return

    // Split into sentences so Chromium never resets charIndex or drops boundaries
    const rawSentenceList = speechText
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const sentenceList = rawSentenceList.length > 0 ? rawSentenceList : [speechText]

    interface SentenceChunk {
      text: string
      words: string[]
      spans: { word: string; start: number; end: number }[]
      wordOffset: number
    }

    const chunks: SentenceChunk[] = []
    const allWords: string[] = []
    let cumulativeCount = 0

    for (const sent of sentenceList) {
      const sWords: string[] = []
      const sSpans: { word: string; start: number; end: number }[] = []
      const wordRegex = /\S+/g
      let m: RegExpExecArray | null
      while ((m = wordRegex.exec(sent)) !== null) {
        sWords.push(m[0])
        sSpans.push({
          word: m[0],
          start: m.index,
          end: m.index + m[0].length,
        })
      }
      if (sWords.length > 0) {
        chunks.push({
          text: sent,
          words: sWords,
          spans: sSpans,
          wordOffset: cumulativeCount,
        })
        allWords.push(...sWords)
        cumulativeCount += sWords.length
      }
    }

    if (chunks.length === 0 || allWords.length === 0) return

    setSpeechWords(allWords)
    setSpokenWordIndex(0)
    setCurrentlySpeakingMsgId(msgId)

    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find((v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || v.name.includes('Jenny') || v.name.includes('Guy') || v.name.includes('Aria'))
    ) || voices.find((v) => v.lang.startsWith('en') && !v.name.includes('Desktop')) || voices.find((v) => v.lang.startsWith('en'))

    const playSentence = (idx: number) => {
      if (speechCancelRef.current || idx >= chunks.length) {
        if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
        currentUtteranceRef.current = null
        setCurrentlySpeakingMsgId(null)
        setSpokenWordIndex(null)
        return
      }

      const chunk = chunks[idx]
      const utterance = new SpeechSynthesisUtterance(chunk.text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      if (preferredVoice) utterance.voice = preferredVoice
      currentUtteranceRef.current = utterance

      let localWordIdx = 0

      // Word-by-word progression timer that keeps animation moving in real time
      const scheduleNextWord = (fromIdx: number) => {
        if (speechCancelRef.current) return
        if (fromIdx >= chunk.words.length) return

        const currentWord = chunk.words[fromIdx] || ''
        const cleanLen = Math.max(1, currentWord.replace(/[^\w]/g, '').length)
        let delay = 210 + cleanLen * 26
        if (currentWord.includes(',') || currentWord.includes(';') || currentWord.includes(':') || currentWord.includes('—')) {
          delay += 160
        }

        speechIntervalRef.current = setTimeout(() => {
          if (speechCancelRef.current) return
          const nextIdx = fromIdx + 1
          if (nextIdx < chunk.words.length) {
            localWordIdx = nextIdx
            setSpokenWordIndex(chunk.wordOffset + nextIdx)
            scheduleNextWord(nextIdx)
          }
        }, delay)
      }

      utterance.onstart = () => {
        if (speechCancelRef.current) return
        setCurrentlySpeakingMsgId(msgId)
        localWordIdx = 0
        setSpokenWordIndex(chunk.wordOffset + 0)
        scheduleNextWord(0)
      }

      utterance.onboundary = (event: any) => {
        // Ignore sentence boundaries - only react to word boundaries
        if (event.name && event.name !== 'word') {
          return
        }

        if (typeof event.charIndex === 'number') {
          const charIdx = event.charIndex
          let localIdx = -1
          for (let i = 0; i < chunk.spans.length; i++) {
            if (charIdx >= chunk.spans[i].start && charIdx <= chunk.spans[i].end) {
              localIdx = i
              break
            }
            if (charIdx < chunk.spans[i].start) {
              localIdx = i
              break
            }
          }
          if (localIdx === -1) localIdx = chunk.spans.length - 1

          localWordIdx = localIdx
          setSpokenWordIndex(chunk.wordOffset + localIdx)
          if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
          scheduleNextWord(localIdx)
        }
      }

      utterance.onend = () => {
        if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
        if (!speechCancelRef.current && idx + 1 < chunks.length) {
          playSentence(idx + 1)
        } else {
          currentUtteranceRef.current = null
          setCurrentlySpeakingMsgId(null)
          setSpokenWordIndex(null)
        }
      }

      utterance.onerror = () => {
        if (speechIntervalRef.current) clearTimeout(speechIntervalRef.current)
        if (!speechCancelRef.current && idx + 1 < chunks.length) {
          playSentence(idx + 1)
        } else {
          currentUtteranceRef.current = null
          setCurrentlySpeakingMsgId(null)
          setSpokenWordIndex(null)
        }
      }

      window.speechSynthesis.speak(utterance)
    }

    playSentence(0)
  }


  const assistantMsgCount = messages.filter((m) => m.role === 'assistant').length
  const canUploadMaterial = extractedTopics.length > 0 || assistantMsgCount >= 2

  // ─── INITIAL WELCOME / CONVERSATION VIEW ─────────────────────── //
  return (
    <div className={`relative w-full h-full max-h-screen ${activeArtifact ? 'max-w-none' : 'max-w-4xl mx-auto'} overflow-hidden transition-all duration-300`} style={{ fontFamily: 'var(--font-serif)' }}>
      {/* ── Welcome Screen ── */}
      {step === 'ask_subject' && (
        <div className="w-full h-full flex flex-col items-center justify-center text-center overflow-y-auto custom-scrollbar px-4 sm:px-6 py-4 pb-28">
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
        <div className={`w-full h-full flex ${viewerPosition === 'left' ? 'flex-row-reverse' : 'flex-row'} overflow-hidden relative`}>
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-w-0 h-full flex flex-col space-y-4 px-3 sm:px-6 pt-3 pb-36 overflow-y-auto notebook-lines custom-scrollbar will-change-scroll"
          >
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
                className={m.role === 'assistant' ? 'relative w-full py-2 px-1' : ''}
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
                    color: 'var(--ink)',
                  }
                }>
                {/* Subtle Minimalist Audio Indicator */}
                {m.role === 'assistant' && currentlySpeakingMsgId === m.id && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500 font-sans">
                    <div className="flex items-center gap-0.5 h-2.5">
                      <span className="equalizer-bar" style={{ animationDelay: '0s', background: '#334155' }} />
                      <span className="equalizer-bar" style={{ animationDelay: '0.2s', background: '#334155' }} />
                      <span className="equalizer-bar" style={{ animationDelay: '0.4s', background: '#334155' }} />
                    </div>
                    <span className="text-[11.5px] font-medium text-slate-600">Reading aloud...</span>
                  </div>
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
                  currentlySpeakingMsgId === m.id && speechWords.length > 0 ? (
                    <div className="space-y-3.5">
                      <div className="text-[16.5px] leading-[1.85] font-serif text-slate-900 py-1 select-none flex flex-wrap gap-y-1 items-center">
                        {speechWords.map((word, wIdx) => {
                          const isCurrent = wIdx === spokenWordIndex
                          const isPast = spokenWordIndex !== null && wIdx < spokenWordIndex
                          return (
                            <span
                              key={wIdx}
                              className={`inline-block mr-1.5 transition-all duration-150 rounded-md ${
                                isCurrent
                                  ? 'bg-amber-300 text-slate-950 font-bold px-1.5 py-0.5 shadow-xs ring-2 ring-amber-400/60 scale-105'
                                  : isPast
                                  ? 'text-slate-900 font-medium'
                                  : 'text-slate-400 opacity-75'
                              }`}
                            >
                              {word}
                            </span>
                          )
                        })}
                      </div>

                      {/* If study notes, also keep the box card visible while reading */}
                      {isStudyNotesMessage(m) && (
                        <div
                          onClick={() => setActiveArtifact({ title: getStudyNotesTitle(m), markdown: m.text })}
                          className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 max-w-md select-none active:scale-[0.99]"
                          title="Click to open study notes in viewer"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 border border-slate-200 group-hover:bg-slate-200 group-hover:scale-105 transition-all">
                              <FileText size={20} className="text-slate-700" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-sm text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                                {getStudyNotesTitle(m)}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">Document · MD</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleDownloadStudyNotes(m)}
                              disabled={isDownloadingMd === m.id}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:border-slate-300 active:scale-95"
                              title="Download as Markdown (.md)"
                            >
                              <FileText size={12} className="text-slate-500" />
                              <span>{isDownloadingMd === m.id ? 'Saving...' : 'MD'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => exportNotesToPdf(getStudyNotesTitle(m), undefined)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:border-emerald-400 active:scale-95"
                              title="Download as PDF (.pdf)"
                            >
                              <Download size={12} className="text-emerald-700" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isStudyNotesMessage(m) ? (
                    <div className="space-y-3.5">
                      {/* Conversational Intro Text Matching Claude */}
                      <div className="text-[14.5px] leading-relaxed text-slate-800 markdown-content">
                        <ReactMarkdown>{getStudyNotesChatIntro(m)}</ReactMarkdown>
                      </div>

                      {/* Claude-style Document Box Card */}
                      <div
                        onClick={() => setActiveArtifact({ title: getStudyNotesTitle(m), markdown: m.text })}
                        className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 max-w-md select-none active:scale-[0.99]"
                        title="Click to open study notes in viewer"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0 border border-slate-200 group-hover:bg-slate-200 group-hover:scale-105 transition-all">
                            <FileText size={20} className="text-slate-700" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                              {getStudyNotesTitle(m)}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">Document · MD</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleDownloadStudyNotes(m)}
                            disabled={isDownloadingMd === m.id}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:border-slate-300 active:scale-95"
                            title="Download as Markdown (.md)"
                          >
                            <FileText size={12} className="text-slate-500" />
                            <span>{isDownloadingMd === m.id ? 'Saving...' : 'MD'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportNotesToPdf(getStudyNotesTitle(m), undefined)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:border-emerald-400 active:scale-95"
                            title="Download as PDF (.pdf)"
                          >
                            <Download size={12} className="text-emerald-700" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={m.role === 'user' ? 'text-[14px] leading-relaxed text-[#1B2340]' : 'markdown-content'}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{getDisplayChatText(m)}</ReactMarkdown>
                    </div>
                  )
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
                        <div className="w-6 h-6 rounded-lg bg-[var(--sage-soft)] flex items-center justify-center text-[var(--sage)] shrink-0 font-bold text-xs border border-[var(--sage)]">
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
                                className="w-full sm:w-2/3 max-w-sm flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-[var(--white)] text-[var(--ink)] hover:bg-[var(--sage-soft)] hover:text-[var(--sage)] hover:border-[var(--sage)] border border-[var(--paper-rule)] shadow-2xs active:scale-[0.98]"
                              >
                                <Brain size={13} />
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

              {/* Action Chips: View, Speak & Feedback */}
              {m.role === 'assistant' && !m.isAnalyzing && (
                <div className="flex items-center flex-wrap gap-2 mt-2 pl-0.5">
                  {/* View Option Button Below Response */}
                  {(isStudyNotesMessage(m) || m.export_ready) && (
                    <button
                      type="button"
                      onClick={() => setActiveArtifact({ title: getStudyNotesTitle(m), markdown: m.text })}
                      className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all px-3 py-1 rounded-full shadow-2xs group bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 active:scale-[0.98]"
                      title="Open Markdown Viewer in side panel"
                    >
                      <Code2 size={13} className="text-emerald-700" />
                      <span>View</span>
                    </button>
                  )}

                  {/* Speaker Button with Natural Wave Animation */}
                  <button
                    type="button"
                    onClick={() => handleToggleSpeak(m.id, isStudyNotesMessage(m) ? getStudyNotesChatIntro(m) : m.text, m.quizData)}
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

        {/* Claude-style Side-Panel Markdown Artifact Viewer */}
        <MarkdownArtifactViewer
          isOpen={Boolean(activeArtifact)}
          onClose={() => setActiveArtifact(null)}
          title={activeArtifact?.title || ''}
          markdown={activeArtifact?.markdown || ''}
          position={viewerPosition}
          onTogglePosition={() => setViewerPosition(p => p === 'left' ? 'right' : 'left')}
          onDownload={() => {
            if (activeArtifact) {
              const dummyMsg: Message = { id: 'art_dl', role: 'assistant', text: activeArtifact.markdown }
              handleDownloadStudyNotes(dummyMsg)
            }
          }}
          isDownloading={isDownloadingMd === 'art_dl'}
        />
      </div>
      )}

      {/* ── Floating Translucent Input Bar (Floating Over the Scrolling Text) ── */}
      {(step === 'conversing' || step === 'topics_ready' || step === 'analyzing') && (
        <div className={`absolute bottom-0 ${
          activeArtifact
            ? viewerPosition === 'left'
              ? 'right-0 left-auto w-full lg:w-[calc(100%-500px)] xl:w-[calc(100%-560px)]'
              : 'left-0 right-auto w-full lg:w-[calc(100%-500px)] xl:w-[calc(100%-560px)]'
            : 'left-0 right-0'
        } z-20 pb-3 pt-6 bg-gradient-to-t from-[var(--paper)] via-[var(--paper)]/60 to-transparent pointer-events-none transition-all duration-300`}>
          {/* Scroll to Bottom Quick Button */}
          <AnimatePresence>
            {showScrollBottom && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.9 }}
                className="flex justify-center mb-2 pointer-events-auto"
              >
                <button
                  type="button"
                  onClick={scrollToBottom}
                  className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-black hover:bg-slate-50 transition-all cursor-pointer"
                  title="Scroll to bottom"
                >
                  <ArrowDown size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pointer-events-auto max-w-3xl mx-auto px-4 sm:px-6">
            <ChatInputForm
              onSendMessage={(txt) => handleSendMessage(txt)}
              onUploadFile={(file, note) => handleMaterialUpload(file, note)}
              disabled={isAgentThinking || isUploading}
              allowUpload={true}
              placeholder="Ask anything..."
            />
          </div>
        </div>
      )}
    </div>
  )
}




