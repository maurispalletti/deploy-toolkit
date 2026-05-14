// Sample Vite-React app that uses Firebase Auth + Firestore.
//
// On a fresh clone this file imports two siblings that DON'T exist
// yet — `firebase-config.js` and (conditionally, post-injection)
// `SignInWithGoogle.jsx`. Both are written by deploy-toolkit's
// inject-auth stage when the wizard runs:
//
//   - `src/firebase-config.js` — Firebase Web SDK config (always
//     written when plan.auth or plan.firestore is non-null).
//   - `src/SignInWithGoogle.jsx` — the Sign-in button component
//     (only written on the auto-inject path).
//
// Until those are generated, `vite dev` will fail with "Failed to
// resolve import". Run the wizard once and the resolution heals
// itself.

import { useEffect, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, query, orderBy,
  serverTimestamp
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";
import "./App.css";

const APP_TITLE = import.meta.env.VITE_APP_TITLE || "Notes";

function ensureApp() {
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export default function App() {
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Track sign-in state.
  useEffect(() => {
    const auth = getAuth(ensureApp());
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Load notes whenever the user changes.
  useEffect(() => {
    if (!user) {
      setNotes([]);
      return;
    }
    (async () => {
      try {
        const db = getFirestore(ensureApp());
        const q = query(
          collection(db, "users", user.uid, "notes"),
          orderBy("at", "desc")
        );
        const snap = await getDocs(q);
        setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(err.message || String(err));
      }
    })();
  }, [user]);

  async function addNote() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const db = getFirestore(ensureApp());
      const ref = collection(db, "users", user.uid, "notes");
      const n = notes.length + 1;
      await addDoc(ref, { text: `Note #${n}`, at: serverTimestamp() });
      // Re-fetch instead of reading back the ref (keeps the code dumb
      // and the deploy verifiable from a single getDocs call).
      const snap = await getDocs(query(ref, orderBy("at", "desc")));
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="card">
      <h1>{APP_TITLE}</h1>

      {/* The wizard's auto-inject path will insert <SignInWithGoogle />
          right here. The prompt-path version expects you (or your AI
          tool) to do the same. */}

      {!user && <p className="hint">Please sign in to see your notes.</p>}

      {user && (
        <>
          <button onClick={addNote} disabled={busy}>
            {busy ? "Adding…" : "Add a note"}
          </button>
          <ul className="notes">
            {notes.length === 0 && <li className="hint">No notes yet — click "Add a note".</li>}
            {notes.map(n => (
              <li key={n.id}>{n.text}</li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="hint error">{error}</p>}
    </main>
  );
}
