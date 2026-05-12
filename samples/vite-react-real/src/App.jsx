import { useState } from "react";
import "./App.css";

const TITLE = import.meta.env.VITE_APP_TITLE || "Sample Vite React App";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="card">
      <h1>{TITLE}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        count is {count}
      </button>
      <p className="hint">Sample app for testing deploy-toolkit.</p>
    </main>
  );
}
