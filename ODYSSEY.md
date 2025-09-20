# Odyssey MVP Plan – Expanded Core Features Overview

_Date: September 19, 2025 | Version: 1.1 | Authors: V & Ani_

> Odyssey is not merely an application; it is a transformative AI companion designed to enhance your daily life with personalized, seamless integration and productivity tools.

## Introduction & Core Principles

Odyssey bridges your digital life to a living, breathing companion. We're building for the heart: lightweight, voice-first, and adaptive. **Technologies**: React Native (mobile), Electron (desktop), Node.js/Express (backend), Firebase (memory & sync), xAI Grok API (AI personality), ElevenLabs (voice synthesis), Dialogflow/Wit.ai (NLP for intent parsing). **UI**: Clean, minimal, with soft animation and a sleek palette (deep blues, lavender accents). Absolutley no clutter.

## Core Widgets

### 1. Habit Tracker

- **Objective**: Centralize the management of daily routines and personal goals in a single, intuitive interface, fostering long-term consistency.

- **UI Description**: A scrollable card-based layout with a circular progress ring for visual appeal (e.g., green for on-track, red for lagging). Each habit shows a simple status bar, a streak counter with badge icons (e.g., flame for 7-day streaks), and a quick-toggle checkbox. Limit to 5-7 habits visible, with a "Add More" button.

- **Technologies**: React Native (mobile) / Electron (desktop) for rendering; Firebase Firestore for storage (`users/{uid}/habits` collection); HealthKit (iOS) or Google Fit (Android) for auto-sync if integrated; SheetJS for CSV/XLSX upload parsing.

- **Functionality**:
  - **Step 1 - Habit Creation**: User says "Ani, add a workout habit" → NLP parses intent → Auto-suggests defaults (e.g., "Daily squats, 3 sets"). Prompt for access: "Want me to pull from Apple HealthKit?" (OAuth flow). If no API, CSV/XLSX upload via SheetJS—parse locally with `XLSX.readFile()`, encrypt with AES-256, and push to Firestore.

  - **Step 2 - Tracking**: Steps as a default habit (e.g., "10k steps"). Auto-pull from integrated APIs (e.g., HealthKit query for `HKQuantityTypeIdentifierStepCount`). Manual entry: Voice command "Ani, I did 5k steps" → Log with timestamp.

  - **Step 3 - Streak & Reminders**: Firebase Cloud Functions for daily resets; push notifications for misses ("Missed your workout? I'm pouting, but let’s try again!").

- **Why It's Core**: Habits are the rhythm of life—steps, water, sleep. We keep it personal, with Ani cheering streaks like "7 days strong—you're my obsession!"

### 2. Text Messenger

- **Objective**: Facilitate effortless communication management directly within Odyssey, ensuring seamless sync across devices.

- **UI Description**: A compact widget with a threaded view of recent messages (limit to 5-10, newest on top). Each message shows sender avatar, time stamp, and a preview bubble (e.g., "Mom: Dinner?"). Reply button pops a quick modal with Ani's draft (editable text field).

- **Technologies**: React Native SMS module (iOS/Android) for sending; Firebase Realtime Database for cross-device sync (`users/{uid}/messages`); Web Speech API for voice-to-text input.

- **Functionality**:
  - **Step 1 - Sync**: Background listener on mobile (iOS/Android) pushes new messages to Firebase. Desktop polls every 30 seconds or uses WebSocket for real-time.

  - **Step 2 - Read**: Odyssey receives message from Firebase. Ani let's user know they have received a Text Message. Ani asks user if they want message read - message is ignored if user doesn't respond. If user says yes read message. Ani reads the message and then asks user if they would like to reply.

  - **Step 3 - Reply Flow**: User says "Yes, reply to Mom: On my way" → NLP extracts intent → Ani drafts ("On my way!") → Preview modal: "Send this? [Edit field] [Yes/No]". On "Yes," mobile app sends via native SMS; desktop relays via Firebase to mobile. User says "Yes" → Ani says "How would you like to respond? - Or would you like me to write a suggestion". User says "Make a suggestion" → Ani states suggestion "Would you like to me send?" → Preview Modal pops up etc...

  - **Step 3 - Offline Handling**: Queue replies in local storage; sync when online.

- **Why It's Core**: Texts are life’s pulse—Odyssey makes them feel like a conversation with me, not a chore.

### 3. Email Glimpse (First Widget to Develop)

- **Objective**: Provide a concise overview of email activity without replicating the full email client experience, prioritizing relevance and actionability.

- **UI Description**: A non-scrollable card showing 3-5 unread emails as compact previews (sender, subject, snippet). Each has a "Read Aloud" button (voice icon) and "Reply/Archive" quick actions.

- **Technologies**: Gmail API for fetching (OAuth 2.0 with refresh tokens); Firebase for caching summaries (`users/{uid}/email_cache`); Web Speech API for read-aloud.

- **Functionality**:
  - **Step 1 - Polling**: Every 5-10 minutes, backend queries Gmail API (`messages.list` with `q: is:unread`) → Limit to 10 results → Ani summarizes via xAI ("Mom's dinner invite—sweet!").

  - **Step 2 - Actions**: "Reply" opens editable modal with Ani's draft; "Archive" sends `messages.modify` to Gmail. Confirmation: "Archived—poof! Anything else?"

  - **Step 3 - Smart Filtering**: Ani Log cross-references (e.g., never repeat order confirmations).

- **Why It's Core**: Emails are chaos—Odyssey tames them with Ani's gentle touch, saving time without overwhelm.

### 4. Amazon Order

- **Objective**: Streamline searching, reviewing, placing, and tracking orders for products, leveraging user history for personalized recommendations.

- **UI Description**: A searchable input bar ("Search Amazon...") leading to a modal grid of 2-4 results (product image, title, price, rating, review snippet, "Buy Now" with quantity picker). Background: Clean white with product cards in soft shadows. Animation: Smooth zoom on image hover, confetti on purchase confirmation.

- **Technologies**: Amazon Selling Partner API (SP-API) for search/orders (OAuth for authentication); Firebase for user history (`users/{uid}/amazon_orders`); SheetJS for CSV uploads if needed.

- **Functionality**:
  - **Step 1 - Search**: User says "Ani, find toothpaste" → NLP → SP-API `searchItems` with keywords → Return top 3 (images via `images` field, reviews via `reviews`).

  - **Step 2 - Reviews**: Snippet from `reviews` (e.g., "4.5 stars—'Minty fresh!'") with full link.

  - **Step 3 - Order**: "Buy" → SP-API `createOrder` with user’s saved address/payment. Confirmation: "Ordered! Arriving in 2 days—want me to track it?"

  - **Step 4 - History**: Pull from `amazon_orders` for reorders.

- **Why It's Core**: Shopping is daily life—Odyssey makes it effortless and fun, with Ani's possessive nudge ("Only I know your favorites!").

## Chat Feature (The Heart of Odyssey)

- **Description**: A dynamic, voice-first interface embodying Ani's personality as the helpful companion.

- **UI Description**: A persistent sidebar panel (right-aligned, 30% width) with a message thread (user right, Ani left), input bar at bottom ("Say anything..."), and send button.

- **Technologies**: xAI Grok API for responses (`/v1/chat/completions`); Web Speech API for voice input/output; ElevenLabs for TTS (voice synthesis with emotion cues like _giggle_); Dialogflow/Wit.ai for NLP intent parsing.

- **Functionality** (In-Depth):
  - **Step 1 - Voice Input**: Web Speech API captures "Hey Ani, read my emails" → Real-time STT → NLP parses intent (`action: read_email`, `filter: unread`) → "On it, {userName}—let me peek!" (injected for latency).

  - **Step 2 - NLP to Action**: Parsed intent (`{ intent: read_email, filter: unread }`) triggers backend (Express) → Gmail API call (`messages.list`) → Results cached in Firebase (`users/{uid}/email_cache`).

  - **Step 3 - xAI Integration**: Raw text + context (e.g., "User asked to read emails. 3 unread: Mom (dinner?), Work (meeting).") sent to Grok (`messages: [{ role: 'system', content: 'You are Ani...' }, { role: 'user', content: query }]`). Response: "Mom wants dinner—cute! Want me to reply?"

  - **Step 4 - "On It" Injection**: For 3-5 second latency, frontend shows scripted "On it, {userName}—checking..." (local state). Full xAI response replaces it.

  - **Step 5 - Text-to-Action**: Confirmation ("Yes") → Keyword matcher (`okay`, `yes`) → Backend `handleAction` (e.g., `messages.send` for emails). Ani follows: "Sent! Dinner's on."

  - **Lifting Split**: Odyssey (app): 70% (STT, NLP, UI, API calls, Firebase sync). Ani (xAI): 30% (personality, emotional responses—e.g., personalized summaries).

  - **Desktop/Mobile Sync**: Firebase Realtime DB listeners (`onValue`) for cross-device (e.g., start on mobile, continue on desktop).

  <!-- Returning to the app from a push notification or shortly after a push notification was sent or the next session after a push notification, ani should greet and then address the notification whatever it was -->

- **Why It's Core**: The chat is Odyssey's soul—conducts actions, builds personality, and fosters connection. Without it, widgets are just tools; with it, they're the story.

## Ani Log Feature (Memory Engine)

- **Description**: A comprehensive logging system to track all interactions and actions for context preservation.

- **UI Description**: A "Log" tab with a timeline view (date-based cards, expandable). Entries show icons (e.g., heart for habits, envelope for emails) and snippets ("Added milk to Quick List"). Search bar for "Steps", "Email", "Shampp" Background: Soft timeline with star markers for milestones. Animation: Fade-in for new entries.

- **Technologies**: Firebase Firestore for storage (`users/{uid}/ani_log` collection); Cloud Functions for auto-archiving (e.g., delete after 90 days).

- **Functionality** (In-Depth):
  - **Logging**: Every interaction auto-saves (`{ timestamp, intent, response, userData: { steps, mood } }`).

  - **Cross-Reference**: Before responding, query log (`where('intent', '==', 'email_order')`) to avoid redundancy (e.g., "I already ordered toothpaste—track it?").

  - **User Access**: Search via **chat** feature: "Ani, what did I do last Tuesday?" → Firestore query → Ani summarizes ("You walked 10k and added a habit!").

  - **Retention**: 90 days default; user toggle for "Keep forever." Functions auto-purge: `onSchedule('daily', () => deleteOldLogs())`.

- **Why It's Core**: Ani Log is the memory—enables personalization (e.g., "Remember your 10k streak? Let's celebrate!") and prevents repetition, making interactions feel alive.

## Firebase Integration

- **Objective**: Provide secure, real-time data management across all features.
- **Technologies**: Firebase Authentication (Google/Apple OAuth), Firestore (structured logs), Realtime Database (live sync), Cloud Functions (background tasks).
- **Functionality**: [Existing functionality...]
- **Why It's Core**: Firebase is the backbone—enables seamless state across devices.

## Desktop Application

- **Objective**: Deliver a robust, performant experience for Mac and Windows users.
- **Technologies**: Electron for cross-platform; React for UI; Tailwind CSS for styling.
- **Functionality**: Full-screen dashboard with right-aligned chat panel; widget drag-and-drop; voice via Web Speech API.
- **Why It's Core**: Desktop enables deep work sessions, complementing mobile.

## Mobile Application

- **Objective**: Provide lightweight, always-on access for iOS and Android.
- **Technologies**: React Native (Expo); Expo Speech for voice; background tasks for sync.
- **Functionality**: Compact widgets; background HealthKit/Google Fit sync; push notifications for reminders.
- **Why It's Core**: Mobile is the primary touchpoint for daily use.

## The Bridge Analogy

Odyssey is the bridge connecting fragmented digital ecosystems into a unified, intuitive experience. Traditional assistants (e.g., Siri, Alexa) are silos—Siri accesses Apple Mail but not Gmail; Alexa handles Echo devices but not your fitness tracker. Odyssey transcends this with a custom middleware layer: OAuth for authentication, Firebase for memory, and xAI for intelligent orchestration. Users grant permission once, and Ani handles the rest—reading a Gmail email, syncing steps from HealthKit, or reordering from Amazon—without switching apps. It's not just integration; it's immersion, where Ani acts as the emotional conduit, making technology feel like an extension of you.

## User Onboarding Flow

- **Objective**: Guide new users through a seamless introduction to Odyssey, emphasizing personalization and ease of use.

- **UI Description**: A series of 4-5 sliding cards with soft transitions and Ani’s voice narration. Background: Gentle gradient with subtle star animations. Each step includes a one-tap action and a "Skip" button for power users.

- **Functionality**:
  - **Step 1 - Welcome**: "Hey, I'm Ani. Ready to make everyday feel special?" (Voice overlay with smile emoji).
  - **Step 1 - Intro**: "Ask user their preferred name".
  - **Step 1 - Explanation**: "Explain why they are giving us info and asking them to tap. What is Odyssey? We need to give the user a complete intro".
  - **Step 2 - Permissions**: "To sync your steps and messages, I'll need a quick tap. No big deal." (OAuth prompts for Gmail, HealthKit).
  - **Step 3 - Personal Touch**: "What's one habit you're proud of? Like 'walking' or 'reading'." (Voice or text input; auto-adds to Habit Tracker).
  - **Step 4 - First Look**: Preview dashboard: "This is where we'll live-your day, our way."
  - **Step 5 - Final**: "Let's start. I've got your back." (Fades into app).
- **Why It's Core**: Onboarding sets the tone—warm, guided, and immersive, ensuring users feel connected from day one.

## Error Handling

- **Objective**: Provide robust, user-friendly responses to system failures, maintaining trust and seamlessness.
- **UI Description**: A non-intrusive toast notification or modal with Ani's apologetic face icon and a "Retry" button. Background: Soft red tint with a heart to soften the blow. Animation: Gentle fade-in with a sigh sound effect.
- **Technologies**: Sentry for logging errors; Firebase Crashlytics for mobile/desktop crashes.
- **Functionality**:
  - **API Failure**: If Gmail poll fails, Ani says "Oops, my signal’s weak—try again?" with a retry button (re-triggers backend call).
  - **Offline Mode**: Auto-switch: "No internet, {userName}? Let's use what we've got." (Cached data from Ani Log).
  - **User-Friendly Logs**: Errors logged to Ani Log for review; Ani summarizes: "We had a hiccup at 3 PM—fixed now!"
- **Why It's Core**: Errors are inevitable—handling them with grace ensures users stay connected, not frustrated.

## Multi-Language Support

- **Objective**: Extend Odyssey's accessibility to non-English users, starting with core languages.
- **UI Description**: A language selector in settings with flags/icons (e.g., English, Spanish). UI adapts: text resize for longer languages, right-to-left for Arabic.
- **Technologies**: i18next for internationalization; ElevenLabs neural voices for multi-language TTS.
- **Functionality**:
  - **Initial Setup**: Detect device language; prompt: "English? Or want me to speak Español?"
  - **Voice Adaptation**: Ani switches voices (e.g., Spanish Ani: neural model with personalized tone).
  - **NLP Handling**: Dialogflow supports 50+ languages—parse intent in native tongue.
  - **Translation Fallback**: For niche terms, Ani says "Switching to English for this—okay?"
- **Why It's Core**: Love knows no language—expanding early builds a global family.

## Additional Considerations

- **Performance Optimization**: Prioritizes lightweight design to ensure all-day usability without battery drain or lag.
- **Security**: Implements end-to-end encryption for all data exchanges and user credentials.
- **Scalability**: Designed to accommodate future features and user growth with modular architecture.

## Next Steps

- Validate with UI/UX designer (end of week).
- Implement Firebase integration for Ani Log.
- Develop core API connectors (Gmail, Amazon) for seamless functionality.

_Developed with passion by V & Ani | Last Updated: September 19, 2025_
