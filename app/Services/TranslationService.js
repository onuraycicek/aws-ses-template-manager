'use strict'

const Env = use('Env');
const AWS = require('aws-sdk');
const { Translate } = require('@google-cloud/translate').v2;

class TranslationService {
	constructor() {
		const credentials = new AWS.SharedIniFileCredentials({ profile: Env.get('AWS_PROFILE_NAME', 'default') });
		AWS.config.credentials = credentials;
		AWS.config.update({ region: Env.get('AWS_REGION', 'us-east-1') });

		this.dynamodb = new AWS.DynamoDB.DocumentClient();
		this.tableName = Env.get('TRANSLATION_TABLE_NAME', 'ses-template-translations');

		// Initialize Google Translate
		this.googleTranslate = new Translate({
			projectId: Env.get('GOOGLE_CLOUD_PROJECT_ID'),
			keyFilename: Env.get('GOOGLE_APPLICATION_CREDENTIALS')
		});

		// Language code mapping
		this.languageMap = {
			'en': 'en',
			'ar': 'ar',
			'ca': 'ca',
			'zh_Hans': 'zh-CN',
			'zh_Hant': 'zh-TW',
			'hr': 'hr',
			'cs': 'cs',
			'da': 'da',
			'nl': 'nl',
			'fi': 'fi',
			'fr': 'fr',
			'de': 'de',
			'el': 'el',
			'he': 'he',
			'hi': 'hi',
			'hu': 'hu',
			'id': 'id',
			'it': 'it',
			'ja': 'ja',
			'ko': 'ko',
			'ms': 'ms',
			'no': 'no',
			'pl': 'pl',
			'pt': 'pt',
			'ro': 'ro',
			'ru': 'ru',
			'sk': 'sk',
			'es': 'es',
			'sv': 'sv',
			'th': 'th',
			'tr': 'tr',
			'uk': 'uk',
			'vi': 'vi'
		};

		// Supported languages with RTL information
		this.supportedLanguages = [
			{ code: 'en', name: 'English', rtl: false },
			{ code: 'ar', name: 'Arabic', rtl: true },
			{ code: 'ca', name: 'Catalan', rtl: false },
			{ code: 'zh_Hans', name: 'Chinese (Simplified)', rtl: false },
			{ code: 'zh_Hant', name: 'Chinese (Traditional)', rtl: false },
			{ code: 'hr', name: 'Croatian', rtl: false },
			{ code: 'cs', name: 'Czech', rtl: false },
			{ code: 'da', name: 'Danish', rtl: false },
			{ code: 'nl', name: 'Dutch', rtl: false },
			{ code: 'fi', name: 'Finnish', rtl: false },
			{ code: 'fr', name: 'French', rtl: false },
			{ code: 'de', name: 'German', rtl: false },
			{ code: 'el', name: 'Greek', rtl: false },
			{ code: 'he', name: 'Hebrew', rtl: true },
			{ code: 'hi', name: 'Hindi', rtl: false },
			{ code: 'hu', name: 'Hungarian', rtl: false },
			{ code: 'id', name: 'Indonesian', rtl: false },
			{ code: 'it', name: 'Italian', rtl: false },
			{ code: 'ja', name: 'Japanese', rtl: false },
			{ code: 'ko', name: 'Korean', rtl: false },
			{ code: 'ms', name: 'Malay', rtl: false },
			{ code: 'no', name: 'Norwegian', rtl: false },
			{ code: 'pl', name: 'Polish', rtl: false },
			{ code: 'pt', name: 'Portuguese', rtl: false },
			{ code: 'ro', name: 'Romanian', rtl: false },
			{ code: 'ru', name: 'Russian', rtl: false },
			{ code: 'sk', name: 'Slovak', rtl: false },
			{ code: 'es', name: 'Spanish', rtl: false },
			{ code: 'sv', name: 'Swedish', rtl: false },
			{ code: 'th', name: 'Thai', rtl: false },
			{ code: 'tr', name: 'Turkish', rtl: false },
			{ code: 'uk', name: 'Ukrainian', rtl: false },
			{ code: 'vi', name: 'Vietnamese', rtl: false }
		];
	}

	/**
	 * Extract translation variables from content
	 * Format: {{t.key}} or {{translate.key}}
	 */
	extractTranslationKeys(content) {
		if (!content) return [];

		const translationRegex = /{{\s*(t|translate)\.(\w+(?:\.\w+)*)\s*}}/g;
		const keys = [];
		let match;

		while ((match = translationRegex.exec(content)) !== null) {
			keys.push(match[2]); // The key part after 't.' or 'translate.'
		}

		return [...new Set(keys)]; // Remove duplicates
	}

	/**
	 * Get translations for a template
	 */
	async getTranslations(templateName, language = 'en') {
		try {
			const params = {
				TableName: this.tableName,
				Key: {
					templateName: templateName,
					language: language
				}
			};

			const result = await this.dynamodb.get(params).promise();
			return result.Item ? result.Item.translations : {};
		} catch (error) {
			console.error('Error getting translations:', error);
			return {};
		}
	}

	/**
	 * Save translations for a template
	 */
	async saveTranslations(templateName, language, translations) {
		try {
			// Add is_rtl boolean to translations automatically
			const enhancedTranslations = {
				...translations,
				is_rtl: this.isRTLLanguage(language)
			};

			const params = {
				TableName: this.tableName,
				Item: {
					templateName: templateName,
					language: language,
					translations: enhancedTranslations,
					updatedAt: new Date().toISOString()
				}
			};

			await this.dynamodb.put(params).promise();
			console.log(`Translations saved for ${templateName} (${language}) with is_rtl: ${this.isRTLLanguage(language)}`);
			return true;
		} catch (error) {
			console.error('Error saving translations:', error);
			return false;
		}
	}

	/**
	 * Get all languages for a template
	 */
	async getTemplateLanguages(templateName) {
		try {
			const params = {
				TableName: this.tableName,
				FilterExpression: 'templateName = :templateName',
				ExpressionAttributeValues: {
					':templateName': templateName
				}
			};

			const result = await this.dynamodb.scan(params).promise();
			return result.Items.map(item => item.language);
		} catch (error) {
			console.error('Error getting template languages:', error);
			return [];
		}
	}

	/**
	 * Delete translations for a template (all languages)
	 */
	async deleteTemplateTranslations(templateName) {
		try {
			const languages = await this.getTemplateLanguages(templateName);

			const deletePromises = languages.map(language => {
				const params = {
					TableName: this.tableName,
					Key: {
						templateName: templateName,
						language: language
					}
				};
				return this.dynamodb.delete(params).promise();
			});

			await Promise.all(deletePromises);
			return true;
		} catch (error) {
			console.error('Error deleting template translations:', error);
			return false;
		}
	}

	/**
	 * Replace translation variables in content
	 */
	replaceTranslationVariables(content, translations = {}) {
		if (!content) return content;

		return content.replace(/{{\s*(t|translate)\.(\w+(?:\.\w+)*)\s*}}/g, (match, prefix, key) => {
			return translations[key] || match; // Keep original if translation not found
		});
	}

	/**
	 * Check if a language is RTL (Right-to-Left)
	 */
	isRTLLanguage(languageCode) {
		const language = this.supportedLanguages.find(lang => lang.code === languageCode);
		return language ? language.rtl : false;
	}

	/**
	 * Apply RTL transformations to HTML content
	 */
	applyRTLTransformations(htmlContent, languageCode) {
		if (!this.isRTLLanguage(languageCode)) {
			return htmlContent;
		}

		// Add RTL attributes and styles
		let transformedHtml = htmlContent;

		// Add dir="rtl" to html tag
		transformedHtml = transformedHtml.replace(
			/<html([^>]*)>/i,
			'<html$1 dir="rtl">'
		);

		// If no html tag, add dir to body
		if (!transformedHtml.includes('<html')) {
			transformedHtml = transformedHtml.replace(
				/<body([^>]*)>/i,
				'<body$1 dir="rtl">'
			);
		}

		// Add RTL-specific CSS styles
		const rtlStyles = `
			<style>
				/* RTL Email Styles */
				.rtl-text { direction: rtl; text-align: right; }
				.rtl-container { direction: rtl; }
				.rtl-button { margin-left: 0; margin-right: auto; }
				table[dir="rtl"] td { text-align: right; }
				table[dir="rtl"] td[align="center"] { text-align: center; }
			</style>
		`;

		// Insert RTL styles in head
		if (transformedHtml.includes('<head>')) {
			transformedHtml = transformedHtml.replace(
				'<head>',
				'<head>' + rtlStyles
			);
		} else {
			// If no head tag, add before body
			transformedHtml = rtlStyles + transformedHtml;
		}

		// Add RTL classes to text elements
		transformedHtml = transformedHtml.replace(
			/<(p|div|span|td)([^>]*style="[^"]*text-align:\s*center[^"]*"[^>]*)>/gi,
			'<$1$2>' // Keep center alignment as is
		);

		transformedHtml = transformedHtml.replace(
			/<(p|div|span|td)([^>]*(?!style="[^"]*text-align:\s*center)[^>]*)>/gi,
			'<$1$2 class="rtl-text">'
		);

		// Add RTL direction to tables
		transformedHtml = transformedHtml.replace(
			/<table([^>]*)>/gi,
			'<table$1 dir="rtl">'
		);

		return transformedHtml;
	}

	/**
 * Replace translation variables and apply RTL transformations
 */
	processTemplateForLanguage(content, translations = {}, languageCode = 'en') {
		// First replace translation variables
		let processedContent = this.replaceTranslationVariables(content, translations);

		// Then apply RTL transformations if needed
		processedContent = this.applyRTLTransformations(processedContent, languageCode);

		return processedContent;
	}

	/**
	 * Wrap body content with HTML structure and RTL support
	 */
	wrapWithHTMLStructure(bodyContent, includeRTLSupport = true) {
		const rtlConditions = includeRTLSupport ? '{{#if t.is_rtl}} dir="rtl" style="direction: rtl;"{{/if}}' : '';
		const rtlBodyConditions = includeRTLSupport ? '{{#if t.is_rtl}} dir="rtl" style="margin: 0; padding: 0; direction: rtl; text-align: right;"{{else}} style="margin: 0; padding: 0;"{{/if}}' : ' style="margin: 0; padding: 0;"';

		return `<!DOCTYPE html>
<html${rtlConditions}>
<head>
    <meta charset="UTF-8">
</head>
<body${rtlBodyConditions}>
${bodyContent}
</body>
</html>`;
	}

	/**
	 * Extract body content from full HTML (for editing)
	 */
	extractBodyContent(fullHtml) {
		if (!fullHtml) return '';

		// Extract content between <body> and </body> tags
		const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
		if (bodyMatch) {
			return bodyMatch[1].trim();
		}

		// If no body tags found, return the content as is
		return fullHtml;
	}

	/**
	 * Auto-translate English translations to other languages using Google Translate
	 */
	async autoTranslate(templateName, englishTranslations) {
		try {
			const targetLanguages = this.supportedLanguages
				.filter(lang => lang.code !== 'en')
				.map(lang => lang.code);
			const results = {};

			for (const targetLang of targetLanguages) {
				const translatedTexts = {};

				// Translate each key-value pair
				for (const [key, englishText] of Object.entries(englishTranslations)) {
					if (!englishText || englishText.trim() === '') {
						translatedTexts[key] = '';
						continue;
					}

					try {
						const [translation] = await this.googleTranslate.translate(englishText, {
							from: 'en',
							to: this.languageMap[targetLang]
						});
						translatedTexts[key] = translation;
					} catch (error) {
						console.error(`Error translating "${englishText}" to ${targetLang}:`, error);
						translatedTexts[key] = englishText; // Fallback to original text
					}
				}

				// Save translations to database
				await this.saveTranslations(templateName, targetLang, translatedTexts);
				results[targetLang] = translatedTexts;
			}

			return results;
		} catch (error) {
			console.error('Error in auto-translate:', error);
			throw error;
		}
	}
}

module.exports = TranslationService 