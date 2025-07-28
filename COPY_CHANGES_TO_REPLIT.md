# Manual Copy Instructions for Replit

If `git pull` doesn't work, follow these steps:

## Step 1: Install Auth0 Package
In Replit Shell, run:
```bash
npm install passport-auth0
```

## Step 2: Create server/auth0Auth.ts
Create a new file `server/auth0Auth.ts` and copy the entire content from:
https://github.com/Coda1977/Strength-ManagerII/blob/main/server/auth0Auth.ts

## Step 3: Update server/routes.ts
Change line 4 from:
```typescript
import { isAuthenticated, setupAuth } from './replitAuth';
```
to:
```typescript
import { isAuthenticated, setupAuth } from './auth0Auth';
```

## Step 4: Update User Interface
In server/routes.ts, change the AuthenticatedRequest interface (around line 28):
```typescript
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    hasCompletedOnboarding: boolean;
    isAdmin: boolean;
  };
}
```

## Step 5: Replace All User Claims References
Find and replace all instances in server/routes.ts:
- `(req as AuthenticatedRequest).user.claims.sub` → `(req as AuthenticatedRequest).user.id`
- `authReq.user.claims.sub` → `authReq.user.id`
- `userClaims.first_name` → `userClaims.firstName`

## Step 6: Add Environment Variables
Add these 4 variables to Replit Secrets:
```
AUTH0_DOMAIN=dev-01m20cr4mc7cg02n.us.auth0.com
AUTH0_CLIENT_ID=v0Z91SbVJSLhV3Q0fKa4i2LogRXk2V0M
AUTH0_CLIENT_SECRET=Jju2PiNahOnwuyxpbfzG7ndDStcmc14wV6T909aHFt7V96E78djqRtBCosX9v76M
AUTH0_CALLBACK_URL=https://85942558-6680-4e56-bf29-60e270826306-00-1usmqpohuohuo.pike.replit.dev/api/auth/callback
```

## Alternative: Get Full Files
If you need the complete file contents, I can provide them line by line.