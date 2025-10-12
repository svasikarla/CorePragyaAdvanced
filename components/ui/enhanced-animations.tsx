import React from "react";

// Enhanced animation wrapper for smooth transitions
interface AnimatedWrapperProps {
  children: React.ReactNode;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'scaleIn' | 'slideLeft' | 'slideRight';
  duration?: 'fast' | 'normal' | 'slow';
  delay?: 'none' | 'short' | 'medium' | 'long';
  className?: string;
}

export function AnimatedWrapper({ 
  children, 
  animation = 'fadeIn',
  duration = 'normal',
  delay = 'none',
  className = ""
}: AnimatedWrapperProps) {
  const animationClasses = {
    fadeIn: 'animate-in fade-in',
    slideUp: 'animate-in slide-in-from-bottom-4',
    slideDown: 'animate-in slide-in-from-top-4',
    scaleIn: 'animate-in zoom-in-95',
    slideLeft: 'animate-in slide-in-from-right-4',
    slideRight: 'animate-in slide-in-from-left-4'
  };

  const durationClasses = {
    fast: 'duration-200',
    normal: 'duration-300',
    slow: 'duration-500'
  };

  const delayClasses = {
    none: '',
    short: 'delay-75',
    medium: 'delay-150',
    long: 'delay-300'
  };

  return (
    <div className={`${animationClasses[animation]} ${durationClasses[duration]} ${delayClasses[delay]} ${className}`}>
      {children}
    </div>
  );
}

// Staggered animation for lists
interface StaggeredListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  animation?: 'fadeIn' | 'slideUp' | 'scaleIn';
  className?: string;
}

export function StaggeredList({ 
  children, 
  staggerDelay = 50,
  animation = 'fadeIn',
  className = ""
}: StaggeredListProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <AnimatedWrapper
          animation={animation}
          delay={index < 4 ? (['none', 'short', 'medium', 'long'] as const)[index] : 'long'}
          key={index}
        >
          {child}
        </AnimatedWrapper>
      ))}
    </div>
  );
}

// Hover animation wrapper
interface HoverAnimationProps {
  children: React.ReactNode;
  effect?: 'lift' | 'glow' | 'scale' | 'tilt' | 'bounce';
  className?: string;
}

export function HoverAnimation({ 
  children, 
  effect = 'lift',
  className = ""
}: HoverAnimationProps) {
  const effectClasses = {
    lift: 'transition-all duration-300 hover:shadow-lg hover:-translate-y-1',
    glow: 'transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/25',
    scale: 'transition-transform duration-300 hover:scale-105',
    tilt: 'transition-transform duration-300 hover:rotate-1',
    bounce: 'transition-transform duration-300 hover:animate-bounce'
  };

  return (
    <div className={`${effectClasses[effect]} ${className}`}>
      {children}
    </div>
  );
}

// Loading pulse animation
interface PulseAnimationProps {
  children: React.ReactNode;
  isActive?: boolean;
  className?: string;
}

export function PulseAnimation({ 
  children, 
  isActive = true,
  className = ""
}: PulseAnimationProps) {
  return (
    <div className={`${isActive ? 'animate-pulse' : ''} ${className}`}>
      {children}
    </div>
  );
}

// Smooth height transition
interface SmoothHeightProps {
  children: React.ReactNode;
  isOpen: boolean;
  className?: string;
}

export function SmoothHeight({ 
  children, 
  isOpen,
  className = ""
}: SmoothHeightProps) {
  return (
    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

// Floating action button with animation
interface FloatingButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  className?: string;
}

export function FloatingButton({ 
  children, 
  onClick,
  position = 'bottom-right',
  className = ""
}: FloatingButtonProps) {
  const positionClasses = {
    'bottom-right': 'fixed bottom-6 right-6',
    'bottom-left': 'fixed bottom-6 left-6',
    'top-right': 'fixed top-6 right-6',
    'top-left': 'fixed top-6 left-6'
  };

  return (
    <button
      onClick={onClick}
      className={`
        ${positionClasses[position]}
        bg-indigo-600 hover:bg-indigo-700 text-white
        rounded-full p-4 shadow-lg hover:shadow-xl
        transition-all duration-300 ease-in-out
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-4 focus:ring-indigo-500/50
        z-50
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// Progress bar animation
interface ProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ 
  progress, 
  className = "",
  showLabel = false
}: ProgressBarProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

// Notification toast animation
interface NotificationProps {
  children: React.ReactNode;
  type?: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose?: () => void;
}

export function Notification({ 
  children, 
  type = 'info',
  isVisible,
  onClose
}: NotificationProps) {
  const typeClasses = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  return (
    <div className={`
      fixed top-4 right-4 z-50
      transition-all duration-300 ease-in-out
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className={`
        p-4 rounded-lg border shadow-lg max-w-sm
        ${typeClasses[type]}
      `}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {children}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
