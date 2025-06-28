'use strict'
const Env = use('Env');
const AWS = require('aws-sdk');
const TranslationService = require('../../Services/TranslationService');

const credentials = new AWS.SharedIniFileCredentials({ profile: Env.get('AWS_PROFILE_NAME', 'default') });
AWS.config.credentials = credentials;

class SesTemplateController {
  constructor() {
    this.translationService = new TranslationService();
  }

  getDynamicFields(contentStr) {
    // a helper function which will convert a string into an array of any mustache dynamic fields
    let dynamicFieldsArr = [];
    if (contentStr) {
      const matchRegex = contentStr.match(/{{\s*[\w\.]+\s*}}/g);  // match on any mustache templates
      if (matchRegex) {
        dynamicFieldsArr = matchRegex.map(function (x) { return x.match(/[\w\.]+/)[0]; });
      }
    }

    return dynamicFieldsArr;
  }

  async createTemplate({ request, response }) {
    const requestBody = request.post();

    AWS.config.update({ region: requestBody.region });
    const ses = new AWS.SES();

    // Wrap HTML content with proper HTML structure and RTL support
    const wrappedHtml = this.translationService.wrapWithHTMLStructure(requestBody.HtmlPart);

    const params = {
      Template: {
        TemplateName: requestBody.TemplateName, /* required */
        HtmlPart: wrappedHtml, // Use wrapped HTML
        SubjectPart: requestBody.SubjectPart,
        TextPart: requestBody.TextPart
      }
    };

    await new Promise((resolve, reject) => {
      //do async AWS createTemplate
      ses.createTemplate(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }).then(async (data) => {
      // Save initial translations if provided
      if (requestBody.allLanguageTranslations) {
        const savePromises = [];
        for (const [language, translations] of Object.entries(requestBody.allLanguageTranslations)) {
          if (translations && Object.keys(translations).length > 0) {
            savePromises.push(
              this.translationService.saveTranslations(
                requestBody.TemplateName,
                language,
                translations
              )
            );
          }
        }
        await Promise.all(savePromises);
      }
      response.send(200, 'Created');
    }).catch(err => {
      response.status(500);
      response.send(err);
    });
  }

  async listTemplates({ request, response }) {
    const requestParams = request.get();

    AWS.config.update({ region: requestParams.region });
    const ses = new AWS.SES();

    await new Promise((resolve, reject) => {
      ses.listTemplates({ MaxItems: requestParams.MaxItems || 5000 }, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }).then(data => {
      response.status(200);
      response.send({ items: data });
    }).catch(err => {
      response.status(500);
      response.send(err)
    });
  }

  async getTemplate({ request, response }) {
    const requestParams = request.params;
    const requestQueryParams = request.get();

    AWS.config.update({ region: requestQueryParams.region });
    const ses = new AWS.SES();

    const params = {
      TemplateName: requestParams.TemplateName
    };

    await new Promise((resolve, reject) => {
      ses.getTemplate(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    }).then(async (data) => {
      response.status(200);

      // get dynamic fields to return to the FE
      const { SubjectPart, TextPart, HtmlPart } = data.Template;

      // Extract only body content from HTML for editing
      const bodyContent = this.translationService.extractBodyContent(HtmlPart);

      // get 'SubjectPart', 'HtmlPart', 'TextPart' dynamic fields
      let dynamicFieldsArr = [];
      dynamicFieldsArr = [...dynamicFieldsArr, ...this.getDynamicFields(SubjectPart)]; // SubjectPart
      dynamicFieldsArr = [...dynamicFieldsArr, ...this.getDynamicFields(TextPart)]; // TextPart
      dynamicFieldsArr = [...dynamicFieldsArr, ...this.getDynamicFields(bodyContent)]; // Use body content for dynamic fields

      dynamicFieldsArr = Array.from(new Set(dynamicFieldsArr)); // removes any dupes

      // Extract translation keys
      let translationKeys = [];
      translationKeys = [...translationKeys, ...this.translationService.extractTranslationKeys(SubjectPart)];
      translationKeys = [...translationKeys, ...this.translationService.extractTranslationKeys(TextPart)];
      translationKeys = [...translationKeys, ...this.translationService.extractTranslationKeys(bodyContent)]; // Use body content for translation keys
      translationKeys = Array.from(new Set(translationKeys));

      // Get available languages for this template
      const availableLanguages = await this.translationService.getTemplateLanguages(requestParams.TemplateName);

      // Get translations for requested language
      const language = requestQueryParams.language || 'en';
      const translations = await this.translationService.getTranslations(requestParams.TemplateName, language);

      // Return body content instead of full HTML for editing
      data.Template.HtmlPart = bodyContent;
      data.Template['dynamicFields'] = dynamicFieldsArr;  // add the dynamicFields to the payload
      data.Template['translationKeys'] = translationKeys;
      data.Template['availableLanguages'] = availableLanguages;
      data.Template['currentLanguage'] = language;
      data.Template['translations'] = translations;

      response.send({ data: data.Template });
    }).catch(err => {
      response.status(500);
      response.send(err);
    });
  }

  async updateTemplate({ request, response }) {
    const requestBody = request.post();

    AWS.config.update({ region: requestBody.region });
    const ses = new AWS.SES();

    // Wrap HTML content with proper HTML structure and RTL support
    const wrappedHtml = this.translationService.wrapWithHTMLStructure(requestBody.HtmlPart);

    const params = {
      Template: {
        TemplateName: requestBody.TemplateName, /* required */
        HtmlPart: wrappedHtml, // Use wrapped HTML
        SubjectPart: requestBody.SubjectPart,
        TextPart: requestBody.TextPart
      }
    };

    await new Promise((resolve, reject) => {
      ses.updateTemplate(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).then(async (data) => {
      // Save updated translations if provided
      if (requestBody.allLanguageTranslations) {
        const savePromises = [];
        for (const [language, translations] of Object.entries(requestBody.allLanguageTranslations)) {
          if (translations && Object.keys(translations).length > 0) {
            savePromises.push(
              this.translationService.saveTranslations(
                requestBody.TemplateName,
                language,
                translations
              )
            );
          }
        }
        await Promise.all(savePromises);
      }
      response.send(200);
    }).catch(err => {
      response.status(500);
      response.send(err);
    });
  }

  async deleteTemplate({ request, response }) {
    const requestParams = request.params;
    const requestQueryParams = request.get();

    AWS.config.update({ region: requestQueryParams.region });
    const ses = new AWS.SES();

    await new Promise((resolve, reject) => {
      const params = {
        TemplateName: requestParams.TemplateName /* required */
      };
      ses.deleteTemplate(params, function (err, data) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }).then(async (data) => {
      // Also delete translations
      await this.translationService.deleteTemplateTranslations(requestParams.TemplateName);
      response.send(200);
    }).catch(err => {
      response.status(500);
      response.send(err);
    });
  }

  async sendTemplate({ request, response }) {
    const requestBody = request.post();
    const params = {
      Destination: { /* required */
        ToAddresses: [
          requestBody.toAddress
        ]
      },
      Source: requestBody.source, /* required */
      Template: requestBody.templateName, /* required */
      TemplateData: requestBody.templateData, /* required */
    };

    AWS.config.update({ region: requestBody.region });
    const ses = new AWS.SES();

    await new Promise((resolve, reject) => {
      ses.sendTemplatedEmail(params, function (err, data) {
        if (err) {
          // an error occurred
          console.log(err, err.stack);
          reject(err);
        } else {
          resolve(data);           // successful response
        }
      });
    }).then((data) => {
      response.send(200);
    }).catch((err) => {
      response.status(500);
      response.send(err);
    });

  }

  async getTranslations({ request, response }) {
    const requestParams = request.params;
    const requestQueryParams = request.get();

    try {
      const translations = await this.translationService.getTranslations(
        requestParams.TemplateName,
        requestQueryParams.language || 'en'
      );

      response.status(200);
      response.send({ translations });
    } catch (error) {
      response.status(500);
      response.send({ error: error.message });
    }
  }

  async saveTranslations({ request, response }) {
    const requestParams = request.params;
    const requestBody = request.post();

    try {
      const success = await this.translationService.saveTranslations(
        requestParams.TemplateName,
        requestBody.language,
        requestBody.translations
      );

      if (success) {
        response.status(200);
        response.send({ message: 'Translations saved successfully' });
      } else {
        response.status(500);
        response.send({ error: 'Failed to save translations' });
      }
    } catch (error) {
      response.status(500);
      response.send({ error: error.message });
    }
  }

  async getTemplateLanguages({ request, response }) {
    const requestParams = request.params;

    try {
      const languages = await this.translationService.getTemplateLanguages(requestParams.TemplateName);

      response.status(200);
      response.send({ languages });
    } catch (error) {
      response.status(500);
      response.send({ error: error.message });
    }
  }

  async autoTranslate({ request, response }) {
    const requestParams = request.params;
    const requestBody = request.post();

    try {
      // Get English translations from request body
      const englishTranslations = requestBody.englishTranslations || {};

      if (Object.keys(englishTranslations).length === 0) {
        response.status(400);
        response.send({ error: 'No English translations provided' });
        return;
      }

      // Auto-translate to other languages
      const translatedTexts = await this.translationService.autoTranslate(
        requestParams.TemplateName,
        englishTranslations
      );

      response.status(200);
      response.send({
        message: 'Auto-translation completed successfully',
        translations: translatedTexts
      });
    } catch (error) {
      console.error('Auto-translate error:', error);
      response.status(500);
      response.send({
        error: 'Auto-translation failed. Please check your Google Cloud configuration.',
        details: error.message
      });
    }
  }

  async getSupportedLanguages({ response }) {
    try {
      response.status(200);
      response.send({
        languages: this.translationService.supportedLanguages
      });
    } catch (error) {
      response.status(500);
      response.send({ error: error.message });
    }
  }

  async showCreateTemplate({ view }) {
    return view.render('create-template', {
      languages: this.translationService.supportedLanguages
    });
  }

  async showUpdateTemplate({ view }) {
    return view.render('update-template', {
      languages: this.translationService.supportedLanguages
    });
  }
}

module.exports = SesTemplateController
