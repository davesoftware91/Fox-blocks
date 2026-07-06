import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase web configuration (safely bundled client-side)
const firebaseConfig = {
  apiKey: "AIzaSyB8AFryexfHKy8XvM0o8JWXRb-jsy6sliI",
  authDomain: "gen-lang-client-0129668002.firebaseapp.com",
  projectId: "gen-lang-client-0129668002",
  storageBucket: "gen-lang-client-0129668002.firebasestorage.app",
  messagingSenderId: "336056015153",
  appId: "1:336056015153:web:e3dab86214a26cb46a3810"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId from config
export const db = getFirestore(app, "ai-studio-87f88d4f-eaf2-4519-9968-fa4aed4901c4");

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const localPlayerId = typeof window !== 'undefined' ? window.localStorage.getItem("fox_blocks_player_id") : null;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: localPlayerId,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

