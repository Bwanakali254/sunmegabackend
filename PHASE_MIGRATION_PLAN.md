# Phase Migration Plan

## Current State
- ✅ Functional backend with controllers, models, routes at root level
- ✅ Working authentication, cart, orders, payments
- ⚠️ Not organized into modular structure per phases
- ⚠️ Missing some Phase requirements (version fields, proper error classes, etc.)

## Migration Strategy

### Approach: Incremental Migration with Backward Compatibility

1. **Create new modular structure alongside existing code**
2. **Migrate modules one by one** (starting with shared infrastructure)
3. **Update routes to point to new modules gradually**
4. **Keep old code until migration complete**
5. **Remove old code after verification**

## Phase Implementation Order

### Phase 2 (Foundation) - START HERE
- [x] Shared error classes (BaseError + subclasses)
- [x] Request ID middleware
- [x] Enhanced error handler
- [x] Config validation (env.js)
- [x] Redis client setup (if not exists)
- [ ] Structured logger enhancements

### Phase 3 (Database Schema)
- [ ] Add version fields to Cart, Order, Payment models
- [ ] Add soft delete (deletedAt) to User, Product models
- [ ] Update indexes per phase specs
- [ ] Ensure Decimal128 for monetary fields

### Phase 4 (Auth) - First Module Migration
- [ ] Create `src/modules/auth/` structure
- [ ] Migrate auth to service layer
- [ ] Implement proper JWT refresh token rotation
- [ ] Update auth routes to use new module
- [ ] Test backward compatibility

### Phase 5 (Cart)
- [ ] Migrate cart to modular structure
- [ ] Implement guest cart merge
- [ ] Add versioning and optimistic locking
- [ ] Update routes

### Phase 6 (Products)
- [ ] Migrate products to modular structure
- [ ] Separate admin/storefront operations
- [ ] Add product state machine
- [ ] Update routes

### Phase 7 (Orders)
- [ ] Migrate orders to modular structure
- [ ] Ensure immutable snapshots
- [ ] Add atomic transaction support
- [ ] Update routes

### Phase 8 (Payments)
- [ ] Migrate payments to modular structure
- [ ] Ensure idempotency
- [ ] Update routes

### Phase 9 (Performance)
- [ ] Add Redis caching layer
- [ ] Add rate limiting per phase specs
- [ ] Add health/readiness endpoints
- [ ] Add graceful shutdown

## Notes

- Old routes will continue working during migration
- New routes will be added alongside old ones
- Once a module is fully migrated and tested, old code will be removed
- Database migrations will be additive only (no breaking changes)
