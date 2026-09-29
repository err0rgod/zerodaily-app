# ZeroDaily Mobile — Tech News, Roasted to Perfection

[![CI](https://github.com/err0rgod/zerodaily-app/actions/workflows/ci.yml/badge.svg)](https://github.com/err0rgod/zerodaily-app/actions/workflows/ci.yml)
[![Build Android](https://github.com/err0rgod/zerodaily-app/actions/workflows/build-android.yml/badge.svg)](https://github.com/err0rgod/zerodaily-app/actions/workflows/build-android.yml)
[![Expo](https://img.shields.io/badge/Expo-52.0+-black.svg)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)

**ZeroDaily** is an Inshorts-style vertical gesture news reader built for engineers, hackers, and tech enthusiasts who want the signal without the noise.

No clickbait filler. No 30-minute podcast recaps. No sanitized corporate PR. Just the day's biggest breakthroughs, security meltdowns, and AI drama delivered in razor-sharp, **60-word roasted cards** with biting satirical wit.

---

## What Makes ZeroDaily Different?

- **Swipe, Don't Scroll**: 60/120 FPS vertical paging engine with smooth tactile snap alignment. Swipe up to browse the next story; swipe down to revisit previous cards.
- **60-Word Satirical Roasts**: Every card delivers a hilarious roasted headline and a witty 60-word summary that cuts straight to the point.
- **The "Full Roast" Deep-Dive**: Want the full technical story? Tap "Full Roast" on any card to read a complete multi-paragraph breakdown with analytical commentary.
- **Zero-Spinner Experience**: 0ms cold-boot renders directly from device storage. Predictive background prefetching loads images and stories ahead of your swipe so you never stare at a loading spinner.
- **7 High-Octane Tech Channels**:
  - 🔥 **Hot Stories**: The most impactful trending stories across the entire tech ecosystem.
  - 🛡️ **Cybersecurity**: Critical zero-days, ransomware debacles, and security failures.
  - 🤖 **Artificial Intelligence**: LLM benchmark wars, autonomous agents, and GPU clusters.
  - 💻 **Software Engineering**: Runtimes, tooling wars, framework churn, and dev culture.
  - 🦾 **Robotics**: Humanoids, automation breakthroughs, and robotic systems.
  - 🚀 **Defense & Aerospace**: Hypersonics, satellite swarms, and aerospace engineering.
  - ⚡ **Hardware & Chips**: TSMC wafer fabrication, GPUs, silicon architecture, and quantum computing.
  - 📈 **Markets & Finance**: Tech earnings, venture capital deals, crypto volatility, and commodities.
- **Adaptive Personalization**: The app quietly learns your favorite categories through natural dwell time and interaction without invasive third-party ad tracking.
- **Frictionless Auth**: Start instantly as an anonymous guest, or sign in with one tap via **Google Sign-In** or **Firebase Email/Password**.
- **Offline Library**: Bookmark stories with one tap. Access your saved library anytime, even with zero network connectivity.
- **Light & Cyber-Dark Themes**: Switch seamlessly between a dark hacker terminal aesthetic and clean, modern daylight typography.

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

4. Scan the QR code using the **Expo Go** app on your Android or iOS device.

---

## Project Structure

```text
zerodaily-app/
├── credentials/              # Persistent release keystore (matches Firebase SHA-1)
├── src/
│   ├── api/                  # Resilient API client & Firebase Auth Identity Toolkit integration
│   ├── components/
│   │   ├── common/           # Header, glowing badges, tactile buttons
│   │   ├── feed/             # CardSwiper vertical pager & 60-word NewsCard
│   │   └── modals/           # AuthModal, FullRoastModal, BookmarksModal, SettingsModal
│   ├── constants/            # Category taxonomy, theme tokens, and topic mappings
│   ├── hooks/                # Push notifications & deep linking handlers
│   ├── store/                # Zustand stores (feedStore, userStore, bookmarkStore, themeStore)
│   └── types/                # Strict TypeScript contracts
├── App.tsx                   # Main application coordinator
├── app.json                  # Expo manifest configuration
├── google-services.json      # Firebase & Google OAuth credentials
└── package.json              # Project scripts and dependencies
```

---

## Backend Infrastructure

ZeroDaily Mobile is powered by the serverless backend infrastructure hosted at `api.zerodaily.in`:
- **Repository**: [zerodaily](https://github.com/err0rgod/zerodaily)
- **API Documentation**: [Docs](https://github.com/err0rgod/zerodaily/blob/main/Docs.md)
