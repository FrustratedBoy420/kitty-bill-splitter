import { Link, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { homesApi } from '../api'
import { knownHomes, rememberHome } from '../storage'
import { ChevronRight, ErrorBox, Mark, Shell, useSubmit } from './ui'

// three.js is only downloaded for this screen, after the first paint.
const CoinScene = lazy(() => import('./CoinScene'))

const COIN_LABEL = 'A coin cut into four shares, one of them paid'

export function HomePicker() {
  // Read once per visit; this screen is the only place that lists homes.
  const [homes] = useState(knownHomes)
  const navigate = useNavigate()
  const [name, setName] = useState('')

  const form = useSubmit(async () => {
    const result = await homesApi.create(name)
    if (!result.ok) return result.error
    rememberHome(result.data)
    setName('')
    await navigate({ to: '/', search: { homeId: result.data.id } })
    return null
  })

  return (
    <Shell>
      <div className="title-row">
        <div>
          <h1>Homes</h1>
          <p>
            {homes.length === 0
              ? 'No homes yet. Start with the place you share.'
              : `${homes.length} ${homes.length === 1 ? 'home' : 'homes'} on this device.`}
          </p>
        </div>
      </div>

      <div className="stack">
        <section className="panel hero" aria-labelledby="new-home">
          <div className="hero-copy">
            <h2 id="new-home">Split bills to the cent.</h2>
            <p className="hero-text">
              Name the place you share and add who lives there. Every bill is cut into one share
              each, and everyone pays their own.
            </p>
            <form className="hero-form" onSubmit={form.onSubmit}>
              <div className="field">
                <label htmlFor="home-name">Home name</label>
                <input
                  id="home-name"
                  className="input"
                  placeholder="Flat 4B, Elm Street"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={form.pending}>
                {form.pending ? 'Creating…' : 'Create home'}
              </button>
            </form>
            {form.error && (
              <div className="form-error">
                <ErrorBox message={form.error} />
              </div>
            )}
          </div>

          <div className="coin-stage">
            <Suspense fallback={null}>
              <CoinScene label={COIN_LABEL} />
            </Suspense>
            {/* Shown until WebGL draws, and for good if WebGL is not available. */}
            <span className="coin-fallback">
              <Mark size={160} />
            </span>
            <p className="coin-caption">One bill, one share each. Blue is paid.</p>
          </div>
        </section>

        <section className="panel" aria-labelledby="your-homes">
          <div className="panel-head">
            <h2 id="your-homes">Your homes</h2>
          </div>
          {homes.length === 0 ? (
            <p className="empty">
              Homes you create or open on this device show up here. To join a home someone else
              made, open the link they share with you.
            </p>
          ) : (
            <nav aria-label="Homes">
              {homes.map((home) => (
                <Link key={home.id} to="/" search={{ homeId: home.id }} className="home-row">
                  <span>{home.name}</span>
                  <ChevronRight />
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </Shell>
  )
}
