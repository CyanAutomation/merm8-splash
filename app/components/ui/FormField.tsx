import type { ReactNode } from 'react'

export interface FormFieldControlIds {
  id: string
  describedBy?: string
}

export interface FormFieldProps {
  id: string
  label: ReactNode
  description?: ReactNode
  feedback?: ReactNode
  invalid?: boolean
  children: (ids: FormFieldControlIds) => ReactNode
  className?: string
}

export default function FormField({
  id,
  label,
  description,
  feedback,
  invalid = false,
  children,
  className = '',
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const feedbackId = feedback ? `${id}-feedback` : undefined
  const describedBy = [descriptionId, feedbackId].filter(Boolean).join(' ') || undefined

  return (
    <div className={['form-field', className].filter(Boolean).join(' ')}>
      <label className="field-label" htmlFor={id}>{label}</label>
      {children({ id, describedBy })}
      {description && (
        <div id={descriptionId} className="form-field-description">{description}</div>
      )}
      {feedback && (
        <div
          id={feedbackId}
          className={`form-field-feedback${invalid ? ' form-field-feedback-error' : ''}`}
          role={invalid ? 'alert' : 'status'}
        >
          {feedback}
        </div>
      )}
    </div>
  )
}
