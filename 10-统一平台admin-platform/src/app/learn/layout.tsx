'use client';

import { useEffect } from 'react';
import { ConfigProvider } from 'antd';

const BRAND = {
  gold: '#C8A96E',
  goldDark: '#A98746',
  red: '#8B1A1A',
  bg: '#F7F3EB',
  text: '#2C1810',
  muted: '#8C8172',
  border: '#E8DDCB',
  card: '#FFFDF8',
  shadow: '0 2px 8px rgba(44,24,16,0.06)',
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.title = '伊娃东方舞 · 学员成长系统';
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: BRAND.gold,
          colorPrimaryHover: BRAND.goldDark,
          colorPrimaryActive: BRAND.red,
          colorLink: BRAND.goldDark,
          colorLinkHover: BRAND.red,
          colorInfo: BRAND.gold,
          colorText: BRAND.text,
          colorTextSecondary: BRAND.muted,
          colorBgLayout: BRAND.bg,
          colorBgContainer: BRAND.card,
          colorBorder: BRAND.border,
          borderRadius: 8,
          boxShadow: BRAND.shadow,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
        components: {
          Button: {
            primaryShadow: '0 6px 16px rgba(200,169,110,0.24)',
            defaultBorderColor: BRAND.border,
            defaultColor: BRAND.text,
            defaultHoverBorderColor: BRAND.gold,
            defaultHoverColor: BRAND.goldDark,
          },
          Card: {
            colorBgContainer: BRAND.card,
            colorBorderSecondary: BRAND.border,
            borderRadiusLG: 8,
            headerFontSize: 16,
          },
          Checkbox: {
            colorPrimary: BRAND.gold,
            colorPrimaryHover: BRAND.goldDark,
          },
          Input: {
            activeBorderColor: BRAND.gold,
            hoverBorderColor: BRAND.gold,
            colorTextPlaceholder: BRAND.muted,
          },
          Progress: {
            defaultColor: BRAND.gold,
            remainingColor: '#EFE6D7',
          },
          Tag: {
            defaultBg: '#FFF8EA',
            defaultColor: BRAND.text,
          },
        },
      }}
    >
      <div className="learn-brand-shell" style={{
        minHeight: '100vh',
        background: BRAND.bg,
        color: BRAND.text,
      }}>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .learn-brand-shell {
                --learn-gold: ${BRAND.gold};
                --learn-gold-dark: ${BRAND.goldDark};
                --learn-red: ${BRAND.red};
                --learn-bg: ${BRAND.bg};
                --learn-text: ${BRAND.text};
                --learn-muted: ${BRAND.muted};
                --learn-border: ${BRAND.border};
                --learn-card: ${BRAND.card};
                --learn-shadow: ${BRAND.shadow};
                --learn-shadow-strong: 0 18px 45px rgba(44,24,16,0.10);
              }
              .learn-brand-shell a {
                color: inherit;
              }
              .learn-brand-shell *,
              .learn-brand-shell *::before,
              .learn-brand-shell *::after {
                box-sizing: border-box;
              }
              .learn-brand-shell .ant-layout,
              .learn-brand-shell .ant-layout-content {
                background: ${BRAND.bg};
                color: ${BRAND.text};
              }
              .learn-brand-shell .ant-card,
              .learn-brand-shell .ant-card-head {
                border-color: ${BRAND.border};
                color: ${BRAND.text};
              }
              .learn-brand-shell .ant-card {
                background: ${BRAND.card};
                box-shadow: ${BRAND.shadow};
              }
              .learn-brand-shell .ant-card-body {
                color: ${BRAND.text};
              }
              .learn-brand-shell .ant-typography,
              .learn-brand-shell .ant-card-head-title,
              .learn-brand-shell .ant-form-item-label > label {
                color: ${BRAND.text};
              }
              .learn-brand-shell .ant-typography-secondary,
              .learn-brand-shell .ant-form-item-extra {
                color: ${BRAND.muted} !important;
              }
              .learn-brand-shell .ant-input,
              .learn-brand-shell .ant-input-affix-wrapper {
                background: ${BRAND.card};
                border-color: ${BRAND.border};
                color: ${BRAND.text};
              }
              .learn-brand-shell .ant-input:hover,
              .learn-brand-shell .ant-input-affix-wrapper:hover,
              .learn-brand-shell .ant-input:focus,
              .learn-brand-shell .ant-input-affix-wrapper-focused {
                border-color: ${BRAND.gold} !important;
                box-shadow: 0 0 0 2px rgba(200,169,110,0.14);
              }
              .learn-brand-shell .ant-checkbox-checked .ant-checkbox-inner {
                background-color: ${BRAND.gold};
                border-color: ${BRAND.gold};
              }
              .learn-brand-shell .ant-checkbox-wrapper:hover .ant-checkbox-inner,
              .learn-brand-shell .ant-checkbox:hover .ant-checkbox-inner {
                border-color: ${BRAND.goldDark};
              }
              .learn-center-page {
                background:
                  radial-gradient(circle at 12% 0%, rgba(200,169,110,0.16), transparent 32%),
                  linear-gradient(180deg, #fbf7ef 0%, ${BRAND.bg} 42%, #f4ecdf 100%);
              }
              .learn-sidebar {
                box-shadow: 14px 0 35px rgba(44,24,16,0.05);
              }
              .learn-nav-link {
                transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
              }
              .learn-nav-link:hover {
                background: #f2e6cf !important;
                color: ${BRAND.red} !important;
                transform: translateX(2px);
              }
              .learn-nav-link.is-active:hover {
                background: linear-gradient(135deg, ${BRAND.gold}, ${BRAND.goldDark}) !important;
                color: #fff !important;
              }
              .learn-topbar {
                position: sticky;
                top: 68px;
                z-index: 10;
                backdrop-filter: blur(16px);
                background: rgba(247,243,235,0.84);
                border-bottom: 1px solid rgba(232,221,203,0.72);
              }
              .learn-official-nav {
                margin: -20px -28px 18px !important;
              }
              .learn-section-card,
              .learn-course-card {
                transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
              }
              .learn-course-card:hover,
              .learn-section-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--learn-shadow-strong) !important;
                border-color: rgba(200,169,110,0.62) !important;
              }
              .learn-course-thumb {
                aspect-ratio: 1 / 1;
                min-height: 0;
              }
              .learn-course-card-body {
                min-height: 126px;
                display: flex;
                flex-direction: column;
              }
              .learn-course-title {
                min-height: 44px;
                line-height: 1.45;
              }
              .learn-courses-list-page {
                max-width: 980px;
                margin: 0 auto;
              }
              .learn-authorized-course-list {
                display: grid;
                gap: 12px;
              }
              .learn-search-course-list {
                display: grid;
                gap: 12px;
                max-width: 980px;
              }
              .learn-home-course-list {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
              }
              .learn-authorized-course-card .ant-card-body {
                height: 100%;
              }
              .learn-authorized-course-row {
                display: flex;
                align-items: stretch;
                gap: 14px;
                min-height: 132px;
                padding: 12px;
              }
              .learn-authorized-course-cover,
              .learn-authorized-course-cover-skeleton {
                flex: 0 0 172px;
                width: 172px !important;
                height: 116px !important;
                min-width: 0;
                border-radius: 8px;
                overflow: hidden;
              }
              .learn-authorized-course-cover {
                position: relative;
                background: linear-gradient(135deg, ${BRAND.gold}, ${BRAND.red});
              }
              .learn-authorized-course-play {
                position: absolute;
                right: 10px;
                bottom: 8px;
                color: #fff;
                font-size: 26px;
                filter: drop-shadow(0 6px 12px rgba(0,0,0,.24));
              }
              .learn-authorized-course-tag {
                position: absolute;
                left: 8px;
                top: 8px;
                max-width: calc(100% - 16px);
                margin: 0;
                border-color: ${BRAND.gold};
                color: ${BRAND.goldDark};
                background: rgba(255,253,248,.92);
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .learn-authorized-course-info {
                flex: 1 1 auto;
                min-width: 0;
                display: flex;
                flex-direction: column;
                padding: 2px 2px 0 0;
              }
              .learn-home-course-card .learn-course-title {
                min-height: 0;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }
              .learn-authorized-course-meta {
                display: grid;
                gap: 4px;
                margin-top: 8px;
              }
              .learn-authorized-course-meta-line {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                color: ${BRAND.muted} !important;
                font-size: 13px;
                line-height: 1.35;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .learn-authorized-course-progress {
                margin-top: auto;
                padding-top: 8px;
              }
              .learn-authorized-course-progress .ant-progress {
                line-height: 1;
              }
              .learn-course-detail-topline {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 14px;
              }
              .learn-course-detail-hero {
                display: grid;
                grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
                gap: 14px;
                align-items: stretch;
                margin-bottom: 14px;
              }
              .learn-course-detail-hero-cover {
                min-height: 190px;
                max-height: 220px;
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                background: linear-gradient(135deg, ${BRAND.gold}, ${BRAND.red});
                box-shadow: var(--learn-shadow);
              }
              .learn-course-detail-info-card .ant-card-body {
                height: 100%;
                min-height: 190px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 18px;
              }
              .learn-course-detail-tag {
                width: fit-content;
                margin-bottom: 8px;
              }
              .learn-course-detail-title.ant-typography {
                margin: 0;
                color: ${BRAND.text};
                font-size: 30px;
                line-height: 1.15;
              }
              .learn-course-detail-subtitle.ant-typography {
                margin: 8px 0 0;
                color: ${BRAND.muted};
                font-size: 15px;
                line-height: 1.55;
              }
              .learn-course-detail-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 8px 16px;
                margin-top: 12px;
              }
              .learn-course-detail-meta .ant-typography {
                color: ${BRAND.muted};
                font-size: 13px;
                line-height: 1.35;
              }
              .learn-course-detail-progress {
                margin-top: 16px;
              }
              .learn-course-detail-progress-label {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
              }
              .learn-course-detail-progress .ant-progress {
                line-height: 1;
              }
              .learn-course-detail-actions {
                display: flex;
                gap: 10px;
                margin-top: 12px;
              }
              .learn-course-detail-actions .ant-btn {
                border-radius: 6px;
              }
              .learn-course-detail-panels {
                display: grid;
                gap: 14px;
              }
              .learn-course-detail-panel-nav {
                position: sticky;
                top: 68px;
                z-index: 8;
                padding: 10px;
                border-bottom: 1px solid ${BRAND.border};
                background: rgba(255,253,248,0.96);
                backdrop-filter: blur(12px);
              }
              .learn-course-detail-panel-nav .ant-segmented {
                background: #F4ECDC;
              }
              .learn-course-detail-panel-nav .ant-segmented-item {
                min-height: 36px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
              }
              .learn-course-detail-panel-body {
                padding: 18px;
              }
              .learn-course-catalog {
                display: grid;
                gap: 10px;
              }
              .learn-catalog-chapter {
                border: 1px solid ${BRAND.border};
                border-radius: 8px;
                background: #FFFDF8;
                overflow: hidden;
              }
              .learn-catalog-chapter-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 12px 14px;
              }
              .learn-catalog-chapter-head.is-playable {
                cursor: pointer;
              }
              .learn-catalog-chapter-head.is-playable:hover,
              .learn-catalog-video-row:hover {
                background: #F9F1E4;
              }
              .learn-catalog-title {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                min-width: 0;
              }
              .learn-catalog-title > div {
                min-width: 0;
              }
              .learn-catalog-title .ant-typography {
                display: block;
                min-width: 0;
                line-height: 1.42;
              }
              .learn-catalog-index {
                flex: 0 0 auto;
                width: 30px;
                height: 24px;
                border-radius: 6px;
                display: grid;
                place-items: center;
                color: ${BRAND.goldDark};
                background: #F4ECDC;
                font-size: 12px;
                font-weight: 900;
              }
              .learn-catalog-desc.ant-typography {
                margin-top: 3px;
                color: ${BRAND.muted};
                font-size: 12px;
              }
              .learn-catalog-meta {
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                gap: 10px;
                color: ${BRAND.muted};
                font-size: 12px;
                white-space: nowrap;
              }
              .learn-catalog-meta .ant-tag {
                margin-inline-end: 0;
                font-size: 11px;
                line-height: 18px;
              }
              .learn-catalog-play.ant-typography,
              .learn-catalog-video-side {
                color: ${BRAND.goldDark};
                font-weight: 800;
              }
              .learn-catalog-videos {
                border-top: 1px solid ${BRAND.border};
                background: rgba(247,243,235,.42);
              }
              .learn-catalog-video-row {
                width: 100%;
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 10px 14px 10px 44px;
                border: 0;
                border-bottom: 1px solid rgba(232,221,203,.72);
                background: transparent;
                color: ${BRAND.text};
                text-align: left;
                cursor: pointer;
              }
              .learn-catalog-video-row:last-child {
                border-bottom: 0;
              }
              .learn-catalog-video-main {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                font-size: 14px;
                line-height: 1.35;
              }
              .learn-catalog-video-main .anticon {
                color: ${BRAND.goldDark};
                flex: 0 0 auto;
              }
              .learn-catalog-video-main span:last-child {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
              .learn-catalog-video-side {
                flex: 0 0 auto;
                font-size: 12px;
                white-space: nowrap;
              }
              .learn-recommend-item .learn-course-thumb {
                border-radius: 8px;
              }
              .learn-quick-link {
                transition: transform .18s ease, color .18s ease;
              }
              .learn-quick-link:hover {
                transform: translateY(-2px);
                color: ${BRAND.red} !important;
              }
              .learn-official-nav-links a {
                transition: background .18s ease, color .18s ease;
              }
              .learn-official-nav-links a:hover {
                background: #F2E6CF;
                color: ${BRAND.red} !important;
              }
              .student-login-page {
                background:
                  linear-gradient(90deg, rgba(44,24,16,0.02), transparent 46%),
                  ${BRAND.bg};
              }
              .student-login-form-panel .ant-input-affix-wrapper {
                border-radius: 8px;
                min-height: 48px;
              }
              @media (max-width: 1199px) {
                .learn-official-nav-links {
                  display: none !important;
                }
                .learn-official-nav-menu {
                  display: inline-flex !important;
                }
                .learn-sidebar {
                  position: sticky !important;
                  inset: auto !important;
                  top: 0;
                  z-index: 20;
                  width: 100% !important;
                  min-height: auto !important;
                  padding: 14px 18px !important;
                  flex-direction: row !important;
                  align-items: center;
                  overflow-x: auto;
                  border-right: 0 !important;
                  border-bottom: 1px solid ${BRAND.border};
                }
                .learn-sidebar-brand {
                  flex: 0 0 auto;
                }
                .learn-sidebar nav {
                  display: flex !important;
                  gap: 8px !important;
                  overflow-x: auto;
                  scrollbar-width: none;
                }
                .learn-sidebar nav::-webkit-scrollbar {
                  display: none;
                }
                .learn-nav-link {
                  flex: 0 0 auto;
                  height: 40px !important;
                  padding: 0 12px !important;
                  font-size: 14px !important;
                  white-space: nowrap;
                }
                .learn-sidebar-benefit {
                  display: none;
                }
                .learn-main {
                  margin-left: 0 !important;
                  padding: 18px !important;
                }
                .learn-topbar {
                  margin: -18px -18px 18px !important;
                  padding: 14px 18px;
                }
                .learn-official-nav {
                  margin: -18px -18px 18px !important;
                }
              }
              @media (max-width: 900px) {
                .learn-topbar {
                  flex-wrap: wrap;
                  gap: 12px !important;
                }
                .learn-search {
                  order: 2;
                  width: 100% !important;
                }
                .learn-topbar-spacer {
                  display: none;
                }
                .learn-topbar-actions {
                  width: 100%;
                  justify-content: space-between;
                }
                .learn-hero {
                  height: auto !important;
                  min-height: 320px;
                  padding: 36px 28px !important;
                }
                .learn-hero-title {
                  font-size: 34px !important;
                  margin-bottom: 22px !important;
                }
                .learn-progress-card {
                  height: auto !important;
                }
              }
              @media (max-width: 640px) {
                .learn-sidebar {
                  padding: 12px !important;
                  display: block !important;
                }
                .learn-sidebar-brand {
                  margin-bottom: 12px;
                }
                .learn-main {
                  padding: 14px 12px 24px !important;
                }
                .learn-topbar {
                  margin: -14px -12px 14px !important;
                  padding: 12px;
                }
                .learn-official-nav {
                  margin: -14px -12px 14px !important;
                }
                .learn-official-nav > div {
                  min-height: auto !important;
                  padding: 10px 12px !important;
                  gap: 8px !important;
                  flex-wrap: wrap;
                }
                .learn-official-nav > div > a {
                  flex: 1 1 160px;
                }
                .learn-official-nav-actions {
                  width: 100%;
                  display: grid !important;
                  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 40px;
                  gap: 8px !important;
                }
                .learn-official-nav-actions .ant-space-item {
                  min-width: 0;
                }
                .learn-official-nav-actions .ant-btn {
                  width: 100%;
                  height: 36px;
                  padding: 0 8px;
                  justify-content: center;
                }
                .learn-topbar-actions .ant-space-item:nth-child(1),
                .learn-topbar-actions .ant-space-item:nth-child(3) {
                  display: none;
                }
                .learn-hero {
                  min-height: 360px;
                  padding: 28px 20px !important;
                }
                .learn-hero-overlay {
                  background: linear-gradient(180deg, rgba(247,243,235,.98) 0%, rgba(247,243,235,.88) 62%, rgba(247,243,235,.48) 100%) !important;
                }
                .learn-hero-title {
                  font-size: 30px !important;
                }
                .learn-hero-actions {
                  display: grid;
                  gap: 10px;
                }
                .learn-hero-actions .ant-btn {
                  width: 100%;
                  margin-left: 0 !important;
                }
                .learn-course-tabs {
                  width: 100%;
                  overflow-x: auto;
                  padding-bottom: 4px;
                }
                .learn-course-tabs .ant-space-item {
                  white-space: nowrap;
                }
                .learn-courses-list-page {
                  padding: 18px 12px 28px !important;
                }
                .learn-courses-list-page .learn-page-header {
                  gap: 14px !important;
                  margin-bottom: 18px !important;
                }
                .learn-courses-list-page .learn-page-header .ant-input-affix-wrapper {
                  width: 100% !important;
                }
                .learn-authorized-course-row {
                  gap: 10px;
                  min-height: 116px;
                  padding: 10px;
                }
                .learn-authorized-course-cover,
                .learn-authorized-course-cover-skeleton {
                  flex-basis: 132px;
                  width: 132px !important;
                  height: 96px !important;
                }
                .learn-authorized-course-info .ant-typography h5,
                .learn-authorized-course-info h5.ant-typography {
                  font-size: 15px;
                  line-height: 1.32;
                }
                .learn-authorized-course-meta {
                  gap: 3px;
                  margin-top: 6px;
                }
                .learn-authorized-course-meta-line {
                  font-size: 12px;
                }
                .learn-authorized-course-progress {
                  padding-top: 6px;
                }
                .learn-authorized-course-progress .ant-typography {
                  font-size: 12px;
                }
                .learn-authorized-course-progress .ant-progress-line {
                  margin-bottom: 0;
                }
                .learn-home-course-list {
                  grid-template-columns: minmax(0, 1fr);
                }
                .learn-search-page {
                  padding: 18px 12px 28px !important;
                }
                .learn-search-hero {
                  margin: 10px 0 18px !important;
                  padding: 20px 16px !important;
                }
                .learn-search-hero h1.ant-typography {
                  font-size: 30px !important;
                }
                .learn-course-detail-page {
                  padding: 18px 12px 28px !important;
                }
                .learn-course-detail-topline {
                  margin-bottom: 10px;
                }
                .learn-course-detail-back {
                  height: 36px;
                  padding: 0 12px;
                }
                .learn-course-detail-hero {
                  grid-template-columns: 112px minmax(0, 1fr) !important;
                  gap: 10px !important;
                  margin-bottom: 12px !important;
                }
                .learn-course-detail-hero-cover {
                  min-height: 0;
                  height: 132px;
                  max-height: 132px;
                }
                .learn-course-detail-hero .ant-card {
                  min-height: 0 !important;
                }
                .learn-course-detail-info-card .ant-card-body {
                  min-height: 132px;
                  padding: 10px;
                  justify-content: flex-start;
                }
                .learn-course-detail-tag {
                  margin-bottom: 5px;
                  font-size: 11px;
                  line-height: 18px;
                }
                .learn-course-detail-title.ant-typography {
                  font-size: 18px !important;
                  line-height: 1.24;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                .learn-course-detail-subtitle.ant-typography {
                  margin-top: 5px;
                  font-size: 12px;
                  line-height: 1.35;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                  overflow: hidden;
                }
                .learn-course-detail-meta {
                  gap: 4px 8px;
                  margin-top: 7px;
                }
                .learn-course-detail-meta .ant-typography {
                  font-size: 11px;
                }
                .learn-course-detail-progress {
                  margin-top: 7px;
                }
                .learn-course-detail-progress-label .ant-typography {
                  font-size: 11px;
                }
                .learn-course-detail-actions {
                  display: none;
                }
                .learn-course-detail-panel-nav {
                  top: 91px;
                  padding: 8px;
                }
                .learn-course-detail-panel-body {
                  padding: 12px;
                }
                .learn-catalog-chapter-head {
                  align-items: flex-start;
                  padding: 10px;
                }
                .learn-catalog-index {
                  width: 26px;
                  height: 22px;
                  font-size: 11px;
                }
                .learn-catalog-meta {
                  flex-direction: column;
                  align-items: flex-end;
                  gap: 3px;
                  font-size: 11px;
                }
                .learn-catalog-video-row {
                  min-height: 42px;
                  padding: 9px 10px 9px 36px;
                }
                .learn-catalog-video-main {
                  font-size: 13px;
                }
                .learn-catalog-video-side {
                  font-size: 11px;
                }
                .learn-progress-body {
                  gap: 18px;
                  text-align: center;
                }
                .learn-progress-body .ant-col {
                  flex: 0 0 100%;
                  max-width: 100%;
                }
                .student-login-page {
                  display: block !important;
                }
                .student-login-hero {
                  min-height: 360px;
                  padding: 36px 24px !important;
                }
                .student-login-hero-content .ant-typography {
                  font-size: 34px !important;
                }
                .student-login-form-panel {
                  min-height: auto;
                  padding: 30px 22px 40px !important;
                  box-shadow: 0 -14px 34px rgba(44,24,16,.08) !important;
                }
                .student-login-card {
                  max-width: 420px !important;
                }
              }
            `,
          }}
        />
        {children}
      </div>
    </ConfigProvider>
  );
}
