'use client'
import PracticeWorkspace from '@/components/practice/PracticeWorkspace'
import { PracticeOverview } from '@/components/practice/PracticeOperations'
export default function Page() { return <div className='grid grid-cols-[minmax(0,1fr)] gap-6'><PracticeOverview /><PracticeWorkspace /></div> }
