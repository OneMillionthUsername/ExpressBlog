// Frontend: Bild hochladen
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('postId', '123'); // Optional
formData.append('alt_text', 'Beschreibung des Bildes');

fetch('/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
})
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('Upload erfolgreich:', data.media);
    }
  });