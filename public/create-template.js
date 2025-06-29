$(document).ready(function () {
  // Translation management - will be populated dynamically
  window.allLanguageTranslations = {};
  window.currentLanguage = 'en';
  window.translationKeys = [];
  window.lastTranslationKeysStr = '';

  // check to see if the template we're creating is a duplicate of an existing template
  const urlParams = new URLSearchParams(window.location.search);
  window.history.replaceState({}, document.title, "/create-template");  // clean the url search params from the URL

  window.codeMirrorEditor = window.CodeMirror.fromTextArea(document.querySelector('#codeMirror'), {
    mode: "htmlmixed",
    lineNumbers: true,
    viewportMargin: Infinity
  });

  if (urlParams.has('d-origin')) {
    // we need to load the existing template from which we will duplicate
    let originTemplateName = urlParams.get('d-origin');

    // Remove language suffix if exists (e.g., 'template_en' -> 'template')
    if (originTemplateName && originTemplateName.match(/_[a-z]{2}$/)) {
      originTemplateName = originTemplateName.replace(/_[a-z]{2}$/, '');
      console.log('Cleaned origin template name (removed language suffix):', originTemplateName);
    }

    $.get(`/get-template/${originTemplateName}?region=${localStorage.getItem('region')}`, function (response) {
      $('#templateName').val(urlParams.get('d-name'));
      $('#templateSubject').val(response.data.SubjectPart);
      $('#templateText').val(response.data.TextPart);
      window.codeMirrorEditor.setValue(response.data.HtmlPart ? response.data.HtmlPart : "");
      $('#saveTemplateCta').removeAttr('disabled');  // enable the save button

      // Load translation data if available
      if (response.data.translationKeys) {
        window.translationKeys = response.data.translationKeys;
        updateTranslationKeysDisplay();
      }
      if (response.data.translations) {
        window.allLanguageTranslations[response.data.currentLanguage || 'en'] = response.data.translations;
        updateTranslationInputs();
      }
    });
  }

  $('#alwaysFullyRenderCodeEditor').on('change', (e) => {
    const newValue = e.target.checked;
    const newViewportMargin = newValue ? Infinity : window.CodeMirror.defaults.viewportMargin;
    window.codeMirrorEditor.setOption('viewportMargin', newViewportMargin);
  });

  const isCodeMirrorEvent = (e) => (e.target === window.codeMirrorEditor.getInputField());

  // observe any changes to the form. If so, then enable the create btn
  $('#createTemplateForm').on('input', (e) => {
    if (isCodeMirrorEvent(e)) return;
    const isEditorConfig = e.target.getAttribute('data-editor-config') === 'true';
    if (isEditorConfig) return;

    // Don't update translation keys if this is a translation input
    const isTranslationInput = e.target.classList.contains('translation-input');
    if (isTranslationInput) return;

    $('#createTemplateForm button').attr('disabled', false);

    // Update translation keys when content changes
    updateTranslationKeys();
  });

  // We may not get an input event on deletion from the codeMirror editor
  window.codeMirrorEditor.on('change', () => {
    $('#createTemplateForm button').attr('disabled', false);
    updateTranslationKeys();
  });

  // Language tab change handler
  $('#languageTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    const newLanguage = $(e.target).attr('href').replace('#', '').replace('-content', '');
    window.currentLanguage = newLanguage;
    updateTranslationInputs();

    // Update previews when language tab changes
    const showPreview = $('#templatePreviewContainer')[0].checkVisibility();
    if (showPreview) {
      updateLanguagePreviews();
    }
  });

  // Translation key extraction and display
  function extractTranslationKeys(content) {
    if (!content) return [];
    const regex = /{{\s*(t|translate)\.(\w+(?:\.\w+)*)\s*}}/g;
    const keys = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      keys.push(match[2]);
    }

    return [...new Set(keys)];
  }

  function updateTranslationKeys() {
    const subject = $('#templateSubject').val();
    const text = $('#templateText').val();
    const html = window.codeMirrorEditor.getValue();

    let allKeys = [];
    allKeys = allKeys.concat(extractTranslationKeys(subject));
    allKeys = allKeys.concat(extractTranslationKeys(text));
    allKeys = allKeys.concat(extractTranslationKeys(html));

    // Add is_rtl key automatically
    allKeys.push('is_rtl');

    window.translationKeys = [...new Set(allKeys)];
    updateTranslationKeysDisplay();
  }

  function updateTranslationKeysDisplay() {
    // Check if translation keys actually changed
    const currentKeysStr = JSON.stringify(window.translationKeys.sort());
    if (window.lastTranslationKeysStr === currentKeysStr) {
      return; // No change, don't re-render
    }
    window.lastTranslationKeysStr = currentKeysStr;

    // Update all language tabs
    $('.translation-inputs').each(function () {
      const language = $(this).data('language');
      const container = $(this);
      container.empty();

      if (window.translationKeys.length === 0) {
        container.append('<p class="text-muted">No translation keys found in template content.</p>');
        return;
      }

      window.translationKeys.forEach(key => {
        const value = window.allLanguageTranslations[language][key] || '';

        if (key === 'is_rtl') {
          // Special handling for is_rtl - show as readonly boolean
          const isRTL = isRTLLanguage(language);
          const inputGroup = $(`
            <div class="form-group">
              <label for="trans_${language}_${key}">{{t.${key}}} <small class="text-muted">(Auto-generated)</small></label>
              <input type="text" class="form-control" 
                     id="trans_${language}_${key}" 
                     value="${isRTL}" 
                     readonly
                     style="background-color: #f8f9fa;">
              <small class="form-text text-muted">This boolean value is automatically set based on language RTL property and used for RTL detection in templates.</small>
            </div>
          `);
          container.append(inputGroup);
        } else {
          // Regular translation input
          const inputGroup = $(`
            <div class="form-group">
              <label for="trans_${language}_${key}">{{t.${key}}}</label>
              <input type="text" class="form-control translation-input" 
                     id="trans_${language}_${key}" 
                     data-key="${key}" 
                     data-language="${language}"
                     value="${value}" 
                     placeholder="Enter ${getLanguageName(language)} translation for ${key}">
            </div>
          `);
          container.append(inputGroup);
        }
      });
    });

    // Show/hide translation section
    if (window.translationKeys.length > 0) {
      $('#translationKeysSection').show();
    } else {
      $('#translationKeysSection').hide();
    }
  }

  function updateTranslationInputs() {
    $(`.translation-inputs[data-language="${window.currentLanguage}"] .translation-input`).each(function () {
      const key = $(this).data('key');
      $(this).val(window.allLanguageTranslations[window.currentLanguage][key] || '');
    });
  }

  function getLanguageName(code) {
    if (window.supportedLanguages) {
      const language = window.supportedLanguages.find(l => l.code === code);
      return language ? language.name : code;
    }
    return code; // Fallback to code if languages not loaded yet
  }

  // Handle translation input changes
  $(document).on('input', '.translation-input', function () {
    const key = $(this).data('key');
    const language = $(this).data('language');
    const value = $(this).val();

    if (!window.allLanguageTranslations[language]) {
      window.allLanguageTranslations[language] = {};
    }
    window.allLanguageTranslations[language][key] = value;

    // Enable save button but don't update translation keys
    $('#createTemplateForm button').attr('disabled', false);

    // Update language previews
    updateLanguagePreviews();
  });

  const setTemplatePreview = () => {
    const templateHtml = window.codeMirrorEditor.getValue();
    const templateSubject = $('#templateSubject').val();
    const enableRTLWrapper = $('#enableRTLWrapper').is(':checked');

    // Raw template previews - show wrapper if enabled
    const displayHtml = enableRTLWrapper ? wrapWithFullHTMLStructure(templateHtml) : templateHtml;
    $('#templatePreview').html(displayHtml);
    $('#templateSubjectPreview').text(templateSubject);

    // Language-specific previews
    updateLanguagePreviews();
  };

  const updateLanguagePreviews = () => {
    if (!window.supportedLanguages) return; // Wait for languages to load

    const templateHtml = window.codeMirrorEditor.getValue();
    const templateSubject = $('#templateSubject').val();
    const enableRTLWrapper = $('#enableRTLWrapper').is(':checked');
    const languages = window.supportedLanguages.map(l => l.code);

    languages.forEach(lang => {
      const translations = window.allLanguageTranslations[lang] || {};
      const translatedHtml = replaceTranslationVariables(templateHtml, translations);
      const translatedSubject = replaceTranslationVariables(templateSubject, translations);

      // Apply wrapper based on checkbox setting
      let processedHtml;
      if (enableRTLWrapper) {
        // Use full HTML structure with RTL support
        processedHtml = wrapWithFullHTMLStructure(translatedHtml, lang);
      } else {
        // Just apply RTL styling for preview if it's RTL language
        processedHtml = wrapWithHTMLStructure(translatedHtml, lang);
      }

      $(`#${lang}Preview`).html(processedHtml);
      $(`#${lang}SubjectPreview`).text(translatedSubject);
    });
  };

  const replaceTranslationVariables = (content, translations) => {
    if (!content) return content;

    return content.replace(/{{\s*(t|translate)\.(\w+(?:\.\w+)*)\s*}}/g, (match, prefix, key) => {
      return translations[key] || match; // Keep original if translation not found
    });
  };

  const isRTLLanguage = (languageCode) => {
    if (!window.supportedLanguages) return false;
    const language = window.supportedLanguages.find(lang => lang.code === languageCode);
    return language ? language.rtl : false;
  };

  const wrapWithHTMLStructure = (bodyContent, languageCode = 'en') => {
    const isRTL = isRTLLanguage(languageCode);

    if (!isRTL) {
      // For non-RTL languages, just return the body content
      return bodyContent;
    }

    // For RTL languages, wrap content in a div with RTL styles
    return `<div dir="rtl" style="direction: rtl; text-align: right;">
      <style>
        
      </style>
      <div class="rtl-preview">
        ${bodyContent}
      </div>
    </div>`;
  };

  const wrapWithFullHTMLStructure = (bodyContent, languageCode = 'en') => {
    const isRTL = isRTLLanguage(languageCode);
    const rtlConditions = isRTL ? ' dir="rtl" style="direction: rtl;"' : '';
    const rtlBodyConditions = isRTL ? ' dir="rtl" style="margin: 0; padding: 0; direction: rtl; text-align: right;"' : ' style="margin: 0; padding: 0;"';

    return `<!DOCTYPE html>
<html${rtlConditions}>
<head>
    <meta charset="UTF-8">
    <title>{{ t.title }}</title>
</head>
<body${rtlBodyConditions}>
${bodyContent}
</body>
</html>`;
  };

  const handlePreview = () => {
    setTemplatePreview();
  }

  // We may not get an input event on deletion from the codeMirror editor
  $('#createTemplateForm').on('input', (e) => {
    if (isCodeMirrorEvent(e)) return;
    handlePreview();
  });

  window.codeMirrorEditor.on('change', handlePreview);

  // Handle RTL wrapper checkbox change
  $('#enableRTLWrapper').on('change', handlePreview);

  // Preview is now always visible in sidebar, no need for toggle

  // handle form submissions
  $('#createTemplateForm').submit(function (e) {
    e.preventDefault();

    const createPayload = {
      "TemplateName": $('#templateName').val(),
      "HtmlPart": window.codeMirrorEditor.getValue(),
      "SubjectPart": $('#templateSubject').val(),
      "TextPart": $('#templateText').val(),
      "region": localStorage.getItem('region'),
      "enableRTLWrapper": $('#enableRTLWrapper').is(':checked'),
      "allLanguageTranslations": window.allLanguageTranslations
    };

    $.ajax({
      type: "POST",
      url: "/create-template",
      data: createPayload,
      success: function () {
        window.location.href = '/';
      },
      error: function (xhr) {
        let content;
        if (xhr.responseJSON.message) {
          content = xhr.responseJSON.message;
        } else {
          content = "Error saving template. Please try again";
        }
        $('#errContainer').html(content).removeClass('d-none');
      }
    });
  });

  // Auto-translate functionality
  $('#autoTranslateBtn').click(function () {
    const templateName = $('#templateName').val();
    if (!templateName) {
      alert('Please enter a template name first.');
      return;
    }

    const englishTranslations = window.allLanguageTranslations['en'] || {};
    if (Object.keys(englishTranslations).length === 0) {
      alert('Please fill in English translations first.');
      return;
    }

    // Check if all English translations are filled (except is_rtl)
    let missingTranslations = [];
    window.translationKeys.forEach(key => {
      if (key !== 'is_rtl' && (!englishTranslations[key] || englishTranslations[key].trim() === '')) {
        missingTranslations.push(key);
      }
    });

    if (missingTranslations.length > 0) {
      alert(`Please fill in English translations for: ${missingTranslations.join(', ')}`);
      return;
    }

    // Show loading state
    const $btn = $(this);
    const originalText = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i> Translating...').prop('disabled', true);

    // Call auto-translate API
    $.ajax({
      type: 'POST',
      url: `/auto-translate/${templateName}`,
      data: {
        englishTranslations: englishTranslations
      },
      success: function (response) {
        // Update translations for all languages
        Object.keys(response.translations).forEach(language => {
          window.allLanguageTranslations[language] = response.translations[language];
        });

        // Refresh translation inputs
        updateTranslationKeysDisplay();

        // Update previews
        updateLanguagePreviews();

        alert('Auto-translation completed successfully!');
      },
      error: function (xhr) {
        let errorMessage = 'Auto-translation failed. ';
        if (xhr.responseJSON && xhr.responseJSON.error) {
          errorMessage += xhr.responseJSON.error;
        } else {
          errorMessage += 'Please check your Google Cloud configuration.';
        }
        alert(errorMessage);
      },
      complete: function () {
        // Restore button
        $btn.html(originalText).prop('disabled', false);
      }
    });
  });

  // Load supported languages
  function loadSupportedLanguages() {
    $.get('/supported-languages', function (response) {
      window.supportedLanguages = response.languages;

      // Initialize translation objects for all languages
      response.languages.forEach(lang => {
        if (!window.allLanguageTranslations[lang.code]) {
          window.allLanguageTranslations[lang.code] = {};
        }
      });

      // Update display after languages are loaded
      updateTranslationKeysDisplay();

      // Initial preview
      setTemplatePreview();
    }).fail(function () {
      console.error('Could not load supported languages');
      alert('Failed to load language configuration. Please refresh the page.');
    });
  }

  // Initialize
  loadSupportedLanguages();
  updateTranslationKeys();
});
