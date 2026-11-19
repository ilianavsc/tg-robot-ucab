---
name: Autonomous Laboratory Cockpit
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e0fdff'
  on-primary: '#00373a'
  primary-container: '#00f2fe'
  on-primary-container: '#006a70'
  inverse-primary: '#00696f'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#e1ffec'
  on-tertiary: '#003824'
  tertiary-container: '#67f4b7'
  on-tertiary-container: '#006e4b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  telemetry-lg:
    fontFamily: JetBrains Mono
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  telemetry-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  telemetry-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.04em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-tablet: 1rem
  margin: 1rem
  margin-tablet: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system establishes a high-performance, dark-mode engineering cockpit interface for the TG Robot UCAB mobile control suite. The interface is engineered for lab technicians, robotics researchers, and field engineers operating in rigorous, low-light, or high-glare research environments.

### Core Tenets
- **Mission-Critical Precision:** Every indicator, telemetry read-out, and navigation element must provide instant legibility and uncompromised real-time status recognition.
- **Cockpit Instrumentation Aesthetic:** Combines Material Design 3 structural primitives with industrial telemetry consoles—incorporating subtle edge-lit luminescence, sharp contrast boundaries, and monospaced diagnostic matrices.
- **Fail-Safe Tactility:** High-stakes operations (Emergency Stops, path rerouting, motor engages) feature deliberate tactile depth, explicit actuation barriers, and state persistence to prevent accidental inputs.

## Colors

The palette leverages a deep obsidian and midnight slate framework that anchors the cockpit, allowing energized spectral accents to convey operational states and dynamic telemetry immediately.

### Key Roles
- **Primary (`#00F2FE`):** Cyber Teal. Serves as the active telemetry trace, focused input stroke, primary state confirmation, and prominent navigation indicator.
- **Secondary (`#3B82F6`):** Electric Cobalt. Governs secondary instrumentation, system utilities, sensor diagnostics, and data stream indicators.
- **Tertiary (`#10B981`):** Autonomous Emerald. Represents optimal system health, nominal path tracing, active power flow, and calibrated sensors.
- **Neutral Dark Canvas (`#0D1117` to `#161B22`):** Midnight Obsidian base canvas, minimizing screen glare and reducing visual fatigue in subterranean or darkened cleanroom environments.
- **Critical & Hazard Alerts:**
  - **Critical Failure / E-Stop (`#EF4444` / `#DC2626`):** Reserved exclusively for collision warnings, motor lockouts, thermal overload, and manual overrides.
  - **Cautionary / Warning (`#F59E0B`):** Denotes payload shift warnings, degraded LIDAR signals, low battery thresholds, and communication latency spikes.

### Surface Elevation & Border Colors
- **Surface Level 0 (Base Canvas):** `#0D1117`
- **Surface Level 1 (Container / Card):** `#161B22`
- **Surface Level 2 (Instrument Wells / Nested Data):** `#1F2937`
- **Surface Level 3 (Modal / Elevated Control):** `#2D3748`
- **Outline / Border Glow Stroke:** `#374151` with stateful transitions to `rgba(0, 242, 254, 0.35)` on active telemetry focus.

## Typography

The typographic hierarchy utilizes a dual-engine architecture:
1. **Inter** handles high-level telemetry groupings, cockpit headings, navigational commands, and descriptive content with neutral legibility.
2. **JetBrains Mono** anchors all raw telemetry feeds, coordinate matrices, motor RPM readings, battery status percentages, and hardware log streams. Its fixed-width character alignment eliminates layout shift during volatile metric changes.

### Usage Guidelines
- Apply uppercase styling to `telemetry-sm` and `label-md` when labelling diagnostic groups or operational modes (e.g., `SYS_STATUS`, `VELOCITY_X`, `BATTERY_HEALTH`).
- Maintain numerical tabular figures across all instrumentation readouts to prevent visual jitter when variables update at 60Hz.

## Layout & Spacing

The layout is built around a dense, high-utility fluid grid designed for rapid thumb interactions and one-handed telemetry sweeps on mobile devices.

### Breakpoints & Geometry
- **Mobile Handheld (360px – 599px):** 4-column layout, compact `margin: 1rem`, `gutter: 0.75rem`. Controls prioritize low-reach ergonomics. Primary actuators sit within the lower 40% of the viewport.
- **Tablet / Mounted Cradle (600px – 1024px):** 8-column layout, `margin-tablet: 1.5rem`, `gutter-tablet: 1rem`. Dynamic split-screen dividing real-time LiDAR/camera feeds on the primary panel from motor diagnostics and task queues on the secondary panel.

### Spatial Rhythms
- Use strict 4px/8px modular units for padding inside telemetry cells to maintain high information density without visual crowding.
- Maintain a minimum 48px touch-target bounding box for all interactive cockpit controls, even if visual pill or switch indicators are more compact.

## Elevation & Depth

Visual hierarchy operates through layered chromatic depth and luminance boundaries rather than heavy drop shadows:

1. **Surface Layering:** 
   - Base workspace: `#0D1117`.
   - Structural dashboard cards: `#161B22` container with a fine 1px border of `#374151`.
   - Recessed telemetry monitors / camera feeds: `#111827` with inset highlights.
2. **Luminescent Glow Borders:**
   - Active, focused, or operational cards project an ambient border glow: `0 0 12px rgba(0, 242, 254, 0.20)` alongside a 1px border of `#00F2FE`.
   - Hazard states emit an emergency pulse: `0 0 16px rgba(239, 68, 68, 0.35)` with a 1px `#EF4444` border.
3. **Elevation Cast (Modals & Overlays):**
   - E-Stop sheets and emergency diagnostics float at Level 3 (`#1F2937`) over a 75% dark `#0D1117` backdrop blur, using an ambient shadow: `0 12px 32px rgba(0, 0, 0, 0.65)`.

## Shapes

The interface employs a disciplined, industrial shape language (`roundedness: 1` — Soft, 4px base radius). This reflects ruggedized field tablet hardware, resisting decorative roundness in favor of clear structural boundaries.

- **Base Radii:** 
  - Standard cards, telemetry cells, and terminal viewports: `0.25rem` (4px).
  - Surface modals and primary control groups: `rounded-lg` (8px).
  - Floating action buttons, status pills, and toggle indicators: `rounded-xl` (12px) or full capsule geometry where instantaneous status scanning is mandatory.

## Components

### 1. Actuation Buttons & Tactical Triggers
- **Primary Control Button:** High-contrast background filled with `#00F2FE`, foreground text `#0D1117` (Inter 600). Pressed state transitions to an intense inner cyan glow with active scale `0.98`.
- **Secondary Instrumentation Button:** Outlined style with `#1F2937` background, 1px border `#374151`, and text `#3B82F6`. Hover/focus activates `#3B82F6` border glow.
- **E-Stop (Emergency Stop):** Permanent floating bottom anchor or dedicated header zone. `#DC2626` background, heavy high-contrast white monospaced label (`EMERGENCY STOP`), accompanied by a persistent pulsing hazard outline. Requires a physical hold-and-confirm interaction pattern.

### 2. Telemetry Cards & Metric Cells
- Constructed with `#161B22` background and a 1px `#374151` boundary.
- **Top Row:** Uppercase JetBrains Mono label (`telemetry-sm`) in `#9CA3AF` paired with sensor status indicator dot (Green: Operational, Amber: Throttled, Red: Offline).
- **Center Row:** Large tabular readout (`telemetry-lg`) in high-contrast `#FFFFFF` or `#00F2FE`.
- **Footer Row:** Sparkline or delta vector rendered in `#3B82F6` or `#10B981`.

### 3. Status Pills & State Badges
- Pill-shaped capsule (`border-radius: 9999px`) featuring a dual structure: 6px circular glowing node on the left, followed by concise JetBrains Mono state text on the right (e.g., `AUTONOMOUS`, `TELEOP`, `MANUAL_OVERRIDE`).
- Translucent backdrop tint derived from the state color at 15% opacity, bounded by a 1px matching stroke at 40% opacity.

### 4. Interactive Industrial Sliders & Joysticks
- **Virtual Control Stick:** Embedded within an inset circular well (`#111827`) with concentric coordinate rings in `#1F2937`. Central control knob rendered in `#1F2937` with a cyan-illuminated center nexus.
- **Parameter Sliders (Throttle, Sensitivity):** Thick 8px track in `#1F2937` with an energized filled segment in `#00F2FE`. 24px wide tactile rounded thumb with knurled visual ridges for firm grip feedback.

### 5. Input Fields & Diagnostic Consoles
- Flat obsidian fill (`#111827`), inset 1px stroke (`#374151`), JetBrains Mono text entry.
- On focus: Active border shifts cleanly to `#00F2FE` with zero layout jumping.

### 6. MD3 Navigation Bar
- Docked flush at the screen bottom in `#111827` with a top 1px dividing border `#1F2937`.
- Active item uses an illuminated cyan capsule indicator with an obsidian icon, paired with an uppercase monospaced sub-label.