//get email template from ses template
require('dotenv').config();
const fs = require('fs');

const AWS = require('aws-sdk');
const templateName = process.env.TEST_TEMPLATE_NAME
const region = "us-east-1"

const ses = new AWS.SES({ region: region });

const getTemplate = async () => {
	const params = {
		TemplateName: templateName,
	}

	const response = await ses.getTemplate(params).promise();
	console.log(response);
	//write to file
	fs.writeFileSync('template.html', response.Template.HtmlPart);
}

getTemplate();