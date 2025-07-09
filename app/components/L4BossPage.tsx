import BossPerformancePage from './BossPerformancePage'

interface L4BossPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function L4BossPage(props: L4BossPageProps) {
  return <BossPerformancePage {...props} level={4} />
}