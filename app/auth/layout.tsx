import { useTranslations } from 'next-intl'
import { ThemeToggle } from '@/components/ui/ThemeProvider'
import { LanguageSwitch } from '@/components/ui/LanguageSwitch'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('shell')
  return <>
    <nav aria-label={t('accountAppearance')} className='auth-appearance-navigation'><div className='appearance-controls'><ThemeToggle /><LanguageSwitch /></div></nav>
    {children}
  </>
}
