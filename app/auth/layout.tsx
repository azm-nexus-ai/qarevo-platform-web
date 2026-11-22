import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>
    <nav aria-label='Account appearance' className='auth-appearance-navigation'><div className='appearance-controls'><ThemeToggle /><LanguageSwitch /></div></nav>
    {children}
  </>
}
