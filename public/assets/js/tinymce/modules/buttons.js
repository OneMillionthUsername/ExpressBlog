// Custom Buttons Module
// Defines custom TinyMCE buttons and UI elements

/**
 * Setup custom buttons for TinyMCE editor
 * @param {Object} editor - TinyMCE editor instance
 */
export function setupCustomButtons(editor) {
  // Custom blockquote button with author field
  editor.ui.registry.addButton('customblockquote', {
    text: '📝',
    tooltip: 'Blockquote mit Autor einfügen (Dialog)',
    onAction: function() {
      editor.windowManager.open({
        title: 'Blockquote einfügen',
        body: {
          type: 'panel',
          items: [
            {
              type: 'textarea',
              name: 'quote',
              label: 'Zitat',
              placeholder: 'Geben Sie hier das Zitat ein...'
            },
            {
              type: 'input',
              name: 'author',
              label: 'Autor/Quelle',
              placeholder: 'Name des Autors oder Quelle'
            }
          ]
        },
        buttons: [
          {
            type: 'cancel',
            text: 'Abbrechen'
          },
          {
            type: 'submit',
            text: 'Einfügen',
            primary: true
          }
        ],
        onSubmit: function(api) {
          const data = api.getData();
          let blockquoteHtml = '<blockquote>';
          if (data.quote) {
            blockquoteHtml += '<p>' + data.quote + '</p>';
          }
          if (data.author) {
            blockquoteHtml += '<footer><cite>— ' + data.author + '</cite></footer>';
          }
          blockquoteHtml += '</blockquote>';
          editor.insertContent(blockquoteHtml);
          api.close();
        }
      });
    }
  });
}
