import BossPerformancePage from './BossPerformancePage'

interface L3BossPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function L3BossPage(props: L3BossPageProps) {
  return <BossPerformancePage {...props} level={3} />
}