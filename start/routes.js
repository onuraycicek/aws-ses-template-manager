'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URLs and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.0/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route')

Route.get('/', ({ view }) => {
  return view.render('index')
});

Route.get('/update-template', 'SesTemplateController.showUpdateTemplate');
Route.get('/create-template', 'SesTemplateController.showCreateTemplate');

Route.get('list-templates', 'SesTemplateController.listTemplates');
Route.get('get-template/:TemplateName', 'SesTemplateController.getTemplate');
Route.post('create-template', 'SesTemplateController.createTemplate');
Route.put('update-template', 'SesTemplateController.updateTemplate');
Route.delete('delete-template/:TemplateName', 'SesTemplateController.deleteTemplate');
Route.post('send-template', 'SesTemplateController.sendTemplate').middleware('throttle:30');

Route.get('translations/:TemplateName', 'SesTemplateController.getTranslations');
Route.post('translations/:TemplateName', 'SesTemplateController.saveTranslations');
Route.get('template-languages/:TemplateName', 'SesTemplateController.getTemplateLanguages');
Route.post('auto-translate/:TemplateName', 'SesTemplateController.autoTranslate');
Route.get('supported-languages', 'SesTemplateController.getSupportedLanguages');
