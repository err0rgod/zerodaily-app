# ZeroDaily Mobile App (`zerodaily-app`)

[![CI](https://github.com/zerodaily/zerodaily-app/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Build Android](https://github.com/zerodaily/zerodaily-app/actions/workflows/build-android.yml/badge.svg)](.github/workflows/build-android.yml)
[![Expo](https://img.shields.io/badge/Expo-52.0+-black.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)

An **Inshorts-style vertical gesture news reader** for tech professionals, delivering 60-word roasted summaries across 6 tech domains.

Built with **React Native / Expo** with full offline caching, 0ms cold-boot renders, background prefetching, client-side FCM topic subscriptions, and **100% Cloud-based CI/CD compilation** via GitHub Actions.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN Edge                      │
│        api.zerodaily.in       |     media.zerodaily.in      │
└──────────────────────┬────────┴──────────────┬──────────────┘
                       │                       │
              JSON Feed & Articles        WebP 800px Assets
                       │                       │
                       ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 ZeroDaily Mobile Client                     │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │            CardSwiper (Vertical Pager)              │   │
│   │  • Full screen card snapping (60/120 FPS)           │   │
│   │  • N-8 Prefetch Engine (fetches ahead at card 12)   │   │
│   │  • WebP Image Pre-caching in disk memory            │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Local Storage Layer (Offline-First)       │   │
│   │  • 0ms cold-boot render from local disk             │   │
│   │  • Automatic background synchronization             │   │
│   │  • Bookmarked stories offline storage               │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │             FCM Topic Push Architecture             │   │
│   │  • Client-managed subscriptions (0 server tokens)   │   │
│   │  • topic_breaking_all & topic_{category}            │   │
│   │  • Deep link routing directly to breaking story     │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Layout

```text
zerodaily-app/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Automated TypeScript check and tests on push/PR
│       └── build-android.yml         # Cloud runner compilation (outputs standalone APK)
├── assets/                           # App icons, splash screens, notification monochrome icons
├── scripts/
│   └── generate_assets.py            # Automated asset synthesis script
├── src/
│   ├── api/
│   │   ├── client.ts                 # Resilient HTTP client with timeout & mock fallback
│   │   ├── endpoints.ts              # API routes matching D:/zerodaily/Docs.md
│   │   └── mockData.ts               # Offline and preview roasted tech stories
│   ├── components/
│   │   ├── common/
│   │   │   ├── Badge.tsx             # Thematic glowing category badges
│   │   │   ├── Header.tsx            # App bar with live terminal status dot & actions
│   │   │   └── IconButton.tsx        # Tactile buttons with haptic feedback
│   │   ├── feed/
│   │   │   ├── CardSwiper.tsx        # Vertical paging engine with snap alignment
│   │   │   ├── CategoryPills.tsx     # Horizontal category switcher
│   │   │   └── NewsCard.tsx          # 60-word headline card with WebP hero image
│   │   ├── modals/
│   │   │   ├── BookmarksModal.tsx    # Saved offline stories manager
│   │   │   ├── FullRoastModal.tsx    # Slide-up modal with complete analytical roast
│   │   │   ├── NotificationModal.tsx # Breaking push alerts history inbox
│   │   │   └── SettingsModal.tsx     # FCM topic subscription toggles
│   │   └── webview/
│   │       └── ArticleReader.ts      # Native Chrome Custom Tabs / Safari reader
│   ├── constants/
│   │   ├── categories.ts             # Category taxonomy & FCM topic mappings
│   │   └── theme.ts                  # Dark cyber-hacker design tokens
│   ├── hooks/
│   │   └── useNotifications.ts       # Android notification channel & deep linking
│   ├── store/
│   │   ├── bookmarkStore.ts          # Offline saved stories store
│   │   ├── feedStore.ts              # Feed state, 0ms cache, cursor pagination & N-8 rule
│   │   └── settingsStore.ts          # User notification preferences
│   ├── types/
│   │   └── index.ts                  # Strict TypeScript interfaces
│   └── utils/
│       ├── date.ts                   # Relative time formatter ("18m ago")
│       └── share.ts                  # Native share sheet helper
├── App.tsx                           # Main application coordinator
├── app.json                          # Expo configuration manifest
├── eas.json                          # EAS Cloud Build configuration
├── index.ts                          # Expo entry point
├── notification-arch.md              # Client push notification contract
└── package.json                      # Dependencies and scripts
```

---

## Cloud CI/CD Build Pipeline (Zero Laptop Compiling Load)

To prevent your laptop from running heavy Android SDK / Gradle compilations, **all APK builds execute in GitHub Actions in the cloud**:

### How It Works:
1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "feat: inshorts feed engine"
   git push origin main
   ```
2. Open your repository on GitHub and click **Actions** → **Build Android APK (Cloud CI)**.
3. Click **Run workflow**, choose `debug` or `release`, and run.
4. The Ubuntu cloud runner will:
   - Setup Java 17 and Android SDK.
   - Run `npx expo prebuild`.
   - Compile `./gradlew assembleDebug` (or `assembleRelease`).
   - Produce a standalone `.apk` and upload it directly as an artifact!
5. **Download the APK directly to your phone from GitHub Actions.**

---

## Local Development (Lightweight Web / Preview)

Run the lightweight dev server without building any native binaries:

### 1. Start Expo Web
```bash
npm run web
```
Opens in your browser instantly at `http://localhost:8081` with live reloading.

### 2. Test in Expo Go (Mobile Phone)
```bash
npx expo start
```
Scan the QR code using the **Expo Go** app on Android or iOS.

---

## Supported Tech Categories & FCM Topics

| Category | Key | Color | FCM Topic String | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Top Feed** | `all` | Emerald (`#10B981`) | `topic_breaking_all` | Unified feed across all 7 domains. |
| **Cybersecurity** | `cybersec` | Red (`#EF4444`) | `topic_cybersec` | Zero-days, CVEs, breach alerts. |
| **Artificial Intelligence** | `ai` | Violet (`#A855F7`) | `topic_ai` | Frontier LLMs, benchmark disruptions. |
| **Software Engineering** | `programming` | Emerald (`#10B981`) | `topic_programming` | Runtimes, kernel bugs, developer culture. |
| **Robotics** | `robotics` | Amber (`#F59E0B`) | `topic_robotics` | Humanoid milestones, automation. |
| **Defense & Aerospace** | `defense_aerospace` | Cyan (`#06B6D4`) | `topic_defense_aerospace` | Orbital tests, hypersonics, defense tech. |
| **Hardware & Silicon** | `hardware` | Copper (`#F97316`) | `topic_hardware` | Transistor tape-outs, GPUs, packaging. |
| **Finance** | `finance` | Teal (`#14B8A6`) | `topic_finance` | Fintech, algorithmic trading, crypto, venture capital. |

---

## Inshorts Swiper Algorithm & Optimization

Conforming to [D:/zerodaily/Docs.md](file:///D:/zerodaily/Docs.md#L340-L358):
1. **0ms Cold Boot**: Feed immediately loads from local disk cache (`AsyncStorage`). No spinners or blank screens on launch.
2. **Background Sync**: Silently queries `GET /api/v1/feed` and updates cache if new articles exist.
3. **N - 8 Prefetch Rule**: When the user scrolls to card `N - 8` (e.g. Card 12 in a 20-card batch), the app automatically triggers the next cursor fetch (`next_cursor`) and pre-downloads the next batch of WebP hero images.
4. **Hardware-Accelerated WebP Decoding**: Images are handled via `expo-image` with disk caching and fast decoding.
