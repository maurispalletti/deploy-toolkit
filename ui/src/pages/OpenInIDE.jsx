import { useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import { postOpenInIDE } from "../api.js";

const IDES = [
  { id: "cursor",      label: "Cursor" },
  { id: "vscode",      label: "VS Code" },
  { id: "antigravity", label: "Antigravity" },
  { id: "devin",       label: "Devin" },
];

export default function OpenInIDE({ appDir, onDone }) {
  const [opened, setOpened] = useState(null);

  async function open(id) {
    await postOpenInIDE(id, appDir);
    setOpened(id);
  }

  return (
    <Card
      title="Open your project"
      sub="Pick an editor to start building, then hit Done."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "20px 0" }}>
        {IDES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => open(id)}
            style={{
              padding: "10px 16px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "#fff",
              color: "#111",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              textAlign: "left",
              transition: "border-color 0.15s",
              outline: opened === id ? "2px solid var(--green, #16a34a)" : "none",
              outlineOffset: 1,
            }}
          >
            {opened === id ? "✓ " : ""}{label}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <Button onClick={onDone}>
          {opened ? "Done" : "Skip"}
        </Button>
      </div>
    </Card>
  );
}
