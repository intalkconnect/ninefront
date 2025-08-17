export const LocationNodeTemplate = {
  type: 'location',
  label: 'Localização',
  iconName: 'MapPin',
  color: '#0288D1',
  block: {
    type: 'location',
    awaitResponse: false,
    awaitTimeInSeconds: 0,
    sendDelayInSeconds: 1,
    actions: [],
    content: {
      name: '',
      address: '',
      latitude: '',
      longitude: ''
    }
  },
};
