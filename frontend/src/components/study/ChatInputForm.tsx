import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, MicOff, Loader2, X, FileText, Sparkles, Leaf
} from 'lucide-react'

export interface ChatInputFormProps {
  onSendMessage: (text: string) => void
  onUploadFile?: (file: File, userNote?: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

export default function ChatInputForm({
  onSendMessage,
  onUploadFile,
  disabled = false,
  placeholder = 'Ask a question or upload course material...',
  autoFocus = false,
  className = '',
}: ChatInputFormProps) {
  const [inputVal, setInputVal] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Auto-resize textarea height as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [inputVal])

  const handleSend = () => {
    const trimmed = inputVal.trim()
    if (!trimmed && !attachedFile) return

    if (attachedFile) {
      if (onUploadFile) {
        onUploadFile(attachedFile, trimmed)
      } else {
        onSendMessage(trimmed || `Attached file: ${attachedFile.name}`)
      }
      setAttachedFile(null)
      setInputVal('')
      return
    }

    onSendMessage(trimmed)
    setInputVal('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAttachedFile(file)
    }
    e.target.value = ''
  }

  const handleVoiceToggle = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice dictation is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      if (transcript) {
        setInputVal((prev) => (prev ? `${prev} ${transcript}` : transcript))
      }
    }
    recognition.start()
  }

  const canSubmit = (inputVal.trim().length > 0 || attachedFile !== null) && !disabled

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Nature Container */}
      <div
        className="relative transition-all duration-300 ease-out"
        style={{
          background: 'var(--white, #FFFDF8)',
          borderRadius: '16px',
          border: isFocused
            ? '1.5px solid var(--sage, #6B8E6E)'
            : '1.5px solid var(--paper-rule, #D9D0B8)',
          boxShadow: isFocused
            ? '0 6px 24px -4px rgba(107, 142, 110, 0.18), 0 2px 8px rgba(27, 35, 64, 0.04)'
            : '0 2px 10px rgba(27, 35, 64, 0.04)',
        }}
      >
        {/* Attachment Pill (if file selected) */}
        <AnimatePresence>
          {attachedFile && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="px-3.5 pt-3 pb-1"
            >
              <div
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-xs"
                style={{
                  background: 'var(--sage-soft, #E4ECE2)',
                  border: '1px solid var(--sage, #6B8E6E)',
                  color: 'var(--sage, #6B8E6E)',
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="shrink-0" />
                  <span className="font-semibold truncate max-w-[200px] sm:max-w-[320px]">
                    {attachedFile.name}
                  </span>
                  <span className="text-[11px] opacity-75 shrink-0">
                    ({(attachedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="p-1 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Input Row */}
        <div className="flex items-end gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="flex items-center justify-center p-2 rounded-xl text-xs transition-all cursor-pointer shrink-0"
            style={{
              color: attachedFile ? 'var(--sage, #6B8E6E)' : 'var(--ink-soft, #3B4266)',
              background: attachedFile ? 'var(--sage-soft, #E4ECE2)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--sage-soft, #E4ECE2)'
              e.currentTarget.style.color = 'var(--sage, #6B8E6E)'
            }}
            onMouseLeave={(e) => {
              if (!attachedFile) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--ink-soft, #3B4266)'
              }
            }}
            title="Attach Syllabus or PDF notes"
          >
            <Paperclip size={17} />
          </button>

          {/* Textarea Field */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputVal}
              disabled={disabled}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none border-none p-1 font-sans custom-scrollbar"
              style={{
                color: 'var(--ink, #1B2340)',
                minHeight: '26px',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Action Buttons: Voice & Send */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Voice Dictation Button */}
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={disabled}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isListening ? 'animate-pulse' : ''
              }`}
              style={{
                background: isListening ? 'var(--coral-soft, #FBE6E2)' : 'transparent',
                color: isListening ? 'var(--coral, #E85D4E)' : 'var(--ink-soft, #3B4266)',
              }}
              onMouseEnter={(e) => {
                if (!isListening) {
                  e.currentTarget.style.background = 'var(--paper, #F6F1E4)'
                  e.currentTarget.style.color = 'var(--ink, #1B2340)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isListening) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--ink-soft, #3B4266)'
                }
              }}
              title={isListening ? 'Listening... click to stop' : 'Voice dictation'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Send Button with Micro-Interaction Spring */}
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={!canSubmit}
              whileTap={{ scale: 0.94 }}
              className={`flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer ${
                canSubmit
                  ? 'shadow-sm opacity-100'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{
                background: canSubmit ? 'var(--ink, #1B2340)' : 'var(--paper-line, #E4DCC8)',
                color: canSubmit ? 'var(--highlight, #FFD23F)' : 'var(--ink-soft, #3B4266)',
              }}
              title="Send Message (Enter)"
            >
              {disabled ? (
                <Loader2 size={15} className="animate-spin text-white" />
              ) : (
                <Send size={15} />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Nature Micro-Cue on Focus */}
      <div className="flex items-center justify-between px-2 pt-1.5 text-[11px]" style={{ color: 'var(--ink-soft, #3B4266)', opacity: 0.75 }}>
        <span className="hidden sm:inline">Press <kbd className="px-1 py-0.5 rounded bg-black/5 font-mono text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-black/5 font-mono text-[10px]">Shift + Enter</kbd> for new line</span>
        {isFocused && (
          <span className="flex items-center gap-1 text-[10.5px] ml-auto font-medium" style={{ color: 'var(--sage, #6B8E6E)' }}>
            <Leaf size={11} />
            <span>DeepTutor Active</span>
          </span>
        )}
      </div>
    </div>
  )
}
