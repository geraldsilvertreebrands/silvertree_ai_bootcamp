# Architecture Decision Records

## ADR-001: Framework Selection

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Need to choose backend framework for internal SaaS access management tool.

**Options Considered:**

1. **Laravel (PHP)**
   - Pros: Comprehensive built-in features, rapid development, strong ecosystem
   - Cons: PHP performance, less modern language features, K8s deployment less common
   - Used by: BBC, Pfizer, many SaaS startups

2. **Flask (Python)**
   - Pros: Lightweight, flexible, Python ecosystem
   - Cons: More setup required, less opinionated, smaller web framework ecosystem
   - Used by: Netflix, Lyft for microservices

3. **Node.js/TypeScript with NestJS**
   - Pros: High performance, type safety, excellent K8s support, modern ecosystem, unified language
   - Cons: More initial setup, steeper learning curve if team new to TypeScript
   - Used by: LinkedIn, PayPal, Adidas, Roche

**Decision:** Node.js/TypeScript with NestJS

**Rationale:**
- Performance is critical for access overview page with many grants
- TypeScript provides type safety for long-lived project
- Excellent Kubernetes ecosystem and deployment patterns
- NestJS provides structure similar to enterprise frameworks
- Team has no strong preference, so choosing most modern option
- Modular architecture aligns with NestJS module system

**Fallback:** Laravel if team has strong PHP expertise

**Reversibility:** Medium - switching would require significant rewrite, but modular architecture makes it more feasible

---

## ADR-002: Database Selection

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Need relational database for access management system.

**Options Considered:**

1. **PostgreSQL**
   - Pros: Excellent JSON support, strong ACID guarantees, mature, excellent for SaaS
   - Cons: Slightly more complex than MySQL for simple use cases
   - Used by: Many SaaS companies (GitHub, Instagram, Spotify)

2. **MySQL/MariaDB**
   - Pros: Simpler for basic use cases, wide adoption
   - Cons: Less advanced features, weaker JSON support
   - Used by: Many web applications

**Decision:** PostgreSQL

**Rationale:**
- Better JSON support (useful for future metadata)
- Strong ACID guarantees important for access management
- Excellent for SaaS applications
- Better performance for complex queries
- Industry standard for modern applications

**Fallback:** MySQL if team has strong preference

**Reversibility:** Medium - schema differences, but both are SQL databases

---

## ADR-003: Architecture Pattern

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Choose architecture pattern for Phase 1.

**Options Considered:**

1. **Microservices**
   - Pros: Independent scaling, technology diversity
   - Cons: Operational complexity, overkill for Phase 1 scale, network latency
   - Used by: Large companies (Netflix, Amazon)

2. **Modular Monolith**
   - Pros: Simpler deployment, easier development, clear module boundaries, can extract later
   - Cons: Single deployment unit, shared database
   - Used by: Many startups and mid-size companies

3. **Traditional Monolith**
   - Pros: Simplest to start
   - Cons: Hard to maintain, unclear boundaries, difficult to scale
   - Used by: Legacy applications

**Decision:** Modular Monolith

**Rationale:**
- Phase 1 scale doesn't require microservices (~15 users, hundreds of grants)
- Clear module boundaries allow future extraction if needed
- Simpler deployment and development for small team
- Can evolve to microservices in Phase 2+ if needed
- Follows industry best practices for starting SaaS applications

**Fallback:** Continue as monolith if scale remains small

**Reversibility:** High - modules designed to be extractable

---

## ADR-004: ORM Selection

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Choose ORM for TypeScript/NestJS.

**Options Considered:**

1. **TypeORM**
   - Pros: Built into NestJS, decorator-based, migrations, active development
   - Cons: Can be complex for advanced queries, performance concerns at scale
   - Used by: Many NestJS applications

2. **Prisma**
   - Pros: Excellent developer experience, type-safe, great migrations
   - Cons: Less integrated with NestJS, different patterns
   - Used by: Many modern Node.js applications

3. **Sequelize**
   - Pros: Mature, feature-rich
   - Cons: Less TypeScript-friendly, older patterns
   - Used by: Many legacy Node.js applications

**Decision:** TypeORM

**Rationale:**
- Built into NestJS ecosystem
- Decorator-based (fits NestJS style)
- Good migration support
- Sufficient for Phase 1 scale
- Can evaluate Prisma later if needed

**Fallback:** Prisma if TypeORM becomes limiting

**Reversibility:** Medium - different query patterns, but both are ORMs

---

## ADR-005: Authentication Approach (Phase 1)

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Authentication strategy for Phase 1.

**Options Considered:**

1. **Full SSO Integration**
   - Pros: Production-ready, secure
   - Cons: Complex setup, may not be available in Phase 1
   - Used by: Enterprise applications

2. **Simple Username/Password**
   - Pros: Quick to implement, works immediately
   - Cons: Not production-grade, will need to replace
   - Used by: Internal tools, prototypes

3. **Defer Authentication**
   - Pros: Focus on core features
   - Cons: Can't test authorization properly
   - Used by: Early prototypes

**Decision:** Simple Username/Password with JWT tokens

**Rationale:**
- Phase 1 is internal tool, simple auth is acceptable
- Need to test authorization (system owner checks)
- Can upgrade to SSO in Phase 2
- Quick to implement, doesn't block core features

**Fallback:** Defer if SSO is available immediately

**Reversibility:** High - authentication is isolated layer

---

## ADR-006: UI Approach (Phase 1)

**Date:** 2024-12-19  
**Status:** Accepted  
**Context:** Frontend approach for Phase 1.

**Options Considered:**

1. **Single Page Application (SPA)**
   - Pros: Modern, fast interactions
   - Cons: More complex, SEO not needed, overkill for Phase 1
   - Used by: Modern web apps

2. **Server-Rendered Pages**
   - Pros: Simpler, faster to build, works for Phase 1
   - Cons: Less interactive, may need to rebuild for Phase 2
   - Used by: Traditional web apps

3. **API-First with Simple UI**
   - Pros: API ready for future, simple UI for Phase 1
   - Cons: Need to build both API and UI
   - Used by: Many SaaS applications

**Decision:** API-First with Simple Server-Rendered UI

**Rationale:**
- API-first design allows SPA later without API changes
- Simple server-rendered UI is faster for Phase 1
- Can build SPA in Phase 2 if needed
- Focus on core functionality, not UI polish in Phase 1

**Fallback:** Pure API if UI can be deferred

**Reversibility:** High - API is separate from UI

---

## ADR-007: Bulk Upload Approach (CSV + Grid)

**Date:** 2025-12-09  
**Status:** Accepted  
**Context:** Phase 1 requires fast bulk logging of access grants with clear error reporting.

**Decision:** Support both CSV upload and in-browser grid (JSON) for bulk grants. CSV endpoint validates rows, prevents duplicate active grants, creates missing users (derived from email), requires existing systems/instances/tiers, and returns per-row results used by the audit log/UI. Template download is provided; sample/import-only users are not seeded.

**Rationale:**
- CSV suits system owners working from spreadsheets.
- Grid editor covers quick in-app edits without leaving the UI.
- Service-level validation yields detailed per-row feedback and duplicate protection.

**Consequences:**
- Clear template/error messaging required.
- Audit log must include CSV-sourced grants.
- Seeds stay stable; sample users come via CSV to avoid index drift.

**Fallback:** If grid usage is low, keep CSV as primary and simplify grid interactions.

