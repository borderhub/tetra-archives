import { redirect } from 'next/navigation';

export default function RootPage() {
  // トップアクセスを /archive/all/page/1 にリダイレクト
  redirect('/archive/all/year/2025/page/1');
}
