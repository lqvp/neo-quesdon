'use client';

import NameComponents from '@/app/_components/NameComponents';

import { useContext, useEffect, useRef, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { UserSettingsUpdateDto } from '@/app/_dto/settings/settings.dto';
import { $Enums } from '@prisma/client';
import BlockList from '@/app/main/settings/_table';
import CollapseMenu from '@/app/_components/collapseMenu';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';
import { AccountCleanReqDto } from '@/app/_dto/account-clean/account-clean.dto';
import { FaLock, FaUserLargeSlash } from 'react-icons/fa6';
import { MdDeleteSweep, MdOutlineCleaningServices } from 'react-icons/md';
import { MyProfileContext } from '@/app/main/layout';
import { MyProfileEv } from '@/app/main/_events';
import { getProxyUrl } from '@/utils/getProxyUrl/getProxyUrl';
import { onApiError } from '@/utils/api-error/onApiError';

export type FormValue = {
  stopAnonQuestion: boolean;
  stopNewQuestion: boolean;
  stopNotiNewQuestion: boolean;
  stopPostAnswer: boolean;
  questionBoxName: string;
  visibility: $Enums.PostVisibility;
  wordMuteList: string;
};
async function updateUserSettings(value: FormValue) {
  const body: UserSettingsUpdateDto = {
    stopAnonQuestion: value.stopAnonQuestion,
    stopNewQuestion: value.stopNewQuestion,
    stopNotiNewQuestion: value.stopNotiNewQuestion,
    stopPostAnswer: value.stopPostAnswer,
    questionBoxName: value.questionBoxName || '質問箱',
    defaultPostVisibility: value.visibility,
    wordMuteList: value.wordMuteList
      .split('\n')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((word) => word.replace(/^\/|\/[igmsuy]{0,6}$/g, '')),
  };
  try {
    const res = await fetch('/api/user/settings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-type': 'application/json',
      },
    });
    if (!res.ok) {
      onApiError(res.status, res);
      return;
    }
    MyProfileEv.SendUpdateReq({ ...body });
  } catch (err) {
    throw err;
  }
}

function Divider({ className }: { className?: string }) {
  return <div className={`w-full window:w-[90%] desktop:w-full my-4 border-b ${className}`} />;
}

export default function Settings() {
  const userInfo = useContext(MyProfileContext);
  const [buttonClicked, setButtonClicked] = useState<boolean>(false);
  const [defaultFormValue, setDefaultFormValue] = useState<FormValue>();
  const logoutAllModalRef = useRef<HTMLDialogElement>(null);
  const accountCleanModalRef = useRef<HTMLDialogElement>(null);
  const importBlockModalRef = useRef<HTMLDialogElement>(null);
  const deleteAllQuestionsModalRef = useRef<HTMLDialogElement>(null);
  const deleteAllNotificationsModalRef = useRef<HTMLDialogElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValue>({
    values: defaultFormValue,
  });

  const formValues = watch();
  useEffect(() => {
    if (userInfo) {
      const value = {
        stopAnonQuestion: userInfo.stopAnonQuestion,
        stopNewQuestion: userInfo.stopNewQuestion,
        stopNotiNewQuestion: userInfo.stopNotiNewQuestion,
        stopPostAnswer: userInfo.stopPostAnswer,
        questionBoxName: userInfo.questionBoxName,
        visibility: userInfo.defaultPostVisibility,
        wordMuteList: userInfo.wordMuteList.join('\n'),
      };
      setDefaultFormValue(value);
    }
  }, [userInfo]);

  const onSubmit: SubmitHandler<FormValue> = async (value) => {
    if (userInfo) {
      updateUserSettings(value);
      setButtonClicked(true);
      setTimeout(() => {
        setButtonClicked(false);
      }, 2000);
    }
  };
  const onLogoutAll = async () => {
    setButtonClicked(true);
    const res = await fetch('/api/user/logout-all', { method: 'POST' });
    if (res.ok) {
      localStorage.removeItem('user_handle');
      window.location.href = '/';
    } else {
      onApiError(res.status, res);
      setButtonClicked(false);
      return;
    }
    setTimeout(() => {
      setButtonClicked(false);
    }, 2000);
  };

  const onAccountClean = async () => {
    setButtonClicked(true);
    const user_handle = userInfo?.handle;
    if (!user_handle) {
      return;
    }
    const req: AccountCleanReqDto = {
      handle: user_handle,
    };
    const res = await fetch('/api/user/account-clean', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'content-type': 'application/json' },
    });
    if (res.ok) {
      console.log('アカウントクリーニングが開始されました...');
    } else {
      onApiError(res.status, res);
    }
    setTimeout(() => {
      setButtonClicked(false);
    }, 2000);
  };

  const onImportBlock = async () => {
    setButtonClicked(true);
    const res = await fetch('/api/user/blocking/import', {
      method: 'POST',
    });
    if (res.ok) {
      console.log('ブロックリストのインポートが開始されました...');
    } else {
      onApiError(res.status, res);
    }
    setTimeout(() => {
      setButtonClicked(false);
    }, 2000);
  };

  const onDeleteAllQuestions = async () => {
    setButtonClicked(true);
    const res = await fetch('/api/db/questions', {
      method: 'DELETE',
    });
    setButtonClicked(false);
    if (!res.ok) {
      throw new Error('すべての質問を削除することに失敗しました！');
    }
  };

  const onDeleteAllNotifications = async () => {
    setButtonClicked(true);
    const res = await fetch('/api/user/notification', {
      method: 'DELETE',
    });
    setButtonClicked(false);
    if (!res.ok) {
      throw new Error('通知の削除に失敗しました！');
    }
  };

  return (
    <div className="w-[90%] window:w-[80%] desktop:w-[70%] glass flex flex-col desktop:grid desktop:grid-cols-2 gap-0 rounded-box shadow p-2 dark:text-white">
      {userInfo === undefined ? (
        <div className="w-full flex col-span-3 justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <>
          {userInfo === null || defaultFormValue === undefined ? (
            <div className="w-full flex col-span-3 justify-center">
              <span className="text-2xl">ログインされていません！</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col mt-2 gap-2 col-span-2 justify-center items-center">
                <div className="avatar">
                  <div className="ring-primary ring-offset-base-100 w-24 h-24 rounded-full ring ring-offset-2">
                    {userInfo?.avatarUrl !== undefined && (
                      <img src={getProxyUrl(userInfo.avatarUrl)} alt="User Avatar" className="rounded-full" />
                    )}
                  </div>
                </div>
                <div className="desktop:ml-2 flex flex-col items-center desktop:items-start">
                  <span className="text-xl font-thin">こんにちは,</span>
                  <div className="flex text-2xl items-center">
                    <NameComponents username={userInfo?.name} width={24} height={24} />
                    <span>さん！</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col col-span-2 items-center">
                <div className="text-3xl flex justify-center mt-4 w-full window:w-[90%] desktop:w-full">
                  <span>私たちだけの秘密の設定画面</span>
                </div>
                <Divider />
                <div className="w-full window:w-[70%] flex flex-col desktop:w-full gap-2 desktop:grid desktop:grid-cols-2">
                  {userInfo && (
                    <>
                      <CollapseMenu id={'basicSetting'} text="基本設定">
                        <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col items-center">
                          <div className="grid grid-cols-[20%_80%] desktop:w-[24rem] desktop:grid-cols-[7rem_100%] gap-2 items-center p-2">
                            <input {...register('stopNewQuestion')} type="checkbox" className="toggle toggle-success" />
                            <span className="font-thin">これ以上質問を受け付けない</span>
                            <input
                              {...register('stopAnonQuestion')}
                              type="checkbox"
                              className="toggle toggle-success"
                              disabled={formValues.stopNewQuestion}
                            />
                            <span className="font-thin">匿名質問を受け付けない</span>
                            <input
                              {...register('stopNotiNewQuestion')}
                              type="checkbox"
                              className="toggle toggle-success"
                              disabled={formValues.stopNewQuestion}
                            />
                            <span className="font-thin">新しい質問をDMで受け取らない</span>
                            <input {...register('stopPostAnswer')} type="checkbox" className="toggle toggle-success" />
                            <span className="font-thin">回答を投稿しない</span>
                            <div className="w-fit col-span-2 desktop:grid desktop:grid-cols-subgrid flex flex-col-reverse justify-center desktop:items-center gap-2 ml-[calc(20%+8px)] desktop:ml-0">
                              <select
                                {...register('visibility')}
                                className="select select-ghost select-sm w-fit"
                                disabled={formValues.stopPostAnswer}
                              >
                                <option value="public">公開</option>
                                <option value="home">ホーム</option>
                                <option value="followers">フォロワー</option>
                              </select>
                              <span className="font-thin">回答を投稿する際のデフォルトの公開範囲</span>
                            </div>
                            <div className="col-start-2 flex flex-col-reverse gap-2">
                              <input
                                {...register('questionBoxName', {
                                  maxLength: 10,
                                })}
                                type="text"
                                placeholder="質問箱"
                                className={`input input-bordered input-sm w-48 ${
                                  errors.questionBoxName?.type === 'maxLength' && 'input-error'
                                }`}
                              />
                              <span className="font-thin">質問箱の名前 (10文字以内)</span>
                            </div>
                          </div>
                          <Divider />
                          <div className="flex flex-col desktop:w-[24rem] gap-2 items-center p-2">
                            <div className="text-lg"> 質問のワードミュート </div>
                            <div className="font-thin">
                              ミュートする単語を1行に1つずつ入力します。 <br /> 正規表現もサポートしています。
                            </div>
                            <textarea
                              {...register('wordMuteList')}
                              className="textarea textarea-bordered w-full min-h-[15vh] text-base"
                              placeholder="ミュートする単語、または正規表現"
                            ></textarea>
                          </div>
                          <div className="flex w-full justify-end mt-2">
                            <button type="submit" className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-primary'}`}>
                              {buttonClicked ? '少々お待ちください...' : '保存'}
                            </button>
                          </div>
                        </form>
                      </CollapseMenu>
                      <div className="flex justify-center">
                        <BlockList />
                      </div>
                      <CollapseMenu id={'securitySettings'} text="セキュリティ">
                        <div className="w-full flex flex-col items-center">
                          <span className="font-normal text-xl py-3 flex items-center gap-2">
                            <FaLock />
                            すべてのデバイスからログアウトする{' '}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              logoutAllModalRef.current?.showModal();
                            }}
                            className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-warning'}`}
                          >
                            {buttonClicked ? '少々お待ちください...' : 'すべてのデバイスからログアウト'}
                          </button>
                        </div>
                      </CollapseMenu>
                      <CollapseMenu id={'dangerSetting'} text="危険な設定">
                        <div className="w-full flex flex-col items-center">
                          <Divider />
                          <div className="font-normal text-xl py-3 flex items-center gap-2">
                            <MdDeleteSweep size={24} />
                            通知ボックスを空にする
                          </div>
                          <div className="font-thin px-4 py-2 break-keep">
                            通知ボックスのすべての通知を消去します。 消された通知は元に戻せないので注意してください。
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              deleteAllNotificationsModalRef.current?.showModal();
                            }}
                            className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-warning'}`}
                          >
                            {buttonClicked ? 'ちょっと待って...' : '通知ボックスを空にする'}
                          </button>
                          <Divider />
                          <div className="font-normal text-xl py-3 flex items-center gap-2">
                            <FaUserLargeSlash />
                            ブロックリストのインポート
                          </div>
                          <div className="font-thin px-4 py-2 break-keep">
                            ブロックリストを連合宇宙アカウントからインポートする機能です。ブロックされたユーザーは、もう質問を送ることができません。ユーザーをブロックすると、お互いの回答が非表示になります。
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              importBlockModalRef.current?.showModal();
                            }}
                            className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-warning'}`}
                          >
                            {buttonClicked ? '少々お待ちください...' : 'ブロックリストのインポート'}
                          </button>
                          <Divider />
                          <div className="font-normal text-xl py-3 flex items-center gap-2">
                            <MdOutlineCleaningServices />
                            アカウントのクリーニング
                          </div>
                          <div className="font-thin px-4 py-2 break-keep">
                            ネオ・クエスドンでこのアカウントでこれまでに書いたすべての回答を削除します。この作業には時間がかかり、削除された投稿は元に戻せませんのでご注意ください。{' '}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              accountCleanModalRef.current?.showModal();
                            }}
                            className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-error'}`}
                          >
                            {buttonClicked ? '少々お待ちください...' : 'すべての回答を削除'}
                          </button>
                          <Divider />
                          <div className="font-normal text-xl py-3 flex items-center gap-2">
                            <MdDeleteSweep size={24} />
                            すべての質問を削除
                          </div>
                          <div className="font-thin px-4 py-2 break-keep">
                            まだ回答していないすべての質問を削除します。削除された内容は元に戻せないので、ご注意ください。
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              deleteAllQuestionsModalRef.current?.showModal();
                            }}
                            className={`btn ${buttonClicked ? 'btn-disabled' : 'btn-error'}`}
                          >
                            {buttonClicked ? '少々お待ちください...' : 'すべての質問を削除'}
                          </button>
                          <Divider />
                        </div>
                      </CollapseMenu>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
          <DialogModalTwoButton
            title={'注意'}
            body={'本当にすべてのデバイスからログアウトしますか？'}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={logoutAllModalRef}
            onClick={onLogoutAll}
          />
          <DialogModalTwoButton
            title={'注意'}
            body={'通知箱を空にしますか？'}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={deleteAllNotificationsModalRef}
            onClick={onDeleteAllNotifications}
          />
          <DialogModalTwoButton
            title={'警告'}
            body={'未回答の質問をすべて削除しますか？ \nこの作業には時間がかかり、削除された質問は復元できません！'}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={deleteAllNotificationsModalRef}
            onClick={onDeleteAllNotifications}
          />
          <DialogModalTwoButton
            title={'警告'}
            body={'未回答の質問をすべて削除しますか？ \nこの作業には時間がかかり、削除された質問は復元できません！'}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={deleteAllQuestionsModalRef}
            onClick={onDeleteAllQuestions}
          />
          <DialogModalTwoButton
            title={'警告'}
            body={'これまでに書いたすべての回答を削除しますか？ \nこの作業には時間がかかり、削除された回答は復元できません！'}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={accountCleanModalRef}
            onClick={onAccountClean}
          />
          <DialogModalTwoButton
            title={'注意'}
            body={`${userInfo.instanceType} からブロックリストをインポートしますか？ \nこの作業には少し時間がかかります！`}
            confirmButtonText={'はい'}
            cancelButtonText={'いいえ'}
            ref={importBlockModalRef}
            onClick={onImportBlock}
          />
        </>
      )}
    </div>
  );
}