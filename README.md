# VisionTranslate: Real-Time ASL Recognition & Gesture Translation Platform

A client-side American Sign Language (ASL) recognition and translation web application powered by **Google MediaPipe Hands**, mathematical geometric kinematics, and real-time hand skeleton tracking.

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-purple.svg)](https://vitejs.dev/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-teal.svg)](https://developers.google.com/mediapipe)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8.svg)](https://tailwindcss.com/)

---

## 🚀 Key Features

* **Real-Time 21-Point Skeletal Tracking**: Directly tracks all 21 hand joints at 30–60 FPS using MediaPipe WebAssembly (Wasm) in the browser with neon line vectors and glowing joint nodes.
* **Scale- & Translation-Invariant 73D Geometric Classifier**:
  * 63 wrist-relative coordinates normalized by the wrist-to-middle-knuckle scale factor.
  * 5 finger extension ratios (tip-to-wrist vs. knuckle-to-wrist).
  * 5 inter-finger spread distances.
* **Hybrid Similarity Engine**: Combines **Cosine Similarity (55%)** with **Normalized Exponential Euclidean Similarity (45%)** for high-precision recognition.
* **Zero Phantom Predictions**: Recognition is strictly bound to signs recorded in the user's personal library.
* **5-Second Transition Time Breaker**: Automatic 5-second cooldown between recognized signs with an under-camera countdown progress bar and a "Ready now ⚡" skip button to eliminate accidental transitional gestures.
* **Multi-Tiered Hybrid Storage**:
  * **IndexedDB (`ASLTranslateDB`)**: Stores high-resolution video blobs without browser 5MB `localStorage` crashes.
  * **Disk Persistence (`library-data.json`)**: Auto-syncs enrolled signs to disk via Vite middleware, ensuring recordings survive browser restarts and cache clearing.
* **5-Sample Library Builder**: Requires only 5 recorded video takes per sign to achieve high-confidence recognition (~100%).
* **Audio Synthesis & Export**: Text-to-speech engine and one-click clipboard copying.

---

## 🛠️ Architecture & Mathematical Formulation

### 1. 21-Point Skeletal Joint Model
MediaPipe models 21 key landmarks per hand:
* **Wrist**: Landmark 0 (Anchor origin $L_0$)
* **Thumb**: Landmarks 1–4
* **Index**: Landmarks 5–8
* **Middle**: Landmarks 9–12
* **Ring**: Landmarks 13–16
* **Pinky**: Landmarks 17–20

### 2. Feature Extraction Vector ($\mathbb{R}^{73}$)
$$\vec{V} = \Big[ \vec{P}_{\text{norm}} \;(63), \quad \vec{R}_{\text{ext}} \;(5), \quad \vec{S}_{\text{spread}} \;(5) \Big]$$

* **Scale Factor ($s$)**: Euclidean distance from wrist ($L_0$) to Middle Finger Knuckle ($L_9$):
  $$s = \sqrt{(x_9 - x_0)^2 + (y_9 - y_0)^2 + (z_9 - z_0)^2}$$
* **Normalized Coordinates**:
  $$x_i^{\text{norm}} = \frac{x_i - x_0}{s}, \quad y_i^{\text{norm}} = \frac{y_i - y_0}{s}, \quad z_i^{\text{norm}} = \frac{z_i - z_0}{s}$$
* **Finger Extension Ratio**:
  $$R_f = \frac{\text{dist}(L_{\text{tip}}, L_0)}{\text{dist}(L_{\text{mcp}}, L_0)}$$

### 3. Hybrid Gesture Similarity
$$\text{Similarity} = 0.55 \cdot \text{Sim}_{\text{cos}}(\vec{A}, \vec{B}) + 0.45 \cdot e^{-1.8 \cdot d_{\text{mean}}}$$

---

## 📦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* A modern web browser with webcam access (Chrome, Edge, Firefox, Brave)

### Installation
```bash
# Clone the repository
git clone https://github.com/Stevespalakalam/ASL-detector.git
cd ASL-detector

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open `http://localhost:3000` (or the port displayed in your terminal) in your browser.

---

## 📁 Project Structure

```
├── components/
│   ├── LibraryPage.tsx       # Sign library viewer, take counter, and delete controls
│   ├── RecordPage.tsx        # Camera recording studio with live 21-joint tracking
│   ├── TranslatePage.tsx     # Real-time translation, transition HUD, and transcript
│   ├── Navbar.tsx            # Navigation header
│   └── Button.tsx            # Styled UI components
├── services/
│   ├── gestureService.ts     # 73D feature extraction, Cosine/Euclidean math, template aggregation
│   ├── dataService.ts        # IndexedDB + localStorage + disk sync management
│   └── geminiService.ts      # Multi-take confidence scoring and translation bridge
├── types.ts                  # TypeScript interfaces (Landmark, Sign, Take, MatchResult)
├── constants.ts              # System defaults (MIN_SAMPLES = 5, CONFIDENCE_THRESHOLD = 0.80)
├── vite.config.ts            # Vite config with custom REST endpoint for library-data.json
└── package.json              # Project dependencies and build scripts
```

---

## 🎓 College Defense & Viva Summary

* **Why not CNNs?** Standard pixel CNNs are sensitive to lighting and background noise and require heavy GPUs. MediaPipe extracts kinematic 3D skeletons on CPU WebAssembly in $<20\text{ms}$, and our geometric similarity classifier runs with zero latency.
* **Why the 5-second transition breaker?** Prevents in-between hand repositioning postures from falsely triggering duplicate or incorrect signs.
* **Where is data stored?** Browser **IndexedDB** (`ASLTranslateDB`) for large client-side binary takes, plus a server-assisted sync to **`library-data.json`** on the local hard drive for permanent persistence.

---

## 📄 License
This project is open-source and available under the MIT License.
