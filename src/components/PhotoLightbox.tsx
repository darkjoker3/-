import React, { useEffect } from 'react';
import { SpotPhoto } from '../types';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';

interface PhotoLightboxProps {
  photos: SpotPhoto[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
  spotTitle?: string;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
  spotTitle,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onNavigate((currentIndex - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight') {
        onNavigate((currentIndex + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate]);

  if (!isOpen || photos.length === 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div
      id="photo-lightbox-modal"
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 select-none animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between text-white/90 px-2 py-1 z-10">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-5 h-5 text-rose-400" />
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide truncate max-w-xs sm:max-w-md">
              {spotTitle || '写真ビューア'}
            </h3>
            <p className="text-xs text-white/60">
              {currentIndex + 1} / {photos.length} 枚
            </p>
          </div>
        </div>
        <button
          id="lightbox-close-btn"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          title="閉じる (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 flex items-center justify-center p-2 min-h-0 overflow-hidden">
        {/* Previous Button */}
        {photos.length > 1 && (
          <button
            id="lightbox-prev-btn"
            onClick={() => onNavigate((currentIndex - 1 + photos.length) % photos.length)}
            className="absolute left-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all z-20 cursor-pointer"
            title="前の写真 (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Current Image */}
        <div className="max-w-full max-h-full flex flex-col items-center justify-center">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || `${spotTitle}の写真 ${currentIndex + 1}`}
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-transform"
          />
          {currentPhoto.caption && (
            <p className="mt-3 text-center text-sm font-medium text-white/90 bg-black/60 px-4 py-1.5 rounded-full max-w-xl backdrop-blur-sm">
              {currentPhoto.caption}
            </p>
          )}
        </div>

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            id="lightbox-next-btn"
            onClick={() => onNavigate((currentIndex + 1) % photos.length)}
            className="absolute right-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 transition-all z-20 cursor-pointer"
            title="次の写真 (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 max-w-full">
          {photos.map((photo, idx) => (
            <button
              key={photo.id ? `${photo.id}_${idx}` : `photo_${idx}`}
              onClick={() => onNavigate(idx)}
              className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                idx === currentIndex
                  ? 'border-rose-500 scale-105 shadow-md ring-2 ring-rose-400/50'
                  : 'border-white/30 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
