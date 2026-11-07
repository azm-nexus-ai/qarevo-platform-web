'use client'

export function focusValidation(form: Element) {
  // Wait for React to render the error state before moving keyboard focus.
  requestAnimationFrame(() => {
    const target = form.querySelector<HTMLElement>('[aria-invalid="true"]')
      || form.querySelector<HTMLElement>('[data-validation-summary]')
    target?.focus()
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

export function FieldFeedback({ name, error, hint }: { name: string; error?: string; hint?: string }) {
  return <>
    {hint && <p id={`${name}-hint`} className="field-hint">{hint}</p>}
    {error && <p id={`${name}-error`} className="field-error">{error}</p>}
  </>
}

export function ValidationSummary({ errors }: { errors: Record<string, string | undefined> }) {
  const messages = [...new Set(Object.values(errors).filter(Boolean))]
  if (!messages.length) return null
  return <div role="alert" tabIndex={-1} data-validation-summary className="validation-summary">
    <strong>Please check the following before continuing:</strong>
    <ul>{messages.map(message => <li key={message}>{message}</li>)}</ul>
  </div>
}
