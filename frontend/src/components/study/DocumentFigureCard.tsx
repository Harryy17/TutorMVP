import React, { useState } from 'react'
import { ZoomIn, Download, X, Maximize2, FileImage } from 'lucide-react'

interface DocumentFigureCardProps {
  src: string
  alt?: string
  caption?: string
  page?: number | string
}

export const DocumentFigureCard: React.FC<DocumentFigureCardProps> = ({
  src,
  alt = 'Document Figure',
  caption,
  page,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <>
      <div className="my-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs group transition-all hover:shadow-md">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3.5 py-1.5 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <FileImage size={13} className="text-orange-500" />
            <span>Document Figure {page ? `(Page ${page})` : ''}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 transition cursor-pointer"
          >
            <ZoomIn size={12} />
            <span>Enlarge</span>
          </button>
        </div>

        {/* Thumbnail View */}
        <div
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center bg-slate-100/60 p-3 cursor-zoom-in overflow-hidden max-h-[360px]"
        >
          {!isLoaded && (
            <div className="flex items-center gap-2 py-10 text-xs text-slate-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              <span>Loading figure...</span>
            </div>
          )}
          <img
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            className={`max-h-[340px] w-auto rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.01] ${
              isLoaded ? 'block' : 'hidden'
            }`}
          />
        </div>

        {/* Caption */}
        {caption && (
          <div className="border-t border-slate-100 bg-white px-4 py-2.5">
            <p className="text-xs leading-relaxed text-slate-600 italic font-serif">
              {caption}
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-h-[92vh] max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {alt} {page ? `— Slide / Page ${page}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={src}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
                  title="Download Image"
                >
                  <Download size={15} />
                </a>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center overflow-auto p-4 max-h-[75vh]">
              <img src={src} alt={alt} className="max-h-[70vh] w-auto rounded object-contain" />
            </div>

            {caption && (
              <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-xs text-slate-600 text-center">
                {caption}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

