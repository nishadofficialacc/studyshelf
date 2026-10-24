/**
 * StudyShelf V3 Firebase WEB configuration.
 * Firebase apiKey is a public project identifier (not a merchant or server secret).
 * Do NOT put service-account keys, GitHub tokens, or Payhip passwords here.
 * Copy the Firebase Console web app config and set enabled: true when ready.
 */
export const firebaseSettings = {
  enabled: false,
  config: {
    apiKey: 'REPLACE_WITH_FIREBASE_WEB_API_KEY',
    authDomain: 'REPLACE_WITH_PROJECT_ID.firebaseapp.com',
    projectId: 'REPLACE_WITH_PROJECT_ID',
    appId: 'REPLACE_WITH_FIREBASE_APP_ID'
  }
};
