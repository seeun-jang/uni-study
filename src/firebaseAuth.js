import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

function getFirebaseAuth() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      'Firebase environment variables are missing. Check VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.'
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

function createProvider(providerKey) {
  if (providerKey === 'google') {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    return provider;
  }

  if (providerKey === 'github') {
    const provider = new GithubAuthProvider();
    provider.addScope('read:user');
    provider.addScope('user:email');
    return provider;
  }

  if (providerKey === 'naver') {
    const providerId = import.meta.env.VITE_FIREBASE_NAVER_PROVIDER_ID || 'oidc.naver';
    const provider = new OAuthProvider(providerId);
    provider.addScope('name');
    provider.addScope('email');
    return provider;
  }

  throw new Error('Unsupported social provider key.');
}

export async function signInWithSocial(providerKey) {
  const auth = getFirebaseAuth();
  const provider = createProvider(providerKey);
  const result = await signInWithPopup(auth, provider);

  return {
    uid: result.user.uid,
    displayName: result.user.displayName,
    email: result.user.email,
    providerId: result.user.providerData?.[0]?.providerId || provider.providerId,
  };
}
