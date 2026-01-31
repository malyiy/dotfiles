# Claude Code Style Guide

Code style and formatting preferences. These are defaults - defer to project-specific configurations when they exist.

## Formatting

| Setting | Preference |
|---------|------------|
| Indentation | Tabs |
| Semicolons | Always |
| Quotes | Single quotes |
| Trailing commas | Never |
| Max line length | ~120 (soft limit, good to follow but not strict) |

## JavaScript/TypeScript

### Variables & Functions

```typescript
// Use const over let
const value = 'immutable';

// Arrow functions preferred
const handleClick = () => { ... };

// camelCase for variables and functions
const userName = 'john';
const getUserData = () => { ... };

// PascalCase for components and classes
const UserProfile = () => { ... };
class DataService { ... }

// camelCase for file names
userProfile.ts
dataService.ts
```

### Destructuring

Use destructuring aggressively for guaranteed non-null properties:

```typescript
// Good - top-level properties that are guaranteed to exist
const { name, email, id } = user;

// Good - with default values for nullable nested objects
const { profile: { avatar } = {} } = user;

// Good - destructure after null check
if (user.profile) {
  const { avatar, settings } = user.profile;
}

// BAD - nested destructuring without null safety
const { profile: { avatar } } = user; // Throws if profile is null
```

**Rule:** Use optional chaining for nullable paths, destructuring for guaranteed properties.

### Exports

```typescript
// Prefer default exports
export default function UserProfile() { ... }

// Import order: external first, then internal
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { UserService } from '@/services/user';
import { Button } from '@/components/Button';
```

### Control Flow

```typescript
// Early returns preferred
function processUser(user: User) {
  if (!user) return null;
  if (!user.isActive) return null;

  return user.process();
}

// Ternary only for simple cases
const status = isActive ? 'active' : 'inactive';

// Avoid complex ternaries - use if/else instead
// BAD:
const result = condition1 ? value1 : condition2 ? value2 : value3;

// GOOD:
if (condition1) return value1;
if (condition2) return value2;
return value3;
```

### Optional Chaining

Use only where null/undefined is actually expected:

```typescript
// Good - profile might not exist
const displayName = user.profile?.displayName;

// Avoid overuse when values are guaranteed
// BAD (if user is always defined):
const name = user?.profile?.settings?.displayName?.trim();
```

### Nullish Coalescing vs OR

Use judgment based on context:

```typescript
// Use ?? when 0 or '' are valid values
const count = value ?? 0;

// Use || when falsy values should trigger default
const name = value || 'Anonymous';
```

## TypeScript Specifics

### Validation

- Prefer TypeScript types for compile-time safety
- Use manual validation for runtime checks when needed
- Project-specific validation libraries (Zod, Yup) when already in use

```typescript
// Manual validation example
function validateUser(data: unknown): User {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid user data');
  }
  // ... validate fields
  return data as User;
}
```

## Architecture

### Module System

- Use ESM (`import`/`export`)
- Avoid CommonJS unless required by tooling

### API Layer

- Use services pattern for API calls
- Prefer TanStack Query for data fetching (when applicable)

### Approach

- Functional programming preferred
- Avoid classes unless necessary
- Pure functions where possible
