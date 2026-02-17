const https = require('https');

exports.handler = async (event) => {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.nunezdev.com';
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
        console.error('CRON_SECRET environment variable not set');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Configuration error' })
        };
    }

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({});
        
        const options = {
            hostname: baseUrl.replace('https://', '').replace('http://', ''),
            port: 443,
            path: '/api/recurring-invoices/process',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer ${cronSecret}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log(`Recurring invoice processing completed: ${result.processed || 0} invoices processed`);
                    
                    resolve({
                        statusCode: 200,
                        body: JSON.stringify({
                            success: true,
                            message: `Processed ${result.processed || 0} recurring invoices`,
                            timestamp: new Date().toISOString(),
                            ...result
                        })
                    });
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    console.error('Raw response:', data);
                    
                    resolve({
                        statusCode: 500,
                        body: JSON.stringify({
                            error: 'Failed to parse response',
                            rawResponse: data
                        })
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Error processing recurring invoices:', error);
            resolve({
                statusCode: 500,
                body: JSON.stringify({
                    error: 'Failed to process recurring invoices',
                    message: error.message
                })
            });
        });

        req.write(postData);
        req.end();
    });
};