import { Resend } from 'resend';
import { eq, and } from 'drizzle-orm';
import { db } from './db';
import { storage } from './storage';
import { emailSubscriptions, emailLogs, users, teamMembers } from '../shared/schema';
import type { InsertEmailSubscription, InsertEmailLog, User } from '../shared/schema';
import { generateWeeklyEmailContent, generateWelcomeEmailContent } from './openai';
import { render } from '@react-email/components';
import { WelcomeEmail, WeeklyNudgeEmail } from './emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  private fromEmail = 'onboarding@tinymanager.ai';
  
  async sendWelcomeEmail(user: User, timezone: string = 'America/New_York'): Promise<void> {
    try {
      // Create email subscription for this user
      await db.insert(emailSubscriptions).values({
        userId: user.id,
        emailType: 'welcome',
        timezone,
        isActive: true,
      });

      // Also create weekly coaching subscription
      await db.insert(emailSubscriptions).values({
        userId: user.id,
        emailType: 'weekly_coaching',
        timezone,
        isActive: true,
        weeklyEmailCount: '0',
      });

      // Get user's top strengths for AI content generation
      const userStrengths = user.topStrengths || [];
      const strength1 = userStrengths[0];
      const strength2 = userStrengths[1];
      
      // Calculate next Monday
      const today = new Date();
      const daysUntilMonday = (8 - today.getDay()) % 7 || 7;
      const nextMonday = new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
      const nextMondayStr = nextMonday.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });

      // Generate AI-powered welcome email content
      const welcomeContent = await generateWelcomeEmailContent(
        user.firstName || undefined,
        strength1,
        strength2,
        nextMondayStr
      );
      
      // Handle error case
      if ('error' in welcomeContent) {
        console.error('Failed to generate welcome email content:', welcomeContent.error);
        // Fall back to simple template
        const { data, error } = await resend.emails.send({
          from: this.fromEmail,
          to: [user.email!],
          subject: 'Welcome to Strengths Manager! 🎯',
          html: this.generateWelcomeEmailHtml(user),
        });
        
        await storage.createEmailLog({
          userId: user.id,
          emailType: 'welcome',
          emailSubject: 'Welcome to Strengths Manager! 🎯',
          resendId: data?.id,
          status: error ? 'failed' : 'sent',
          errorMessage: error?.message,
        });
        
        if (error) {
          throw new Error(`Failed to send welcome email: ${error.message}`);
        }
        return;
      }
      
      // Render the proper React email template
      const welcomeHtml = await render(WelcomeEmail({
        firstName: user.firstName ?? undefined,
        strength1: strength1 || 'Strengths',
        strength2: strength2 || 'Leadership',
        challengeText: welcomeContent.challengeText,
        nextMonday: nextMondayStr,
        greeting: welcomeContent.greeting,
        dna: welcomeContent.dna,
        whatsNext: welcomeContent.whatsNext,
        cta: welcomeContent.cta,
        unsubscribeUrl: `${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${user.id}`
      }));
      
      // Direct email delivery to recipient
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: welcomeContent.subject,
        html: welcomeHtml,
      });

      // Log the email attempt
      await storage.createEmailLog({
        userId: user.id,
        emailType: 'welcome',
        emailSubject: welcomeContent.subject,
        resendId: data?.id,
        status: error ? 'failed' : 'sent',
        errorMessage: error?.message,
      });

      if (error) {
        console.error('Failed to send welcome email:', error);
        throw new Error(`Failed to send welcome email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in sendWelcomeEmail:', error);
      throw error;
    }
  }

  async sendWeeklyCoachingEmail(user: User, weekNumber: number): Promise<void> {
    try {
      // Check if user still has active weekly subscription and hasn't exceeded 12 weeks
      const subscription = await db
        .select()
        .from(emailSubscriptions)
        .where(
          and(
            eq(emailSubscriptions.userId, user.id),
            eq(emailSubscriptions.emailType, 'weekly_coaching'),
            eq(emailSubscriptions.isActive, true)
          )
        )
        .limit(1);

      if (!subscription.length) {
        console.log(`No active weekly subscription for user ${user.id}`);
        return;
      }

      const currentCount = parseInt(subscription[0].weeklyEmailCount || '0');
      if (currentCount >= 12) {
        console.log(`User ${user.id} has already received 12 weekly emails`);
        // Deactivate subscription
        await db
          .update(emailSubscriptions)
          .set({ isActive: false })
          .where(
            and(
              eq(emailSubscriptions.userId, user.id),
              eq(emailSubscriptions.emailType, 'weekly_coaching')
            )
          );
        return;
      }

      // Get team members for this user
      const userTeamMembers = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.managerId, user.id));

      // Generate AI content for the weekly email
      const emailContent = await this.generateWeeklyEmailContent(
        user,
        weekNumber,
        subscription[0],
        userTeamMembers
      );

      // Get random team member for team insight
      const randomTeamMember = userTeamMembers.length > 0 
        ? userTeamMembers[Math.floor(Math.random() * userTeamMembers.length)]
        : null;

      // Render the proper React email template
      const emailHtml = await render(WeeklyNudgeEmail({
        managerName: user.firstName || 'Manager',
        personalStrength: emailContent.personalStrength,
        personalTip: emailContent.personalInsight,
        specificAction: emailContent.techniqueContent || `Focus on leveraging your ${emailContent.personalStrength} strength this week`,
        teamMemberName: randomTeamMember?.name || emailContent.teamMemberName || 'Team Member',
        teamMemberStrength: randomTeamMember?.strengths?.[0] || emailContent.teamMemberStrength || 'Strategic Thinking',
        teamTip: emailContent.teamSection || 'Continue building team collaboration',
        weekNumber: weekNumber,
        dashboardUrl: `${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/dashboard`,
        unsubscribeUrl: `${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}/unsubscribe?token=${user.id}`
      }));

      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [user.email!],
        subject: emailContent.subjectLine,
        html: emailHtml,
      });

      // Update the weekly email count and variety tracking
      await this.updateEmailVarietyTracking(user.id, emailContent, weekNumber);

      // Log the email attempt
      await storage.createEmailLog({
        userId: user.id,
        emailType: 'weekly_coaching',
        emailSubject: emailContent.subjectLine,
        weekNumber: weekNumber.toString(),
        resendId: data?.id,
        status: error ? 'failed' : 'sent',
        errorMessage: error?.message,
      });

      if (error) {
        console.error('Failed to send weekly coaching email:', error);
        throw new Error(`Failed to send weekly coaching email: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in sendWeeklyCoachingEmail:', error);
      throw error;
    }
  }

  private async generateWeeklyEmailContent(
    user: User,
    weekNumber: number,
    subscription: any,
    teamMembers: any[]
  ): Promise<{
    subjectLine: string;
    preHeader: string;
    header: string;
    personalInsight: string;
    techniqueName: string;
    techniqueContent: string;
    teamSection: string;
    quote: string;
    quoteAuthor: string;
    personalStrength: string;
    teamMemberName: string;
    teamMemberStrength: string;
  }> {
    // Select featured strength from user's top 5
    const topStrengths = user.topStrengths || [];
    const featuredStrength = topStrengths[weekNumber % topStrengths.length] || topStrengths[0] || 'Achiever';

    // Select featured team member
    const featuredTeamMember = teamMembers[weekNumber % teamMembers.length] || teamMembers[0];
    const teamMemberName = featuredTeamMember?.name || 'Team Member';
    const teamMemberStrengths = featuredTeamMember?.strengths || [];
    const teamMemberFeaturedStrength = teamMemberStrengths[weekNumber % teamMemberStrengths.length] || teamMemberStrengths[0] || 'Achiever';

    // Get variety tracking data
    const previousPersonalTips = subscription.previousPersonalTips || [];
    const previousOpeners = subscription.previousOpeners || [];
    const previousTeamMembers = subscription.previousTeamMembers || [];

    // Generate AI content
    const content = await generateWeeklyEmailContent(
      user.firstName || 'Manager',
      topStrengths,
      weekNumber,
      teamMembers.length,
      featuredStrength,
      teamMemberName,
      teamMemberStrengths,
      teamMemberFeaturedStrength,
      previousPersonalTips,
      previousOpeners,
      previousTeamMembers
    );

    return {
      ...content,
      personalStrength: featuredStrength,
      teamMemberName,
      teamMemberStrength: teamMemberFeaturedStrength,
    };
  }

  private async updateEmailVarietyTracking(
    userId: string,
    emailContent: any,
    weekNumber: number
  ): Promise<void> {
    // Get current subscription
    const subscription = await db
      .select()
      .from(emailSubscriptions)
      .where(
        and(
          eq(emailSubscriptions.userId, userId),
          eq(emailSubscriptions.emailType, 'weekly_coaching')
        )
      )
      .limit(1);

    if (!subscription.length) return;

    const current = subscription[0];
    const currentCount = parseInt(current.weeklyEmailCount || '0');

    // Update variety tracking arrays (keep last 4 items)
    const updateData: any = {
      weeklyEmailCount: (currentCount + 1).toString(),
      isActive: currentCount + 1 < 12,
      lastSentAt: new Date(),
    };

    // Update previous openers (extract opener pattern from personal insight)
    const openerPattern = this.extractOpenerPattern(emailContent.personalInsight);
    const previousOpeners = [...(current.previousOpeners || []), openerPattern].slice(-4);
    updateData.previousOpeners = previousOpeners;

    // Update previous team members
    const previousTeamMembers = [...(current.previousTeamMembers || []), emailContent.teamMemberName].slice(-4);
    updateData.previousTeamMembers = previousTeamMembers;

    // Update previous personal tips (extract strength from personal insight)
    const personalTip = this.extractPersonalTip(emailContent.personalInsight);
    const previousPersonalTips = [...(current.previousPersonalTips || []), personalTip].slice(-4);
    updateData.previousPersonalTips = previousPersonalTips;

    // Update subject patterns
    const subjectPattern = this.extractSubjectPattern(emailContent.subjectLine);
    const previousSubjectPatterns = [...(current.previousSubjectPatterns || []), subjectPattern].slice(-4);
    updateData.previousSubjectPatterns = previousSubjectPatterns;

    // Update quote sources
    const quoteSource = this.determineQuoteSource(weekNumber);
    const previousQuoteSources = [...(current.previousQuoteSources || []), quoteSource].slice(-4);
    updateData.previousQuoteSources = previousQuoteSources;

    await db
      .update(emailSubscriptions)
      .set(updateData)
      .where(
        and(
          eq(emailSubscriptions.userId, userId),
          eq(emailSubscriptions.emailType, 'weekly_coaching')
        )
      );
  }

  private extractOpenerPattern(personalInsight: string): string {
    // Simple pattern extraction - can be enhanced
    if (personalInsight.includes('?')) return 'question';
    if (personalInsight.includes('does something unusual')) return 'observation';
    if (personalInsight.includes('Most') && personalInsight.includes('You\'re ready')) return 'challenge';
    if (personalInsight.includes('revelation')) return 'discovery';
    if (personalInsight.includes('Time to upgrade')) return 'direct';
    return 'default';
  }

  private extractPersonalTip(personalInsight: string): string {
    // Extract the main strength or theme from the insight
    const strengthMatch = personalInsight.match(/\b[A-Z][a-z]+\b/);
    return strengthMatch ? strengthMatch[0] : 'general';
  }

  private extractSubjectPattern(subjectLine: string): string {
    if (subjectLine.includes('your')) return 'action_strength';
    if (subjectLine.includes('with')) return 'outcome_strength';
    if (subjectLine.includes(',')) return 'name_benefit';
    if (subjectLine.includes('?')) return 'question';
    return 'default';
  }

  private determineQuoteSource(weekNumber: number): string {
    if (weekNumber <= 4) return 'business_leaders';
    if (weekNumber <= 8) return 'scientists_researchers';
    if (weekNumber <= 12) return 'historical_figures';
    if (weekNumber <= 16) return 'movies_tv';
    return 'business_leaders'; // Repeat cycle
  }

  async processWeeklyEmails(): Promise<void> {
    try {
      // Get all active weekly subscriptions
      const activeSubscriptions = await db
        .select({
          subscription: emailSubscriptions,
          user: users,
        })
        .from(emailSubscriptions)
        .innerJoin(users, eq(emailSubscriptions.userId, users.id))
        .where(
          and(
            eq(emailSubscriptions.emailType, 'weekly_coaching'),
            eq(emailSubscriptions.isActive, true)
          )
        );

      console.log(`Processing ${activeSubscriptions.length} active weekly subscriptions`);

      for (const { subscription, user } of activeSubscriptions) {
        const currentCount = parseInt(subscription.weeklyEmailCount || '0');
        
        if (currentCount < 12) {
          const nextWeek = currentCount + 1;
          await this.sendWeeklyCoachingEmail(user, nextWeek);
          console.log(`Sent week ${nextWeek} email to ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Error processing weekly emails:', error);
    }
  }

  private generateWelcomeEmailHtml(user: User): string {
    const firstName = user.firstName || 'there';
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Strengths Manager</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 5px; }
          .cta { text-align: center; margin: 30px 0; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
          .footer { text-align: center; color: #666; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Welcome to Strengths Manager! 🎯</h1>
          <p>Transform your strengths data into actionable coaching</p>
        </div>
        
        <div class="content">
          <h2>Hi ${firstName},</h2>
          
          <p>Welcome to Strengths Manager! We're excited to help you unlock your team's potential through strengths-based leadership.</p>
          
          <div class="highlight">
            <strong>What happens next?</strong><br>
            Starting Monday, you'll receive weekly coaching insights delivered straight to your inbox at 9 AM. Each email contains practical, science-backed strategies to help you apply your strengths and engage your team's unique talents.
          </div>
          
          <h3>Here's what you can expect:</h3>
          <ul>
            <li><strong>Week 1-3:</strong> Foundation building - Understanding your strengths ecosystem</li>
            <li><strong>Week 4-6:</strong> Team dynamics - Leveraging collective strengths</li>
            <li><strong>Week 7-9:</strong> Advanced applications - Strengths in challenging situations</li>
            <li><strong>Week 10-12:</strong> Mastery - Becoming a strengths-based leader</li>
          </ul>
          
          <div class="cta">
            <a href="${process.env.REPLIT_DOMAINS || 'https://your-app.replit.app'}" class="button">
              Start Your Strengths Journey
            </a>
          </div>
          
          <p>Remember: "Don't waste time trying to put in what was left out. Try to draw out what was left in." - Marcus Buckingham</p>
        </div>
        
        <div class="footer">
          <p>You're receiving this because you signed up for Strengths Manager.<br>
          Questions? Just reply to this email - we'd love to help!</p>
        </div>
      </body>
      </html>
    `;
  }
} export const emailService = new EmailService();
