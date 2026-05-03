import { db, auth } from './firebase';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './error';

export interface UserProfile {
  email: string;
  displayName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  pinned?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  sender: 'user' | 'ai';
  content: string;
  createdAt: Timestamp;
  status?: 'sending' | 'sent' | 'error';
}

export async function updateUserProfile(userId: string, displayName: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      displayName,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function checkUserProfile(userId: string, email: string, displayName: string = "") {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email,
        displayName: displayName || email.split('@')[0],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${userId}`);
  }
}

export async function createChat(userId: string, title: string) {
  try {
    const newChatRef = doc(collection(db, 'chats'));
    const chat: Omit<Chat, 'id'> = {
      userId,
      title,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };
    await setDoc(newChatRef, chat);
    return { id: newChatRef.id, ...chat };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `chats`);
    throw err;
  }
}

export async function updateChatTitle(chatId: string, title: string) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      title,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export async function deleteChat(chatId: string) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await deleteDoc(chatRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}`);
  }
}

export async function pinChat(chatId: string, pinned: boolean) {
  try {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
      pinned,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
  }
}

export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
  const q = query(collection(db, 'chats'), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    callback(snapshot.docs.map(d => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...data } as Chat;
    }));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `chats`);
  });
}

export async function sendMessage(chatId: string, userId: string, sender: 'user'|'ai', content: string) {
  try {
    const msgRef = doc(collection(db, `chats/${chatId}/messages`));
    await setDoc(msgRef, {
      chatId,
      userId,
      sender,
      content,
      createdAt: serverTimestamp(),
      status: 'sent'
    });
    
    // Update chat 
    await updateDoc(doc(db, 'chats', chatId), {
      updatedAt: serverTimestamp()
    });
    
    return msgRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `chats/${chatId}/messages`);
  }
}

export function subscribeToMessages(chatId: string, userId: string, callback: (msgs: Message[]) => void) {
  const q = query(
    collection(db, `chats/${chatId}/messages`), 
    // the security rule has: resource.data.userId == request.auth.uid for messages list
    where('userId', '==', userId),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    callback(snapshot.docs.map(d => {
      const data = d.data({ serverTimestamps: 'estimate' });
      return {
        id: d.id,
        ...data,
        status: d.metadata.hasPendingWrites ? 'sending' : data.status || 'sent'
      } as Message;
    }));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, `chats/${chatId}/messages`);
  });
}
