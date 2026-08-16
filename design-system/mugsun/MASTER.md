# Design System Master File

> **本项目适配说明（2026-08-12）：** 下方配色/字体为技能通用推荐，**不适用于本仓库**。mugsun-pc 已有成熟设计令牌（Element Plus + `src/assets/styles/core/` 明暗双主题覆盖层），全站优化以既有令牌为准，**禁止更换主题色/字体体系**。本文件仅 UX 准则部分（加载/空态/错误/表单/表格/可达性/对比度/动效 150–300ms）作为审查清单生效。

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`. If that file exists, its rules **override** this Master file. If not, strictly follow the rules below.

---

**Project:** mugsun **Generated:** 2026-08-11 23:36:18 **Category:** B2B Service **Design Dials:** Density 7/10 (Standard)

---

## Global Rules

### Color Palette

| Role        | Hex       | CSS Variable          |
| ----------- | --------- | --------------------- |
| Primary     | `#7C3AED` | `--color-primary`     |
| On Primary  | `#FFFFFF` | `--color-on-primary`  |
| Secondary   | `#A78BFA` | `--color-secondary`   |
| Accent/CTA  | `#EC4899` | `--color-accent`      |
| Background  | `#FAF5FF` | `--color-background`  |
| Foreground  | `#4C1D95` | `--color-foreground`  |
| Muted       | `#ECEEF9` | `--color-muted`       |
| Border      | `#DDD6FE` | `--color-border`      |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring        | `#7C3AED` | `--color-ring`        |

**Color Notes:** Builder purple + component pink + canvas neutral

### Typography

- **Heading Font:** Fira Code
- **Body Font:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Google Fonts:** [Fira Code + Fira Sans](https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**

```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

_Density: 7/10 — Standard_

| Token         | Value             | Usage                     |
| ------------- | ----------------- | ------------------------- |
| `--space-xs`  | `4px` / `0.25rem` | Tight gaps                |
| `--space-sm`  | `8px` / `0.5rem`  | Icon gaps, inline spacing |
| `--space-md`  | `16px` / `1rem`   | Standard padding          |
| `--space-lg`  | `24px` / `1.5rem` | Section padding           |
| `--space-xl`  | `32px` / `2rem`   | Large gaps                |
| `--space-2xl` | `48px` / `3rem`   | Section margins           |
| `--space-3xl` | `64px` / `4rem`   | Hero padding              |

### Shadow Depths

| Level         | Value                          | Usage                       |
| ------------- | ------------------------------ | --------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)`   | Subtle lift                 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)`    | Cards, buttons              |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)`  | Modals, dropdowns           |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #ec4899;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #7c3aed;
  border: 2px solid #7c3aed;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #faf5ff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #7c3aed;
  outline: none;
  box-shadow: 0 0 0 3px #7c3aed20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Trust & Authority

**Keywords:** Certificates/badges displayed, expert credentials, case studies with metrics, before/after comparisons, industry recognition, security badges

**Best For:** Healthcare/medical landing pages, financial services, enterprise software, premium/luxury products, legal services

**Key Effects:** Badge hover effects, metric pulse animations, certificate carousel, smooth stat reveal

### Page Pattern

**Pattern Name:** Trust & Authority + Conversion

- **Conversion Strategy:** Security badges. Case studies. Transparent pricing. Low-friction form.
- **CTA Placement:** Contact Sales / Get Quote (primary) + Nav
- **Section Order:** 1. Hero (mission/credibility), 2. Proof (logos, certs, stats), 3. Solution overview, 4. Clear CTA path

---

## Anti-Patterns (Do NOT Use)

- ❌ Playful design
- ❌ Hidden credentials
- ❌ AI purple/pink gradients

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
