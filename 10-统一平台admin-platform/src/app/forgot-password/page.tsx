import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">找回后台账号密码</h1>
        <p className="mt-5 leading-7 text-gray-600">请联系校长或平台管理员，提供你的后台账号，由管理员核实身份后协助重置密码。</p>
        <p className="mt-3 leading-7 text-gray-600">重置完成后，返回登录页使用新密码登录。</p>
        <Link href="/login" className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-white">返回登录</Link>
      </section>
    </main>
  );
}
