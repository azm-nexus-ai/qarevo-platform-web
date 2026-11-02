import { ThemeToggle } from '@/components/ui/ThemeProvider'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav aria-label='Account appearance' className='auth-appearance-navigation'><ThemeToggle /></nav>
    {children}
  </>
}
