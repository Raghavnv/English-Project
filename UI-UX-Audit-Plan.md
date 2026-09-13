# UI/UX & Frontend Architecture Audit: EnglishBridge

Based on **UI/UX Pro Max** guidelines, WCAG 2.1 accessibility standards, and modern frontend architecture patterns, here is a comprehensive audit and action plan for the `platform` codebase.

---

## 1. Audit Findings

### 🔴 Contrast Issues
*   **Muted Text on Semi-transparent Backgrounds:** Classes using `color: var(--muted)` on top of `rgba(255,255,255,0.65)` (like the `.modal-cancel` button) risk falling below the WCAG AA `4.5:1` contrast ratio for normal text.
*   **Lightning Modal Hierarchy:** The `#854d0e` text on the `#fef08a` gradient background is legible, but hover states using semi-transparent overlays can dip below acceptable contrast thresholds. 
*   **Placeholder Text:** Custom inputs (`.feature-input`) often rely on default placeholder colors which fail the `4.5:1` ratio against white backgrounds.

### 🔴 Missing ARIA Labels (Icon/Emoji Buttons)
*   **`#roleplayMicBtn` and `#pronunciationMicBtn`:** These use the raw `🎤` emoji with no accessible name. Screen readers will literally read "Microphone", but fail to describe the action.
    *   *Fix:* Add `aria-label="Start speaking"` and wrap emojis in `<span aria-hidden="true">` to prevent redundant reading. Emojis should ideally be replaced with consistent Phosphor/SVG icons per UI/UX Pro Max rules.
*   **Modal Close Buttons (`✕`):** Buttons like `#closeAnalysisModalBtn` and `.ai-modal-close` lack `aria-label="Close dialog"`.

### 🔴 Mobile Touch-Target Gaps
*   **Modal Actions (`.modal-cancel`, `.modal-confirm`):** Currently set to `min-height: 40px`. iOS/WCAG standard requires a minimum of **44x44pt** (48dp for Android). 
*   **Close Buttons:** `#closeAnalysisModalBtn` is hardcoded to `width: 32px; height: 32px;`, making it exceptionally difficult to tap on mobile devices.

---

## 2. Design Token System (CSS Architecture)

To resolve inconsistencies and enforce spacing rhythms (4pt/8pt grid) and semantic colors, replace the current fragmented variables with a strict token system in `platform.css`.

```css
:root {
  /* 🎨 Color Tokens */
  --color-primary-100: #e0e7ff;
  --color-primary-500: #4f46e5; /* var(--accent) */
  --color-primary-700: #3730a3; /* var(--accent-deep) */
  
  --color-surface-base: #ffffff;
  --color-surface-muted: #f9fafb;
  --color-surface-glass: rgba(255, 255, 255, 0.75);
  
  --color-text-base: #111827; /* Contrast >= 4.5:1 */
  --color-text-muted: #4b5563; /* Contrast >= 4.5:1 */
  --color-text-invert: #ffffff;
  
  --color-danger-500: #ef4444;
  --color-danger-glass: rgba(239, 68, 68, 0.1);

  /* 📏 Spacing Tokens (8pt Grid) */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-6: 1.5rem;   /* 24px */
  --space-8: 2rem;     /* 32px */
  --space-12: 3rem;    /* 48px */

  /* 🖋 Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  
  /* 💠 Interaction & Elevation */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.05);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.08);
  --shadow-glass: 0 8px 32px rgba(31, 26, 22, 0.08);
  --transition-bounce: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
```

---

## 3. File-by-File Refactor Action Plan

### A. `platform.css` (Component Refactors)

**1. The Audio-Pulse Animation:**
*Problem:* Modifying `transform: scale()` directly on the button causes layout jitter and distorts the icon.
*Fix:* Use a `box-shadow` ripple to keep the interaction target stable.
```css
/* Replace old ai-pulse */
.mic-btn.is-listening {
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
  70% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
}
```

**2. Flashcard Flip Physics:**
*Problem:* Inline inline JS flips (`rotateY(180deg)`) are hard to maintain and lack proper focus states.
*Fix:* Class-based toggling with better 3D depth.
```css
.ai-card-inner {
  position: relative;
  width: 100%; height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
  cursor: pointer;
}
.ai-card-inner.is-flipped {
  transform: rotateY(180deg);
}
.card-face-front, .card-face-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 24px;
}
.card-face-back {
  transform: rotateY(180deg);
}
```

### B. `platform.html` (Accessibility Refactors)

**1. Modal Conversions:**
Instead of `div.modal-overlay` with manual pointer-events, migrate to the native HTML5 `<dialog>` element. It automatically traps keyboard focus, handles z-index, and provides an accessible backdrop.
```html
<!-- OLD -->
<div class="modal-overlay" id="lightningModal">...</div>

<!-- NEW -->
<dialog id="lightningModal" class="native-modal">
  <div class="modal-box">
    <button aria-label="Close dialog" onclick="this.closest('dialog').close()" class="btn-close">
      <span aria-hidden="true">✕</span>
    </button>
    <!-- content -->
  </div>
</dialog>
```

**2. ARIA Buttons:**
```html
<!-- OLD -->
<button id="roleplayMicBtn" onclick="toggleRoleplayMic()">🎤</button>

<!-- NEW -->
<button 
  id="roleplayMicBtn" 
  onclick="toggleRoleplayMic()" 
  aria-label="Start voice recording" 
  aria-pressed="false"
  style="min-width: 44px; min-height: 44px;"
>
  <svg aria-hidden="true" ...><!-- Use vector mic icon instead of emoji --></svg>
</button>
```

### C. `platform.js` (Interaction Logic)

**1. Flashcard Flipping:**
```javascript
// Replace inline transform styling:
window.flipSrsCard = function() {
  const cardInner = document.getElementById('srsCardInner');
  // Use class toggling instead of direct style manipulation
  cardInner.classList.toggle('is-flipped');
}
```

**2. Native Modal Handlers:**
```javascript
// Replace manual opacity / display logic
function openLightningModal() {
  const dialog = document.getElementById("lightningModal");
  dialog.showModal(); // Automatically handles backdrop and focus trapping
}

function closeLightningModal() {
  const dialog = document.getElementById("lightningModal");
  dialog.close();
}

// Close on backdrop click (standard UX pattern)
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', (e) => {
    const dialogDimensions = dialog.getBoundingClientRect();
    if (
      e.clientX < dialogDimensions.left ||
      e.clientX > dialogDimensions.right ||
      e.clientY < dialogDimensions.top ||
      e.clientY > dialogDimensions.bottom
    ) {
      dialog.close();
    }
  });
});
```
