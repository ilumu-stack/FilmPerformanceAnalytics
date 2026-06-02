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
    throw new Error(err.detail || `API error ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────
export interface LoginResponse {
  access_token:  string
  refresh_token: string
  token_type:    string
  user: { id: number; email: string; username: string; role: string }
}

export interface PredictionRequest {
  title:          string
  budget:         number
  genre:          string
  director_score: number
  cast_score:     number
  season:         string
  market:         string
  logline?:       string
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
}

export interface Movie {
  id:           number
  title:        string
  budget:       number
  revenue:      number
  roi?:         number
  vote_average: number
  popularity:   number
  release_date?: string
  genres:       string[]
}

export interface DashboardData {
  kpis:             Record<string, number>
  year_trend:       { year: string; total: number; avg: number; count: number }[]
  genre_analytics:  { genre: string; avg_revenue: number; count: number }[]
  model_comparison: { models: { name: string; r2: number }[] }
  sentiment_trend:  { months: string[]; positive: number[]; negative: number[] }
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const auth = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => apiFetch<{ id: number; email: string; username: string; role: string }>('/api/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
}

// ── Movies ────────────────────────────────────────────────────────────────
export const movies = {
  top:    (limit = 10)         => apiFetch<Movie[]>(`/api/movies/top?limit=${limit}`),
  list:   (page = 1, limit = 20) => apiFetch<Movie[]>(`/api/movies?page=${page}&limit=${limit}`),
  search: (q: string)          => apiFetch<Movie[]>(`/api/movies/search?q=${encodeURIComponent(q)}`),
  get:    (id: number)         => apiFetch<Movie>(`/api/movies/${id}`),
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
  yearTrend:   ()          => apiFetch<any[]>('/api/analytics/year-trend'),
  seasonal:    ()          => apiFetch<any[]>('/api/analytics/seasonal'),
  language:    ()          => apiFetch<any[]>('/api/analytics/language'),
  scatter:     (genre?: string) => apiFetch<any[]>(`/api/analytics/scatter${genre ? `?genre=${genre}` : ''}`),
  modelAccuracy: ()        => apiFetch<any>('/api/analytics/model-accuracy'),
  topDirectors: (limit = 8) => apiFetch<any[]>(`/api/analytics/top-directors?limit=${limit}`),
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
  id:           number
  email:        string
  username:     string
  full_name:    string | null
  role:         string
  country:      string | null
  organisation: string | null
  is_active:    boolean
  created_at:   string
  last_login:   string | null
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
    apiFetch<{ id: number; email: string; username: string; message: string }>(
      '/api/admin/users', { method: 'POST', body: JSON.stringify(data) }
    ),

  resetUserPassword: (userId: number, newPassword: string) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/reset-password`,
      { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }
    ),

  toggleStatus: (userId: number, isActive: boolean) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/status`,
      { method: 'PUT', body: JSON.stringify({ is_active: isActive }) }
    ),

  changeRole: (userId: number, role: string) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}/role`,
      { method: 'PUT', body: JSON.stringify({ role }) }
    ),

  deleteUser: (userId: number) =>
    apiFetch<{ message: string }>(
      `/api/admin/users/${userId}`, { method: 'DELETE' }
    ),
}

