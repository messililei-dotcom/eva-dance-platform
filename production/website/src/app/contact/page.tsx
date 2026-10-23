'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Send, MapPin, Phone, Mail, Clock, User, MailIcon, MessageSquare, MessageCircle } from 'lucide-react';
import ScrollAnimation from '@/components/ScrollAnimation';

const customerServiceQRCodes = [
  {
    name: 'Monica 海艳老师',
    src: '/images/contact/wechat-monica-haiyan.jpg',
    note: '课程咨询',
  },
  {
    name: 'Elin 伊琳老师',
    src: '/images/contact/wechat-elin-yilin.jpg',
    note: '报名咨询',
  },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setFormData({ name: '', email: '', phone: '', message: '' });
      setSubmitted(false);
    }, 3000);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-crimson-dark via-crimson to-gold-dark pb-16 pt-36 md:pb-24 md:pt-44">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollAnimation>
            <span className="inline-block px-3 py-1 bg-white/10 text-gold-light text-sm font-medium rounded-full mb-4">
              联系我们
            </span>
            <h1 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
              与我们取得联系
            </h1>
            <p className="text-white/70 max-w-xl mx-auto">
              有任何课程、报名或活动问题，欢迎添加客服微信咨询
            </p>
          </ScrollAnimation>
        </div>
      </section>

      <div className="py-16 md:py-24 bg-warm-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact Form */}
            <ScrollAnimation animation="slide-left">
              <div id="contact-form" className="scroll-mt-24">
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-6">
                  发送消息
                </h2>
                <p className="text-text-secondary mb-8">
                  填写以下表单，或直接扫码添加客服微信，我们会尽快与您联系
                </p>

                {submitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-green-800 mb-2">消息已发送！</h3>
                    <p className="text-green-700">我们会尽快回复您的消息。</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-text mb-2">
                        姓名 *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="请输入您的姓名"
                          className="w-full pl-10 pr-4 py-3 border border-sand/50 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-text mb-2">
                        邮箱 *
                      </label>
                      <div className="relative">
                        <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="请输入您的邮箱"
                          className="w-full pl-10 pr-4 py-3 border border-sand/50 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-text mb-2">
                        电话
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="请输入您的电话号码"
                          className="w-full pl-10 pr-4 py-3 border border-sand/50 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-text mb-2">
                        消息 *
                      </label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-text-muted" />
                        <textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleInputChange}
                          placeholder="请输入您的消息..."
                          rows={5}
                          className="w-full pl-10 pr-4 py-3 border border-sand/50 rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent outline-none transition-all resize-none"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="px-8 py-3.5 bg-gradient-to-r from-gold to-gold-dark text-white font-medium rounded-lg hover:shadow-lg hover:shadow-gold/30 transition-all flex items-center gap-2"
                    >
                      <Send className="w-5 h-5" />
                      发送消息
                    </button>
                  </form>
                )}
              </div>
            </ScrollAnimation>

            {/* Contact Info */}
            <ScrollAnimation animation="slide-right">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-text mb-6">
                  联系信息
                </h2>
                <p className="text-text-secondary mb-8">
                  扫码添加客服微信，咨询课程、报名与活动安排
                </p>

                <div className="space-y-6">
                  <div id="wechat" className="scroll-mt-24 rounded-xl border border-gold/20 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gold/10">
                        <MessageCircle className="h-5 w-5 text-gold" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text">微信客服</h3>
                        <p className="text-sm text-text-secondary">任选一位老师扫码添加</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {customerServiceQRCodes.map((qr) => (
                        <div key={qr.name} className="text-center">
                          <div className="overflow-hidden rounded-lg border border-sand/40 bg-white">
                            <Image
                              src={qr.src}
                              alt={`${qr.name}微信二维码`}
                              width={420}
                              height={560}
                              className="aspect-[3/4] w-full object-contain"
                            />
                          </div>
                          <p className="mt-3 text-sm font-medium text-text">{qr.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">{qr.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text mb-1">地址</h3>
                      <p className="text-text-secondary">长沙总部（具体地址以当期课程通知为准）</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                      <Phone className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text mb-1">电话</h3>
                      <p className="text-text-secondary">请通过页面二维码联系课程顾问</p>
                    </div>
                  </div>

                  <div id="business" className="scroll-mt-24 flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                      <Mail className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text mb-1">邮箱</h3>
                      <p className="text-text-secondary">商务合作与课程咨询请先通过微信联系</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center">
                      <Clock className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-text mb-1">工作时间</h3>
                      <p className="text-text-secondary">周一至周五 9:00-18:00<br />周末及节假日休息</p>
                    </div>
                  </div>
                </div>

                {/* Social Media */}
                <div className="mt-8 pt-8 border-t border-sand/30">
                  <h3 className="font-semibold text-text mb-2">客服响应</h3>
                  <p className="text-sm text-text-secondary">
                    工作时间内优先通过微信回复，非工作时间留言会在下一工作日处理。
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </div>
    </div>
  );
}
