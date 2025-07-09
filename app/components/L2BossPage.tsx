import BossPerformancePage from './BossPerformancePage'

interface L2BossPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function L2BossPage(props: L2BossPageProps) {
  return <BossPerformancePage {...props} level={2} />
}