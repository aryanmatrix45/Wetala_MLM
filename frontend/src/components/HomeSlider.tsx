import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAssetUrl, type SliderItem } from '../services/api';

interface HomeSliderProps {
  sliders: SliderItem[];
  autoPlayInterval?: number; // default 5000ms
  className?: string;
}

export const HomeSlider: React.FC<HomeSliderProps> = ({
  sliders = [],
  autoPlayInterval = 5000,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Responsive screen detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter slides based on parent (Desktop) vs child (Mobile) with graceful fallback
  const activeSlides = React.useMemo(() => {
    if (!sliders || sliders.length === 0) return [];

    const desktopSlides = sliders.filter((s) => s.type === 'parent' && s.status === 'active');
    const mobileSlides = sliders.filter((s) => s.type === 'child' && s.status === 'active');

    if (isMobile) {
      return mobileSlides.length > 0 ? mobileSlides : desktopSlides;
    } else {
      return desktopSlides.length > 0 ? desktopSlides : mobileSlides;
    }
  }, [sliders, isMobile]);

  // Reset index if slides change
  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  // Autoplay timer
  useEffect(() => {
    if (activeSlides.length <= 1 || isHovered) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
    }, autoPlayInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeSlides.length, autoPlayInterval, isHovered]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % activeSlides.length);
  };

  if (!activeSlides || activeSlides.length === 0) {
    return null;
  }

  const handleSlideClick = (slide: SliderItem) => {
    if (!slide.link) return;
    if (slide.link.startsWith('http://') || slide.link.startsWith('https://')) {
      window.open(slide.link, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = slide.link;
    }
  };

  return (
    <div
      className={`home-slider-container ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="home-slider-wrapper">
        {activeSlides.map((slide, index) => {
          const isActive = index === currentIndex;
          const imgSrc = getAssetUrl(slide.imageUrl || slide.image);

          return (
            <div
              key={slide._id || slide.id || index}
              className={`home-slider-slide ${isActive ? 'active' : ''}`}
              style={{
                display: isActive ? 'block' : 'none',
                cursor: slide.link ? 'pointer' : 'default',
              }}
              onClick={() => handleSlideClick(slide)}
            >
              <img
                src={imgSrc}
                alt={slide.title || `Slide ${index + 1}`}
                className="home-slider-image"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          );
        })}

        {/* Prev / Next Navigation Arrows */}
        {activeSlides.length > 1 && (
          <>
            <button
              type="button"
              className="home-slider-btn prev"
              onClick={handlePrev}
              aria-label="Previous slide"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="home-slider-btn next"
              onClick={handleNext}
              aria-label="Next slide"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Pagination Dots */}
        {activeSlides.length > 1 && (
          <div className="home-slider-dots">
            {activeSlides.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                className={`home-slider-dot ${dotIdx === currentIndex ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(dotIdx);
                }}
                aria-label={`Go to slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
