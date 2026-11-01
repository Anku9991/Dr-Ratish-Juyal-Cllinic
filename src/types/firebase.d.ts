declare module "firebase/app" {
  export interface FirebaseApp {
    name: string;
    options: Record<string, unknown>;
  }
  export function initializeApp(config: Record<string, unknown>): FirebaseApp;
  export function getApps(): FirebaseApp[];
  export function getApp(): FirebaseApp;
}

declare module "firebase/firestore" {
  export interface Firestore {
    type: string;
  }
  export interface DocumentData {
    [field: string]: unknown;
  }
  export interface DocumentReference<_T = DocumentData> {
    id: string;
    path: string;
  }
  export interface CollectionReference<_T = DocumentData> {
    id: string;
    path: string;
  }
  export interface DocumentSnapshot<T = DocumentData> {
    id: string;
    exists(): boolean;
    data(): T | undefined;
  }
  export interface QuerySnapshot<T = DocumentData> {
    empty: boolean;
    docs: DocumentSnapshot<T>[];
    forEach(callback: (result: DocumentSnapshot<T>) => void): void;
  }
  export interface QueryConstraint {
    type: string;
  }

  export function getFirestore(app?: unknown): Firestore;
  export function collection(db: unknown, path: string): CollectionReference;
  export function doc(db: unknown, path: string, ...pathSegments: string[]): DocumentReference;
  export function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot>;
  export function getDocs(query: unknown): Promise<QuerySnapshot>;
  export function setDoc(docRef: DocumentReference, data: unknown, options?: unknown): Promise<void>;
  export function updateDoc(docRef: DocumentReference, data: unknown): Promise<void>;
  export function deleteDoc(docRef: DocumentReference): Promise<void>;
  export function query(collectionRef: unknown, ...queryConstraints: QueryConstraint[]): unknown;
  export function where(fieldPath: string, opStr: string, value: unknown): QueryConstraint;
  export function orderBy(fieldPath: string, directionStr?: string): QueryConstraint;
  export function onSnapshot(docRef: DocumentReference, onNext: (snapshot: DocumentSnapshot) => void, onError?: (error: Error) => void): () => void;
}

declare module "firebase/auth" {
  export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    getIdToken(forceRefresh?: boolean): Promise<string>;
  }
  export interface UserCredential {
    user: User;
  }
  export class AuthProvider {}
  export class GoogleAuthProvider extends AuthProvider {
    setCustomParameters(customOAuthParameters: Record<string, string>): void;
  }
  export interface Auth {
    currentUser: User | null;
  }
  export function getAuth(app?: unknown): Auth;
  export function signInWithPopup(auth: Auth, provider: AuthProvider): Promise<UserCredential>;
  export function signInWithRedirect(auth: Auth, provider: AuthProvider): Promise<void>;
  export function getRedirectResult(auth: Auth): Promise<UserCredential | null>;
  export function signOut(auth: Auth): Promise<void>;
}

declare module "firebase/storage" {
  export interface FirebaseStorage {
    app: unknown;
  }
  export function getStorage(app?: unknown): FirebaseStorage;
}

declare module "firebase/analytics" {
  export interface Analytics {
    app: unknown;
  }
  export function getAnalytics(app?: unknown): Analytics;
  export function isSupported(): Promise<boolean>;
}
