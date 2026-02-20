// TinyMCE Configuration Module
// Contains base configuration for TinyMCE editor

import { getAssetVersion } from '../../config.js';
import { uploadImageMultipart } from './upload.js';
import { setupCustomButtons } from './buttons.js';
import { applyTinyMCETheme } from './theme.js';

/**
 * Get TinyMCE configuration object
 * @returns {Object} TinyMCE configuration
 */
export function getTinyMCEConfig() {
  const assetVersion = (typeof getAssetVersion === 'function' && getAssetVersion()) || '';
  const cacheSuffix = assetVersion ? `?v=${encodeURIComponent(assetVersion)}` : '';
  
  return {
    selector: '#content',
    height: 650,
    resize: true,
    menubar: 'edit view insert format tools help',
    referrer_policy: 'origin',
    cache_suffix: cacheSuffix,
    
    // Disable premium features and tracking
    promotion: false,
    branding: false,
    license_key: 'gpl',
    
    // Skin and icons configuration for jsDelivr CDN
    skin_url: 'https://cdn.jsdelivr.net/npm/tinymce@6/skins/ui/oxide',
    content_css: [
      'https://cdn.jsdelivr.net/npm/tinymce@6/skins/content/default/content.min.css',
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Crimson+Text:wght@400;600;700&display=swap',
      '/assets/css/tinymce-content.css',
    ],
    
    // Language
    language: 'de',
    content_langs: [
      { title: 'Deutsch', code: 'de' },
      { title: 'English', code: 'en' }
    ],
    
    // Plugins
    plugins: [
      'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
      'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
      'insertdatetime', 'media', 'table', 'help', 'wordcount',
      'save', 'directionality', 'emoticons',
      'codesample', 'nonbreaking', 'pagebreak', 'quickbars',
    ],
    
    // Toolbar
    toolbar: [
      'undo redo | bold italic underline strikethrough | fontsize forecolor backcolor',
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent',
      'link image media table | codesample blockquote customblockquote hr pagebreak | emoticons charmap',
      'searchreplace visualblocks code fullscreen preview | save help',
    ],
    toolbar_mode: 'floating',
    quickbars_selection_toolbar: 'bold italic underline | quicklink blockquote',
    quickbars_insert_toolbar: 'image media table hr',
    contextmenu: 'link image table configurepermanentpen',
    
    // Formatting
    font_size_formats: '8pt 10pt 12pt 14pt 16pt 18pt 20pt 24pt 28pt 32pt 36pt 48pt 60pt 72pt',
    block_formats: 'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; Heading 5=h5; Heading 6=h6; Preformatted=pre; Address=address',
    
    // Style formats
    style_formats: [
      {title: 'Headers', items: [
        {title: 'Header 1', block: 'h1'},
        {title: 'Header 2', block: 'h2'},
        {title: 'Header 3', block: 'h3'},
      ]},
      {title: 'Inline', items: [
        {title: 'Bold', inline: 'strong'},
        {title: 'Italic', inline: 'em'},
        {title: 'Code', inline: 'code'},
      ]},
    ],
    
    // Image upload
    images_upload_handler: async (blobInfo, progress) => {
      return await uploadImageMultipart(blobInfo, progress);
    },
    
    // Image settings
    paste_data_images: true,
    automatic_uploads: true,
    images_file_types: 'jpg,jpeg,png,gif,webp',
    image_dimensions: false,
    image_class_list: [
      { title: 'Responsive', value: 'img-responsive' }
    ],
    
    // Spellcheck
    browser_spellcheck: true,
    
    // Branding
    branding: false,
    promotion: false,
    
    // Shortcuts
    custom_shortcuts: true,
    
    // Table
    table_toolbar: 'tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow',
    
    // Links
    link_context_toolbar: true,
    
    // Lists
    lists_indent_on_tab: true,
    
    // Note: Templates configuration removed as 'template' plugin is deprecated in TinyMCE 6
    // For templates, consider using Advanced Template plugin or custom buttons
    
    // Setup function
    setup: function(editor) {
      // Register custom buttons
      setupCustomButtons(editor);
      
      // Make images responsive
      const makeImagesResponsive = () => {
        const images = editor.getDoc().querySelectorAll('img');
        images.forEach(img => {
          img.removeAttribute('width');
          img.removeAttribute('height');
          img.style.width = '';
          img.style.height = '';
          if (!img.classList.contains('img-responsive')) {
            img.classList.add('img-responsive');
          }
        });
      };
      
      editor.on('NodeChange', makeImagesResponsive);
      editor.on('SetContent', makeImagesResponsive);
      editor.on('BeforeSetContent', function(e) {
        if (e.content && e.content.includes('<img')) {
          e.content = e.content.replace(/(<img[^>]*)\s+width=["'][^"']*["']/gi, '$1');
          e.content = e.content.replace(/(<img[^>]*)\s+height=["'][^"']*["']/gi, '$1');
          e.content = e.content.replace(/(<img[^>]*)\s+style=["'][^"']*["']/gi, '$1');
        }
      });
      editor.on('paste', function() {
        setTimeout(makeImagesResponsive, 100);
      });
      
      // Update preview on content change
      editor.on('Change', function() {
        // Dispatch custom event for preview update
        document.dispatchEvent(new CustomEvent('tinymce:contentChanged'));
      });
      editor.on('KeyUp', function() {
        // Dispatch custom event for preview update
        document.dispatchEvent(new CustomEvent('tinymce:contentChanged'));
      });
      
      // Apply dark mode theme
      editor.on('init', function() {
        applyTinyMCETheme(editor);
      });
      
      // Listen for theme changes
      if (typeof window.addEventListener === 'function') {
        window.addEventListener('themeChanged', function() {
          applyTinyMCETheme(editor);
        });
      }
    }
  };
}
