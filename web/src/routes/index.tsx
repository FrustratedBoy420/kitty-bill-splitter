import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../components/HomePage'
import { HomePicker } from '../components/HomePicker'

type Search = { homeId?: string }

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search.homeId === 'string' && search.homeId.length > 0 ? { homeId: search.homeId } : {},
  component: Index,
})

function Index() {
  const { homeId } = Route.useSearch()
  return homeId ? <HomePage key={homeId} homeId={homeId} /> : <HomePicker />
}
