# Deployment Guide - Strength Manager Application

## Overview
This guide covers deployment options for the Strength Manager application to various platforms.

## Replit Deployment (Recommended)

### Prerequisites
- Replit account
- GitHub repository access
- Required API keys

### Steps
1. **Import from GitHub**
   - Go to Replit and create a new Repl
   - Select "Import from GitHub"
   - Use: `https://github.com/Coda1977/Strength-ManagerII.git`

2. **Configure Environment Variables**
   In Replit Secrets, add:
   ```
   DATABASE_URL=your_neon_postgresql_url
   OPENAI_API_KEY=your_openai_key
   RESEND_API_KEY=your_resend_key
   SESSION_SECRET=your_secure_session_secret
   ```

3. **Database Setup**
   ```bash
   npm run db:push
   ```

4. **Deploy**
   - Replit will automatically handle deployment
   - Your app will be available at `your-repl-name.replit.app`

## Other Deployment Options

### Vercel
1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Set build command: `npm run build`
4. Set output directory: `dist`

### Railway
1. Connect GitHub repository
2. Configure environment variables
3. Railway will auto-detect Node.js application

### Heroku
1. Create new Heroku app
2. Connect GitHub repository
3. Configure environment variables
4. Add Heroku Postgres addon

### DigitalOcean App Platform
1. Create new app from GitHub
2. Configure environment variables
3. Set build command: `npm run build`
4. Set run command: `npm start`

## Database Configuration

### Neon (Recommended)
1. Create account at neon.tech
2. Create new database
3. Copy connection string to `DATABASE_URL`

### Supabase
1. Create project at supabase.com
2. Get PostgreSQL connection details
3. Configure `DATABASE_URL`

### Self-hosted PostgreSQL
Ensure PostgreSQL 12+ with required extensions

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Yes |
| `RESEND_API_KEY` | Resend API key for emails | Yes |
| `SESSION_SECRET` | Secure string for session encryption | Yes |
| `NODE_ENV` | Environment (production/development) | No |
| `PORT` | Server port (default: 5000) | No |

## SSL/HTTPS Configuration

Most cloud platforms handle SSL automatically. For custom domains:
1. Configure DNS records
2. Set up SSL certificates
3. Update CORS settings if needed

## Domain Configuration

### Custom Domain Setup
1. Configure DNS A/CNAME records
2. Update environment variables
3. Configure platform-specific domain settings

### Email Domain (for Resend)
1. Add DNS records for email domain
2. Verify domain in Resend dashboard
3. Update FROM_EMAIL environment variable

## Monitoring and Logging

### Recommended Tools
- **Error Tracking**: Sentry
- **Logging**: LogRocket, Datadog
- **Uptime Monitoring**: Pingdom, UptimeRobot
- **Performance**: New Relic, Vercel Analytics

### Application Monitoring
The app includes built-in:
- Request logging
- Error tracking
- Performance metrics
- Email delivery tracking

## Scaling Considerations

### Database
- Connection pooling configured
- Prepared statements for performance
- Indexes on frequently queried fields

### Caching
- In-memory caching for strength data
- Query result caching with React Query

### Rate Limiting
- API rate limiting implemented
- OpenAI usage tracking and limits

## Security Checklist

- [ ] All environment variables configured securely
- [ ] Database uses SSL connections
- [ ] Session secrets are cryptographically secure
- [ ] CORS configured for production domains
- [ ] Rate limiting enabled
- [ ] File upload security enabled
- [ ] Input validation on all endpoints

## Backup Strategy

### Database Backups
- Automated daily backups (Neon/cloud providers)
- Weekly full backups
- Point-in-time recovery capability

### Application Backups
- GitHub repository serves as code backup
- Environment variables documented securely
- Deployment configurations version controlled

## Testing in Production

### Health Checks
```bash
# Basic health check
curl https://your-domain.com/health

# Database connectivity
curl https://your-domain.com/api/health/db

# External services
curl https://your-domain.com/api/health/services
```

### Email Testing
1. Test welcome email flow
2. Verify weekly email delivery
3. Check email deliverability scores

### AI Features Testing
1. Verify OpenAI API connectivity
2. Test team insights generation
3. Validate conversation system

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify DATABASE_URL format
   - Check network connectivity
   - Confirm database exists and is accessible

2. **Email Delivery Issues**
   - Verify RESEND_API_KEY
   - Check domain verification
   - Review DNS records

3. **AI Features Not Working**
   - Confirm OPENAI_API_KEY validity
   - Check API quota and billing
   - Verify model availability

4. **Authentication Problems**
   - Check SESSION_SECRET configuration
   - Verify domain configuration
   - Review CORS settings

### Logs Analysis
Check platform-specific logs:
- Application logs for errors
- Database logs for connection issues
- Web server logs for request issues

## Performance Optimization

### Frontend
- Vite optimization for fast builds
- Code splitting implemented
- Static asset optimization

### Backend
- Database connection pooling
- Query optimization
- Response caching

### Email System
- Batch processing for bulk emails
- Retry mechanisms for failed deliveries
- Queue system for high volume

## Maintenance

### Regular Tasks
- Monitor error rates
- Review performance metrics
- Check email deliverability
- Update dependencies
- Review and rotate secrets

### Scheduled Maintenance
- Weekly email system health checks
- Monthly performance reviews
- Quarterly security audits
- Annual dependency updates

This deployment guide ensures your Strength Manager application runs reliably in production with proper monitoring, security, and performance optimization.