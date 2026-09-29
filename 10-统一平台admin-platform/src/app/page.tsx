import { redirect } from 'next/navigation';

/**
 * 根页面直接在服务端跳转，避免用户访问 / 时额外下载一段客户端跳转代码。
 */
export default function Home() {
  redirect('/login');
}
