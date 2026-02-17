# Recurring Invoices Automation Setup for AWS Amplify

## Overview
This sets up automated processing of recurring invoices that runs daily at 9:00 AM UTC using AWS Lambda and EventBridge.

## Setup Instructions

### 1. Add the Lambda Function to Amplify
```bash
amplify add function
```
- Choose "processRecurringInvoices" as the function name
- Select "Scheduled task" as the trigger
- Use the files already created in `amplify/backend/function/processRecurringInvoices/`

### 2. Set Environment Variables
Add these to your Amplify environment variables:
- `CRON_SECRET`: `cron_secret_key_for_automated_tasks_2024`
- `NEXTAUTH_URL`: Your Amplify app URL (e.g., https://main.d1234567890.amplifyapp.com)
- `NEXT_PUBLIC_BASE_URL`: Same as NEXTAUTH_URL

### 3. Deploy the Function
```bash
amplify push
```

### 4. Verify Setup
After deployment, check:
- Lambda function is created: `processRecurringInvoices-{env}`
- EventBridge rule is created with schedule: `cron(0 9 * * ? *)`
- Function has proper environment variables set

## How It Works

1. **Daily Trigger**: EventBridge runs the Lambda function daily at 9:00 AM UTC
2. **Authentication**: Lambda calls your API endpoint with the CRON_SECRET
3. **Processing**: Your existing `/api/recurring-invoices/process` handles the business logic
4. **Stripe Integration**: Invoices are automatically created and sent via Stripe
5. **Schedule Updates**: Next invoice dates are calculated and updated

## Manual Testing

You can manually trigger the function to test:
```bash
aws lambda invoke --function-name processRecurringInvoices-{env} response.json
```

## Monitoring

- Check CloudWatch logs: `/aws/lambda/processRecurringInvoices-{env}`
- Monitor Lambda metrics in AWS Console
- Check your application logs for processing results

## Security

- The CRON endpoint requires bearer token authentication
- Lambda function has minimal IAM permissions
- All environment variables are encrypted at rest