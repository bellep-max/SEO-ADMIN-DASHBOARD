---
name: AppLayout auth redirect pattern
description: Calling setLocation during render in AppLayout causes React 18 to silently abort rendering (white screen). Must use useEffect.
---

## Rule
Never call `setLocation("/login")` directly inside the render body of AppLayout. Always wrap it in `useEffect`.

**Why:** In React 18, calling a state-setter (setLocation updates Wouter's location state) during render of a different component triggers "Cannot update a component while rendering a different component." React silently aborts the render, producing a white screen with no console error visible to the user.

**How to apply:**
```tsx
useEffect(() => {
  if (!isLoading && !user) {
    setLocation("/login");
  }
}, [isLoading, user, setLocation]);

if (isLoading || !user) {
  return <LoadingSpinner />;
}
```

This pattern was the root cause of the persistent white screen on the client-detail page — the render abort happened on any navigation where `user` was briefly undefined during a React Query revalidation.
