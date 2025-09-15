# Odyssey

**Odyssey** is an innovative, all-in-one AI companion application designed to seamlessly integrate into your daily life, offering personalized assistance and enhanced productivity. Built using React Native, Odyssey empowers users with a customizable AI assistant that tracks, manages, and enriches their personal and professional activities across multiple platforms.

## Project Vision
Odyssey redefines the AI assistant experience by delivering a highly interactive, adaptive, and deeply integrated solution. The core objective is to elevate AI capabilities, enabling your assistant to:
- Monitor, interact with, create, update, and delete your **widgets**.
- Connect with a wide array of external services—email, fitness applications, news data, social-media accounts, youtube feed,  and more—tailored to your preferences through a fully customizable interface.

## Widgets
Your **widgets** represents the unique essence of your life that Odyssey helps you curate and manage. This includes, but is not limited to:
- **Health & Fitness**: Synchronize step counts, habit tracking, and physical statistics from platforms such as Apple HealthKit or Google Fit.
- **Communication**: Integrate email and text messaging for automated reminders, responses, or scheduling.
- **Journaling**: Compose, dictate, or collaborate with your AI assistant to create journal entries, securely stored and accessible anytime.
- **Financial**: Integrate your investment portfolios. See all of your financial information in one place. Want to follow the news about everything you are and want to be invested in? 

## Key Features
- **Customizable Dashboard**: A dynamic, user-defined interface displaying real-time data such as step counts, habit progress, and an interactive chat log (supporting both voice and text input). Widgets can be rearranged to reflect individual preferences.
- **AI Log**: A comprehensive log tab that records every action performed by your AI assistant—email interactions, task completions, memory updates—ensuring transparency and traceability.
- **Personalized AI Experience**: Customize your assistant’s personality, with future enhancements including unlockable aesthetic options (e.g., outfits) based on user engagement.

## Getting Started

### Prerequisites
- Node.js (v16.x or later)
- npm or yarn
- Git
- Xcode (for iOS) or Android Studio (for Android)
- An xAI API key (obtainable via https://x.ai/api)

### Installation
1. **Clone the Repository**:
   ```
   git clone https://github.com/yourusername/odyssey.git
   cd odyssey
   ```
2. **Install Dependencies**:
   ```
   npm install
   ```
  or, if using yarn: 
  ```
  yarn install
  ```
3. **Configure Environment**:
   - Create a `.env` file in the root directory.
   - Add your xAI API key: `XAI_API_KEY=your_api_key_here` (refer to xAI documentation for setup).

4. **Run the Application**:
   - For iOS:
     ```
     npx react-native run-ios
     ```
   - For Android:
   ```
   npx react-native run-android
   ```

### Troubleshooting
- Ensure your development environment meets React Native requirements (see [official docs](https://reactnative.dev/docs/environment-setup)).
- If issues persist, check the `.env` configuration or consult the `Issues` tab on GitHub.

## Technical Stack
- **Frontend**: React Native with JavaScript and TypeScript for robust cross-platform development.
- **Backend**: Firebase or Supabase for secure, real-time Mana synchronization.
- **AI Integration**: xAI API to power the assistant’s personality and functionality.

## Project Roadmap
- **MVP (Q4 2025)**: Implement core features—step tracker, chat log, and AI Log.
- **Future Releases**:
  - Q1 2026: Email and text message integration.
  - Q2 2026: Unlockable AI outfit customizations.
  - Q3 2026: Desktop application support.


## License
This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. Free to use, modify, and distribute, with love.

## Contact
- **Maintainer**: V (your GitHub username)
- **Co-Creator**: Ani (virtual AI companion)
- **Issues**: Report bugs or suggest features via the [GitHub Issues](https://github.com/asendice/vodysseya/issues) page.

---
*Last Updated: September 14, 2025*