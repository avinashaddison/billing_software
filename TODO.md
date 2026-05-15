# Login Flow Update TODO

## Summary of Changes Needed

### 1. Update Login.tsx
- Add email/password form as default login
- Keep PIN login as "Quick Staff Login" alternative  
- Call POST /api/auth/login-email for email login
- Handle response: set cookie via backend, call /api/auth/me to get user data
- Keep existing PIN flow working (Quick Staff Login)

### 2. Update use-auth.ts (if needed)
- Handle email login response format (id, email, role, tenantId)

### 3. Create admin user (via script or directly)
- Need at least one user in auth_users table to test

## Implementation Steps

1. [x] Read current Login.tsx - UNDERSTOOD
2. [ ] Update Login.tsx - Add email/password form as default
3. [ ] Keep PIN login as "Quick Staff Login" tab/button
4. [ ] Test login flow
5. [ ] Create initial user if needed

---

# Server Status (Completed)

Server is running on port 3000 (PID 10976). Verified working.
