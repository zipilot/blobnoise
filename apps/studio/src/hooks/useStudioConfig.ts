import { useCallback, useEffect, useRef, useState } from "react";
import { createConfig, getPreset, parseConfig, serializeConfig, type BlobConfig } from "blobnoise";

export const STORAGE_KEY = "blobnoise.studio.config.v1";
const MAX_BYTES = 65_536;

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseImport(text: string): BlobConfig {
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) {
    throw new Error("Configuration must be 64 KiB or smaller.");
  }
  return parseConfig(text);
}

function loadDraft() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { config: saved ? parseImport(saved) : getPreset("Cloud"), error: null, restored: !!saved };
  } catch (error) {
    return {
      config: getPreset("Cloud"),
      error: `Could not restore the local draft: ${errorMessage(error)} Your current work can still be downloaded.`,
      restored: false,
    };
  }
}

export function useStudioConfig() {
  const [initial] = useState(loadDraft);
  const [config, setConfig] = useState(initial.config);
  const current = useRef(config);
  const past = useRef<BlobConfig[]>([]);
  const future = useRef<BlobConfig[]>([]);
  const [revision, setRevision] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(initial.error);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    initial.error ? "unsaved" : initial.restored ? "saved" : "saving",
  );

  const publish = useCallback((next: BlobConfig) => {
    current.current = next;
    setConfig(next);
    setRevision(value => value + 1);
    setSaveStatus("saving");
  }, []);

  const commit = useCallback((input: unknown) => {
    const next = createConfig(input);
    if (serializeConfig(next) === serializeConfig(current.current)) return;
    past.current = [...past.current.slice(-99), current.current];
    future.current = [];
    publish(next);
  }, [publish]);

  const edit = useCallback((change: (draft: BlobConfig) => void) => {
    const draft = structuredClone(current.current);
    change(draft);
    commit(draft);
  }, [commit]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(current.current);
    publish(previous);
  }, [publish]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    publish(next);
  }, [publish]);

  const save = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeConfig(current.current));
      setStorageError(null);
      setSaveStatus("saved");
    } catch (error) {
      setStorageError(`Local autosave failed: ${errorMessage(error)} Your draft is still open. Download the config to keep a copy.`);
      setSaveStatus("unsaved");
    }
  }, []);

  useEffect(() => {
    if (revision === 0 && initial.error) return;
    const timeout = window.setTimeout(save, 400);
    return () => window.clearTimeout(timeout);
  }, [revision, initial.error, save]);

  useEffect(() => {
    const flush = () => {
      // Do not overwrite an unreadable saved draft before the user makes an edit.
      if (revision > 0 || !initial.error) save();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [revision, initial.error, save]);

  return {
    config, commit, edit, undo, redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    reset: () => commit(getPreset("Cloud")),
    storageError, saveStatus, retrySave: save,
    restored: initial.restored,
  };
}
