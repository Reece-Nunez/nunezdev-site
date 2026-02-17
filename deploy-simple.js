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
        await iam.createRole({
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
        console.log('Waiting for IAM role to be available...');
        await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
        if (error.code !== 'EntityAlreadyExists') {
            throw error;
        }
        console.log('IAM role already exists, continuing...');
    }

    // Step 2: Read Lambda function code
    const functionCode = fs.readFileSync(path.join(__dirname, 'lambda-function', 'index.js'));
    const functionName = 'processRecurringInvoices';
    
    try {
        console.log('Creating Lambda function...');
        await lambda.createFunction({
            FunctionName: functionName,
            Runtime: 'nodejs18.x',
            Role: `arn:aws:iam::730335638958:role/${roleName}`,
            Handler: 'index.handler',
            Code: {
                ZipFile: functionCode
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
                ZipFile: functionCode
            }).promise();
            console.log('Lambda function updated successfully');
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
            console.log('Permission already exists');
        }

        console.log('CloudWatch Events rule created successfully');

    } catch (error) {
        if (error.code === 'ResourceAlreadyExistsException') {
            console.log('CloudWatch rule already exists');
        } else {
            console.error('Error creating CloudWatch rule:', error);
            throw error;
        }
    }

    console.log('✅ Deployment completed successfully!');
    console.log(`Lambda function: ${functionName}`);
    console.log(`Schedule: Daily at 9:00 AM UTC`);
    console.log(`CloudWatch rule: ${ruleName}`);
    console.log('Your recurring invoices will now be processed automatically every day!');
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