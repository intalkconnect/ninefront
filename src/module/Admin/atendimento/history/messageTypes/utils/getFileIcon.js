
// src/components/ChatWindow/utils/getFileIcon.js

export function getFileIcon(filename = '') {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: 'https://cdn-icons-png.flaticon.com/512/337/337946.png',
    doc: 'https://cdn-icons-png.flaticon.com/512/337/337932.png',
    docx: 'https://cdn-icons-png.flaticon.com/512/337/337932.png',
    xls: 'https://cdn-icons-png.flaticon.com/512/337/337959.png',
    xlsx: 'https://cdn-icons-png.flaticon.com/512/337/337959.png',
    ppt: 'https://cdn-icons-png.flaticon.com/512/337/337953.png',
    pptx: 'https://cdn-icons-png.flaticon.com/512/337/337953.png',
  };
  return icons[ext] || 'https://cdn-icons-png.flaticon.com/512/136/136539.png';
}
