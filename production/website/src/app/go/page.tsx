import type { Metadata } from 'next'
import GoClient from './go-client'
import { buildShareMetadata } from '@/lib/share-metadata'

export const metadata: Metadata = buildShareMetadata({
  title: '伊娃东方舞 · 官方网站',
  description: '十二年匠心传承，专注东方舞师资培训。线上课程、线下集训、成品舞专栏、师资认证，培养10000+专业舞蹈教师。',
  path: '/go',
  image: '/logo-transparent-20261005.png',
})

export default function GoPage() {
  return <GoClient />
}
