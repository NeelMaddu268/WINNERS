# Cashmere

Cashmere is a paper-trading investment app designed for learning and simulated decision-making. Users can build a simulated portfolio, track positions with real-time prices, receive AI-generated insights, and engage with a social trading feed. All trading is simulated with a starting balance of $10,000; no real money is involved.

## Features

**Portfolio**
- Live portfolio tracking with positions, cost basis, unrealized P&L, and available cash
- Transaction history with buy/sell records and share transaction sharing to the feed
- Holdings view with current prices refreshed every 10 seconds

**AI Insights**
- Portfolio Pulse: portfolio-level analysis with scores for overvaluation risk, growth potential, and political climate
- Account Insights: explanations of position movements with news-driven drivers and interpretations
- Lookout: signals for stocks outside the portfolio based on recent news
- Ticker Overview: per-stock analysis with price behavior, recent news, fundamentals, risks, and outlook
- Key statistics on ticker pages: P/E ratio, market cap, 52-week range, volume

**Markets**
- Ticker search and individual stock pages with charts
- Top gainers, losers, and volume leaders
- Sector performance heatmap
- Earnings calendar and economic events
- Fear and Greed index
- Market news feed

**Social**
- Global feed of shared trades and portfolio milestones
- Like and comment on posts
- Public or friends-only sharing for trade posts
- User profiles with top holdings

**Friends**
- Friends list and friend requests
- View friends' portfolios and activity

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Auth:** Firebase Authentication
- **Database:** Firebase Firestore
- **AI:** Google Gemini 2.5 Flash Lite via @google/generative-ai
- **UI:** React 19, Framer Motion, Radix UI, Lucide icons

## APIs

**Yahoo Finance** (unofficial, no API key)
- Chart data: `query1.finance.yahoo.com/v8/finance/chart`
- Quotes: `query1.finance.yahoo.com/v7/finance/quote`
- Search: `query1.finance.yahoo.com/v1/finance/search`
- Screeners: day gainers, losers, most actives
- Used for: prices, historical charts, key statistics (P/E, market cap, 52W high/low), sector ETFs

**Finnhub** (requires FINNHUB_API_KEY)
- Company news: `finnhub.io/api/v1/company-news`
- General news: `finnhub.io/api/v1/news`
- Used for: stock-specific news, market news, AI context for Lookout and ticker overviews

**CNN Fear and Greed Index**
- `production.dataviz.cnn.io/index/fearandgreed/graphdata`
- Used for: market sentiment indicator on Markets page

**Google Gemini**
- Model: gemini-2.5-flash-lite
- Used for: Portfolio Pulse, Account Insights, Lookout, Ticker Overview
- Prompt rules: GEMINIRULES.MD, HYPESCORE.MD

## Project Structure

```
src/
  app/
    (app)/              # Authenticated app routes
      portfolio/        # Portfolio, holdings, transaction history
      markets/          # Markets overview, ticker pages
      social/           # Feed
      friends/          # Friends list
      settings/         # User settings
      profile/[uid]/    # User profile
    api/
      stream-gemini/    # Streaming text API route
    login/              # Login page
    setup/              # Onboarding
    page.tsx            # Landing page
  actions/
    market.ts           # Yahoo, Finnhub, Fear/Greed
    gemini.ts           # AI analysis (Portfolio Pulse, Insights, Lookout, Ticker)
    portfolio.ts        # Portfolio recalculation from transactions
  components/
    Navbar.tsx          # Main navigation
    TypewriterText.tsx  # Animated text
    StreamingText.tsx   # Streaming AI text component
  hooks/
    useStreamingText.ts # Hook for consuming streamed text
  lib/
    firebase.ts         # Firebase config
```

**Key files**
- `GEMINIRULES.MD`: AI behavior and output format for all analysis modes
- `HYPESCORE.MD`: Rubric for hype score (when used)
- `.env.local`: Firebase, Finnhub, Gemini API keys

## Setup

1. Clone the repository and install dependencies: `npm install`
2. Create `.env.local` with the required variables (see Environment Variables below):
   - `NEXT_PUBLIC_FIREBASE_*`: Firebase project config
   - `FINNHUB_API_KEY`: Finnhub API key (free tier)
   - `GEMINI_API_KEY`: Google AI Studio API key
3. Run `npm run dev` for development
4. Run `npm run build` and `npm start` for production

## Environment Variables

| Variable | Purpose |
|----------|---------|
| NEXT_PUBLIC_FIREBASE_API_KEY | Firebase client config |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Firebase auth domain |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Firebase project ID |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Firebase storage |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase messaging |
| NEXT_PUBLIC_FIREBASE_APP_ID | Firebase app ID |
| NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID | Firebase Analytics |
| FINNHUB_API_KEY | Finnhub news and company data |
| GEMINI_API_KEY | Google Gemini for AI analysis |
