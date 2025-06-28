#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS - use environment variables directly
const region = process.env.AWS_REGION || 'us-east-1';
const profileName = process.env.AWS_PROFILE_NAME || 'default';

const credentials = new AWS.SharedIniFileCredentials({ profile: profileName });
AWS.config.credentials = credentials;
AWS.config.update({ region: region });

const dynamodb = new AWS.DynamoDB();

const tableName = process.env.TRANSLATION_TABLE_NAME || 'ses-template-translations';

const tableParams = {
	TableName: tableName,
	KeySchema: [
		{
			AttributeName: 'templateName',
			KeyType: 'HASH'  // Partition key
		},
		{
			AttributeName: 'language',
			KeyType: 'RANGE'  // Sort key
		}
	],
	AttributeDefinitions: [
		{
			AttributeName: 'templateName',
			AttributeType: 'S'
		},
		{
			AttributeName: 'language',
			AttributeType: 'S'
		}
	],
	BillingMode: 'PAY_PER_REQUEST'
};

async function createTable() {
	try {
		console.log(`Creating DynamoDB table: ${tableName}`);

		// Check if table already exists
		try {
			await dynamodb.describeTable({ TableName: tableName }).promise();
			console.log(`Table ${tableName} already exists!`);
			return;
		} catch (err) {
			if (err.code !== 'ResourceNotFoundException') {
				throw err;
			}
		}

		// Create the table
		const result = await dynamodb.createTable(tableParams).promise();
		console.log(`Table ${tableName} created successfully!`);

		// Wait for table to be active
		console.log('Waiting for table to be active...');
		await dynamodb.waitFor('tableExists', { TableName: tableName }).promise();
		console.log(`Table ${tableName} is now active!`);

	} catch (error) {
		console.error('Error creating DynamoDB table:', error);
		process.exit(1);
	}
}

// Run the setup
createTable().then(() => {
	console.log('\nDynamoDB setup completed successfully!');
	console.log('\nTo use the translation system:');
	console.log('1. Make sure your AWS credentials are configured');
	console.log('2. Set the TRANSLATION_TABLE_NAME environment variable if you want a different table name');
	console.log('3. Use translation variables in your templates like {{t.welcome}} or {{translate.goodbye}}');
	console.log('4. The system will automatically detect these variables and provide input fields for translations');
	process.exit(0);
}).catch(error => {
	console.error('Setup failed:', error);
	process.exit(1);
}); 