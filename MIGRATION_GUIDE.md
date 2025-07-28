# Auth0 Migration Guide

## Step 1: Set up Auth0

1. Go to https://auth0.com and create a free account
2. Create a new "Regular Web Application"
3. In the application settings, configure:

**Allowed Callback URLs:**
```
https://85942558-6680-4e56-bf29-60e270826306-00-1usmqpohuohuo.pike.replit.dev/api/auth/callback
```

**Allowed Logout URLs:**
```
https://85942558-6680-4e56-bf29-60e270826306-00-1usmqpohuohuo.pike.replit.dev
```

**Allowed Web Origins:**
```
https://85942558-6680-4e56-bf29-60e270826306-00-1usmqpohuohuo.pike.replit.dev
```

## Step 2: Configure Environment Variables in Replit

Add these new environment variables in your Replit Secrets:

```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id_from_auth0
AUTH0_CLIENT_SECRET=your_client_secret_from_auth0
AUTH0_CALLBACK_URL=https://85942558-6680-4e56-bf29-60e270826306-00-1usmqpohuohuo.pike.replit.dev/api/auth/callback
```

## Step 3: Test the Migration

1. Restart your Replit application
2. Visit your app URL
3. Click "Get Started" - you should be redirected to Auth0
4. Create a new account or sign in
5. Complete onboarding

## Step 4: User Migration Options

### Fresh Start (Default)
- Users will need to re-register with Auth0
- They'll lose their old team data

### Manual Account Linking (Coming Soon)
- Users can link their new Auth0 account to old data
- Preserves team members and conversations

## Changes Made

1. ✅ Replaced Replit Auth with Auth0 Passport strategy
2. ✅ Updated all user authentication references
3. ✅ Maintained existing session management
4. ✅ Preserved email welcome functionality
5. ✅ Kept admin bypass functionality

## Testing Checklist

- [ ] Login with Auth0 works
- [ ] Onboarding flow works for new users
- [ ] Dashboard loads after login
- [ ] Team member management works
- [ ] Chat functionality works
- [ ] Email notifications are sent
- [ ] Admin functionality works
- [ ] Logout redirects properly

## Rollback Plan

If something goes wrong, restore `server/routes.ts` to use:
```typescript
import { isAuthenticated, setupAuth } from './replitAuth';
```

And remove the Auth0 environment variables.