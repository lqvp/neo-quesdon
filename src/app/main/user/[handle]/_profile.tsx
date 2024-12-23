'use client';

import DialogModalLoadingOneButton from '@/app/_components/modalLoadingOneButton';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';
import NameComponents from '@/app/_components/NameComponents';
import { SearchBlockListResDto } from '@/app/_dto/blocking/blocking.dto';
import { CreateQuestionDto } from '@/app/_dto/questions/create-question.dto';
import { userProfileDto } from '@/app/_dto/fetch-profile/Profile.dto';
import josa from '@/app/api/_utils/josa';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { getProxyUrl } from '@/utils/getProxyUrl/getProxyUrl';

type FormValue = {
  question: string;
  nonAnonQuestion: boolean;
};

async function fetchProfile(handle: string) {
  const res = await fetch(`/api/db/fetch-profile/${handle}`);
  try {
    if (res && res.ok) {
      return res.json() as unknown as userProfileDto;
    } else {
      throw new Error(`プロフィールを取得するのに失敗しました！ ${await res.text()}`);
    }
  } catch (err) {
    alert(err);
    return undefined;
  }
}

export default function Profile() {
  const { handle } = useParams() as { handle: string };
  const profileHandle = decodeURIComponent(handle);

  const [userProfile, setUserProfile] = useState<userProfileDto>();
  const [localHandle, setLocalHandle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUserBlocked, setIsUserBlocked] = useState<boolean>(false);
  const [questionSendingDoneMessage, setQuestionSendingDoneMessage] = useState<{ title: string; body: string }>({
    title: '成功',
    body: '質問しました！',
  });
  const questionSendingModalRef = useRef<HTMLDialogElement>(null);
  const blockConfirmModalRef = useRef<HTMLDialogElement>(null);
  const blockSuccessModalRef = useRef<HTMLDialogElement>(null);
  const unblockConfirmModalRef = useRef<HTMLDialogElement>(null);
  const unblockSuccessModalRef = useRef<HTMLDialogElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    trigger,
    getValues,
    setError,
    formState: { errors },
  } = useForm<FormValue>({
    defaultValues: {
      question: '',
      nonAnonQuestion: false,
    },
  });

  const nonAnonQuestion = watch('nonAnonQuestion');

  const onCtrlEnter = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const isValid = await trigger();

      if (isValid === false) {
        return;
      } else {
        const value = getValues();
        if (value && !questionSendingModalRef.current?.open) {
          await onSubmit(value);
        }
      }
    }
  };

  /**
   * @throws throw only when fetch throws exception
   * @param q CreateQuestionDto
   * @returns create question API による Response
   */
  const mkQuestionCreateApi = async (q: CreateQuestionDto): Promise<Response> => {
    try {
      const res = await fetch('/api/db/questions', {
        method: 'POST',
        body: JSON.stringify(q),
      });
      return res;
    } catch (err) {
      // fetch 自体が throw された場合のみ alert し、status code が成功でない場合は別途ハンドリング
      setIsLoading(false);
      setQuestionSendingDoneMessage({ title: 'エラー', body: `質問を送信するのに失敗しました！ ${err}` });
      throw err;
    }
  };

  const shareUrl = () => {
    const server = localStorage.getItem('server');
    const text = `私の${josa(
      userProfile?.questionBoxName,
      'です！',
      'です！',
    )} #neo_quesdon #lqvp_fork ${location.origin}/main/user/${userProfile?.handle}`;
    return `https://${server}/share?text=${encodeURIComponent(text)}`;
  };

  // ブロックする関数
  const handleBlock = async () => {
    setIsLoading(true);
    blockSuccessModalRef.current?.showModal();
    const res = await fetch('/api/user/blocking/create', {
      method: 'POST',
      body: JSON.stringify({ targetHandle: profileHandle }),
    });
    if (!res.ok) {
      alert(await res.text());
      setIsLoading(false);
    }
    setIsUserBlocked(true);
    setIsLoading(false);
  };

  // ブロック解除する関数
  const handleUnBlock = async () => {
    setIsLoading(true);
    unblockSuccessModalRef.current?.showModal();
    const res = await fetch('/api/user/blocking/delete', {
      method: 'POST',
      body: JSON.stringify({ targetHandle: profileHandle }),
    });
    if (!res.ok) {
      alert(await res.text());
      setIsLoading(false);
    }
    setIsUserBlocked(false);
    setIsLoading(false);
  };

  const onSubmit: SubmitHandler<FormValue> = async (e) => {
    const user_handle = localStorage.getItem('user_handle');
    const detectWhiteSpaces = new RegExp(/^\s+$/);

    // 작성자 공개
    if (nonAnonQuestion === true) {
      if (user_handle === null) {
        setError('nonAnonQuestion', {
          type: 'notLoggedIn',
          message: '投稿者公開をするにはログインしてください！',
        });
        return;
      }
      if (detectWhiteSpaces.test(e.question) === true) {
        setError('question', {
          type: 'questionOnlyWhiteSpace',
          message: '何も書かれていない質問を送信しようとしていますか...?',
        });
        return;
      }

      const req: CreateQuestionDto = {
        question: e.question,
        isAnonymous: !nonAnonQuestion,
        questionee: profileHandle,
      };
      reset();
      setIsLoading(true);
      questionSendingModalRef.current?.showModal();
      const res = await mkQuestionCreateApi(req);

      if (res.ok) {
        setIsLoading(false);
      } else {
        setIsLoading(false);
        setQuestionSendingDoneMessage({ title: 'エラー', body: `質問を送信するのに失敗しました！ ${await res.text()}` });
      }
    }
    // 投稿者非公開
    else {
      if (userProfile?.stopAnonQuestion === true) {
        setError('nonAnonQuestion', {
          type: 'stopAnonQuestion',
          message: '匿名質問は受け付けていません...',
        });
        return;
      } else {
        if (detectWhiteSpaces.test(e.question) === true) {
          setError('question', {
            type: 'questionOnlyWhiteSpace',
            message: '何も書かれていない質問を送信しようとしていますか...?',
          });
          return;
        }

        const req: CreateQuestionDto = {
          question: e.question,
          isAnonymous: !nonAnonQuestion,
          questionee: profileHandle,
        };
        reset();
        setIsLoading(true);
        questionSendingModalRef.current?.showModal();
        const res = await mkQuestionCreateApi(req);
        if (res.ok) {
          setIsLoading(false);
        } else {
          setIsLoading(false);
          setQuestionSendingDoneMessage({ title: 'エラー', body: `質問を送信するのに失敗しました！ ${await res.text()}` });
        }
      }
    }
  };

  useEffect(() => {
    fetchProfile(profileHandle).then((r) => {
      setUserProfile(r);
    });
  }, []);

  useEffect(() => {
    setLocalHandle(localStorage.getItem('user_handle'));
    if (localHandle) {
      (async () => {
        const res = await fetch('/api/user/blocking/find', {
          method: 'POST',
          body: JSON.stringify({ targetHandle: profileHandle }),
        });
        if (!res.ok) alert('ブロック状態を取得するのにエラーが発生しました！');
        const data = (await res.json()) as SearchBlockListResDto;
        setIsUserBlocked(data.isBlocked);
      })();
    }
  }, [localHandle]);

  return (
    <div className="w-full h-fit desktop:sticky top-2 flex flex-col">
      <div className="h-fit p-2 glass rounded-box flex flex-col items-center shadow mb-2">
        <div className="flex flex-col items-center">
          {localHandle !== profileHandle && localHandle !== null && (
            <div tabIndex={0} className="dropdown dropdown-end size-fit absolute top-2 right-2">
              <div className="flex btn btn-ghost btn-circle text-slate-600 dark:text-slate-200">
                <FaEllipsisVertical size={20} />
              </div>
              <ul tabIndex={0} className="flex dropdown-content menu bg-base-100 z-10 rounded-box w-40 p-2 shadow">
                {isUserBlocked ? (
                  <li>
                    <a className="w-full" onClick={() => unblockConfirmModalRef.current?.showModal()}>
                      ブロック解除
                    </a>
                  </li>
                ) : (
                  <li>
                    <a className="w-full hover:bg-red-500" onClick={() => blockConfirmModalRef.current?.showModal()}>
                      ブロック
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
          {userProfile && userProfile.avatarUrl ? (
            <div className="flex w-full h-24 mb-2">
              <Link href={`https://${userProfile.hostname}/${userProfile.handle.match(/^@([^@ ]){1,100}/g)?.[0]}`}>
                <img
                  src={getProxyUrl(userProfile.avatarUrl)}
                  alt="User Avatar"
                  className={`w-24 h-24 object-cover absolute left-[calc(50%-3rem)] rounded-full`}
                />
              </Link>
              {userProfile.stopAnonQuestion && !userProfile.stopNewQuestion && (
                <div className="chat chat-end w-32 window:w-full desktop:w-full relative bottom-[40%] right-[22%] window:right-[60%] deskstop:left-[60%]">
                  <div className="chat-bubble text-xs flex items-center bg-base-100 text-slate-700 dark:text-slate-400">
                    投稿者公開の質問のみ受け付けています！
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="skeleton h-24 w-24 rounded-full" />
          )}
          <div className="flex items-center text-xl mb-2">
            {userProfile && userProfile.stopNewQuestion ? (
              <div className="flex flex-col items-center desktop:flex-row">
                <NameComponents username={userProfile.name} width={32} height={32} />
                <span>さんは現在質問を受け付けていません...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center desktop:flex-row window:flex-row window:text-2xl">
                <NameComponents username={userProfile?.name} width={32} height={32} />
                <span>さんの{josa(userProfile?.questionBoxName, 'です！', 'です！')}</span>
              </div>
            )}
          </div>
        </div>
        <form className="w-full flex flex-col items-center" onSubmit={handleSubmit(onSubmit)}>
          <textarea
            {...register('question', {
              required: 'required',
              maxLength: 1000,
            })}
            placeholder="質問内容を入力してください"
            className={`w-[90%] mb-2 font-thin leading-loose textarea ${
              errors.question ? 'textarea-error' : 'textarea-bordered'
            }`}
            onKeyDown={onCtrlEnter}
            disabled={userProfile?.stopNewQuestion === true ? true : false}
            style={{ resize: 'none' }}
          />
          {errors.nonAnonQuestion && errors.nonAnonQuestion.type === 'stopAnonQuestion' && (
            <div
              className="tooltip tooltip-open tooltip-bottom tooltip-error transition-opacity"
              data-tip={errors.nonAnonQuestion.message}
            />
          )}
          {errors.nonAnonQuestion && errors.nonAnonQuestion.type === 'notLoggedIn' && (
            <div
              className="tooltip tooltip-open tooltip-bottom tooltip-error transition-opacity"
              data-tip={errors.nonAnonQuestion.message}
            />
          )}
          {errors.question && errors.question.type === 'questionOnlyWhiteSpace' && (
            <div
              className="tooltip tooltip-open tooltip-bottom tooltip-error transition-opacity"
              data-tip={errors.question.message}
            />
          )}
          <div className="w-[90%] flex justify-between">
            <div className="flex gap-2 items-center">
              <input
                type="checkbox"
                className="toggle toggle-accent"
                onClick={() => setValue('nonAnonQuestion', !nonAnonQuestion)}
              />
              <input type="hidden" {...register('nonAnonQuestion')} />
              <span>投稿者公開</span>
            </div>
            <button type="submit" className="btn btn-primary">
              質問する
            </button>
          </div>
        </form>
      </div>
      {localHandle === profileHandle && (
        <div className="h-fit py-4 glass rounded-box flex flex-col items-center shadow mb-2 dark:text-white">
          <a className="link" href={shareUrl()} target="_blank" rel="noreferrer">
            {userProfile?.instanceType}に質問箱ページを共有
          </a>
        </div>
      )}
      <DialogModalLoadingOneButton
        isLoading={isLoading}
        title_loading={'送信中'}
        title_done={questionSendingDoneMessage.title}
        body_loading={'質問を送信中です...'}
        body_done={questionSendingDoneMessage.body}
        loadingButtonText={'ロード中'}
        doneButtonText={'閉じる'}
        ref={questionSendingModalRef}
      />
      <DialogModalTwoButton
        title={'ブロック'}
        body={
          '本当にブロックしますか...?\nブロック後はお互いの回答が非表示になり、ブロックした人があなたに質問を送ることができなくなります。'
        }
        confirmButtonText={'確認'}
        onClick={handleBlock}
        cancelButtonText={'キャンセル'}
        ref={blockConfirmModalRef}
      />
      <DialogModalLoadingOneButton
        isLoading={isLoading}
        title_loading={'ブロック'}
        title_done={'ブロック'}
        body_loading={'ブロック中...'}
        body_done={'ブロックされました！'}
        loadingButtonText={'ロード中'}
        doneButtonText={'閉じる'}
        ref={blockSuccessModalRef}
      />
      <DialogModalTwoButton
        title={'ブロック解除'}
        body={'ブロックを解除しますか？'}
        confirmButtonText={'確認'}
        onClick={handleUnBlock}
        cancelButtonText={'キャンセル'}
        ref={unblockConfirmModalRef}
      />
      <DialogModalLoadingOneButton
        isLoading={isLoading}
        title_loading={'ブロック解除'}
        title_done={'ブロック解除'}
        body_loading={'ブロック解除中...'}
        body_done={'ブロックが解除されました！'}
        loadingButtonText={'ロード中'}
        doneButtonText={'閉じる'}
        ref={unblockSuccessModalRef}
      />
    </div>
  );
}