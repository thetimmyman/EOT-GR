import BossPerformancePage from './BossPerformancePage'

interface L5BossPageProps {
  selectedGuild: string
  selectedSeason: string
}

export default function L5BossPage(props: L5BossPageProps) {
  return <BossPerformancePage {...props} level={5} />
}