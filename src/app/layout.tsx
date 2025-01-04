import type { Metadata, Viewport } from 'next';
import './globals.css';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Neo-Quesdon',
  description: '세라복.모에의 새로운 Quesdon',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const randomNumber = Math.ceil(Math.random() * 4);

  return (
    <html lang="en">
      <body
        className="antialiased bg-transparent w-[100vw] h-[100vh]"
        style={{
          fontFamily: "'Noto Sans JP', sans-serif"
        }}
      >
        {children}
        <div className="fixed top-0 left-0 bg-transparent w-[100vw] h-[100vh] -z-10">
          <Image
            src={`/static/${randomNumber}.gif`}
            alt="App Background"
            fill={true}
            unoptimized
            objectFit="cover"
            style={{
              opacity: '0.6',
            }}
          />
        </div>
      </body>
    </html>
  );
}