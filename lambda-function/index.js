const https = require('https');

exports.handler = async (event) => {
    console.log('Processing recurring invoices - Lambda triggered');
    
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.nunezdev.com';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.error('CRON_SECRET environment variable not set');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Configuration error: CRON_SECRET missing' })
        };
    }

    try {
        const response = await new Promise((resolve, reject) => {
            const options = {
                hostname: baseUrl.replace('https://', '').replace('http://', ''),
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
};