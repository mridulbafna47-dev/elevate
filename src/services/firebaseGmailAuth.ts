import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of GMAIL_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent select_account',
});

let isSigningIn = false;
// Keep OAuth access token strictly in memory — never in localStorage or sessionStorage
let cachedGmailAccessToken: string | null = null;

export function subscribeFirebaseAuth(
  onSignedOut: () => void
): () => void {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (!user && !isSigningIn) {
      cachedGmailAccessToken = null;
      onSignedOut();
    }
  });
}

export async function googleSignInWithGmail(): Promise<{
  user: User;
  idToken: string;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Gmail read access token from Google sign-in.');
    }
    const idToken = await result.user.getIdToken();
    cachedGmailAccessToken = credential.accessToken;
    return {
      user: result.user,
      idToken,
      accessToken: cachedGmailAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export async function clearFirebaseGmailSession(): Promise<void> {
  cachedGmailAccessToken = null;
  try {
    await auth.signOut();
  } catch {
    // Non-fatal if already signed out
  }
}
