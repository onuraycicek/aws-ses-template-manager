# Localization System for SES Template Manager

This document explains how to use the localization (translation) system added to the AWS SES Template Manager.

## Overview

The localization system allows you to:
- Create templates with translation variables
- Manage translations for multiple languages
- Store translations in DynamoDB
- Automatically detect translation keys in your templates

## Setup

### 1. Create DynamoDB Table

Run the setup script to create the required DynamoDB table:

```bash
npm run setup-dynamodb
```

### 2. Environment Variables

Set the following environment variables (optional):

```bash
export TRANSLATION_TABLE_NAME=ses-template-translations
export AWS_REGION=us-east-1
export AWS_PROFILE_NAME=default
```

## Using Translation Variables

### Translation Variable Format

In your templates, use translation variables with the following format:

```html
{{t.variableName}}
```

or

```html
{{translate.variableName}}
```

### Examples

**Subject:**
```
{{t.welcome}} - {{t.companyName}}
```

**HTML Content:**
```html
<h1>{{t.greeting}}</h1>
<p>{{t.message}}</p>
<footer>{{t.footer}}</footer>
```

**Text Content:**
```
{{t.greeting}}

{{t.message}}

{{t.footer}}
```

## Managing Translations

### Creating Templates with Translations

1. Go to the "Create Template" page
2. Add your content with translation variables (e.g., `{{t.welcome}}`)
3. Select the language from the dropdown
4. The system will automatically detect translation variables
5. Fill in the translation values in the "Translation Keys Found" section
6. Save the template

### Updating Template Translations

1. Go to the "Update Template" page
2. Select the template to edit
3. Choose the language you want to edit from the dropdown
4. Click "Load Language" to load existing translations
5. Click "Add Language" to create translations for a new language
6. Update translation values as needed
7. Save the template

### Language Management

- **English (en)**: Default language
- **Turkish (tr)**: Türkçe
- **Spanish (es)**: Español
- **French (fr)**: Français
- **German (de)**: Deutsch

You can add more languages by modifying the language options in the frontend files.

## Data Structure

### DynamoDB Table Structure

The translations are stored in DynamoDB with the following structure:

**Table Name**: `ses-template-translations`

**Primary Key**: 
- Partition Key: `templateName` (String)
- Sort Key: `language` (String)

**Attributes**:
- `templateName`: Name of the SES template
- `language`: Language code (en, tr, es, fr, de, etc.)
- `translations`: JSON object containing key-value pairs
- `updatedAt`: Timestamp of last update

### Example Record

```json
{
  "templateName": "welcome-email",
  "language": "en",
  "translations": {
    "welcome": "Welcome",
    "greeting": "Hello there!",
    "message": "Thank you for signing up",
    "footer": "Best regards, Our Team"
  },
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## API Endpoints

### Get Translations
```
GET /translations/:TemplateName?language=en
```

### Save Translations
```
POST /translations/:TemplateName
Body: {
  "language": "en",
  "translations": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

### Get Template Languages
```
GET /template-languages/:TemplateName
```

## Best Practices

1. **Consistent Naming**: Use descriptive names for translation keys
   - ✅ `{{t.welcomeMessage}}`
   - ❌ `{{t.msg1}}`

2. **Organize by Section**: Group related translations
   - `{{t.header.title}}`
   - `{{t.content.description}}`
   - `{{t.footer.copyright}}`

3. **Default Language**: Always provide English translations as fallback

4. **Testing**: Test templates with different languages before sending

## Troubleshooting

### Common Issues

1. **DynamoDB Table Not Found**
   - Run `npm run setup-dynamodb` to create the table
   - Check AWS credentials and region settings

2. **Translation Variables Not Detected**
   - Ensure you're using the correct format: `{{t.keyName}}`
   - Check for typos in variable names

3. **Translations Not Saving**
   - Verify AWS permissions for DynamoDB access
   - Check console for error messages

### Permissions Required

Your AWS user/role needs the following permissions for DynamoDB:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ses-template-translations"
    }
  ]
}
```

## Future Enhancements

- Support for pluralization rules
- Import/export translations from/to CSV/JSON files
- Translation validation and missing key detection
- Integration with professional translation services
- Template preview with applied translations 