import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UploadCloud, FileText, Image as ImageIcon, CheckCircle,
  AlertCircle, Loader2, Sparkles, ArrowLeft, Zap, Eye
} from 'lucide-react'

interface MaterialUploadProps {
  subject: string
  onUpload: (file: File) => Promise<void>
  onBack: () => void
  isExtracting?: boolean
}

export default function MaterialUpload({
  subject,
  onUpload,
  onBack,
  isExtracting = false,
}: MaterialUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const processFile = (file: File) => {
    setErrorMsg(null)
    const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.txt', '.md']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!validExtensions.includes(ext)) {
      setErrorMsg(`Unsupported file type. Please upload a PDF, image, or text document.`)
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File exceeds 50MB limit.')
      return
    }

    setSelectedFile(file)
    onUpload(file)
  }

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center justify-center px-4">
      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onBack}
        disabled={isExtracting}
        className="absolute top-6 left-6 p-2.5 rounded-full border border-slate-200/80 hover:border-slate-300 bg-white/80 backdrop-blur shadow-sm text-slate-600 hover:text-slate-900 transition-all cursor-pointer z-10 disabled:opacity-50"
      >
        <ArrowLeft size={18} />
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl flex flex-col items-center text-center z-10"
      >
        {/* Subject Header Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200/80 text-orange-700 text-xs font-semibold uppercase tracking-wider mb-4 shadow-2xs">
          <Sparkles size={13} className="text-orange-500 animate-pulse" />
          <span>Studying {subject}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-serif text-slate-900 font-normal mb-2">
          Upload your study materials
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-8">
          Upload PDF textbooks, lecture slides, or scanned notes. Our AI analyzes the topics in under 5 seconds.
        </p>

        {/* Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isExtracting && fileInputRef.current?.click()}
          className={`w-full relative rounded-3xl border-2 border-dashed transition-all p-8 sm:p-10 flex flex-col items-center justify-center cursor-pointer ${
            dragActive
              ? 'border-orange-500 bg-orange-50/60 scale-[1.01]'
              : 'border-slate-300/80 hover:border-orange-400 bg-white/70 hover:bg-white/90 backdrop-blur-sm'
          } shadow-[0_8px_30px_rgb(0,0,0,0.04)]`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.md"
            onChange={handleFileChange}
            className="hidden"
            disabled={isExtracting}
          />

          <AnimatePresence mode="wait">
            {isExtracting ? (
              <motion.div
                key="extracting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-4"
              >
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/25 text-white">
                    <Zap size={28} className="animate-bounce" />
                  </div>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-2 border-2 border-dashed border-orange-400/80 rounded-3xl"
                  />
                </div>

                <h3 className="text-base font-semibold text-slate-800 mb-1">
                  Analyzing document topics...
                </h3>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Eye size={13} className="text-orange-500" />
                  <span>Gemini VLM structure scanner active (target &lt; 5s)</span>
                </p>

                {/* Shimmer progress bar */}
                <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-5 relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: ['10%', '65%', '92%'] }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                  />
                </div>
              </motion.div>
            ) : selectedFile ? (
              <motion.div
                key="selected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
                  <FileText size={26} />
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1 max-w-xs truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-slate-400 mb-3">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <span className="text-xs text-orange-600 font-medium">Click to choose another file</span>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200/60 text-orange-600 flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                  <UploadCloud size={28} />
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Drag and drop your file here, or <span className="text-orange-600 font-semibold underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  PDF, Scanned notes (PNG, JPG), DOCX, TXT (up to 50MB)
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 mt-4 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl"
          >
            <AlertCircle size={14} />
            <span>{errorMsg}</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
