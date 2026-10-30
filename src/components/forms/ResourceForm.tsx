import { useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import { newId } from '@/domain/ids'
import type { Resource, ResourceKind } from '@/domain/types'
import { useStore } from '@/store/appStore'
import { ALLOWED_FILE_TYPES, putStoredFile, validateFile } from '@/store/fileStore'
import { toast } from '@/store/ui'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { AssignmentSelect, CourseSelect, trimOrError, validUrl } from './shared'
import { useT } from '@/i18n'
import { msg } from '@/i18n/langs'

export function ResourceForm({ formId, initial, preset, onDone }: { formId: string; initial?: Resource; preset?: { courseId?: string | null; moduleId?: string | null; assignmentId?: string | null }; onDone: (r: Resource) => void }) {
  const tt = useT()
  const add = useStore((s) => s.addResource)
  const update = useStore((s) => s.updateResource)
  const modules = useStore((s) => s.modules)
  const [kind, setKind] = useState<ResourceKind>(initial?.kind ?? 'link')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [courseId, setCourseId] = useState<string | null>(initial?.courseId ?? preset?.courseId ?? null)
  const [moduleId, setModuleId] = useState<string | null>(initial?.moduleId ?? preset?.moduleId ?? null)
  const [assignmentId, setAssignmentId] = useState<string | null>(initial?.assignmentId ?? preset?.assignmentId ?? null)
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const courseModules = modules.filter((m) => m.courseId === courseId).sort((a, b) => a.position - b.position)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const t = trimOrError(title || file?.name || '', msg('Title'))
    if (t) errs.title = t
    if (kind === 'link' && !validUrl(url.trim())) errs.url = tt('Enter a full link starting with https://')
    if (kind === 'file' && !file && !initial?.file) errs.file = tt('Choose a file to attach.')
    if (file) {
      const fe = validateFile(file)
      if (fe) errs.file = fe
    }
    setErrors(errs)
    if (Object.keys(errs).length) return document.getElementById(`${formId}-${Object.keys(errs)[0]}`)?.focus()

    let fileRef = initial?.file ?? null
    if (kind === 'file' && file) {
      setSaving(true)
      try {
        const blobId = newId('blob')
        await putStoredFile(blobId, file)
        fileRef = { blobId, name: file.name, size: file.size, mimeType: file.type }
      } catch (err) {
        setSaving(false)
        setErrors({ file: (err as Error).message || tt('The file could not be saved in this browser.') })
        return
      }
      setSaving(false)
    }
    const fields = {
      kind,
      title: (title || file?.name || '').trim(),
      url: kind === 'link' ? url.trim() : null,
      description: description.trim(),
      courseId,
      moduleId: courseId ? moduleId : null,
      assignmentId,
      tags: [...new Set(tags.split(',').map((x) => x.trim().replace(/^#/, '').toLowerCase()).filter(Boolean))],
      file: kind === 'file' ? fileRef : null,
    }
    if (initial) {
      update(initial.id, fields)
      toast(tt('Resource updated'))
      onDone({ ...initial, ...fields })
    } else {
      const created = add({ ...fields, favorite: false, createdAt: new Date().toISOString() })
      toast(tt('Resource saved'))
      onDone(created)
    }
  }

  return (
    <form id={formId} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4" aria-busy={saving}>
      <Segmented label="Resource type" value={kind} onChange={setKind} options={[{ value: 'link', label: 'Link' }, { value: 'file', label: 'File' }, { value: 'reference', label: 'Reference' }]} />
      <Field id={`${formId}-title`} label="Title" error={errors.title}>
        {(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'reference' ? 'e.g. Textbook, 5th edition' : 'e.g. Lecture 12 slides'} data-autofocus />}
      </Field>
      {kind === 'link' && (
        <Field id={`${formId}-url`} label="URL" error={errors.url}>
          {(p) => <Input {...p} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />}
        </Field>
      )}
      {kind === 'file' && (
        <Field id={`${formId}-file`} label="File" error={errors.file} hint={`${Object.values(ALLOWED_FILE_TYPES).join(', ')} · up to 5 MB · stored in this browser only`}>
          {(p) => (
            <div className="flex items-center gap-2">
              {initial?.file && !file ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-fg-2">
                  <Paperclip className="size-3.5" aria-hidden />
                  {initial.file.name}
                </span>
              ) : file ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-fg-2">
                  <Paperclip className="size-3.5" aria-hidden />
                  {file.name}
                  <button type="button" aria-label={tt('Remove file')} onClick={() => setFile(null)} className="rounded p-0.5 text-fg-3 hover:text-fg">
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : null}
              <input
                {...p}
                type="file"
                accept={Object.keys(ALLOWED_FILE_TYPES).join(',') + ',.md'}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  setErrors((er) => ({ ...er, file: f ? (validateFile(f) ?? '') : '' }))
                }}
                className="text-xs text-fg-3 file:mr-2 file:rounded-md file:border file:border-line file:bg-surface file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-fg hover:file:bg-surface-2"
              />
            </div>
          )}
        </Field>
      )}
      <Field label="Description" optional>
        {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course" optional>
          {(p) => <CourseSelect {...p} value={courseId} onChange={(v) => { setCourseId(v); setModuleId(null); setAssignmentId(null) }} allowNone />}
        </Field>
        <Field label="Module" optional>
          {(p) => (
            <Select {...p} value={moduleId ?? ''} onChange={(e) => setModuleId(e.target.value || null)} disabled={!courseId || courseModules.length === 0}>
              <option value="">{courseId ? (courseModules.length ? tt('No module') : tt('Course has no modules')) : tt('Choose a course first')}</option>
              {courseModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="For assignment" optional>
          {(p) => <AssignmentSelect {...p} value={assignmentId} onChange={setAssignmentId} courseId={courseId} />}
        </Field>
        <Field label="Tags" hint="Comma-separated" optional>
          {(p) => <Input {...p} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="midterm, chapter-4" />}
        </Field>
      </div>
    </form>
  )
}

export function AddResourceDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { courseId?: string | null; assignmentId?: string | null } }) {
  const tt = useT()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tt('Save a resource')}
      footer={
        <>
          <Button onClick={onClose}>{tt('Cancel')}</Button>
          <Button variant="primary" type="submit" form="resource-form">
            {tt('Save')}
          </Button>
        </>
      }
    >
      <ResourceForm formId="resource-form" preset={preset} onDone={onClose} />
    </Dialog>
  )
}
