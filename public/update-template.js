$(document).ready(function () {
  // Translation management - will be populated dynamically
  window.allLanguageTranslations = {};
  window.currentLanguage = 'en';
  window.translationKeys = [];
  window.templateName = '';
  window.availableLanguages = [];
  window.lastTranslationKeysStr = '';

  const urlParams = new URLSearchParams(window.location.search);
  let templateName = urlParams.get('name');
  let cmInitialized = false;

  console.log('URL params:', window.location.search);
  console.log('Original template name from URL:', templateName);

  // Remove language suffix if exists (e.g., 'template_en' -> 'template')
  if (templateName && templateName.match(/_[a-z]{2}$/)) {
    templateName = templateName.replace(/_[a-z]{2}$/, '');
    console.log('Cleaned template name (removed language suffix):', templateName);
  }

  if (!templateName) {
    console.error('No template name found in URL parameters');
    alert('No template name provided in URL. Redirecting to home page.');
    window.location.href = '/'; //something went wrong
    return;
  }

  window.codeMirrorEditor = window.CodeMirror.fromTextArea(document.querySelector('#codeMirror'), {
    mode: "htmlmixed",
    lineNumbers: true,
    viewportMargin: Infinity
  });

  const setTemplatePreview = () => {
    const templateHtml = window.codeMirrorEditor.getValue();
    const templateSubject = $('#templateSubject').val();

    // Raw template previews
    $('#templatePreview').html(templateHtml);
    $('#templateSubjectPreview').text(templateSubject);

    // Language-specific previews
    updateLanguagePreviews();
  };

  const updateLanguagePreviews = () => {
    if (!window.supportedLanguages) return; // Wait for languages to load

    const templateHtml = window.codeMirrorEditor.getValue();
    const templateSubject = $('#templateSubject').val();
    const languages = window.supportedLanguages.map(l => l.code);

    languages.forEach(lang => {
      const translations = window.allLanguageTranslations[lang] || {};
      const translatedHtml = replaceTranslationVariables(templateHtml, translations);
      const translatedSubject = replaceTranslationVariables(templateSubject, translations);

      // Wrap body content with HTML structure for preview
      const wrappedHtml = wrapWithHTMLStructure(translatedHtml, lang);

      $(`#${lang}Preview`).html(wrappedHtml);
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

  window.templateName = templateName; // Store template name for translations
  console.log('Set window.templateName to:', window.templateName);

  console.log('Making API call to:', `/get-template/${templateName}?region=${localStorage.getItem('region')}`);
  $.get(`/get-template/${templateName}?region=${localStorage.getItem('region')}`, function (response) {
    console.log('Template data received:', response);
    $('#templateName').val(response.data.TemplateName);
    $('#templateSubject').val(response.data.SubjectPart);
    $('#templateText').val(response.data.TextPart);

    window.codeMirrorEditor.setValue(response.data.HtmlPart ? response.data.HtmlPart : "");
    cmInitialized = true;

    $('#updateTemplateForm').removeClass('d-none'); //show the form only when we have pre-populated all inputs
    window.codeMirrorEditor.refresh();  //must be called to re draw the code editor
    setTemplatePreview();

    // Load translation data
    window.translationKeys = response.data.translationKeys || [];
    window.availableLanguages = response.data.availableLanguages || ['en'];
    window.currentLanguage = response.data.currentLanguage || 'en';

    // Load translations for current language
    if (response.data.translations) {
      window.allLanguageTranslations[window.currentLanguage] = response.data.translations;
    }

    // Load translations for all available languages
    loadAllLanguageTranslations();

    updateTranslationKeysDisplay();
    updateTranslationInputs();

    // Update previews after loading
    setTemplatePreview();
  }).fail(function (xhr, status, error) {
    console.error('Error loading template:', error);
    console.error('Response:', xhr.responseText);
    $('#updateTemplateForm').removeClass('d-none'); // Show form even on error
    alert('Error loading template: ' + (xhr.responseJSON ? xhr.responseJSON.message : error));
  });

  $('#alwaysFullyRenderCodeEditor').on('change', (e) => {
    const newValue = e.target.checked;
    const newViewportMargin = newValue ? Infinity : window.CodeMirror.defaults.viewportMargin;
    window.codeMirrorEditor.setOption('viewportMargin', newViewportMargin);
  });

  const isCodeMirrorEvent = (e) => (e.target === window.codeMirrorEditor.getInputField());

  $('#updateTemplateForm').on('input', (e) => {
    if (isCodeMirrorEvent(e)) return;
    const isEditorConfig = e.target.getAttribute('data-editor-config') === 'true';
    if (isEditorConfig) return;

    // Don't update translation keys if this is a translation input
    const isTranslationInput = e.target.classList.contains('translation-input');
    if (isTranslationInput) return;

    $('#updateTemplateForm button').attr('disabled', false);

    // Update translation keys when content changes
    updateTranslationKeys();
  });

  // We may not get an input event on deletion from the codeMirror editor
  window.codeMirrorEditor.on('change', () => {
    $('#updateTemplateForm button').attr('disabled', false);
    updateTranslationKeys();
  });

  // Language tab change handler
  $('#languageTabs a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    const newLanguage = $(e.target).attr('href').replace('#', '').replace('-content', '');
    window.currentLanguage = newLanguage;

    // Load translations for this language if not already loaded
    if (!window.allLanguageTranslations[newLanguage] || Object.keys(window.allLanguageTranslations[newLanguage]).length === 0) {
      loadLanguageTranslations(newLanguage);
    }

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

  function loadLanguageTranslations(language) {
    if (!window.templateName) {
      console.warn('Template name not set, cannot load translations for language:', language);
      return;
    }

    console.log(`Loading translations for language: ${language}`);
    $.get(`/translations/${window.templateName}?language=${language}`, function (response) {
      console.log(`Loaded translations for ${language}:`, response.translations);
      window.allLanguageTranslations[language] = response.translations || {};
      updateTranslationInputs();
    }).fail(function (xhr, status, error) {
      console.log(`No translations found for ${language}, using empty object`);
      // Language doesn't exist yet, start with empty translations
      window.allLanguageTranslations[language] = {};
      updateTranslationInputs();
    });
  }

  function loadAllLanguageTranslations() {
    if (!window.supportedLanguages) return; // Wait for languages to load

    const languages = window.supportedLanguages.map(l => l.code);
    console.log('Loading translations for all languages, current:', window.currentLanguage);
    languages.forEach(lang => {
      if (lang !== window.currentLanguage) {
        loadLanguageTranslations(lang);
      }
    });
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
    $('#updateTemplateForm button').attr('disabled', false);

    // Update language previews
    updateLanguagePreviews();
  });

  const handlePreview = () => {
    setTemplatePreview();
  }

  $('#updateTemplateForm').on('input', (e) => {
    if (isCodeMirrorEvent(e)) return;
    handlePreview();
  });

  window.codeMirrorEditor.on('change', handlePreview);

  // Preview is now always visible in sidebar, no need for toggle

  // Handle form submission
  $('#updateTemplateForm').submit(function (e) {
    e.preventDefault();

    const updatePayload = {
      "TemplateName": $('#templateName').val(),
      "HtmlPart": window.codeMirrorEditor.getValue(),
      "SubjectPart": $('#templateSubject').val(),
      "TextPart": $('#templateText').val(),
      "region": localStorage.getItem('region')
    };

    // Update template
    $.ajax({
      type: "PUT",
      url: "/update-template",
      data: updatePayload,
      success: function () {
        // Save translations for all languages
        saveAllLanguageTranslations();
      },
      error: function (xhr) {
        let content;
        if (xhr.responseJSON && xhr.responseJSON.message) {
          content = xhr.responseJSON.message;
        } else {
          content = "Error updating template. Please try again";
        }
        $('#errContainer').html(content).removeClass('d-none');
      }
    });
  });

  function saveAllLanguageTranslations() {
    if (!window.supportedLanguages) {
      window.location.href = '/';
      return;
    }

    const languages = window.supportedLanguages.map(l => l.code);
    const savePromises = [];

    languages.forEach(lang => {
      if (window.allLanguageTranslations[lang] && Object.keys(window.allLanguageTranslations[lang]).length > 0) {
        const promise = $.ajax({
          type: "POST",
          url: `/translations/${window.templateName}`,
          data: {
            language: lang,
            translations: window.allLanguageTranslations[lang]
          }
        });
        savePromises.push(promise);
      }
    });

    if (savePromises.length > 0) {
      Promise.all(savePromises).then(() => {
        window.location.href = '/';
      }).catch(() => {
        $('#errContainer').html('Template updated but some translations failed to save.').removeClass('d-none');
      });
    } else {
      window.location.href = '/';
    }
  }

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

      // Load translations after languages are loaded
      loadAllLanguageTranslations();

      // Initial preview
      setTemplatePreview();
    }).fail(function () {
      console.error('Could not load supported languages');
      alert('Failed to load language configuration. Please refresh the page.');
    });
  }

  // Initialize page
  loadSupportedLanguages();
  updateTranslationKeys();
});

