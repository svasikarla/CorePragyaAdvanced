// Accessibility utilities for better keyboard navigation and screen reader support

export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End'
} as const;

// Focus management utilities
export class FocusManager {
  private static focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  static getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(this.focusableSelectors));
  }

  static getFirstFocusableElement(container: HTMLElement): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    return focusableElements[0] || null;
  }

  static getLastFocusableElement(container: HTMLElement): HTMLElement | null {
    const focusableElements = this.getFocusableElements(container);
    return focusableElements[focusableElements.length - 1] || null;
  }

  static trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== KEYBOARD_KEYS.TAB) return;

    const focusableElements = this.getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }

  static restoreFocus(element: HTMLElement | null): void {
    if (element && typeof element.focus === 'function') {
      // Use setTimeout to ensure the element is ready to receive focus
      setTimeout(() => element.focus(), 0);
    }
  }
}

// Screen reader announcements
export class ScreenReaderAnnouncer {
  private static liveRegion: HTMLElement | null = null;

  static initialize(): void {
    if (this.liveRegion) return;

    this.liveRegion = document.createElement('div');
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.setAttribute('aria-relevant', 'text');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-10000px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(this.liveRegion);
  }

  static announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    this.initialize();
    
    if (this.liveRegion) {
      this.liveRegion.setAttribute('aria-live', priority);
      this.liveRegion.textContent = message;
      
      // Clear the message after a short delay to allow for re-announcements
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = '';
        }
      }, 1000);
    }
  }
}

// Keyboard navigation helpers
export function handleArrowNavigation(
  event: KeyboardEvent,
  items: HTMLElement[],
  currentIndex: number,
  onIndexChange: (newIndex: number) => void,
  orientation: 'horizontal' | 'vertical' | 'both' = 'vertical'
): void {
  const { key } = event;
  let newIndex = currentIndex;

  switch (key) {
    case KEYBOARD_KEYS.ARROW_UP:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      break;
    case KEYBOARD_KEYS.ARROW_DOWN:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      }
      break;
    case KEYBOARD_KEYS.ARROW_LEFT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      break;
    case KEYBOARD_KEYS.ARROW_RIGHT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      }
      break;
    case KEYBOARD_KEYS.HOME:
      event.preventDefault();
      newIndex = 0;
      break;
    case KEYBOARD_KEYS.END:
      event.preventDefault();
      newIndex = items.length - 1;
      break;
  }

  if (newIndex !== currentIndex) {
    onIndexChange(newIndex);
    items[newIndex]?.focus();
  }
}

// ARIA helpers
export function generateId(prefix: string = 'element'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getAriaLabel(element: HTMLElement): string {
  return element.getAttribute('aria-label') || 
         element.getAttribute('aria-labelledby') || 
         element.textContent || 
         '';
}

// Color contrast utilities
export function getContrastRatio(color1: string, color2: string): number {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd want a more robust color parsing library
  const getLuminance = (color: string): number => {
    // This is a simplified version - you'd want proper color parsing
    const rgb = color.match(/\d+/g);
    if (!rgb) return 0;
    
    const [r, g, b] = rgb.map(x => {
      const val = parseInt(x) / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

export function meetsWCAGContrast(color1: string, color2: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = getContrastRatio(color1, color2);
  return level === 'AA' ? ratio >= 4.5 : ratio >= 7;
}

// Reduced motion detection
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// High contrast detection
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

// Initialize accessibility features
export function initializeAccessibility(): void {
  ScreenReaderAnnouncer.initialize();
  
  // Add global keyboard event listeners for common patterns
  document.addEventListener('keydown', (event) => {
    // Global escape key handler
    if (event.key === KEYBOARD_KEYS.ESCAPE) {
      // Close any open modals, dropdowns, etc.
      const openModals = document.querySelectorAll('[role="dialog"][aria-hidden="false"]');
      openModals.forEach(modal => {
        const closeButton = modal.querySelector('[aria-label*="close"], [aria-label*="Close"]');
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
      });
    }
  });
}

// Skip link utilities
export function createSkipLink(targetId: string, text: string = 'Skip to main content'): HTMLElement {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded';
  
  return skipLink;
}
