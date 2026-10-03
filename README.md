# ZeroDaily Mobile — Tech News, Roasted to Perfection

[![CI](https://github.com/err0rgod/zerodaily-app/actions/workflows/ci.yml/badge.svg)](https://github.com/err0rgod/zerodaily-app/actions/workflows/ci.yml)
[![Build Android](https://github.com/err0rgod/zerodaily-app/actions/workflows/build-android.yml/badge.svg)](https://github.com/err0rgod/zerodaily-app/actions/workflows/build-android.yml)
[![Expo](https://img.shields.io/badge/Expo-52.0+-black.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)

**ZeroDaily** is an Inshorts-style vertical gesture news reader built for engineers, hackers, and tech enthusiasts who want the signal without the noise.

No clickbait filler. No 30-minute podcast recaps. No sanitized corporate PR. Just the day's biggest breakthroughs, security meltdowns, and AI drama delivered in razor-sharp, **60-word roasted cards** with biting satirical wit.

---

## Core Features & Architecture

### 1. Vertical Gesture Swiper (60/120 FPS)
- **Fluid PanResponder Navigation**: Smooth tactile snap alignment. Swipe up to advance; swipe down to revisit previous cards.
- **Dwell Time Intelligence**: Tracks natural reading dwell times (2.0s threshold) to train local category weights without third-party ad telemetry.
- **Zero-Spinner Experience**: 0ms cold-boot renders directly from device storage. Predictive background prefetching loads images and stories ahead of your swipe.

### 2. Local-First Read Tracking (`@zerodaily_read_history`)
- **Never See the Same Story Twice**: Articles read for $\ge 2.0\text{s}$ or opened in "Full Roast" are automatically marked as read and filtered out from future swiper buffers.
- **$O(1)$ Synchronous Memory Cache**: Maintains an in-memory `Set<string>` of read IDs for instantaneous card rendering without async AsyncStorage delays.
- **Buffer Auto-Fill**: When the unread buffer drops below 10 cards, the app silently triggers a background cursor fetch to replenish the queue.
- **Graceful "All Caught Up" Fallback**: When all available stories in the database have been consumed, the app gracefully falls back to recent stories rather than displaying an empty screen.

### 3. Diverse Interleaving & Anti-Clumping Engine
- **No Category Clumping**: Enforces an anti-clumping rule where no more than 1 consecutive card from the same category is served, permanently preventing batch bursts (e.g. morning market opens) from dominating the feed.
- **Decay Half-Life + Category Affinities**: Blends the user's `algo_weights` with an exponential 24-hour decay half-life ($e^{-\Delta t / 24\text{h}}$).
- **Discovery Rate**: Injects a controlled ~18% exploration probability to surface high-signal stories from other subscribed domains.

### 4. Push Notification CTR & Downstream Retention Tracking
- **Click-Through Rate (CTR)**: Tapping a breaking alert banner immediately fires a `notification_open` beacon and deep-links directly to the story card.
- **Downstream Retention Tracker (`notificationSessionTracker`)**:
  - Tracks the exact dwell duration of the session initiated by the push notification.
  - Monitors card swipes via `CardSwiper` to count how many subsequent stories the user reads.
  - Auto-flushes a `notification_session_complete` beacon with dwell time and swipe count when the app is backgrounded (`AppState`).
- **Account Telemetry**: Automatically forwards the authenticated user's JWT token so engagement increments their profile `reading_count` and updates their reading history.

### 5. Android 13+ Push Notification Architecture
- **Runtime Permissions**: Uses `android.permission.POST_NOTIFICATIONS` in `app.json` to properly prompt on Android 13, 14, and 15.
- **FCM Topic Broadcast**: Automatically maps category subscriptions to Firebase Cloud Messaging topics (`topic_cybersec`, `topic_ai`, `topic_programming`, etc.) for zero-cost, real-time broadcasts.

---

## 7 High-Octane Tech Channels

| Key | Channel | Description |
| :--- | :--- | :--- |
| `all` | 🔥 **Hot Stories** | Top trending tech news across all 7 channels |
| `cybersec` | 🛡️ **Cybersecurity** | Zero-days, ransomware debacles, and infrastructure breaches |
| `ai` | 🤖 **Artificial Intelligence** | LLM benchmark wars, reasoning models, and agent architectures |
| `programming` | 💻 **Software Engineering** | Runtimes, tooling wars, framework churn, and dev culture |
| `robotics` | 🦾 **Robotics** | Humanoids, industrial automation, and robotic systems |
| `defense_aerospace` | 🚀 **Defense & Aerospace** | Hypersonics, satellite swarms, and space tech |
| `hardware` | ⚡ **Hardware & Chips** | TSMC fabrication, GPUs, silicon architectures, and quantum chips |
| `finance` | 📈 **Markets & Finance** | Tech earnings, venture capital funding, and crypto volatility |

---

## Getting the App

### Option A: Download Standalone Android APK
Pre-compiled APKs signed with our cryptographic release keystore are automatically generated via GitHub Actions:

1. Head over to the **[Releases](https://github.com/err0rgod/zerodaily-app/releases)** section.
2. Download the latest `ZeroDaily.apk`.
3. Install directly on your Android phone and start swiping.

### Option B: Run Locally with Expo

1. **Clone the repository**:
   ```bash
   git clone https://github.com/err0rgod/zerodaily-app.git
   cd zerodaily-app
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Expo development server**:
   ```bash
   npx expo start
   ```

4. Scan the QR code using the **Expo Go** app or run directly on an emulator:
   ```bash
   npm run android
   ```

---

## Project Structure

```text
zerodaily-app/
├── credentials/              # Persistent release keystore (matches Firebase SHA-1)
├── src/
│   ├── api/                  # API client, endpoints, and Firebase Auth Identity Toolkit integration
│   ├── components/
│   │   ├── common/           # Header, glowing badges, tactile buttons, error states
│   │   ├── feed/             # CardSwiper vertical pager & 60-word NewsCard
│   │   └── modals/           # AuthModal, FullRoastModal, BookmarksModal, SettingsModal, NotificationModal
│   ├── constants/            # Category taxonomy, theme tokens, and FCM topic mappings
│   ├── hooks/                # Push notifications & deep linking handlers (useNotifications)
│   ├── services/             # Notification service & notificationSessionTracker
│   ├── store/                # Zustand stores (feedStore, userStore, bookmarkStore, themeStore, settingsStore)
│   ├── types/                # Strict TypeScript contracts and DTO schemas
│   └── utils/                # readingTracker (AsyncStorage history) & personalization (anti-clumping)
├── tests/                    # Jest test suites (personalization, feedStore, readingTracker, sessionTracker)
├── App.tsx                   # Main application coordinator
├── app.json                  # Expo manifest configuration (permissions, plugins, schemes)
├── google-services.json      # Firebase & Google OAuth credentials
└── package.json              # Project scripts and dependencies
```

---

## Release History

| Version | Version Code | Highlights |
| :--- | :--- | :--- |
| `0.5.8` | `29` | Updated brand identity and app icon assets with official Z vector logo |
| `0.5.7` | `28` | Added `POST_NOTIFICATIONS` permission for Android 13+, FCM topic sync fix |
| `0.5.6` | `27` | Notification CTR & retention session tracker release, version bump |
| `0.5.5` | `26` | 2.0s read tracking dwell threshold, cold-start tap deduplication |
| `0.5.2` | `26` | Gesture threshold tuning, touchable responder steal fix |
| `0.5.0` | `24` | Local-first read tracking (`@zerodaily_read_history`), anti-clumping algorithm |
| `0.4.0` | `20` | Google Sign-In with OAuth credentials and guest account migration |
| `0.3.6` | `16` | 24-hour account deletion grace period and recovery mechanism |

---

## Backend Infrastructure

ZeroDaily Mobile is powered by the serverless backend infrastructure hosted at `api.zerodaily.in`:
- **Repository**: [zerodaily](https://github.com/err0rgod/zerodaily)
- **API Documentation**: [Docs.md](https://github.com/err0rgod/zerodaily/blob/main/Docs.md)
