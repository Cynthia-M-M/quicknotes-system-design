# QuickNotes System Architecture Document

## 1. Overview

This document outlines the distributed system architecture for **QuickNotes**, designed to scale from an initial browser-based prototype to a resilient, high-availability cloud platform serving **1,000,000 registered users**.

---

## 2. Requirements

### 2.1 Functional Requirements

- **Create Notes:** Users can create new notes with a validated title (mandatory, $\le 100$ characters), optional body, and optional category tags.
- **Read & List Notes:** Users can fetch a paginated feed of their authored notes ordered by recency.
- **Delete Notes:** Users can permanently delete individual notes they own.
- **Tagging & Search:** Notes can be categorized using reusable tags and filtered efficiently.

### 2.2 Non-Functional Requirements

- **High Availability:** Target 99.99% uptime ("four nines"), allowing under 53 minutes of total downtime per year.
- **Low Latency:** Read requests (`GET /notes`) must respond in under 50 ms for cached hits and under 100 ms for database reads.
- **Scalability:** Horizontal elasticity to handle peak traffic rushes of 5× normal daily volume.
- **Data Durability & Reliability:** Zero data loss for committed notes via transactional persistence and automated database backups.
- **Stateless Compute:** Application servers maintain zero local session state to facilitate seamless horizontal autoscaling.

---

## 3. Capacity & Load Estimation (1 Million Users)

### 3.1 Core Assumptions

- **Registered User Base:** 1,000,000 users.
- **Daily Active Users (DAU):** 20% of registered base = **200,000 DAU**.
- **User Activity:**
  - Each active user creates **5 notes per day** (Writes).
  - Each active user checks/loads their notes **20 times per day** (Reads).
- **Average Note Record Size:** ~500 bytes (metadata, title, body, and tags).
- **Seconds per Day:** $86,400\text{ seconds} \approx 100,000\text{ seconds}$ for conservative estimation.

### 3.2 Throughput Estimates (Queries Per Second - QPS)

#### Write Throughput:

$$\text{Total Daily Writes} = 200,000\text{ DAU} \times 5\text{ notes/day} = 1,000,000\text{ writes/day}$$
$$\text{Average Write QPS} = \frac{1,000,000\text{ writes}}{100,000\text{ seconds}} \approx 10\text{ writes/second}$$
$$\text{Peak Write QPS (5}\times\text{ multiplier)} = 10 \times 5 = 50\text{ writes/second}$$

#### Read Throughput:

$$\text{Total Daily Reads} = 200,000\text{ DAU} \times 20\text{ views/day} = 4,000,000\text{ reads/day}$$
$$\text{Average Read QPS} = \frac{4,000,000\text{ reads}}{100,000\text{ seconds}} \approx 40\text{ reads/second}$$
$$\text{Peak Read QPS (5}\times\text{ multiplier)} = 40 \times 5 = 200\text{ reads/second}$$

#### Total Traffic & Workload Characteristics:

- **Total Peak QPS:** $50\text{ writes/sec} + 200\text{ reads/sec} = 250\text{ requests/sec}$.
- **Read-to-Write Ratio:** $4:1$ (80% reads, 20% writes). The system is heavily read-dominant, making in-memory caching and read replica scaling highly effective.

### 3.3 Storage Projections:

$$\text{Daily Storage Ingestion} = 1,000,000\text{ notes} \times 500\text{ bytes} = 500,000,000\text{ bytes} = 500\text{ MB/day}$$
$$\text{Annual Storage Accumulation} = 500\text{ MB/day} \times 365\text{ days} \approx 182.5\text{ GB/year}$$
$$\text{5-Year Storage Projection} \approx 912.5\text{ GB} \approx 1\text{ TB}$$

_Conclusion:_ Storage volume is modest (~182.5 GB/year). A single PostgreSQL instance with SSD storage easily accommodates multiple years of data, meaning database sharding is not required immediately; primary-replica read scaling and in-memory caching are sufficient.

---

## 4. Distributed Architecture Diagram

```
                               ┌────────────────────────────────┐
                               │           DNS Server           │
                               │  (Route 53 / Anycast Geo-DNS)  │
                               └───────────────┬────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
      ┌─────────────────┐                                             ┌─────────────────┐
      │  Client Browser │──────────── Static Assets (HTML/CSS/JS) ────>│    CDN Edge     │
      │  / Mobile App   │<────────── Cached Edge Content ─────────────│  (Cloudflare)   │
      └────────┬────────┘                                             └─────────────────┘
               │
               │ HTTPS API Requests (/api/notes)
               ▼
      ┌─────────────────────────────────────────────────────────────────┐
      │                   LOAD BALANCER (Nginx / AWS ALB)               │
      │                  (SSL Termination & Health Checks)              │
      └────────────────┬───────────────────────────────┬────────────────┘
                       │                               │
                       ▼                               ▼
             ┌────────────────────┐          ┌────────────────────┐
             │    App Server 1    │          │    App Server 2    │
             │ (Stateless Node/Go)│          │ (Stateless Node/Go)│
             └─────────┬──────────┘          └─────────┬──────────┘
                       │                               │
                       ├───────────────────────────────┤
                       │                               │
                       ▼ (Cache-Aside: Sub-ms Reads)   │
             ┌────────────────────┐                    │
             │    Redis Cache     │                    │
             │   (In-Memory Key)  │                    │
             └────────────────────┘                    │
                                                       │
         ┌─────────────────────────────┬───────────────┴─────────────┐
         ▼ (Writes & Mutations)        ▼ (Read Queries)              ▼ (Async Tasks)
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   Primary DB     │───WAL───>│   Read Replica   │          │  Message Queue   │
│   (PostgreSQL)   │Streaming │   (PostgreSQL)   │          │ (RabbitMQ / SQS) │
└──────────────────┘          └──────────────────┘          └────────┬─────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │ Background Worker│
                                                            │ (Search / Tasks) │
                                                            └──────────────────┘
```

---

## 5. Component Roles & Problem Analysis

One clear sentence per component explaining the exact problem it solves:

1. **Client (Browser / Mobile App):** Provides the responsive user interface for capturing, organizing, and deleting notes while executing client-side validation.
2. **DNS Server (Route 53):** Resolves the human-readable domain name (`quicknotes.io`) to load balancer IP addresses using low-latency Anycast routing.
3. **CDN (Cloudflare / Edge Network):** Caches and serves static assets (HTML, CSS, JavaScript) geographically close to users to eliminate network round-trip latency and offload traffic from backend origin servers.
4. **Load Balancer (Nginx / AWS ALB):** Distributes incoming HTTP/HTTPS traffic across available application servers using Round Robin while routing around unhealthy nodes.
5. **App Servers (Server 1 & 2):** Run stateless application business logic, enforce authentication, validate incoming requests, and coordinate database interactions.
6. **In-Memory Cache (Redis):** Caches high-frequency read queries in RAM using the Cache-Aside pattern to return user notes in sub-milliseconds without hitting disk.
7. **Primary Database (PostgreSQL):** Serves as the authoritative single source of truth that processes all write mutations, enforces relational constraints, and guarantees ACID transactions.
8. **Read Replica Database (PostgreSQL):** Offloads high-volume read queries (`SELECT`) from the primary database using asynchronous Write-Ahead Log (WAL) replication.
9. **Message Queue (RabbitMQ / SQS):** Buffers resource-intensive asynchronous background tasks so HTTP response cycles remain fast and non-blocking.
10. **Background Worker:** Asynchronously consumes messages from the queue to process deferred jobs such as text search indexing and notification dispatch.

---

## 6. End-to-End Request Flows

### 6.1 `GET /notes` (Read Lifecycle - Cache-Aside Pattern)

```
Client ──> Load Balancer ──> App Server ──> [1] Check Redis
                                               ├── Cache Hit  ──> Return data (sub-10ms)
                                               └── Cache Miss ──> [2] Query Read Replica DB
                                                                      ├── [3] Store in Redis (TTL = 5m)
                                                                      └── [4] Return response to client
```

1. **Client Request:** The client browser dispatches an authenticated `GET /api/notes` request with their Bearer token.
2. **Load Balancing:** The load balancer verifies instance health and routes the request to an available stateless App Server.
3. **Cache Lookup:** The App Server hashes the user's ID into a cache key (`notes:user:42:page:1`) and checks the Redis cache.
4. **Cache Hit:** If the data exists in Redis, it is immediately deserialized and returned to the client in `<10 ms`.
5. **Cache Miss:** If the key is not in Redis, the App Server queries the **Read Replica Database**.
6. **Cache Population:** The App Server populates Redis with the query result and sets a Time-To-Live (TTL) of 300 seconds (5 minutes).
7. **Response Delivery:** The App Server returns a `200 OK` JSON payload with notes and pagination metadata to the client.

---

### 6.2 `POST /notes` (Write Lifecycle - Write & Invalidation)

```
Client ──> Load Balancer ──> App Server ──> [1] Validate Input
                                               ├── Invalid ──> 400 Bad Request
                                               └── Valid   ──> [2] INSERT into Primary DB
                                                               ├── [3] Invalidate Redis Cache Key
                                                               ├── [4] Publish to Message Queue
                                                               └── [5] Return 201 Created to Client
```

1. **Client Submission:** The client submits a JSON payload `{ title, body, tags }` via `POST /api/notes`.
2. **Load Balancing & Validation:** The App Server receives the request and validates that `title` is non-empty and $\le 100$ characters. If invalid, it immediately halts and returns `400 Bad Request`.
3. **Transactional Write:** The App Server executes an `INSERT` statement against the **Primary Database** within an ACID transaction.
4. **Cache Invalidation:** To prevent stale reads, the App Server deletes the user's cached feed key in Redis (`DEL notes:user:42:*`).
5. **Asynchronous Enqueueing:** The App Server pushes a lightweight event `{ event: "note_created", noteId: 1042 }` into the RabbitMQ queue for background tasks.
6. **HTTP Response:** The App Server immediately responds to the client with `210 Created`, including the newly assigned note ID and metadata.
7. **Background Worker Processing:** The asynchronous worker pulls the task from RabbitMQ to update full-text search indexes without delaying the user.

---

## 7. Architectural Trade-offs & Single Point of Failure (SPOF) Strategy

### 7.1 Engineering Trade-offs

#### Trade-off 1: In-Memory Caching (Speed vs. Freshness)

- **Decision:** Use Redis Cache-Aside for user notes lists.
- **Advantage:** Lowers read latency from 45 ms to <5 ms and shields the relational database from 80% of read traffic.
- **Drawback:** Introduces complexity around cache invalidation. If a write succeeds but cache invalidation fails or is delayed, a user might briefly see stale data until the 5-minute TTL expires.
- **Mitigation:** Strict invalidation-on-write (`DEL key`) combined with conservative TTLs (300 seconds).

#### Trade-off 2: Primary-Replica Replication (Availability vs. Consistency)

- **Decision:** Asynchronous streaming replication from Primary PostgreSQL to Read Replica.
- **Advantage:** Read replicas can be horizontally scaled to absorb peak traffic without burdening write performance on the primary instance.
- **Drawback:** Under peak write throughput, replication lag can exist (typically 10–50 ms). A user who creates a note and instantly refreshes might query a replica before the replication stream catches up (Eventual Consistency).
- **Mitigation:** Route "read-your-own-writes" queries directly to the Primary database for 5 seconds immediately following any write mutation.

---

### 7.2 Single Points of Failure (SPOF) Avoidance Strategy

A Single Point of Failure is any individual component whose disruption halts the entire system. QuickNotes eliminates SPOFs across all tiers:

| Layer             | Potential SPOF             | Redundancy & Automated Failover Solution                                                                                                                    |
| :---------------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DNS**           | Single DNS provider outage | Managed Anycast DNS (AWS Route 53) with multi-provider secondary DNS backup.                                                                                |
| **Static Assets** | Web server crash           | Cloudflare CDN edge servers distributed worldwide across hundreds of PoPs with automatic origin fallback.                                                   |
| **Load Balancer** | Single load balancer crash | Active-Passive load balancer pair running VRRP / Keepalived with automated floating IP transfer.                                                            |
| **Compute / API** | Single App Server crash    | At least two stateless App Servers running across separate Availability Zones; Load Balancer health checks drop failed servers automatically in <5 seconds. |
| **Cache**         | Redis server crash         | Redis Sentinel with master-replica replication and automated failover; on total cache loss, App Servers gracefully degrade to reading from Read Replicas.   |
| **Database**      | Primary Database crash     | Automated failover promotes the standby Read Replica to become the new Primary instance within 30 seconds (e.g., AWS RDS Multi-AZ).                         |
| **Message Queue** | Queue broker crash         | Mirrored RabbitMQ cluster with durable queues written to persistent storage, preventing message loss during broker restarts.                                |
