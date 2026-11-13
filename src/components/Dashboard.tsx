
import { useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { TankGauge } from '@joshtwc/react-gauges'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// --------------------------------------------------
// Types
// --------------------------------------------------

type Measurement = {
  tank_id: string
  timestamp: number
  distance_mm: number
  volume_l: number
  fill_percentage: number
}

type AggregatedMeasurement = {
  timestamp: number
  start: number
  end: number
  count: number
  min: number | null
  avg: number | null
  max: number | null
  min_timestamp: number | null
  max_timestamp: number | null
}

type HistorySummary = {
  count: number
  min: number | null
  max: number | null
  average: number | null
  first: number | null
  last: number | null
}

type Period = 'today' | '3d' | '7d' | '14d' | '1m'
type ChartMode = 'lttb' | 'aggregated'

type HistoryResponse = {
  period: Period
  start: number
  end: number
  lttb: Measurement[]
  aggregated: AggregatedMeasurement[]
  summary: HistorySummary
}

type DashboardProps = {
  onLogout: () => void
}

// --------------------------------------------------
// Constants
// --------------------------------------------------

const API_URL = (
  import.meta.env.VITE_API_URL as string
).replace(/\/$/, '')

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Dzisiaj' },
  { value: '3d', label: '3 dni' },
  { value: '7d', label: '7 dni' },
  { value: '14d', label: '14 dni' },
  { value: '1m', label: '1 miesiąc' },
]

// --------------------------------------------------
// API requests
// --------------------------------------------------

async function apiGet<T>(path: string): Promise<T> {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()

  if (!token) {
    throw new Error('Użytkownik nie jest zalogowany')
  }

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Błąd żądania API: ${response.status}`)
  }

  return (await response.json()) as T
}

function fetchLatestMeasurement(): Promise<Measurement> {
  return apiGet<Measurement>('/measurements/latest')
}

function fetchHistory(period: Period): Promise<HistoryResponse> {
  return apiGet<HistoryResponse>(
    `/measurements/history?period=${period}`
  )
}

// --------------------------------------------------
// Formatting and styling
// --------------------------------------------------

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('pl-PL')
}

function formatAxisDate(
  timestamp: number,
  period: Period
): string {
  const date = new Date(timestamp * 1000)

  if (period === 'today') {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return date.toLocaleDateString('pl-PL', {
    month: 'short',
    day: 'numeric',
  })
}

function formatPercentage(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const sectionStyle: CSSProperties = {
  border: '1px solid #64748b55',
  borderRadius: 12,
  padding: '1.5rem',
  margin: 0,
}

function buttonStyle(active: boolean): CSSProperties {
  return {
    padding: '0.55rem 0.9rem',
    borderRadius: 7,
    border: '1px solid #64748b66',
    cursor: 'pointer',
    fontSize: '0.9rem',
    backgroundColor: active ? '#2563eb' : 'transparent',
    color: active ? 'white' : 'inherit',
    fontWeight: active ? 600 : 400,
  }
}

// --------------------------------------------------
// History chart
// --------------------------------------------------

function HistoryChart() {
  const [period, setPeriod] = useState<Period>('7d')
  const [chartMode, setChartMode] = useState<ChartMode>('lttb')

  const {
    data,
    isPending,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['measurementHistory', period],
    queryFn: () => fetchHistory(period),
    staleTime: 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })

  const hasMeasurements = (data?.summary.count ?? 0) > 0

return (
  <section style={sectionStyle}>
    <div style={{ marginBottom: '1rem' }}>
      <h2 style={{ margin: 0 }}>Historia poziomu wody</h2>
      <small style={{ opacity: 0.7 }}>
        {isFetching
          ? 'Aktualizowanie historii...'
          : 'Pomiary historyczne'}
      </small>
    </div>


      {/* Period buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {PERIODS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPeriod(option.value)}
            aria-pressed={period === option.value}
            style={buttonStyle(period === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Chart mode buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setChartMode('lttb')}
          aria-pressed={chartMode === 'lttb'}
          style={buttonStyle(chartMode === 'lttb')}
        >
          Poziom wody
        </button>

        <button
          type="button"
          onClick={() => setChartMode('aggregated')}
          aria-pressed={chartMode === 'aggregated'}
          style={buttonStyle(chartMode === 'aggregated')}
        >
          Zakres wahań
        </button>
      </div>

      {isPending && <p>Wczytywanie historii...</p>}

      {error && (
        <p style={{ color: '#ef4444' }}>
          Nie udało się wczytać historii: {error.message}
        </p>
      )}

      {data && !hasMeasurements && (
        <p>Brak pomiarów w wybranym okresie.</p>
      )}

      {data && hasMeasurements && (
        <>
          <div style={{ width: '100%', height: 360 }}>
            {chartMode === 'lttb' ? (

              // ------------------------------------
              // LTTB: one line
              // ------------------------------------

              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.lttb}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#94a3b844"
                  />

                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="linear"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value: number) =>
                      formatAxisDate(value, period)
                    }
                    tickCount={6}
                    minTickGap={20}
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    domain={[
                      0,
                      (dataMax: number) =>
                        Math.max(
                          100,
                          Math.ceil(dataMax / 10) * 10
                        ),
                    ]}
                    tickFormatter={(value: number) =>
                      `${value}%`
                    }
                    width={50}
                    tick={{ fontSize: 12 }}
                  />

                  <Tooltip
                    labelFormatter={(value) =>
                      formatDate(Number(value))
                    }
                    formatter={(value) =>
                      value == null
                        ? '—'
                        : `${Number(value).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                    }
                    contentStyle={{
                      borderRadius: 8,
                      color: '#111827',
                    }}
                  />

                  <Legend />

                  <Line
                    type="linear"
                    dataKey="fill_percentage"
                    name="Poziom wody"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={data.lttb.length < 3}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

            ) : (

              // ------------------------------------
              // Aggregated: three lines
              // ------------------------------------

              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.aggregated}
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#94a3b844"
                  />

                  <XAxis
                    dataKey="timestamp"
                    type="number"
                    scale="linear"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value: number) =>
                      formatAxisDate(value, period)
                    }
                    tickCount={6}
                    minTickGap={20}
                    tick={{ fontSize: 12 }}
                  />

                  <YAxis
                    domain={[
                      0,
                      (dataMax: number) =>
                        Math.max(
                          100,
                          Math.ceil(dataMax / 10) * 10
                        ),
                    ]}
                    tickFormatter={(value: number) =>
                      `${value}%`
                    }
                    width={50}
                    tick={{ fontSize: 12 }}
                  />

                  <Tooltip
                    labelFormatter={(value) =>
                      formatDate(Number(value))
                    }
                    formatter={(value) =>
                      value == null
                        ? '—'
                        : `${Number(value).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                    }
                    contentStyle={{
                      borderRadius: 8,
                      color: '#111827',
                    }}
                  />

                  <Legend />

                  <Line
                    type="linear"
                    dataKey="min"
                    name="Minimum"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  <Line
                    type="linear"
                    dataKey="avg"
                    name="Średnia"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />

                  <Line
                    type="linear"
                    dataKey="max"
                    name="Maksimum"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>

            )}
          </div>

          {/* Graph description */}
          <p
            style={{
              fontSize: '0.85rem',
              opacity: 0.7,
              marginTop: '0.5rem',
            }}
          >
            {chartMode === 'lttb'
              ? `Wyświetlono ${data.lttb.length} punktów z ${data.summary.count} pomiarów.`
              : `Wyświetlono ${data.aggregated.length} przedziałów czasowych z wartościami minimalnymi, średnimi i maksymalnymi.`}
          </p>

          {/* Summary statistics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
              textAlign: 'center',
            }}
          >
            <div>
              <small>Minimum</small>
              <h3>{formatPercentage(data.summary.min)}</h3>
            </div>

            <div>
              <small>Średnia</small>
              <h3>{formatPercentage(data.summary.average)}</h3>
            </div>

            <div>
              <small>Maximum</small>
              <h3>{formatPercentage(data.summary.max)}</h3>
            </div>

            <div>
              <small>Zmiana</small>
              <h3>
                {data.summary.first !== null &&
                data.summary.last !== null
                  ? `${
                      data.summary.last -
                        data.summary.first >= 0
                        ? '+'
                        : ''
                    }${(
                      data.summary.last -
                      data.summary.first
                    ).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`
                  : '—'}
              </h3>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

// --------------------------------------------------
// Main dashboard
// --------------------------------------------------

export default function Dashboard({
  onLogout,
}: DashboardProps) {
  const {
    data,
    isPending,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['latestMeasurement'],
    queryFn: fetchLatestMeasurement,
    refetchInterval: 15_000,
  })

  async function handleLogout() {
    await signOut()
    onLogout()
  }

  return (
  <main
    style={{
      padding: '1rem',
      width: '100%',
      maxWidth: '1600px',
      margin: '0 auto',
      boxSizing: 'border-box',
    }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
      </header>

      {/* Current water level */}
<div className="dashboard-grid">
  {/* Current water level */}
<section
  style={{
    ...sectionStyle,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '800px',
    boxSizing: 'border-box',
  }}
>
  <h2 style={{ margin: 0, textAlign: 'left' }}>
    Aktualny poziom wody
  </h2>

  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '0.5rem',
    }}
  >
    {isPending && <p>Wczytywanie pomiarów...</p>}

    {error && (
      <p style={{ color: '#ef4444' }}>
        Nie udało się wczytać pomiarów: {error.message}
      </p>
    )}

        {data && (
          <>
            <TankGauge
              value={Math.min(
                100,
                Math.max(0, data.fill_percentage)
              )}
              min={0}
              max={100}
              size={300}
              shape="cylinder"
              label="Poziom wody"
              format={{ decimals: 1, unit: '%' }}
              wave
            />

            <p>
              Objętość: {data.volume_l.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L
            </p>


            <p>
              Ostatnia aktualizacja: {formatDate(data.timestamp)}
            </p>

            <p
              style={{
                fontSize: '0.85rem',
                opacity: 0.7,
              }}
            >
              {isFetching ? 'Odświeżanie...' : 'Dane aktualne'}
            </p>
          </>
        )}
        </div>
  </section>

  <HistoryChart />
</div>

    </main>
  )
}