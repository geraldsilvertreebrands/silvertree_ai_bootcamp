# Slack Integration Setup Guide

This guide walks you through setting up Slack notifications for the Access Management System.

## Prerequisites

- Admin access to a Slack workspace
- Ability to install apps in the workspace

## Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter app details:
   - **App Name**: `Access Management Bot` (or your preferred name)
   - **Pick a workspace**: Select your workspace
5. Click **"Create App"**

## Step 2: Configure Bot Token Scopes

1. In your app settings, go to **"OAuth & Permissions"** (left sidebar)
2. Scroll down to **"Scopes"** → **"Bot Token Scopes"**
3. Add the following scopes:
   - `chat:write` - Send messages
   - `users:read` - Read user information
   - `users:read.email` - Read user email addresses (for email lookup)

## Step 3: Install App to Workspace

1. Still in **"OAuth & Permissions"**, scroll to the top
2. Click **"Install to Workspace"**
3. Review the permissions and click **"Allow"**
4. You'll be redirected back to the OAuth page

## Step 4: Get Your Bot Token

1. After installation, you'll see **"Bot User OAuth Token"** at the top of the OAuth page
2. It starts with `xoxb-` (e.g., `xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
3. Click **"Copy"** to copy the token
4. **⚠️ Keep this token secret!** Don't commit it to version control

## Step 5: Configure Environment Variables

Add the following to your `.env` file:

```env
# Slack Integration
ENABLE_SLACK=true
SLACK_BOT_TOKEN=xoxb-your-actual-token-here

# Application Base URL (for deep links in notifications)
APP_BASE_URL=http://localhost:3000
```

For production, use your actual domain:
```env
APP_BASE_URL=https://your-domain.com
```

## Step 6: Test the Integration

1. Start your application:
   ```bash
   npm run start:dev
   ```

2. Create an access request through the dashboard

3. If configured correctly:
   - **Manager** should receive a Slack DM when a request is created
   - **System owners** should receive a Slack DM when a request is approved
   - **Requester** should receive a Slack DM when request status changes

## Troubleshooting

### Bot doesn't send messages

1. **Check token**: Verify `SLACK_BOT_TOKEN` is correct and starts with `xoxb-`
2. **Check scopes**: Ensure all required scopes are added
3. **Check logs**: Look for error messages in console/logs
4. **Check user email**: User's Slack email must match their system email

### User not found in Slack

- The bot looks up users by email address
- User's Slack email must match their email in the access management system
- If emails don't match, the notification will be skipped (gracefully)

### Testing without Slack

If you want to test without Slack configured:
```env
ENABLE_SLACK=false
```

Notifications will be logged to console instead.

## Security Best Practices

1. **Never commit tokens to version control**
   - Add `.env` to `.gitignore`
   - Use environment variables or secrets management in production

2. **Rotate tokens if compromised**
   - Go to your Slack app settings
   - Regenerate the token
   - Update your `.env` file

3. **Use workspace-specific tokens**
   - Each workspace has its own token
   - Don't share tokens between workspaces

## Additional Configuration (Optional)

### Customize Notification Messages

Edit `src/integrations/notifications/slack-notification.adapter.ts` to customize:
- Message text
- Block layouts
- Button labels
- Emoji/icons

### Rate Limiting

Slack has rate limits:
- Tier 2: 20 requests per minute
- Tier 3: 50+ requests per minute (requires approval)

For high-volume workspaces, consider:
- Implementing retry logic with exponential backoff
- Batching notifications
- Using Slack's Events API for better scalability

## Support

For Slack API issues:
- [Slack API Documentation](https://api.slack.com)
- [Slack Community](https://slackcommunity.com/)

For application issues:
- Check application logs
- Verify environment variables
- Test with `ENABLE_SLACK=false` to isolate Slack-specific issues

