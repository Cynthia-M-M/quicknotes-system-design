# QuickNotes Data Model Document

## 1. Overview

This document specifies the database architecture and schema for QuickNotes. The data tier must reliably store user accounts, notes, and categorization tags while maintaining strict referential integrity, supporting low-latency queries, and scaling to 1,000,000 registered users.

---

## 2. Entities & Schema Specification

The QuickNotes data model consists of four core relational entities:

### 2.1 `users`

Represents registered users in the system.

- `id`: `INTEGER` (Auto-incrementing / SERIAL) — **PRIMARY KEY**
- `username`: `VARCHAR(50)` — Unique, NOT NULL
- `email`: `VARCHAR(255)` — Unique, NOT NULL
- `password_hash`: `VARCHAR(255)` — NOT NULL (Bcrypt/Argon2 hash)
- `created_at`: `TIMESTAMP WITH TIME ZONE` — DEFAULT `CURRENT_TIMESTAMP`
- `updated_at`: `TIMESTAMP WITH TIME ZONE` — DEFAULT `CURRENT_TIMESTAMP`

### 2.2 `notes`

Represents user-created notes.

- `id`: `INTEGER` (Auto-incrementing / SERIAL) — **PRIMARY KEY**
- `user_id`: `INTEGER` — NOT NULL, **FOREIGN KEY** referencing `users(id)` ON DELETE CASCADE
- `title`: `VARCHAR(100)` — NOT NULL (enforces business rule limit of 100 characters)
- `body`: `TEXT` — Optional note content
- `created_at`: `TIMESTAMP WITH TIME ZONE` — DEFAULT `CURRENT_TIMESTAMP`
- `updated_at`: `TIMESTAMP WITH TIME ZONE` — DEFAULT `CURRENT_TIMESTAMP`

### 2.3 `tags`

Represents reusable categorization labels.

- `id`: `INTEGER` (Auto-incrementing / SERIAL) — **PRIMARY KEY**
- `name`: `VARCHAR(50)` — Unique, NOT NULL (e.g., "work", "ideas", "urgent")
- `created_at`: `TIMESTAMP WITH TIME ZONE` — DEFAULT `CURRENT_TIMESTAMP`

### 2.4 `note_tags` (Junction Table)

Resolves the many-to-many relationship between notes and tags.

- `note_id`: `INTEGER` — NOT NULL, **FOREIGN KEY** referencing `notes(id)` ON DELETE CASCADE
- `tag_id`: `INTEGER` — NOT NULL, **FOREIGN KEY** referencing `tags(id)` ON DELETE CASCADE
- **PRIMARY KEY:** `(note_id, tag_id)` (Composite primary key ensuring a tag is only attached once per note)

---

## 3. Relationships Explanation

1. **One-to-Many (1:N) — `users` to `notes`:**
   - A single user can author zero, one, or thousands of notes.
   - Each note belongs strictly to exactly one author (`user_id`).
   - If a user account is deleted, all their associated notes are automatically purged using `ON DELETE CASCADE` to prevent orphaned records.

2. **Many-to-Many (M:N) — `notes` to `tags`:**
   - A single note can be classified under multiple tags (e.g., a note can be tagged as both `backend` and `architecture`).
   - Conversely, a single tag can be linked to thousands of different notes authored by different users.
   - This relationship is modeled using the junction table `note_tags`. It contains foreign keys pointing to both parent tables, allowing many-to-many associations without data duplication.

---

## 4. DDL: `CREATE TABLE` Statements

```sql
-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Table
CREATE TABLE notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notes_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- 3. Tags Table
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Note_Tags Junction Table
CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    CONSTRAINT fk_notetags_note
        FOREIGN KEY (note_id)
        REFERENCES notes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_notetags_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags(id)
        ON DELETE CASCADE
);
```

---

## 5. Performance Indexes & Justification

To maintain sub-100 millisecond response times at scale, database indexes are strategically placed on high-frequency query paths:

```sql
-- Index on foreign key user_id in notes table
CREATE INDEX idx_notes_user_id ON notes(user_id);

-- Composite index for sorting user notes by recency
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);

-- Index on tag_id in the junction table for reverse lookups
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

### Reason for `idx_notes_user_id`:

In QuickNotes, the single most frequent database operation is loading a specific user's feed (`SELECT * FROM notes WHERE user_id = $1`). Without an index, PostgreSQL must perform a sequential full table scan across millions of rows on disk. With a B-Tree index on `user_id`, lookup time is reduced from $O(N)$ to $O(\log N)$, allowing the query planner to instantly locate the user's records with minimal disk I/O.

---

## 6. Example SQL Queries

### Query 1: Insert a Note and Link a Tag

```sql
-- Step A: Insert note
INSERT INTO notes (user_id, title, body)
VALUES (42, 'PostgreSQL Replication Setup', 'Configure streaming replication with WAL sender.')
RETURNING id;

-- Step B: Link tag to the newly inserted note (assume note_id = 1042, tag_id = 1)
INSERT INTO note_tags (note_id, tag_id)
VALUES (1042, 1);
```

### Query 2: Retrieve a User's Notes with Associated Tags (JOIN)

```sql
SELECT
    n.id AS note_id,
    n.title,
    n.body,
    n.created_at,
    COALESCE(
        json_agg(
            json_build_object('id', t.id, 'name', t.name)
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
    ) AS tags
FROM notes n
LEFT JOIN note_tags nt ON n.id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = 42
GROUP BY n.id
ORDER BY n.created_at DESC
LIMIT 10 OFFSET 0;
```

### Query 3: Aggregation — Count Total Notes per User

```sql
SELECT
    u.id AS user_id,
    u.username,
    COUNT(n.id) AS total_notes
FROM users u
LEFT JOIN notes n ON u.id = n.user_id
GROUP BY u.id, u.username
HAVING COUNT(n.id) > 0
ORDER BY total_notes DESC;
```

---

## 7. Database Engine Choice: SQL vs. NoSQL Justification

QuickNotes utilizes a **Relational SQL Database (PostgreSQL)** rather than a document-oriented NoSQL database (such as MongoDB).

**Justification:**

1. **Strict Referential Integrity & ACID Guarantees:** Notes are strictly bound to users, and tags are shared across many notes. Relational databases enforce foreign key constraints (`ON DELETE CASCADE`), ensuring no orphaned tags or records occur during concurrent deletions.
2. **Predictable Structured Schema:** Every note adheres to known constraints (title max 100 characters, mandatory user ownership). Relational schemas enforce data hygiene at the storage engine level.
3. **Complex Many-to-Many Relational Queries:** Categorizing notes requires joining `notes`, `note_tags`, and `tags`. Relational engines are engineered and optimized for multi-table joins. In NoSQL, modeling many-to-many relationships requires either data duplication (which causes update anomalies) or multiple application-layer network roundtrips.
4. **Horizontal Read Scalability:** PostgreSQL pairs effectively with read replicas and in-memory caches (Redis), providing the exact scalability profile needed for our read-heavy 4:1 workload without giving up transactional safety.
