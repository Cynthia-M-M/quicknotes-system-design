/**
 * QuickNotes - REST API Client
 * Communicates with JSONPlaceholder mock API to demonstrate GET, POST, and DELETE operations.
 */

// 1. API Configuration
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// 2. DOM Elements
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const notesCountEl = document.getElementById("notes-count");

/**
 * Updates UI status message with distinct styles.
 * @param {string} message - Message text inserted safely via textContent.
 * @param {'loading'|'success'|'error'|'empty'} type - Status category.
 */
function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = "";
  if (type) {
    statusEl.classList.add(`status-${type}`);
  }
}

/**
 * Updates the notes count badge.
 */
function updateNotesCount() {
  if (!notesCountEl) return;
  const count = notesList.querySelectorAll(".note-item").length;
  notesCountEl.textContent = `${count} ${count === 1 ? "item" : "items"}`;
}

/**
 * Displays an empty state placeholder inside the notes list.
 * User-visible text is inserted using textContent only.
 * @param {string} message
 */
function renderEmptyState(message) {
  notesList.innerHTML = "";
  const emptyLi = document.createElement("li");
  emptyLi.className = "empty-state";
  emptyLi.textContent = message;
  notesList.appendChild(emptyLi);
  updateNotesCount();
}

/**
 * Removes any existing empty-state placeholder element from the list.
 */
function clearEmptyState() {
  const emptyItem = notesList.querySelector(".empty-state");
  if (emptyItem) {
    emptyItem.remove();
  }
}

/**
 * Reusable asynchronous request wrapper.
 * Calls fetch, checks response.ok, and throws an Error on failure.
 * Attaches the HTTP status code to the parsed response.
 * @param {string} url - Target URL.
 * @param {RequestInit} [options] - Fetch configuration (method, headers, body).
 * @returns {Promise<any>} Parsed response data.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      `HTTP Error ${response.status}: ${response.statusText || "Request failed"}`
    );
  }

  // Handle 204 No Content or empty responses
  if (response.status === 204) {
    return { _status: response.status };
  }

  const data = await response.json();

  // Attach non-enumerable HTTP status code so callers can access response.status
  if (data && typeof data === "object") {
    Object.defineProperty(data, "_status", {
      value: response.status,
      enumerable: false,
      writable: true,
    });
  }

  return data;
}

/**
 * Creates and returns a note DOM element.
 * All text (title, body, id) is inserted with textContent ONLY to prevent XSS.
 * @param {{ id: number|string, title: string, body?: string }} note
 * @returns {HTMLLIElement}
 */
function createNoteElement(note) {
  const li = document.createElement("li");
  li.className = "note-item";
  li.dataset.id = String(note.id);

  // Note header row
  const headerRow = document.createElement("div");
  headerRow.className = "note-header-row";

  const titleEl = document.createElement("h3");
  titleEl.className = "note-title";
  titleEl.textContent = note.title; // Safe textContent insertion

  const idBadge = document.createElement("span");
  idBadge.className = "note-id-badge";
  idBadge.textContent = `#${note.id}`;

  headerRow.appendChild(titleEl);
  headerRow.appendChild(idBadge);
  li.appendChild(headerRow);

  // Note body (optional)
  if (note.body && note.body.trim().length > 0) {
    const bodyEl = document.createElement("p");
    bodyEl.className = "note-body";
    bodyEl.textContent = note.body; // Safe textContent insertion
    li.appendChild(bodyEl);
  }

  return li;
}

/**
 * Task 1: Load notes (GET)
 * Fetches 10 notes from JSONPlaceholder and renders them in the list.
 */
async function loadNotes() {
  loadBtn.disabled = true;
  showStatus("Loading notes...", "loading");

  try {
    const notes = await request(`${API_URL}?_limit=10`);

    notesList.innerHTML = "";

    if (!Array.isArray(notes) || notes.length === 0) {
      renderEmptyState("No notes found on the server.");
      showStatus("No notes found.", "empty");
      return;
    }

    notes.forEach((note) => {
      notesList.appendChild(createNoteElement(note));
    });

    updateNotesCount();
    showStatus(`Loaded ${notes.length} notes from the server.`, "success");
  } catch (error) {
    console.error("Error loading notes:", error);
    showStatus("Failed to load notes. Please try again.", "error");
    if (notesList.children.length === 0) {
      renderEmptyState("Unable to load notes. Check your network connection.");
    }
  } finally {
    loadBtn.disabled = false;
  }
}

// 3. Event Listeners
loadBtn.addEventListener("click", loadNotes);
