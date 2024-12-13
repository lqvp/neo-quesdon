'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { mastodonCallbackTokenClaimPayload } from '@/app/_dto/mastodon-callback/callback-token-claim.dto';
import { login } from '@/app/mastodon-callback/action';
import { useRouter } from 'next/navigation';
import DialogModalOneButton from '@/app/_components/modalOneButton';

const onErrorModalClick = () => {
  window.location.replace('/');
};

export default function CallbackPage() {
  const [id, setId] = useState<number>(0);
  const errModalRef = useRef<HTMLDialogElement>(null);
  const [errMessage, setErrorMessage] = useState<string>();

  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);

    const server = localStorage.getItem('server');

    const randomNumber = Math.ceil(Math.random() * 3);
    setId(randomNumber);

    const fn = async () => {
      try {
        if (server) {
          const code = params.get('code');
          const state = params.get('state');
          if (code === null) {
            throw new Error('User code is null?');
          }
          if (state === null) {
            throw new Error('login state is null?');
          }
          const payload: mastodonCallbackTokenClaimPayload = {
            mastodonHost: server,
            callback_code: code,
            state: state,
          };

          let res;
          try {
            res = await login(payload);
          } catch (err) {
            throw err;
          }
          const user = res.user;
          const handle = `@${user.profile.username}@${server}`;
          localStorage.setItem('user_handle', handle);
          const now = Math.ceil(Date.now() / 1000);
          localStorage.setItem('last_token_refresh', `${now}`);

          router.replace('/main');
        }
      } catch (err) {
        console.error(err);
        setErrorMessage(`ログイン中に問題が発生しました... 再度お試しください`);
        errModalRef.current?.showModal();
      }
    };
    fn();
  }, []);

  return (
    <>
      <div className="w-full h-[100vh] flex flex-col gap-2 justify-center items-center text-3xl">
        <Image src={`/loading/${id}.gif`} width={64} height={64} alt="Login Loading" unoptimized />
        <span>ログインしています...</span>
      </div>
      <DialogModalOneButton
        title={'오류'}
        body={`${errMessage}`}
        buttonText={'확인'}
        ref={errModalRef}
        onClick={onErrorModalClick}
      />
    </>
  );
}
