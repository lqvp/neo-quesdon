'use client';

import Link from 'next/link';
import { useContext, useEffect, useRef, useState } from 'react';
import { FaInfoCircle, FaUser } from 'react-icons/fa';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';
import { refreshJwt } from '@/utils/refreshJwt/refresh-jwt-token';
import { logout } from '@/utils/logout/logout';
import { FaXmark } from 'react-icons/fa6';
import WebSocketState from '../_components/webSocketState';
import { MyProfileContext, NotificationContext } from './layout';
import { webSocketManager } from '@/app/main/_websocketManager';
import { getProxyUrl } from '@/utils/getProxyUrl/getProxyUrl';

type headerProps = {
  questionsNum: number;
  loginChecked: boolean;
};
export default function MainHeader({ questionsNum, loginChecked }: headerProps) {
  const profile = useContext(MyProfileContext);
  const logoutModalRef = useRef<HTMLDialogElement>(null);
  const [questionsToastMenu, setQuestionsToastMenu] = useState<boolean>(false);
  const websocketRef = useRef<WebSocket | null>(null);
  const [wsState, setWsState] = useState<number | undefined>();
  const ws_retry_counter = useRef<number>(0);
  const toastTimeout = useRef<NodeJS.Timeout>();
  const [notiNum, setNotiNum] = useState<number>(0);

  const notificationContext = useContext(NotificationContext);

  const menuClose = () => {
    const el = document.activeElement as HTMLLIElement;
    if (el) {
      el?.blur();
    }
  };

  useEffect(() => {
    if (!loginChecked) {
      return;
    }
    const webSocketRetryInterval = setInterval(
      () => {
        if (websocketRef.current === null || websocketRef.current?.readyState === 3) {
          if (ws_retry_counter.current < 5) {
            ws_retry_counter.current += 1;
            console.log('WebSocket接続を再試行中...', ws_retry_counter.current);
            webSocketManager({ websocketRef, toastTimeout, setWsState, setQuestionsToastMenu });
          } else {
            console.log('WebSocket接続の最大再試行回数を超えました!');
            clearInterval(webSocketRetryInterval);
            return;
          }
        } else {
          websocketRef.current.send(`mua: ${Date.now()}`);
        }
      },
      5000 + ws_retry_counter.current * 2000,
    );

    webSocketManager({ websocketRef, toastTimeout, setWsState, setQuestionsToastMenu });
    return () => {
      clearTimeout(toastTimeout.current);
      clearInterval(webSocketRetryInterval);
      if (websocketRef.current?.readyState === 1) {
        websocketRef.current.close();
      }
    };
  }, [loginChecked]);

  useEffect(() => {
    if (websocketRef.current && websocketRef.current.readyState === 1) {
      console.debug('Websocket接続再試行カウンタの初期化！');
      ws_retry_counter.current = 0;
    }
  }, [websocketRef.current?.readyState]);

  useEffect(() => {
    if (!notificationContext) return;
    setNotiNum(notificationContext.unread_count);
  }, [notificationContext]);

  useEffect(() => {
    const fn = async () => {
      const now = Math.ceil(Date.now() / 1000);
      // JWTリフレッシュから1時間が経過した場合、リフレッシュを試みる
      const last_token_refresh = Number.parseInt(localStorage.getItem('last_token_refresh') ?? '0');
      if (now - last_token_refresh > 3600) {
        await refreshJwt();
      }
    };
    fn();
  }, []);

  return (
    <div className="w-[90%] window:w-[80%] desktop:w-[70%] navbar bg-base-100 shadow rounded-box my-4">
      <div className="flex-1">
        <Link href="/main" className="btn btn-ghost text-xl">
          Neo-Quesdon
        </Link>
      </div>
      <div className="mr-2 tooltip tooltip-bottom" data-tip="ストリーミング接続状態">
        <WebSocketState connection={wsState} />
      </div>
      <div className="dropdown dropdown-end">
        <div tabIndex={0} role="button" className={`btn btn-ghost btn-circle avatar`}>
          <div className="w-10 rounded-full">
            {profile?.avatarUrl ? (
              <>
                <img src={getProxyUrl(profile.avatarUrl)} alt="navbar avatar profile" />
                {questionsNum > 0 || notiNum > 0 ? (
                  <span className="badge badge-sm badge-warning absolute top-0">{questionsNum + notiNum}</span>
                ) : (
                  <></>
                )}
              </>
            ) : (
              <div className="w-10 h-10 flex justify-center items-center text-3xl">
                <FaUser />
              </div>
            )}
          </div>
        </div>
        {profile === undefined ? (
          <div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
            >
              <li>
                <Link href={'/'}>ログイン</Link>
              </li>
            </ul>
          </div>
        ) : (
          <div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content bg-base-100 rounded-box z-10 mt-3 w-52 p-2 shadow"
              onClick={menuClose}
            >
              <li>
                <Link href={`/main/user/${profile?.handle}`}>マイページ</Link>
              </li>
              <li className="flex">
                <Link href={'/main/questions'}>
                  <span>未回答の質問</span>
                  {questionsNum && questionsNum > 0 ? (
                    <>
                      <div className="badge badge-warning badge-sm">{questionsNum}</div>
                    </>
                  ) : (
                    <></>
                  )}
                </Link>
              </li>
              <li>
                <Link href={'/main/notification'} scroll={false}>
                  <span>お知らせ</span>
                  {notiNum > 0 ? (
                    <>
                      <div className="badge badge-warning badge-sm">{notiNum}</div>
                    </>
                  ) : (
                    <></>
                  )}
                </Link>
              </li>
              <li>
                <Link href={'/main/social'}>ソーシャル(ベータ)</Link>
              </li>
              <li>
                <Link href={'/main/settings'}>設定</Link>
              </li>
              <li onClick={() => logoutModalRef.current?.showModal()}>
                <a>ログアウト</a>
              </li>
            </ul>
          </div>
        )}
      </div>
      <DialogModalTwoButton
        title={'ログアウト'}
        body={'本当にログアウトしますか？'}
        confirmButtonText={'ログアウト'}
        cancelButtonText={'キャンセル'}
        ref={logoutModalRef}
        onClick={logout}
      />
      <div
        className={`toast toast-end w-[16rem] desktop:w-[20rem] z-[1] ${!questionsToastMenu && 'translate-x-full transition-transform'}`}
      >
        <div className="alert shadow flex">
          <Link
            href={'/main/questions'}
            className="flex items-center gap-4"
            onClick={() => setQuestionsToastMenu(false)}
          >
            <FaInfoCircle size={20} />
            <div className="">
              <h3 className="text-lg">新しい質問があります！</h3>
              <span className="text-sm font-thin">ここをクリックして確認する</span>
            </div>
          </Link>
          <FaXmark className="absolute top-7 right-8 cursor-pointer" onClick={() => setQuestionsToastMenu(false)} />
        </div>
      </div>
    </div>
  );
}