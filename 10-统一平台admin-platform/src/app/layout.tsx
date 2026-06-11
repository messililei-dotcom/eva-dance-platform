import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { KeyboardEnterSubmit } from '@/components/keyboard-enter-submit';
import { AuthProvider } from '@/lib/auth-context';
import '@/styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <title>伊娃东方舞 · 数字化运营平台</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body style={{ margin: 0 }}>
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#F72A8A',
                borderRadius: 8,
                colorLink: '#F72A8A',
                colorSuccess: '#22C55E',
                colorWarning: '#F59E0B',
                colorError: '#EF4444',
                colorInfo: '#3B82F6',
                colorText: '#121A3A',
                colorTextSecondary: '#7A8199',
                colorBgLayout: '#F6F7FB',
                colorBorder: '#E9ECF5',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans SC', sans-serif",
              },
              components: {
                Menu: {
                  itemBg: 'transparent',
                  subMenuItemBg: 'transparent',
                  darkItemBg: 'transparent',
                  darkItemSelectedBg: '#F72A8A',
                  darkItemSelectedColor: '#FFFFFF',
                  darkItemHoverBg: 'rgba(247, 42, 138, 0.12)',
                },
                Table: {
                  headerBg: '#F9FAFF',
                  headerColor: '#121A3A',
                  rowHoverBg: 'rgba(247, 42, 138, 0.04)',
                },
                Card: {
                  paddingLG: 20,
                  borderRadiusLG: 12,
                },
                Button: {
                  primaryShadow: '0 10px 24px rgba(247, 42, 138, 0.2)',
                },
                Input: {
                  activeBorderColor: '#F72A8A',
                  hoverBorderColor: '#FF7DB9',
                },
                Tabs: {
                  inkBarColor: '#F72A8A',
                  itemHoverColor: '#F72A8A',
                  itemSelectedColor: '#F72A8A',
                },
              },
            }}
          >
            <AntdApp>
              <AuthProvider>
                <KeyboardEnterSubmit />
                {children}
              </AuthProvider>
            </AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
