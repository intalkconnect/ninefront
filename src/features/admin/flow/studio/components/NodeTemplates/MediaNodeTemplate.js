export const MediaNodeTemplate = {
  type: 'media',
  label: 'Mídia',
  iconName: 'Image',
  color: '#0097A7',
  block: {
    type: 'media',
    awaitResponse: false,
    awaitTimeInSeconds: 0,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      mediaType: 'image', // image, document, audio, video
      url: '',
      caption: ''
    }
  },
};
