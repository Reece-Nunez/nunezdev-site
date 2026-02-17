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
};