/**
 * QuickNotes - REST API Client
 * Communicates with JSONPlaceholder mock API to demonstrate GET, POST, and DELETE operations.
 */

// 1. API Configuration
const API_URL = "https://jsonplaceholder.typicode.com/posts";

// 2. DOM Elements
const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const noteForm = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");
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
  // Count only actual note items, excluding any empty-state li
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
      `HTTP Error ${response.status}: ${response.statusText || "Request failed"}`,
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

  // Footer with Delete button
  const footer = document.createElement("div");
  footer.className = "note-footer";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger btn-delete";
  deleteBtn.textContent = "Delete Note";

  deleteBtn.addEventListener("click", () => deleteNote(note.id, li, deleteBtn));

  footer.appendChild(deleteBtn);
  li.appendChild(footer);

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

/**
 * Task 2: Create a note (POST)
 * Validates user input and sends a POST request with payload { title, body, userId: 1 }.
 * @param {Event} event
 */
async function createNote(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  // Validation: Title is required
  if (!title) {
    showStatus("Validation Error: Title is required.", "error");
    titleInput.focus();
    return;
  }

  // Validation: Title max length is 100 characters
  if (title.length > 100) {
    showStatus(
      "Validation Error: Title must be 100 characters or less.",
      "error",
    );
    titleInput.focus();
    return;
  }

  submitBtn.disabled = true;
  showStatus("Creating note...", "loading");

  try {
    const payload = {
      title,
      body,
      userId: 1,
    };

    const newNote = await request(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    });

    // Remove empty-state message if present
    clearEmptyState();

    // Insert the new note at the top of the list
    const noteEl = createNoteElement(newNote);
    notesList.insertBefore(noteEl, notesList.firstChild);
    updateNotesCount();

    const statusCode = newNote._status || 201;
    showStatus(
      `Note created (status ${statusCode}, id ${newNote.id}).`,
      "success",
    );

    // Clear form after successful creation
    noteForm.reset();
    titleInput.blur();
  } catch (error) {
    console.error("Error creating note:", error);
    showStatus("Failed to create note. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Task 3: Delete note (DELETE)
 * Sends DELETE /posts/{id} and removes the note from the UI upon success.
 *
 * NOTE ON JSONPLACEHOLDER MOCK BEHAVIOR:
 * JSONPlaceholder is a fake REST API for prototyping and testing.
 * When a note is created via POST, JSONPlaceholder returns an id (such as 101)
 * but does not truly persist it to a database on the server.
 * When sending DELETE /posts/{id}, JSONPlaceholder responds with HTTP 200/204 to simulate
 * successful deletion. Our request() wrapper verifies response.ok.
 * If an error occurs, it is caught and an error status is displayed.
 * Once verified, we remove the corresponding element from the DOM and refresh the UI state.
 *
 * @param {number|string} id - The ID of the note to delete.
 * @param {HTMLLIElement} noteEl - The note list item element in the DOM.
 * @param {HTMLButtonElement} deleteBtn - The delete button within the item.
 */
async function deleteNote(id, noteEl, deleteBtn) {
  deleteBtn.disabled = true;
  deleteBtn.textContent = "Deleting...";
  showStatus("Deleting note...", "loading");

  try {
    await request(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    // Remove element from DOM on success
    noteEl.remove();
    updateNotesCount();

    showStatus(`Note ${id} successfully deleted.`, "success");

    // If the list is now empty, display empty state
    if (notesList.querySelectorAll(".note-item").length === 0) {
      renderEmptyState("All notes deleted. List is empty.");
      showStatus("All notes deleted. List is empty.", "empty");
    }
  } catch (error) {
    console.error(`Error deleting note ${id}:`, error);
    showStatus(`Failed to delete note ${id}. Please try again.`, "error");
    deleteBtn.disabled = false;
    deleteBtn.textContent = "Delete Note";
  }
}

// 3. Event Listeners
loadBtn.addEventListener("click", loadNotes);
noteForm.addEventListener("submit", createNote);

// 4. Initial Application State
showStatus('Click "Load Notes" to fetch your data.', "empty");
renderEmptyState(
  "No notes loaded yet. Click 'Load Notes' above to fetch notes.",
);
