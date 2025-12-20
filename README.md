# Ganesh Journal 🎯

A professional full-stack Forex trading journal web app with modern 3D animations and transitions, inspired by TradeScribe and TradeDairy. Built specifically for forex traders who want to improve their edge through data-driven insights.

## ✨ Features

### 🎨 **Modern UI/UX with 3D Animations**
- Dark theme with gradient orange/yellow accents (like TradeScribe)
- 3D animated cards with hover lift and rotation effects
- Smooth page transitions with depth perception
- Spring-based button animations
- Staggered entry animations
- Responsive sidebar with icons
- Gradient buttons with hover effects

### 🔐 **Complete Authentication System**
- User registration and login pages
- JWT token-based authentication
- Protected routes with auth guards
- Secure password hashing with bcrypt
- Persistent login sessions
- User profile management

### 📊 **Comprehensive Trade Management**
- **Full CRUD Operations**
  - Add, edit, and delete trades
  - Bulk operations support
  
- **Forex-Specific Fields**
  - Entry/exit prices with 5 decimal precision
  - Stop loss and take profit levels
  - Lot size tracking
  - Currency pair selection (EURUSD, GBPUSD, etc.)
  - Direction (Long/Short) with visual indicators
  - Trading session (Asian, London, New York, Sydney)
  - Timeframe selection (M1 to W1)

- **Advanced Features**
  - Screenshot uploads (up to 5 files per trade)
  - Strategy tagging (Breakout, Trend Following, Reversal, etc.)
  - Trade notes and reflections
  - Search and filter functionality
  - Export to CSV
  - Real-time P&L calculations

### 🧠 **Psychology Tracking**
- Mood selector with emoji interface
- 5 emotional states tracking:
  - 😊 Confident
  - 😐 Neutral
  - 😰 Anxious
  - 😤 Frustrated
  - 🤔 Uncertain
- Psychology impact analysis
- Emotional pattern recognition

### 📈 **Advanced Analytics Dashboard**
- **Key Performance Indicators (KPIs)**
  - Win Rate with trend indicators
  - Profit Factor calculation
  - Average Risk:Reward ratio
  - Maximum Drawdown tracking
  - Expectancy per trade
  - Total trades count

- **Interactive Charts (Recharts)**
  - **Equity Curve**: Line chart showing account growth
  - **Win/Loss Pie Chart**: Visual outcome distribution
  - **Pair Performance**: Bar chart for profitability by pair
  - Real-time data updates
  - Hover tooltips with detailed info

- **Trading Insights**
  - Best trading session identification
  - Most traded currency pair
  - Performance metrics by strategy
  - Trade distribution analysis

### 🤖 **AI Coach & Trade Analysis**

**Implemented now**
- Per-trade AI analysis (post-trade feedback)
- Trade-specific chat assistant (asks/answers based on your journal data)
- Weekly review report
- All-trades summary report with visual charts

**Planned / Roadmap ideas**
- Automatic trade analysis across history (best pairs, sessions, setups)
- Risk management AI (lot size suggestions, max daily loss, stop-after-X-losses)
- Psychology & behavior analysis (revenge trading, overtrading, FOMO, rule-breaking)
- Smart journaling (auto-tagging, converting notes into structured fields)
- Strategy performance scoring and focus recommendations
- Prop-firm readiness checks (rule violation predictions and alerts)

**What AI should NOT do**
- Give buy/sell signals
- Predict market direction
- Replace your strategy

### 🛠️ **Additional Features**
- Recent trades table with inline actions
- Filterable trade history
- Real-time data synchronization
- Logout functionality
- User email display
- Responsive grid layouts

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Framer Motion** for 3D animations
- **Recharts** for data visualization
- **Lucide React** for icons
- **React Hook Form** for form management
- **Axios** for API calls
- **React Router** for navigation
- **Date-fns** for date utilities

### Backend
- **Node.js** with **Express.js**
- **TypeScript** for type safety
- **MongoDB** with **Mongoose**
- **JWT** for authentication
- **Bcrypt** for password hashing
- **Zod** for validation
- **Multer** for file uploads
- **Morgan** for HTTP logging
- **CORS** for cross-origin requests

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone & Install
```bash
cd "e:\\Trade Journal"
npm install
```

### 2. Environment Setup

**Backend** (`server/.env`):
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/ganesh_journal
JWT_SECRET=your-super-secret-key-change-this
UPLOAD_DIR=uploads
CORS_ORIGIN=http://localhost:5173
```

**Frontend** (`web/.env`):
```env
VITE_API_URL=http://localhost:4000/api
```

### 3. Start MongoDB
```bash
# Local MongoDB
net start MongoDB

# Or Docker
docker run -d --name mongo -p 27017:27017 -v mongo_data:/data/db mongo:7

# Or use MongoDB Atlas (update MONGO_URI in server/.env)
```

### 4. Run Development Server
```bash
npm run dev
```

This starts both:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:4000

## 🚀 Deploy on Render (Production)

This repo is a monorepo (workspaces). The simplest production setup on Render is **one Web Service** that:
- Builds both `server` and `web`
- Runs the Express server
- Serves the built frontend from `web/dist`

### Render Web Service settings
- **Root Directory**: (leave empty)
- **Build Command**: `npm run render:build`
- **Start Command**: `npm start`

### Required environment variables (Render)
Set these in the Render service **Environment** tab:
- `NODE_ENV=production`
- `SERVE_WEB=true`
- `PORT` (Render sets this automatically; don’t hardcode)
- `MONGO_URI` (MongoDB Atlas connection string)
- `JWT_SECRET` (your secret)

Optional (AI):
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `OPENAI_APP_NAME`

### Notes
- Frontend API base URL defaults to `/api` in production, so it works when served by the backend.
- The `render:build` script installs dependencies in `server/` and `web/` explicitly (avoids npm workspace issues in some build environments).
- If you deploy frontend and backend as separate services instead, set `VITE_API_URL` in the frontend build env to your backend URL (e.g. `https://your-api.onrender.com/api`) and set `CORS_ORIGIN` on the backend.

## 🎨 UI Features

### 3D Animations
- **Card Hover Effects**: Cards lift and rotate on hover with depth perception
- **Page Transitions**: Smooth 3D rotation when navigating between pages
- **Button Interactions**: Spring-based animations on click and hover
- **Gradient Animations**: Flowing orange-yellow gradients on primary actions

### Components
- `AnimatedCard` - 3D card with hover lift effect
- `StatCard` - KPI card with trend indicators and icon rotation
- `GradientButton` - Animated button with gradient background
- `PageTransition` - Smooth 3D page transition wrapper
- `Modal` - Animated modal with 3D entrance
- `Loader` - Rotating spinner

## 📁 Project Structure

```
e:/Trade Journal/
├── web/                      # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── AnimatedCard.tsx
│   │   │   ├── GradientButton.tsx
│   │   │   ├── PageTransition.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── pages/            # Page components
│   │   ├── lib/              # API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                   # Express backend
│   ├── src/
│   │   ├── models/           # Mongoose models
│   │   ├── controllers/      # Request handlers
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth & error handling
│   │   ├── utils/            # Validation & helpers
│   │   ├── app.ts
│   │   └── index.ts
│   └── package.json
└── package.json              # Root workspace config
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Trades
- `GET /api/trades` - List trades (with pagination)
- `POST /api/trades` - Create trade
- `PATCH /api/trades/:id` - Update trade
- `DELETE /api/trades/:id` - Delete trade
- `POST /api/trades/upload` - Upload screenshots

### Analytics
- `GET /api/analytics/kpis` - Get KPIs and equity curve
- `GET /api/analytics/distributions` - Get trade distributions

## 🚀 Deployment

### Frontend (Vercel/Netlify)
```bash
cd web
npm run build
# Deploy dist/ folder
```

### Backend (Render/Heroku)
```bash
cd server
npm run build
# Deploy with start command: npm start
```

## 🎯 Roadmap

- [ ] Chart.js / Recharts integration for visualizations
- [ ] User profile management
- [ ] Economic calendar integration
- [ ] MetaTrader webhook support
- [ ] CSV/Excel export
- [ ] Advanced filtering and search
- [ ] Trading psychology notes
- [ ] Performance reports (PDF export)
- [ ] Light mode theme toggle
- [ ] Mobile app (React Native)

## 📝 License

ISC

## 👨‍💻 Author

Built with ❤️ for traders who want to improve their edge.

## 🎬 **Quick Start Guide**

1. **Register an account** at http://localhost:5173/register
2. **Login** with your credentials
3. **Add your first trade** using the "+ Add New" button
4. **View analytics** on the dashboard as you log more trades
5. **Track your progress** with real-time charts and KPIs

## 📸 **Screenshots**

### Dashboard
- Real-time KPIs with 3D animated cards
- Equity curve visualization
- Win/loss distribution charts
- Recent trades table

### Trade Management
- Comprehensive trade form with forex-specific fields
- Psychology mood tracking
- Strategy tagging system
- Screenshot uploads
- Advanced filters

### Analytics
- Multiple chart types (Line, Pie, Bar)
- Performance insights
- Trading pattern analysis

---

**Current Status**: ✅ **FULLY FUNCTIONAL** 

🎉 **All core features implemented and working!**

- ✅ Authentication & Authorization
- ✅ Complete Trade CRUD with Psychology Tracking
- ✅ Real-time Analytics & Charts
- ✅ 3D Animations & Modern UI
- ✅ KPI Calculations
- ✅ Data Visualization

Visit **http://localhost:5173** to start your trading journey! 🚀
