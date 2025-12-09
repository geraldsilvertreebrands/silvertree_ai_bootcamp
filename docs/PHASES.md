# Project Phases

## Phase 1: Corolla (Current)

**Goal:** Fast, accurate access grant logging and review

**Timeline:** 4-6 weeks (estimated)

**Features:**
- User and Manager management
- System, SystemInstance, AccessTier management
- Access Grant logging (single and bulk)
- Bulk upload delivered via CSV (with template) and in-app grid; CSV can create missing users from email, but systems/instances/tiers must pre-exist
- Access Overview with filtering
- System Owner management
- Basic audit trail

**Status Values:** `active`, `removed` only

**Out of Scope:**
- Approval workflows
- HR system integration
- SSO authentication
- Notifications
- Advanced reporting

## Phase 2: Rolls Royce (Future)

**Goal:** Workflow-driven access management with approvals

**Planned Features:**
- Access request workflow
- Approval chains (manager approval, system owner approval)
- Status values: `requested`, `approved`, `to_remove`, `active`, `removed`
- Email/Slack notifications
- Access review cycles (quarterly reviews)
- Temporary access (expiration dates)
- Access delegation

**Technical Additions:**
- Workflow engine or state machine
- Notification service
- Background job processing (Bull/BullMQ)
- Event-driven architecture

## Phase 3: Self-Driving (Future)

**Goal:** Automated access provisioning and HR integration

**Planned Features:**
- HR system integration (Zoho People sync)
- Automated access provisioning based on role/department
- Access revocation on employee termination
- SSO integration (SAML, OAuth2)
- API for external systems
- Advanced analytics and reporting
- Compliance reporting (SOX, GDPR)
- Access certification campaigns

**Technical Additions:**
- HR system connector
- Provisioning engine
- SSO provider integration
- API gateway
- Analytics/BI integration

## Phase 4: Enterprise (Future)

**Goal:** Multi-tenant, enterprise-grade features

**Planned Features:**
- Multi-organization support
- Advanced RBAC within application
- Custom workflows per organization
- White-labeling
- Advanced audit and compliance
- Performance optimization for large scale

**Technical Additions:**
- Multi-tenancy architecture
- Advanced caching (Redis)
- Search engine (Elasticsearch)
- Microservices extraction (if needed)

