'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import detectInstance from '@/utils/detectInstance/detectInstance';
import { loginReqDto } from '@/app/_dto/web/login/login.dto';
import GithubRepoLink from '@/app/_components/github';
import DialogModalOneButton from '@/app/_components/modalOneButton';
import { loginCheck } from '@/utils/checkLogin/fastLoginCheck';
import { logout } from '@/utils/logout/logout';

interface FormValue {
  address: string;
}

/**
 * Misskey 専用認証関数
 * @param loginReqDto
 * @returns
 */
const misskeyAuth = async ({ host }: loginReqDto) => {
  const body: loginReqDto = {
    host: host,
  };
  const res = await fetch(`/api/web/misskey-login`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Misskey ログインエラー! ${res.status}, ${await res.text()}`);
  }
  return await res.json();
};

/**
 * Mastodon 専用認証関数
 * @param loginReqDto
 * @returns
 */
const mastodonAuth = async ({ host }: loginReqDto) => {
  const body: loginReqDto = {
    host: host,
  };
  const res = await fetch(`/api/web/mastodon-login`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Mastodon ログインエラー! ${res.status}, ${await res.text()}`);
  }
  return await res.json();
};

const goWithoutLogin = async () => {
  try {
    await logout();
  } catch {}
  window.location.replace('/main');
};

/**
 * https://example.com/ のようなURL形式やhandle形式で入力された場合、hostに変換します。
 * hostを小文字に変換して返します。
 * @param urlOrHostOrHandle
 * @returns
 */
function convertHost(urlOrHostOrHandle: string) {
  const url_regex = /\/\/[^/@\s]+(:[0-9]{1,5})?\/?/;
  const matched_host_from_url = urlOrHostOrHandle.match(url_regex)?.[0];
  const handle_regex = /(:?@)[^@\s\n\r\t]+$/g;
  const matched_host_from_handle = urlOrHostOrHandle.match(handle_regex)?.[0];
  if (matched_host_from_url) {
    const replaceed = matched_host_from_url.replaceAll('/', '').toLowerCase();
    console.log(`URL ${urlOrHostOrHandle} は ${replaceed} に置き換えられました`);
    return replaceed;
  } else if (matched_host_from_handle) {
    const replaced = matched_host_from_handle.replaceAll('@', '').toLowerCase();
    console.log(`Handle ${urlOrHostOrHandle} は ${replaced} に置き換えられました`);
    return replaced;
  }
  return urlOrHostOrHandle.toLowerCase();
}

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errMessage, setErrorMessage] = useState<string>();
  const errModalRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const {
    register,
    formState: { errors },
    handleSubmit,
    setValue: setFormValue,
  } = useForm<FormValue>({ defaultValues: { address: '' } });

  const onSubmit: SubmitHandler<FormValue> = async (e) => {
    setIsLoading(true);
    const host = convertHost(e.address);

    localStorage.setItem('server', host);
    await detectInstance(host)
      .then((type) => {
        const payload: loginReqDto = {
          host: host,
        };
        switch (type) {
          case 'misskey':
          case 'cherrypick':
            misskeyAuth(payload)
              .then((r) => {
                router.replace(r.url);
              })
              .catch((err) => {
                setErrorMessage(err);
                errModalRef.current?.showModal();
              });
            break;
          case 'mastodon':
            mastodonAuth(payload)
              .then((r) => {
                router.replace(r);
              })
              .catch((err) => {
                setErrorMessage(err);
                errModalRef.current?.showModal();
              });
            break;
          default:
            setErrorMessage(`不明なインスタンスタイプ '${type}' です!`);
            errModalRef.current?.showModal();
        }
      })
      .catch(() => {
        setErrorMessage('インスタンスタイプの検出に失敗しました!');
        errModalRef.current?.showModal();
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    const lastUsedHost = localStorage.getItem('server');
    const ele = document.getElementById('serverNameInput') as HTMLInputElement;
    if (lastUsedHost && ele) {
      setFormValue('address', lastUsedHost);
      ele.focus();
    }
  }, [setFormValue]);

  useEffect(() => {
    const fn = async () => {
      setIsLoading(true);
      /// すでにログインしている場合、高速再ログインを試みる
      const lastUsedHost = localStorage.getItem('server');
      const lastUsedHandle = localStorage.getItem('user_handle');
      if (lastUsedHost && lastUsedHandle != null) {
        console.log('高速再ログインを試みます...');
        const relogin_success = await loginCheck();
        if (relogin_success) {
          console.log('高速再ログイン成功!!');
          router.replace('/main');
          return;
        } else {
          localStorage.removeItem('handle');
        }
      }
      setIsLoading(false);
    };
    fn();
  }, []);

  return (
    <div className="w-screen h-screen absolute flex flex-col items-center justify-center">
      <main className="w-full h-full flex flex-col justify-center items-center p-6">
        <div className="mb-4 flex flex-col items-center">
          <div className="relative text-7xl font-bold z-10">
            <h1 className="absolute -inset-0 -z-10 bg-gradient-to-r text-transparent from-red-500 via-fuchsia-500 to-green-500 bg-clip-text blur-lg">
              Neo-Quesdon
            </h1>
            <h1 className="text-7xl font-bold z-10 mb-2 desktop:mb-0">Neo-Quesdon</h1>
          </div>
          <span className="font-thin tracking-wider text-base desktop:text-lg">
            Misskey / CherryPick / Mastodon で使用できる新しい Quesdon
          </span>
        </div>
        <div className="flex flex-col desktop:flex-row items-center">
          <form className="flex flex-col desktop:flex-row" onSubmit={handleSubmit(onSubmit)} id="urlInputForm">
            {errors.address && errors.address.type === 'pattern' && (
              <div
                className="tooltip tooltip-open tooltip-error transition-opacity"
                data-tip="正しいURLを入力してください"
              />
            )}
            {errors.address && errors.address.message === 'required' && (
              <div className="tooltip tooltip-open tooltip-error transition-opacity" data-tip="URLを入力してください" />
            )}
            <input
              id="serverNameInput"
              {...register('address', {
                pattern: /\./,
                required: 'required',
              })}
              placeholder="serafuku.moe"
              className="w-full input input-bordered text-lg desktop:text-3xl mb-4 desktop:mb-0"
            />
          </form>
          <div className="flex flex-row items-center">
            <button
              type="submit"
              className={`btn ml-4 ${isLoading ? 'btn-disabled' : 'btn-primary'}`}
              form="urlInputForm"
            >
              {isLoading ? (
                <div>
                  <span className="loading loading-spinner" />
                </div>
              ) : (
                <div>
                  <span>ログイン</span>
                </div>
              )}
            </button>
            <button
              type="button"
              className={`btn ml-4 ${isLoading ? 'btn-disabled' : 'btn-outline'}`}
              onClick={goWithoutLogin}
            >
              ログインせずに楽しむ
            </button>
          </div>
        </div>
      </main>
      <footer className="w-full row-start-3 flex gap-6 flex-wrap items-center justify-end">
        <GithubRepoLink />
      </footer>
      <DialogModalOneButton
        title={'エラー'}
        body={`ログインエラーが発生しました! ${errMessage}`}
        buttonText={'確認'}
        ref={errModalRef}
      />
    </div>
  );
}