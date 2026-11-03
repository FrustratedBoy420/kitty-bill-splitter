import { createRootRoute, Outlet } from '@tanstack/react-router'
import { MotionConfig } from 'motion/react'
import { ErrorBox, Shell } from '../components/ui'

export const Route = createRootRoute({
  // reducedMotion="user": with the OS setting on, Motion drops every transform and keeps opacity.
  component: () => (
    <MotionConfig reducedMotion="user">
      <Outlet />
    </MotionConfig>
  ),
  // Last line of defence: a render error shows a message instead of a blank page.
  errorComponent: ({ reset }) => (
    <Shell>
      <div className="title-row">
        <h1>Something broke</h1>
      </div>
      <ErrorBox message="This page hit an unexpected error." onRetry={reset} />
    </Shell>
  ),
})
