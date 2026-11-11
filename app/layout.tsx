import type { ReactNode } from 'react';
import './globals.css';
export const metadata = {
  title: 'StudyTrack — учебные задания',
  description: 'Учёт учебных заданий и результатов',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t;try{t=localStorage.getItem('studytrack:theme')}catch(e){}if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
