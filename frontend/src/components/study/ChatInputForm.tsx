import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Paperclip, Mic, MicOff, Loader2, X, FileText, Brain, Sparkles, AudioLines
} from 'lucide-react'

export interface ChatInputFormProps {
  onSendMessage: (text: string) => void
  onUploadFile?: (file: File, userNote?: string) => void
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
  allowUpload?: boolean
}

export default function ChatInputForm({
  onSendMessage,
  onUploadFile,
  disabled = false,
  placeholder = 'Ask anything...',
  autoFocus = false,
  className = '',
  allowUpload = true,
}: ChatInputFormProps) {

  const [inputVal, setInputVal] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isDeepThink, setIsDeepThink] = useState(true)

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
        accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.pptx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Transparent Minimalist Pill Container */}
      <div
        className={`relative transition-all duration-200 ease-out bg-transparent rounded-full border px-2 py-1.5 sm:px-3 sm:py-1.5 ${
          isFocused ? 'border-slate-800 ring-1 ring-slate-800/10' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {/* Attachment Pill (if file selected) */}
        <AnimatePresence>
          {attachedFile && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              className="px-3 pt-1.5 pb-1"
            >
              <div
                className="flex items-center justify-between gap-2 px-3 py-1 rounded-full text-xs bg-slate-100/90 border border-slate-200 text-slate-700"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={13} className="shrink-0 text-blue-600" />
                  <span className="font-medium truncate max-w-[200px] sm:max-w-[320px]">
                    {attachedFile.name}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
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
        <div className="flex items-center gap-2">
          {/* Add / Attachment Button (+) */}
          {allowUpload && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="flex items-center justify-center w-8 h-8 rounded-full text-slate-600 hover:text-black hover:bg-black/5 transition-all cursor-pointer shrink-0"
              title="Attach Syllabus, PDF, Word or Notes"
            >
              <Plus size={19} className="stroke-[2.2]" />
            </button>
          )}

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
              className="w-full resize-none bg-transparent text-sm leading-snug outline-none border-none py-1.5 px-1 font-serif text-black placeholder:text-slate-400 custom-scrollbar"
              style={{
                minHeight: '24px',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Right Action Control: Mic only (and Send when user enters text) */}
          <div className="flex items-center gap-1 shrink-0 pr-1">
            {canSubmit ? (
              <motion.button
                type="button"
                onClick={handleSend}
                disabled={disabled}
                whileTap={{ scale: 0.92 }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--ink)] hover:bg-slate-800 text-white shadow-xs transition-all cursor-pointer"
                title="Send message (Enter)"
              >
                {disabled ? (
                  <Loader2 size={14} className="animate-spin text-white" />
                ) : (
                  <Send size={14} className="ml-0.5" />
                )}
              </motion.button>
            ) : (
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={disabled}
                className={`p-2 rounded-full text-slate-500 hover:text-black hover:bg-black/5 transition-all cursor-pointer ${
                  isListening ? 'animate-pulse text-red-500 bg-red-50' : ''
                }`}
                title={isListening ? 'Listening... click to stop' : 'Voice dictation'}
              >
                {isListening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
