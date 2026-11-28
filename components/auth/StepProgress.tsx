'use client'
import Ico from '@/components/ui/Ico'
import { ICONS } from '@/constants/icons'
import styles from './StepProgress.module.css'

/** Three-step sign-up progress. Labels wrap instead of pushing the card wider, so long German labels fit at 320px. */
export default function StepProgress({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return <ol className={styles.steps} aria-label={label}>
    {steps.map((name, index) => {
      const state = index < current ? 'done' : index === current ? 'active' : 'todo'
      return <li key={name} className={styles.step} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
        <span className={styles.dot} aria-hidden='true'>{state === 'done' ? <Ico p={ICONS.check} size={11} sw={3} color='#fff' /> : index + 1}</span>
        <span className={styles.label}>{name}</span>
      </li>
    })}
  </ol>
}
