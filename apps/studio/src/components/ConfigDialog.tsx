import { useState, type ChangeEvent } from "react";
import { createSnippet, serializeConfig, type BlobConfig } from "@zipilot/blobnoise";
import { errorMessage, parseImport } from "../hooks/useStudioConfig";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { downloadBlob } from "./files";

export function ConfigDialog({ mode, config, onImport, onClose, notify }: {
  mode: "code" | "import"; config: BlobConfig; onImport: (config: BlobConfig) => void;
  onClose: () => void; notify: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [reading, setReading] = useState(false);
  const snippet = createSnippet(config);

  const copy = async () => {
    setCopied(false);
    setError("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable in this browser. Select and copy the snippet below.");
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch (reason) {
      setError(`Could not copy: ${errorMessage(reason)}`);
    }
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > 65_536) { setError("Configuration must be 64 KiB or smaller."); event.target.value = ""; return; }
    setReading(true);
    try {
      setText(await file.text());
    } catch (reason) { setError(`Could not read the file: ${errorMessage(reason)}`); }
    finally { setReading(false); event.target.value = ""; }
  };
  const importConfig = () => {
    try {
      const next = parseImport(text);
      onImport(next);
      notify("Configuration imported. You can undo this change.");
      onClose();
    } catch (reason) { setError(errorMessage(reason)); }
  };
  return (
    <Modal title={mode === "code" ? "Code and configuration" : "Import configuration"} onClose={onClose} wide>
      {mode === "code" ? <>
        <p className="modal-description">Use <code>@zipilot/blobnoise</code> from GitHub Packages. Configure the registry and GitHub authentication using the setup instructions.</p>
        <div className="code-caption"><span>JavaScript · browser</span><a href="https://github.com/zipilot/blobnoise#install-the-package" target="_blank" rel="noreferrer">Package setup</a></div>
        <textarea className="code-area" aria-label="JavaScript snippet" readOnly value={snippet} spellCheck={false} />
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={() => {
            try {
              downloadBlob(new Blob([serializeConfig(config)], { type: "application/json" }), `blobnoise-${config.seed}.json`);
              notify("Configuration download started.");
            } catch (reason) { setError(errorMessage(reason)); }
          }}><Icon name="download" />Download config</button>
          <button type="button" className="button primary" onClick={() => void copy()}><Icon name={copied ? "check" : "code"} />{copied ? "Copied!" : "Copy JavaScript"}</button>
        </div>
      </> : <>
        <p className="modal-description">Choose a config file or paste JSON. Every setting is validated before it replaces your draft. Maximum 64 KiB.</p>
        <label className="file-picker"><Icon name="upload" /><span>{reading ? "Reading file…" : "Choose a JSON file"}</span>
          <input type="file" accept=".json,application/json" aria-label="Import JSON file" disabled={reading} onChange={event => void readFile(event)} />
        </label>
        <label className="textarea-label" htmlFor="config-json">Configuration JSON</label>
        <textarea id="config-json" className="code-area" placeholder={'{\n  "seed": 42,\n  "surface": { "kind": "sphere" }\n}'}
          value={text} maxLength={65_537} onChange={event => { setText(event.target.value); setError(""); }} spellCheck={false}
          aria-invalid={!!error} aria-describedby={error ? "import-error" : undefined} />
        {error && <p id="import-error" className="error-message" role="alert">{error}</p>}
        <div className="modal-actions"><span className="helper">Your current draft stays intact if validation fails.</span>
          <button className="button primary" type="button" disabled={!text.trim() || reading} onClick={importConfig}><Icon name="upload" />Import config</button></div>
      </>}
    </Modal>
  );
}
