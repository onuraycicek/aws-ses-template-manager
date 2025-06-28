//send email template from ses template
require('dotenv').config();

const AWS = require('aws-sdk');
const templateName = process.env.TEST_TEMPLATE_NAME
const region = "us-east-1"

const ses = new AWS.SES({ region: region });

const sendTemplate = async () => {
	const params = {
		Source: process.env.TEST_EMAIL_FROM,
		Template: templateName,
		Destination: {
			ToAddresses: [process.env.TEST_EMAIL_TO],
		},
		TemplateData: JSON.stringify({
			"url": "https://www.google.com",
			"auto_year": "2025",
			"t": {
				"body": "Hello, this is a test email",
				"subject": "Test Email",
				"title": "Test Email",
				"customize_button_text": "Customize"
			}
		}),
	}

	const response = await ses.sendTemplatedEmail(params).promise();
	console.log(response);
}

sendTemplate();