/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FilmIQ API Client
 * Typed wrappers around all backend endpoints.
 * Uses Next.js rewrites so /api/* proxies to FastAPI.
 */

import Cookies from 'js-cookie'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

// ── Token helpers ─────────────────────────────────────────────────────────
export const getToken     = (): string | undefined => Cookies.get('filmiq_token')
export const setToken     = (t: string) => Cookies.set('filmiq_token', t, { expires: 1, sameSite: 'lax' })
export const removeToken  = () => { Cookies.remove('filmiq_token'); Cookies.remove('filmiq_refresh') }
export const getRefresh   = (): string | undefined => Cookies.get('filmiq_refresh')
export const setRefresh   = (t: string) => Cookies.set('filmiq_refresh', t, { expires: 30, sameSite: 'lax' })

// ── Base fetch ────────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  _retried = false,   // prevents infinite recursion on repeated 401
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })

  if (res.status === 401 && !_retried) {
    // Attempt token refresh exactly once
    const refreshToken = getRefresh()
    if (refreshToken) {
      const r = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      })
      if (r.ok) {
        const data = await r.json()
        setToken(data.access_token)
        setRefresh(data.refresh_token)
        return apiFetch<T>(path, init, true)  // retry once only
      }
    }
    removeToken()
    throw new Error('Session expired. Please log in again.')
  }

  if (res.status === 401 && _retried) {
    removeToken()
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    // FastAPI validation errors return detail as an array of {msg, loc} objects.
    // Flatten them to a readable string instead of "[object Object]".
    const detail: unknown = err?.detail
    let message: string
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail) && detail.length > 0) {
      message = detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join('; ')
    } else {
      message = `API error ${res.status}`
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface LoginResponse {
  access_token:        string
  refresh_token:       string
  token_type:          string
  must_change_password: boolean
  user: { id: number; email: string; username: string; role: string }
}

export interface ReviewComment {
  text:         string
  days_before?: number
}

export interface PredictionRequest {
  title:           string
  budget:          number
  genre:           string
  director_score:  number
  cast_score:      number
  season:          string
  market:          string
  logline?:        string
  review_comments?: ReviewComment[]
  movie_id?:       string
}

export interface SentimentAnalysis {
  total_comments:  number
  positive_count:  number
  neutral_count:   number
  negative_count:  number
  aggregate_score: number
  sentiment_label: string
}

export interface PredictionResult {
  predicted_revenue:         number
  predicted_opening_weekend: number
  predicted_roi:             number
  confidence:                number
  model_used:                string
  genre_multiplier:          number
  risk_level:                string
  ai_analysis?:              string
  recommendation:            string
  breakdown:                 Record<string, string | number>
  sentiment_analysis?:       SentimentAnalysis | null
}

export interface Movie {
  id:           number
  title:        string
  budget:       number
  revenue:      number
  roi?:         number | null
  vote_average: number
  vote_count?:  number
  popularity:   number
  release_date?: string
  year?:        number | null
  runtime?:     number | null
  genres:       string[]
  cast?:        string[]
  director?:    string | null
  production_companies?: string[]
  production_countries?: string[]
  original_language?: string | null
  overview?:    string | null
  tagline?:     string | null
  poster_url?:  string | null
  backdrop_url?: string | null
  similarity_score?: number
  trend_metrics?: TrendMetrics | null
}

export interface TrendMetrics {
  genre_peer_count:                  number
  rating_percentile_in_genre:        number
  popularity_percentile_in_genre:    number
  revenue_percentile_in_genre?:      number
  year_peer_count?:                  number
  popularity_percentile_in_year?:    number
}

export interface DashboardData {
  kpis:             Record<string, number>
  year_trend:       { year: string; total: number; avg: number; count: number }[]
  genre_analytics:  { genre: string; avg_revenue: number; count: number }[]
}

export interface GenreStat {
  genre:            string
  count:            number
  avg_rating:       number
  avg_popularity:   number
  avg_revenue:      number
  top_movie:        { id: number; title: string; revenue: number } | null
  growth:           { year: number; count: number }[]
}

export interface PersonStat {
  name:          string
  film_count:    number
  avg_rating:    number
  total_revenue?: number
  top_genre:     string | null
}

export interface TrendData {
  rating_trend:      { year: number; avg_rating: number }[]
  popularity_trend:  { year: number; avg_popularity: number }[]
  production_growth: { year: number; count: number }[]
  genre_by_decade:   Record<string, Record<string, number>>
  top_genres:        string[]
}

export interface OverviewData {
  coverage: {
    total_movies: number
    year_range: [number, number] | null
    financial_coverage_pct: number
    language_count: number
  }
  top_genres:        { genre: string; count: number }[]
  top_movies:        { id: number; title: string; revenue: number }[]
  most_active_years: { year: number; count: number }[]
  insights:          string[]
  trending:          Movie[]
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const auth = {
  /** identifier = email address OR username */
  login: (identifier: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  me: () => apiFetch<{ id: number; email: string; username: string; role: string }>('/api/auth/me'),

  /** Returns fresh tokens so the browser cookie is updated immediately */
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string; access_token: string; refresh_token: string }>(
      '/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }
    ),
}

// ── Movies ────────────────────────────────────────────────────────────────
export interface MovieFilters {
  genre?:          string
  year_from?:      number
  year_to?:        number
  min_rating?:     number
  max_rating?:     number
  min_popularity?: number
  max_popularity?: number
  min_runtime?:    number
  max_runtime?:    number
  sort?:           string
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.set(k, String(v))
  }
  return usp.toString()
}

export const movies = {
  top:      (limit = 10)         => apiFetch<Movie[]>(`/api/movies/top?limit=${limit}`),
  list:     (page = 1, limit = 20, filters: MovieFilters = {}) =>
    apiFetch<Movie[]>(`/api/movies?${buildQuery({ page, limit, ...filters })}`),
  search:   (q: string)          => apiFetch<Movie[]>(`/api/movies/search?q=${encodeURIComponent(q)}`),
  get:      (id: number)         => apiFetch<Movie>(`/api/movies/${id}`),
  featured: (limit = 5)          => apiFetch<Movie[]>(`/api/movies/featured?limit=${limit}`),
  similar:  (id: number, limit = 10) => apiFetch<Movie[]>(`/api/movies/${id}/similar?limit=${limit}`),
  compare:  (ids: number[])      => apiFetch<Movie[]>(`/api/movies/compare?ids=${ids.join(',')}`),
}

// ── Predictions ───────────────────────────────────────────────────────────
export const predictions = {
  predict: (data: PredictionRequest) =>
    apiFetch<PredictionResult>('/api/predict/box-office', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  history: () => apiFetch<PredictionResult[]>('/api/predict/history'),
}

// ── Analytics ─────────────────────────────────────────────────────────────
export const analytics = {
  dashboard:   ()          => apiFetch<DashboardData>('/api/analytics/dashboard'),
  genres:      ()          => apiFetch<any[]>('/api/analytics/genre-performance'),
  genreAnalytics: ()       => apiFetch<GenreStat[]>('/api/analytics/genre-analytics'),
  yearTrend:   ()          => apiFetch<any[]>('/api/analytics/year-trend'),
  seasonal:    ()          => apiFetch<any[]>('/api/analytics/seasonal'),
  language:    ()          => apiFetch<any[]>('/api/analytics/language'),
  scatter:     (genre?: string) => apiFetch<any[]>(`/api/analytics/scatter${genre ? `?genre=${genre}` : ''}`),
  modelAccuracy: ()        => apiFetch<any>('/api/analytics/model-accuracy'),
  topDirectors: (limit = 8) => apiFetch<any[]>(`/api/analytics/top-directors?limit=${limit}`),
  trends:      ()          => apiFetch<TrendData>('/api/analytics/trends'),
  people:      (limit = 20) => apiFetch<{ top_directors: PersonStat[]; top_actors: PersonStat[] }>(`/api/analytics/people?limit=${limit}`),
  insights:    ()          => apiFetch<{ insights: string[] }>('/api/analytics/insights'),
  overview:    ()          => apiFetch<OverviewData>('/api/analytics/overview'),
}

// ── Sentiment ─────────────────────────────────────────────────────────────
export const sentiment = {
  analyze: (text: string, days_before?: number) =>
    apiFetch<any>('/api/sentiment/analyze', {
      method: 'POST',
      body: JSON.stringify({ text, days_before }),
    }),
  batch: (comments: { text: string; days_before?: number }[]) =>
    apiFetch<any>('/api/sentiment/batch', {
      method: 'POST',
      body: JSON.stringify({ comments }),
    }),
  demo: () => apiFetch<any>('/api/sentiment/demo'),
}

// ── Investors ─────────────────────────────────────────────────────────────
export const investors = {
  roiMatrix:     ()          => apiFetch<any[]>('/api/investors/roi-matrix'),
  opportunities: ()          => apiFetch<any[]>('/api/investors/opportunities'),
  topRoi:        (limit = 10) => apiFetch<any[]>(`/api/investors/top-roi?limit=${limit}`),
  africaOutlook: ()          => apiFetch<any>('/api/investors/africa-outlook'),
  simulate:      (genre: string, budget: number, market: string) =>
    apiFetch<any>(`/api/investors/simulate?genre=${genre}&budget=${budget}&market=${market}`),
}

// ── Chat (server-side AI proxy) ───────────────────────────────────────────
export const chat = {
  send: (message: string, history?: { role: string; content: string }[]) =>
    apiFetch<{ reply: string }>('/api/chat', {
      method: 'POST',
      body:   JSON.stringify({ message, history }),
    }),
}

// ── Admin user management ─────────────────────────────────────────────────
export interface AdminUser {
  id:                   string
  email:                string
  username:             string
  full_name:            string | null
  role:                 string
  country:              string | null
  organisation:         string | null
  is_active:            boolean
  must_change_password: boolean
  created_at:           string
  last_login:           string | null
}

export const adminApi = {
  listUsers: (page = 1, limit = 50) =>
    apiFetch<{ users: AdminUser[]; total: number; page: number; pages: number }>(
      `/api/admin/users?page=${page}&limit=${limit}`
    ),

  createUser: (data: {
    email: string; username: string; password: string
    full_name?: string; role: string; organisation?: string; country: string
  }) =>
    apiFetch<{ id: string; email: string; username: string; message: string }>(
      '/api/admin/users', { method: 'POST', body: JSON.stringify(data) }
    ),

  editUser: (userId: string, data: {
    full_name?: string; username?: string; organisation?: string; country?: string
  }) =>
    apiFetch<{ message: string; user_id: string }>(
      `/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }
    ),

  resetUserPassword: (userId: string, newPassword: string) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/reset-password`,
      { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }
    ),

  toggleStatus: (userId: string, isActive: boolean) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/status`,
      { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }
    ),

  changeRole: (userId: string, role: string) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/role`,
      { method: 'PUT', body: JSON.stringify({ role }) }
    ),

  deleteUser: (userId: string) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}`, { method: 'DELETE' }
    ),
}

// ── Data Submission Portal ─────────────────────────────────────────────────
export type FieldType = 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'category'
export type SubmissionCategory =
  'box_office' | 'streaming' | 'audience_research' | 'marketing' | 'production' | 'custom'
export type SubmissionStatus =
  'draft' | 'submitted' | 'under_review' | 'approved' | 'processed' | 'rejected'

export interface TemplateField {
  key:      string
  label:    string
  type:     FieldType
  required: boolean
  options?: string[]
  validation?: { min?: number; max?: number; regex?: string; dateFormat?: string }
}

export interface ReportTemplate {
  id:         string
  name:       string
  category:   SubmissionCategory
  fields:     TemplateField[]
  created_by: string
  created_at?: string
}

export interface Submission {
  id:                  string
  name:                string
  category:            SubmissionCategory
  template_id?:        string | null
  status:              SubmissionStatus
  row_count:           number
  submitted_by:        string
  submitted_by_name?:  string
  reviewed_by?:        string | null
  rejection_reason?:   string | null
  created_at?:         string
  updated_at?:         string
}

export interface ValidationIssue { row: number; field: string; type: string; message: string }
export interface ValidationResult {
  errors:     ValidationIssue[]
  warnings:   ValidationIssue[]
  duplicates: { rows: number[]; key: string }[]
  summary:    { error_count: number; warning_count: number; duplicate_count: number }
}

export interface SubmissionDetail extends Submission {
  latest_version: { rows: Record<string, string>[]; mapping: Record<string, string> } | null
  validation:     ValidationResult | null
}

export interface PortalStats {
  datasets_submitted: number
  pending_review:     number
  approved:           number
  processed:          number
}

export interface ActivityEntry {
  id: string
  actor_name: string | null
  action: string
  target_id: string
  created_at: string | null
}

export const dataPortalApi = {
  listTemplates: () => apiFetch<ReportTemplate[]>('/api/filmmaker/templates'),

  createTemplate: (data: { name: string; category: SubmissionCategory; fields: TemplateField[] }) =>
    apiFetch<{ id: string; message: string }>(
      '/api/filmmaker/templates', { method: 'POST', body: JSON.stringify(data) }
    ),

  getStats: () => apiFetch<PortalStats>('/api/filmmaker/stats'),

  listSubmissions: (status?: SubmissionStatus, category?: SubmissionCategory) => {
    const params = new URLSearchParams()
    if (status)   params.set('status', status)
    if (category) params.set('category', category)
    const qs = params.toString()
    return apiFetch<Submission[]>(`/api/filmmaker/submissions${qs ? `?${qs}` : ''}`)
  },

  createSubmission: (data: { name: string; category: SubmissionCategory; template_id?: string }) =>
    apiFetch<{ id: string; message: string }>(
      '/api/filmmaker/submissions', { method: 'POST', body: JSON.stringify(data) }
    ),

  getSubmission: (id: string) =>
    apiFetch<SubmissionDetail>(`/api/filmmaker/submissions/${id}`),

  uploadRows: (id: string, rows: Record<string, string>[], mapping: Record<string, string>) =>
    apiFetch<{ version_id: string; validation: ValidationResult }>(
      `/api/filmmaker/submissions/${id}/rows`,
      { method: 'POST', body: JSON.stringify({ rows, mapping }) }
    ),

  submit: (id: string) =>
    apiFetch<{ message: string; status: SubmissionStatus }>(
      `/api/filmmaker/submissions/${id}/submit`, { method: 'POST' }
    ),

  startReview: (id: string) =>
    apiFetch<{ message: string; status: SubmissionStatus }>(
      `/api/filmmaker/submissions/${id}/start-review`, { method: 'POST' }
    ),

  review: (id: string, action: 'approve' | 'reject', reason?: string) =>
    apiFetch<{ message: string; status: SubmissionStatus }>(
      `/api/filmmaker/submissions/${id}/review`,
      { method: 'POST', body: JSON.stringify({ action, reason }) }
    ),

  getActivity: (limit = 10) =>
    apiFetch<ActivityEntry[]>(`/api/filmmaker/activity?limit=${limit}`),
}

