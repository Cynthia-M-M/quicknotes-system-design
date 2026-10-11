# QuickNotes API Design Document

## 1. Overview

This document specifies the RESTful API for the production **QuickNotes** backend service. QuickNotes is a scalable cloud note-taking system designed to support 1 million registered users. This API replaces the JSONPlaceholder mock client used during early frontend prototyping with an enterprise-ready, authenticated HTTP interface.

All endpoints adhere to standard REST principles:

- **Base URL:** `https://api.quicknotes.io/v1`
- **Data Format:** UTF-8 encoded JSON (`Content-Type: application/json`)
- **Authentication:** Bearer token transmitted in the `Authorization: Bearer <token>` HTTP header.

---

## 2. REST Endpoints

The QuickNotes API provides resource-oriented endpoints for notes and tags:

| Method     | Path              | Description                                                                                                   | Success Status   |
| :--------- | :---------------- | :------------------------------------------------------------------------------------------------------------ | :--------------- |
| **GET**    | `/api/notes`      | Retrieves a paginated list of notes for the authenticated user, optionally filtered by tag or search keyword. | `200 OK`         |
| **POST**   | `/api/notes`      | Creates a new note for the authenticated user with validated title, optional body, and optional tags.         | `201 Created`    |
| **GET**    | `/api/notes/{id}` | Retrieves the complete details of a specific note owned by the authenticated user.                            | `200 OK`         |
| **PUT**    | `/api/notes/{id}` | Replaces all fields (title, body, tags) of an existing note owned by the user.                                | `200 OK`         |
| **DELETE** | `/api/notes/{id}` | Permanently removes an existing note and disassociates its tags.                                              | `204 No Content` |
| **GET**    | `/api/tags`       | Retrieves all tags created or utilized by the authenticated user.                                             | `200 OK`         |
| **POST**   | `/api/tags`       | Creates a new reusable tag for categorizing notes.                                                            | `201 Created`    |

---

## 3. Request & Response JSON Examples

### 3.1 Create a Note (`POST /api/notes`)

Creates a new note for the authenticated user. The `title` field is mandatory (max 100 characters). `body` and `tags` are optional.

#### Request Example

```http
POST /api/notes HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "title": "System Architecture Review",
  "body": "Discuss Redis cache-aside invalidation and PostgreSQL read replicas.",
  "tags": ["backend", "scaling"]
}
```

#### Response Example (`201 Created`)

```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/notes/1042

{
  "id": 1042,
  "userId": 42,
  "title": "System Architecture Review",
  "body": "Discuss Redis cache-aside invalidation and PostgreSQL read replicas.",
  "tags": [
    { "id": 1, "name": "backend" },
    { "id": 5, "name": "scaling" }
  ],
  "createdAt": "2026-10-15T14:30:00Z",
  "updatedAt": "2026-10-15T14:30:00Z"
}
```

---

### 3.2 List Notes (`GET /api/notes`)

Retrieves a paginated collection of notes owned by the authenticated user. Supports pagination query parameters `?page=1&limit=10`.

#### Request Example

```http
GET /api/notes?page=1&limit=2 HTTP/1.1
Host: api.quicknotes.io
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

#### Response Example (`200 OK`)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    {
      "id": 1042,
      "userId": 42,
      "title": "System Architecture Review",
      "body": "Discuss Redis cache-aside invalidation and PostgreSQL read replicas.",
      "tags": [
        { "id": 1, "name": "backend" },
        { "id": 5, "name": "scaling" }
      ],
      "createdAt": "2026-10-15T14:30:00Z",
      "updatedAt": "2026-10-15T14:30:00Z"
    },
    {
      "id": 1041,
      "userId": 42,
      "title": "Grocery Shopping List",
      "body": "Almond milk, whole wheat bread, organic apples, ground coffee.",
      "tags": [
        { "id": 3, "name": "personal" }
      ],
      "createdAt": "2026-10-14T09:15:00Z",
      "updatedAt": "2026-10-14T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 2,
    "totalItems": 48,
    "totalPages": 24,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## 4. Error Handling and Status Codes

The QuickNotes API implements RFC 7807 compliant error bodies. All error responses include an `error`, a clear human-readable `message`, and the numerical `statusCode`.

### Error Status Codes

| Status Code                     | Meaning                           | Triggers in QuickNotes                                                                 |
| :------------------------------ | :-------------------------------- | :------------------------------------------------------------------------------------- |
| **`400 Bad Request`**           | Invalid client input              | Missing required `title`, title exceeding 100 characters, or malformed JSON syntax.    |
| **`401 Unauthorized`**          | Missing or invalid authentication | Missing `Authorization` header, expired JWT token, or forged signature.                |
| **`403 Forbidden`**             | Insufficient permissions          | Authenticated user attempts to view, edit, or delete a note belonging to another user. |
| **`404 Not Found`**             | Resource missing                  | The requested note ID or tag ID does not exist in the database.                        |
| **`500 Internal Server Error`** | Server-side execution failure     | Unhandled exception, database connection failure, or downstream service failure.       |

### Example Error Response Body (`400 Bad Request`)

When a client submits a note with a missing title or a title exceeding 100 characters:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Bad Request",
  "message": "Validation failed: 'title' is required and must not exceed 100 characters.",
  "statusCode": 400,
  "details": [
    {
      "field": "title",
      "issue": "String must contain between 1 and 100 characters."
    }
  ],
  "timestamp": "2026-10-15T14:31:05.120Z"
}
```

### Example Error Response Body (`403 Forbidden`)

When User 42 attempts to delete note 891 owned by User 17:

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden",
  "message": "You do not have permission to access or modify note 891.",
  "statusCode": 403,
  "timestamp": "2026-10-15T14:32:10.840Z"
}
```
