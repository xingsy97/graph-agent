"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Folder,
  FolderOpen,
  LoaderCircle,
  X,
} from "lucide-react";

interface DirectoryListing {
  path: string;
  parent: string | null;
  entries: Array<{ name: string; path: string }>;
}

export function WorkspacePickerModal({
  open,
  initialPath,
  onClose,
  onSelect,
}: {
  open: boolean;
  initialPath: string;
  onClose(): void;
  onSelect(path: string): void;
}) {
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [pathInput, setPathInput] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const browse = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/workspaces?path=${encodeURIComponent(path)}`,
      );
      const data = (await response.json()) as DirectoryListing & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Unable to open this directory");
      setListing(data);
      setPathInput(data.path);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to open this directory",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void browse(initialPath);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, initialPath]);

  if (!open) return null;
  return (
    <div
      className="directory-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="directory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-modal-title"
      >
        <header>
          <div className="directory-modal-icon">
            <FolderOpen size={21} />
          </div>
          <div>
            <h2 id="directory-modal-title">Choose working directory</h2>
            <p>Agents read and write files inside this folder.</p>
          </div>
          <button
            className="directory-close"
            aria-label="Close directory picker"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <form
          className="directory-address"
          onSubmit={(event) => {
            event.preventDefault();
            void browse(pathInput);
          }}
        >
          <button
            type="button"
            aria-label="Go to parent directory"
            disabled={!listing?.parent || loading}
            onClick={() => listing?.parent && void browse(listing.parent)}
          >
            <ChevronLeft size={18} />
          </button>
          <label>
            <span className="sr-only">Directory path</span>
            <input
              autoFocus
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
            />
          </label>
          <button
            type="submit"
            aria-label="Open entered path"
            disabled={loading}
          >
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="directory-list" aria-live="polite">
          {loading ? (
            <div className="directory-state">
              <LoaderCircle className="directory-spinner" size={22} />
              Opening folder…
            </div>
          ) : error ? (
            <div className="directory-state directory-error">{error}</div>
          ) : listing?.entries.length ? (
            listing.entries.map((entry) => (
              <button key={entry.path} onClick={() => void browse(entry.path)}>
                <span>
                  <Folder size={19} fill="currentColor" />
                </span>
                <strong>{entry.name}</strong>
                <ChevronLeft className="directory-enter" size={17} />
              </button>
            ))
          ) : (
            <div className="directory-state">
              This folder has no subdirectories.
            </div>
          )}
        </div>
        <footer>
          <div>
            <small>Selected folder</small>
            <strong title={listing?.path}>{listing?.path ?? pathInput}</strong>
          </div>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button directory-select"
            disabled={!listing || loading}
            onClick={() => listing && onSelect(listing.path)}
          >
            <Check size={17} />
            Use this folder
          </button>
        </footer>
      </div>
    </div>
  );
}
