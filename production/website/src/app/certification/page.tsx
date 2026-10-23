'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, CheckCircle, XCircle, User, CreditCard } from 'lucide-react';
import Link from 'next/link';
import ScrollAnimation from '@/components/ScrollAnimation';

export default function CertificationPage() {
  const [certificateNumber, setCertificateNumber] = useState('');
  const [searched, setSearched] = useState(false);
  const [result, setResult] = useState<{ certificates: { certificateNo: string; memberName: string; courseName: string; issueDate: string; status: string }[]; error?: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const requestSequence = useRef(0);
  const searchCertificate = useCallback(async (number: string) => {
    const sequence = ++requestSequence.current;
    setSearched(true); setResult(null); setSearching(true);
    try {
      const response = await fetch(`/api/public/certificates/verify?q=${encodeURIComponent(number.trim())}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (sequence !== requestSequence.current) return;
      if (!response.ok || payload?.success !== true) {
        setResult({ certificates: [], error: response.status >= 500 ? '证书查询服务暂不可用，请稍后重试' : '未找到证书信息，请核对证书编号、完整姓名或完整手机号码' });
        return;
      }
      setResult({ certificates: Array.isArray(payload.data) ? payload.data : [payload.data] });
    } catch {
      if (sequence === requestSequence.current) setResult({ certificates: [], error: '证书查询服务暂不可用，请稍后重试' });
    } finally {
      if (sequence === requestSequence.current) setSearching(false);
    }
  }, []);
  useEffect(() => {
    const number = new URLSearchParams(window.location.search).get('no')?.trim() || '';
    if (number.length >= 4 && number.length <= 80) { setCertificateNumber(number); void searchCertificate(number); }
  }, [searchCertificate]);
  const handleSearch = (event: React.FormEvent) => { event.preventDefault(); void searchCertificate(certificateNumber); };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-4">
              课程证书
            </span>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
              证书查询
            </h1>
            <p className="text-white/70 max-w-xl mx-auto">
              核验伊娃东方舞线上课程、成品舞及线下课程证书
            </p>
          </ScrollAnimation>
        </div>
      </section>

      {/* Search Form */}
      <section className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimation>
            <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gold" />
                </div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-2">
                  查询课程证书
                </h2>
                <p className="text-text-secondary">
                  支持证书编号、完整姓名或完整手机号码查询
                </p>
              </div>

              <form onSubmit={handleSearch} className="space-y-6">
                <div>
                  <label htmlFor="certificateNumber" className="block text-sm font-medium text-text mb-2">
                    证书编号 / 姓名 / 手机号码
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="text"
                      id="certificateNumber"
                      value={certificateNumber}
                      onChange={(e) => setCertificateNumber(e.target.value)}
                      placeholder="请输入证书编号、姓名或手机号码"
                      className="w-full pl-10 pr-4 py-3 border border-sand/50 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all"
                      required
                      minLength={1}
                      maxLength={80}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching}
                  className="w-full px-6 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all flex items-center justify-center gap-2"
                >
                  <Search className="w-5 h-5" />
                  {searching ? '查询中…' : '查询证书'}
                </button>
              </form>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Results */}
      {searched && (
        <section className="py-16 bg-warm-gray">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollAnimation>
              <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
                <div className="text-center mb-6">
                  <h2 className="font-serif text-2xl font-bold text-text mb-2">
                    查询结果
                  </h2>
                </div>

                {result ? result.certificates.length > 0 ? (
                  <div className="space-y-6" aria-live="polite">
                    <p className="text-center text-text-secondary">共找到 {result.certificates.length} 张证书</p>
                    {result.certificates.map((certificate) => (
                      <article key={certificate.certificateNo} className="rounded-xl border border-sand/50 p-5 text-center">
                        {certificate.status === 'active' ? <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-600" /> : <XCircle className="mx-auto mb-3 h-8 w-8 text-red-600" />}
                        <h3 className="mb-4 text-xl font-bold">{certificate.status === 'active' ? '证书有效' : certificate.status === 'revoked' ? '证书已撤销' : '证书未通过核验'}</h3>
                        <dl className="space-y-3 text-left">
                          {[
                            ['证书编号', certificate.certificateNo], ['姓名', certificate.memberName],
                            ['课程名称', certificate.courseName], ['颁发日期', certificate.issueDate],
                          ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b border-sand/30 pb-2"><dt className="text-text-secondary">{label}</dt><dd className="break-all font-medium">{value}</dd></div>)}
                        </dl>
                        {certificate.status === 'active' ? <>
                          <Link href={`/dashboard/certificates?no=${encodeURIComponent(certificate.certificateNo)}`} className="mt-6 inline-block rounded-lg bg-gold px-5 py-3 font-medium text-white">查看我的证书 · 编辑姓名与下载</Link>
                          <p className="mt-2 text-sm text-text-secondary">登录证书所属学员账号后可编辑。</p>
                        </> : <p className="mt-4 text-text-secondary">此证书不再有效，请联系课程顾问。</p>}
                      </article>
                    ))}
                  </div>
                ) : <p className="text-center text-text-secondary" role="status">{result.error}</p>
                : <p className="text-center text-text-secondary" role="status">查询中...</p>}

              </div>
            </ScrollAnimation>
          </div>
        </section>
      )}

      {/* Certification Info */}
      {!searched && (
        <section className="py-16 bg-warm-gray">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollAnimation>
              <div className="text-center mb-12">
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-text mb-4">
                  关于课程证书
              </h2>
              <p className="text-text-secondary max-w-xl mx-auto">
                伊娃东方舞师资认证覆盖技巧、教学、音乐理解与课堂表达，帮助学员建立专业教学能力
              </p>
            </div>
          </ScrollAnimation>

          <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: '认证标准',
                  desc: '以技术完成度、动作规范和教学表达为核心，确保教学质量',
                  icon: CheckCircle,
                },
                {
                  title: '权威认可',
                  desc: '沉淀多年师资培训经验，为学员提供清晰的专业成长证明',
                  icon: CreditCard,
                },
                {
                  title: '持续学习',
                  desc: '通过复训与进阶课程持续更新教学方法，保持专业水平',
                  icon: User,
                },
              ].map((item, i) => (
                <ScrollAnimation key={i} delay={i * 150}>
                  <div className="bg-white p-6 rounded-xl shadow-sm text-center">
                    <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-6 h-6 text-gold" />
                    </div>
                    <h3 className="font-serif font-semibold text-text mb-2">{item.title}</h3>
                    <p className="text-text-secondary text-sm">{item.desc}</p>
                  </div>
                </ScrollAnimation>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
