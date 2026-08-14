---
name: transitions-dev
description: Collection of essential, production-ready micro-interactions, CSS transitions, spring tokens, and animation patterns for web applications.
---

# Transitions.dev Skill & Motion Design System

This skill provides production-grade motion tokens, easing functions, and interaction patterns based on `Jakubantalik/transitions.dev`.

## Core Easing Tokens

```css
:root {
  /* Fast micro-interactions: toggles, button presses */
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
  --duration-snappy: 150ms;

  /* Natural UI layout shifts: card expands, drawer opens */
  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-normal: 250ms;
  --duration-smooth: 400ms;

  /* Smooth fades & glows */
  --ease-fluid: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-ambient: 800ms;
}
```

## Essential Interaction Patterns

### 1. Tactile Button & Card Press
```css
.tactile-interactive {
  transition: transform var(--duration-snappy) var(--ease-snappy),
              box-shadow var(--duration-snappy) var(--ease-snappy),
              border-color var(--duration-snappy) var(--ease-snappy),
              background-color var(--duration-snappy) var(--ease-snappy);
}

.tactile-interactive:hover {
  transform: translateY(-1px);
}

.tactile-interactive:active {
  transform: translateY(1px) scale(0.985);
}
```

### 2. Smooth Tab & View Reveal
```css
@keyframes viewReveal {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.995);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.animate-view-reveal {
  animation: viewReveal var(--duration-smooth) var(--ease-spring) forwards;
}
```

### 3. Metric Pop-in Counter
```css
@keyframes metricPop {
  0% { transform: scale(0.92); opacity: 0.5; }
  60% { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}

.animate-metric-pop {
  animation: metricPop var(--duration-normal) var(--ease-spring);
}
```
