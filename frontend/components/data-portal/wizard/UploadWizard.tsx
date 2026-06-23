'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { dataPortalApi, type ReportTemplate, type SubmissionCategory, type ValidationResult } from '@/lib/api'
import { parseCsv } from '@/lib/csv'
import ValidationPanel from '../ValidationPanel'

const CATEGORIES: { value: SubmissionCategory; label: string }[] = [
  { value: 'box_office',        label: 'Box Office' },
  { value: 'streaming',         label: 'Streaming' },
  { value: 'audience_research', label: 'Audience Research' },
  { value: 'marketing',         label: 'Marketing' },
  { value: 'production',        label: 'Production' },
  { value: 'custom',            label: 'Custom Dataset' },
]

const STEPS = ['Category', 'Upload CSV', 'Preview', 'Map Columns', 'Validate', 'Review & Submit']

export default function UploadWizard({ templates }: { templates: ReportTemplate[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName]         = useState('')
  const [category, setCategory] = useState<SubmissionCategory | ''>('')
  const [templateId, setTemplateId] = useState<string>('')

  const [headers, setHeaders]   = useState<string[]>([])
  const [rows, setRows]         = useState<Record<string, string>[]>([])
  const [mapping, setMapping]   = useState<Record<string, string>>({})

  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [validation, setValidation]     = useState<ValidationResult | null>(null)

  const template = templates.find((t) => t.id === templateId) ?? null
  const matchingTemplates = templates.filter((t) => t.category === category)

  function next() { setStep((s) => Math.min(STEPS.length - 1, s + 1)) }
  function back() { setStep((s) => Math.max(0, s - 1)) }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const { headers: h, rows: r } = parseCsv(String(reader.result ?? ''))
      if (h.length === 0) { toast.error('Could not parse CSV — no header row found'); return }
      setHeaders(h)
      setRows(r)
      // default mapping: try to auto-match by exact/lowercase header name
      if (template) {
        const auto: Record<string, string> = {}
        h.forEach((col) => {
          const match = template.fields.find((f) => f.key.toLowerCase() === col.toLowerCase() || f.label.toLowerCase() === col.toLowerCase())
          if (match) auto[col] = match.key
        })
        setMapping(auto)
      } else {
        const identity: Record<string, string> = {}
        h.forEach((col) => { identity[col] = col })
        setMapping(identity)
      }
      next()
    }
    reader.readAsText(file)
  }

  async function ensureSubmission(): Promise<string> {
    if (submissionId) return submissionId
    const { id } = await dataPortalApi.createSubmission({
      name, category: category as SubmissionCategory, template_id: templateId || undefined,
    })
    setSubmissionId(id)
    return id
  }

  async function runValidation() {
    setSubmitting(true)
    try {
      const id = await ensureSubmission()
      const { validation: v } = await dataPortalApi.uploadRows(id, rows, mapping)
      setValidation(v)
      next()
    } catch (err: any) {
      toast.error(err?.message ?? 'Validation failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit() {
    if (!submissionId) return
    setSubmitting(true)
    try {
      await dataPortalApi.submit(submissionId)
      toast.success('Submission sent for review')
      router.push('/filmmaker')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const requiredMapped = !template || template.fields
    .filter((f) => f.required)
    .every((f) => Object.values(mapping).includes(f.key))

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-6">
        <p className="section-label mb-1">Data Portal</p>
        <h1 className="text-3xl font-bold text-navy">New Submission</h1>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i === step ? 'bg-brand text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <CheckCircle2 size={14} /> : i + 1}
            </div>
            <span className={`text-xs ${i === step ? 'font-semibold text-navy' : 'text-slate-400'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="card max-w-3xl p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Submission Name</label>
              <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q2 2026 Box Office — Kino" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Report Category</label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => { setCategory(c.value); setTemplateId('') }}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      category === c.value ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {category && category !== 'custom' && matchingTemplates.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Report Template</label>
                <select className="input-field w-full" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">No template — map columns freely</option>
                  {matchingTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end">
              <button disabled={!name || !category} onClick={next} className="btn-primary flex items-center gap-1">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-12 text-center hover:border-brand">
              <Upload size={32} className="text-slate-300" />
              <span className="text-sm font-medium text-slate-600">Click to upload a CSV file</span>
              <input
                type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>
            <StepNav onBack={back} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{rows.length} rows detected. Showing first 20.</p>
            <div className="max-h-80 overflow-auto rounded border border-slate-200">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50">{headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-500">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {headers.map((h) => <td key={h} className="px-2 py-1.5 text-slate-600">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <StepNav onBack={back} onNext={next} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {!template ? (
              <p className="text-sm text-slate-500">No template selected — columns will be submitted as-is.</p>
            ) : (
              <div className="space-y-2">
                {headers.map((col) => (
                  <div key={col} className="flex items-center gap-3">
                    <span className="w-40 truncate text-sm font-medium text-slate-700">{col}</span>
                    <ChevronRight size={14} className="text-slate-300" />
                    <select
                      className="input-field flex-1"
                      value={mapping[col] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [col]: e.target.value }))}
                    >
                      <option value="">— Don&apos;t map —</option>
                      {template.fields.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <StepNav onBack={back} onNext={runValidation} nextLabel="Validate" nextDisabled={!requiredMapped} loading={submitting} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <ValidationPanel validation={validation} />
            <StepNav onBack={back} onNext={next} nextDisabled={(validation?.summary.error_count ?? 0) > 0} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 text-sm">
              <div className="flex justify-between py-1"><span className="text-slate-500">Name</span><span className="font-medium">{name}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-500">Category</span><span className="font-medium">{CATEGORIES.find((c) => c.value === category)?.label}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-500">Rows</span><span className="font-medium">{rows.length}</span></div>
              <div className="flex justify-between py-1"><span className="text-slate-500">Warnings</span><span className="font-medium">{validation?.summary.warning_count ?? 0}</span></div>
            </div>
            <StepNav onBack={back} onNext={handleSubmit} nextLabel="Submit" loading={submitting} />
          </div>
        )}
      </div>
    </div>
  )
}

function StepNav({ onBack, onNext, nextLabel = 'Next', nextDisabled, loading }: {
  onBack: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; loading?: boolean
}) {
  return (
    <div className="flex justify-between">
      <button onClick={onBack} className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
        <ChevronLeft size={14} /> Back
      </button>
      {onNext && (
        <button onClick={onNext} disabled={nextDisabled || loading} className="btn-primary flex items-center gap-1 disabled:opacity-40">
          {loading ? 'Working…' : nextLabel} {!loading && <ChevronRight size={14} />}
        </button>
      )}
    </div>
  )
}
