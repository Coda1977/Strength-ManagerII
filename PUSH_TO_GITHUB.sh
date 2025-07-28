#!/bin/bash

# Script to push Strength Manager application to GitHub
# Repository: https://github.com/Coda1977/Strength-ManagerII.git

echo "🚀 Starting GitHub push process..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "Initializing Git repository..."
    git init
fi

# Check current git status
echo "📋 Current Git status:"
git status

# Add the remote repository if it doesn't exist
if ! git remote get-url origin >/dev/null 2>&1; then
    echo "🔗 Adding remote repository..."
    git remote add origin https://github.com/Coda1977/Strength-ManagerII.git
else
    echo "✅ Remote repository already configured"
    git remote -v
fi

# Stage all files
echo "📦 Staging all files..."
git add .

# Show what will be committed
echo "📝 Files to be committed:"
git diff --cached --name-only

# Create commit
echo "💾 Creating commit..."
git commit -m "Complete Strength Manager Application

🌟 Features:
- Full-stack React/TypeScript application with Express backend
- PostgreSQL database with Drizzle ORM
- OpenAI integration for AI coaching and team insights
- Resend email service with automated weekly coaching emails
- Comprehensive authentication system with Replit Auth
- Team management and CliftonStrengths tracking
- Mobile-responsive UI with Tailwind CSS and shadcn/ui
- Complete test suite coverage
- Email subscription management with timezone-aware scheduling
- Real-time AI chat coaching interface
- Admin dashboard with user management

🛠️ Technical Stack:
- Frontend: React, TypeScript, Vite, TanStack Query, Wouter
- Backend: Express.js, Node.js, Passport.js
- Database: PostgreSQL, Drizzle ORM, Neon serverless
- AI: OpenAI GPT-4o integration
- Email: Resend service with HTML templates
- UI: shadcn/ui, Radix UI, Tailwind CSS, Framer Motion
- Testing: Vitest, Jest, React Testing Library
- Deployment: Replit-optimized with autoscale support

📚 Documentation:
- Complete README with setup instructions
- Deployment guide for multiple platforms
- Architecture documentation
- Environment configuration templates
- Git setup guide

🔐 Security:
- Session-based authentication
- Input validation with Zod schemas
- Rate limiting and CSRF protection
- File upload security scanning
- Environment variable protection"

# Check if we need to set upstream
if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    echo "🔄 Pushing to GitHub (first time)..."
    git push -u origin main
else
    echo "🔄 Pushing to GitHub..."
    git push
fi

echo "✅ Push complete! Your code is now available at:"
echo "   https://github.com/Coda1977/Strength-ManagerII.git"
echo ""
echo "🎯 Next steps:"
echo "1. Verify the upload at GitHub"
echo "2. Configure environment variables for deployment"
echo "3. Deploy using the DEPLOYMENT.md guide"