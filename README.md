# Strengths Manager Application

A sophisticated React web application designed to enhance team and personal development through intelligent email infrastructure and AI-powered coaching capabilities, with a focus on seamless authentication and user engagement.

## 🌟 Key Features

- **Advanced Weekly Email Generation**: Personalized strength insights delivered weekly
- **AI-Driven Coaching**: OpenAI-powered coaching content with dynamic team member analysis
- **Comprehensive Email Management**: Subscription and delivery system with timezone-aware scheduling
- **Intelligent Strength-Based Communication**: Framework for team development
- **Robust Authentication**: Email verification with Replit Auth integration
- **Team Management Dashboard**: Visual analytics and team composition insights
- **CliftonStrengths Encyclopedia**: Complete reference with search capabilities

## 🛠️ Technology Stack

### Frontend
- **React.js** with TypeScript
- **Vite** for fast development and optimized builds
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **shadcn/ui** components built on Radix UI
- **Tailwind CSS** with custom theming
- **Framer Motion** for animations

### Backend
- **Node.js** with TypeScript
- **Express.js** REST API
- **PostgreSQL** with Drizzle ORM
- **Neon** serverless database infrastructure
- **Passport.js** authentication with Replit OIDC
- **Express Sessions** with PostgreSQL store

### External Services
- **OpenAI API** for AI-powered insights and coaching
- **Resend** email service for transactional emails
- **Replit Auth** for user authentication

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database
- OpenAI API key
- Resend API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Coda1977/Strength-ManagerII.git
cd Strength-ManagerII
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy and configure your environment variables
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=your_resend_api_key
SESSION_SECRET=your_session_secret
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📁 Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utility libraries
│   │   └── utils/          # Helper functions
├── server/                 # Backend Express application
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Database operations
│   ├── emailService.ts     # Email functionality
│   ├── chatService.ts      # AI coaching service
│   └── db.ts               # Database configuration
├── shared/                 # Shared types and schemas
│   └── schema.ts           # Database schema definitions
└── migrations/             # Database migration files
```

## 🗄️ Database Schema

### Core Tables
- **users**: User profiles and onboarding status
- **team_members**: Team member information and strengths
- **email_subscriptions**: Email preferences and scheduling
- **email_logs**: Email delivery tracking
- **conversations**: AI coaching conversation history
- **messages**: Individual conversation messages

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push schema changes to database
- `npm run test` - Run test suite
- `npm run test:coverage` - Run tests with coverage

## 🚀 Deployment

### Replit (Recommended)
The application is optimized for Replit deployment with autoscale support:

1. Import the repository to Replit
2. Configure environment variables in Replit Secrets
3. The application will automatically deploy

### Manual Deployment
1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## 🧪 Testing

The application includes comprehensive test coverage:

- **Frontend Tests**: React Testing Library with Vitest
- **Backend Tests**: Supertest with Jest
- **Integration Tests**: Full API endpoint testing

Run tests:
```bash
npm test
```

## 📧 Email System

### Features
- Welcome emails for new users
- Weekly coaching emails (12-week series)
- Timezone-aware scheduling (Monday 9 AM)
- Email subscription management
- Delivery tracking and logging

### Email Templates
- Professional HTML templates with responsive design
- AI-generated personalized content
- Brand-consistent styling with beige card-based layout

## 🤖 AI Integration

### OpenAI Features
- Team strengths analysis
- Collaboration insights
- Personalized coaching recommendations
- Conversation-based coaching interface

### Rate Limiting
- Built-in rate limiting protection
- Graceful error handling
- Token usage tracking

## 🔐 Security

- Session-based authentication with PostgreSQL storage
- CSRF protection
- Input validation with Zod schemas
- File upload security scanning
- Rate limiting on API endpoints

## 🌐 Browser Support

- Chrome/Chromium 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📞 Support

For support and questions, please open an issue in the GitHub repository.

---

Built with ❤️ for team development and strengths-based leadership.