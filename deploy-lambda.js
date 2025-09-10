const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();
const events = new AWS.CloudWatchEvents();
const iam = new AWS.IAM();

async function deployRecurringInvoicesLambda() {
    console.log('Starting deployment of recurring invoices Lambda function...');

    // Step 1: Create IAM role for Lambda
    const roleName = 'RecurringInvoicesLambdaRole';
    const assumeRolePolicyDocument = {
        Version: '2012-10-17',
        Statement: [
            {
                Effect: 'Allow',
                Principal: { Service: 'lambda.amazonaws.com' },
                Action: 'sts:AssumeRole'
            }
        ]
    };

    try {
        console.log('Creating IAM role...');
        const roleResult = await iam.createRole({
            RoleName: roleName,
            AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument),
            Description: 'Lambda execution role for recurring invoices automation'
        }).promise();

        // Attach basic execution policy
        await iam.attachRolePolicy({
            RoleName: roleName,
            PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
        }).promise();

        console.log('IAM role created successfully');
        
        // Wait for role to be available
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
        if (error.code !== 'EntityAlreadyExists') {
            throw error;
        }
        console.log('IAM role already exists, continuing...');
    }

    // Step 2: Create Lambda function
    const functionCode = `
const https = require('https');

exports.handler = async (event) => {
    console.log('Processing recurring invoices - Lambda triggered');
    
    const baseUrl = 'https://www.nunezdev.com';
    const cronSecret = 'cron_secret_key_for_automated_tasks_2024';
    
    try {
        const response = await new Promise((resolve, reject) => {
            const options = {
                hostname: 'www.nunezdev.com',
                port: 443,
                path: '/api/cron/process-recurring-invoices',
                method: 'GET',
                headers: {
                    'Authorization': 'Bearer ' + cronSecret,
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        resolve({ statusCode: res.statusCode, body: result });
                    } catch (e) {
                        resolve({ statusCode: res.statusCode, body: { raw: data } });
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });

        console.log('Recurring invoice processing completed:', response.body);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                timestamp: new Date().toISOString(),
                ...response.body
            })
        };

    } catch (error) {
        console.error('Error in Lambda function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Lambda execution failed',
                message: error.message
            })
        };
    }
};`;

    const functionName = 'processRecurringInvoices';
    
    try {
        console.log('Creating Lambda function...');
        const lambdaResult = await lambda.createFunction({
            FunctionName: functionName,
            Runtime: 'nodejs18.x',
            Role: `arn:aws:iam::730335638958:role/${roleName}`,
            Handler: 'index.handler',
            Code: {
                ZipFile: Buffer.from(`exports.handler = ${functionCode}`)
            },
            Description: 'Automated processing of recurring invoices',
            Timeout: 30
        }).promise();

        console.log('Lambda function created successfully');

    } catch (error) {
        if (error.code === 'ResourceConflictException') {
            console.log('Lambda function already exists, updating...');
            await lambda.updateFunctionCode({
                FunctionName: functionName,
                ZipFile: Buffer.from(`exports.handler = ${functionCode}`)
            }).promise();
        } else {
            throw error;
        }
    }

    // Step 3: Create CloudWatch Events rule
    const ruleName = 'RecurringInvoicesSchedule';
    
    try {
        console.log('Creating CloudWatch Events rule...');
        await events.putRule({
            Name: ruleName,
            ScheduleExpression: 'cron(0 9 * * ? *)', // Daily at 9 AM UTC
            Description: 'Trigger Lambda to process recurring invoices daily',
            State: 'ENABLED'
        }).promise();

        // Add Lambda as target
        await events.putTargets({
            Rule: ruleName,
            Targets: [
                {
                    Id: '1',
                    Arn: `arn:aws:lambda:us-east-1:730335638958:function:${functionName}`
                }
            ]
        }).promise();

        // Add permission for EventBridge to invoke Lambda
        try {
            await lambda.addPermission({
                FunctionName: functionName,
                StatementId: 'AllowEventBridgeInvoke',
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: `arn:aws:events:us-east-1:730335638958:rule/${ruleName}`
            }).promise();
        } catch (permError) {
            if (permError.code !== 'ResourceConflictException') {
                throw permError;
            }
        }

        console.log('CloudWatch Events rule created successfully');

    } catch (error) {
        console.error('Error creating CloudWatch rule:', error);
        throw error;
    }

    console.log('✅ Deployment completed successfully!');
    console.log(`Lambda function: ${functionName}`);
    console.log(`Schedule: Daily at 9:00 AM UTC`);
    console.log(`CloudWatch rule: ${ruleName}`);
}

// Run deployment
if (require.main === module) {
    deployRecurringInvoicesLambda()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Deployment failed:', error);
            process.exit(1);
        });
}

module.exports = { deployRecurringInvoicesLambda };