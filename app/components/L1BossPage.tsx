import BossPerformancePage from './BossPerformancePage'

interface L1BossPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function L1BossPage(props: L1BossPageProps) {
  return <BossPerformancePage {...props} level={1} />
}