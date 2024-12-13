'use client';

import Link from 'next/link';
import { SubmitHandler, useForm } from 'react-hook-form';
import { postAnswer } from '../main/questions/action';
import { RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { createAnswerDto } from '../_dto/create-answer/create-answer.dto';
import { questionDto } from '@/app/_dto/question/question.dto';

interface formValue {
  answer: string;
  nsfw: boolean;
  visibility: 'public' | 'home' | 'followers';
}

interface askProps {
  singleQuestion: questionDto;
  multipleQuestions: questionDto[];
  setQuestions: React.Dispatch<React.SetStateAction<questionDto[] | undefined | null>>;
  setId: React.Dispatch<React.SetStateAction<number>>;
  deleteRef: RefObject<HTMLDialogElement>;
  answerRef: RefObject<HTMLDialogElement>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  defaultVisibility: 'public' | 'home' | 'followers' | undefined;
}

export default function Question({
  singleQuestion,
  multipleQuestions,
  setQuestions,
  setId,
  deleteRef,
  answerRef,
  setIsLoading,
  defaultVisibility,
}: askProps) {
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    watch,
    setError,
    formState: { errors },
    reset,
  } = useForm<formValue>({
    defaultValues: {
      nsfw: false,
      visibility: defaultVisibility,
      answer: '',
    },
    mode: 'onChange',
  });

  const onCtrlEnter = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      const isValid = await trigger();

      if (isValid === false) {
        return;
      } else {
        const value = getValues();
        if (value && !answerRef.current?.open) {
          await onSubmit(value);
        }
      }
    }
  };

  const nsfwedAnswer = watch('nsfw');

  const onSubmit: SubmitHandler<formValue> = async (e) => {
    const detectWhiteSpaces = new RegExp(/^\s+$/);

    if (detectWhiteSpaces.test(e.answer) === true) {
      setError('answer', {
        type: 'answerOnlyWhiteSpace',
        message: '回答に何も書かないんですか...?',
      });
      return;
    }

    const questionId = singleQuestion.id;
    const typedAnswer: createAnswerDto = {
      answer: e.answer,
      nsfwedAnswer: e.nsfw,
      visibility: e.visibility,
    };
    const filteredQuestions = multipleQuestions.filter((el) => el.id !== questionId);

    setQuestions(filteredQuestions);
    setIsLoading(true);
    answerRef.current?.showModal();
    try {
      await postAnswer(questionId, typedAnswer);
    } catch (err) {
      answerRef.current?.close();
      alert(err);
    } finally {
      setIsLoading(false);
    }
  };

  const draftSaveDebounceTimerRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    return () => {
      clearTimeout(draftSaveDebounceTimerRef.current);
    };
  }, []);
  const deBounce = (fn: () => void) => {
    if (draftSaveDebounceTimerRef.current) {
      clearTimeout(draftSaveDebounceTimerRef.current);
    }
    draftSaveDebounceTimerRef.current = setTimeout(() => {
      fn();
    }, 500);
  };

  useLayoutEffect(() => {
    const questionId = singleQuestion.id;
    const draft = sessionStorage.getItem(`draftAnswer:${questionId}`);
    if (draft) {
      console.debug(`質問 ${questionId} の回答の下書きを復元: ${draft}`);
      setValue('answer', draft);
    }
  }, []);

  watch(({ answer }) => {
    onTextChanged(answer);
  });
  const onTextChanged = (textInput: string | undefined) => {
    const save = () => {
      const questionId = singleQuestion.id;
      if (textInput) {
        sessionStorage.setItem(`draftAnswer:${questionId}`, textInput);
        console.debug(`質問 ${questionId} の回答が下書き保存されました: ${textInput}`);
      }
    };
    deBounce(save);
  };

  useEffect(() => {
    reset({ visibility: defaultVisibility, nsfw: false });
  }, [defaultVisibility]);

  return (
    <div className="rounded-box p-2 desktop:p-4 mb-2 glass shadow">
      <div className="text-2xl chat chat-start">
        <div className="chat-header dark:text-slate-50">
          {singleQuestion.questioner ? (
            <Link href={`/main/user/${singleQuestion.questioner}`}>{singleQuestion.questioner}</Link>
          ) : (
            '匿名の質問者'
          )}
        </div>
        <div className="chat-bubble flex items-center text-sm break-all window:text-xl desktop:text-2xl text-slate-200">
          {singleQuestion.question}
        </div>
        <div className="chat-footer opacity-50 dark:text-slate-100 dark:opacity-80">
          {new Date(singleQuestion.questionedAt).toLocaleString('ja-JP', { hour12: false })}
          <span
            className="text-red-500 font-bold ml-2 cursor-pointer"
            onClick={() => {
              deleteRef.current?.showModal();
              setId(singleQuestion.id);
            }}
          >
            削除
          </span>
        </div>
      </div>
      <div className="text-2xl chat chat-end">
        <div className="chat-bubble bg-green-600 text-slate-300 dark:text-slate-200">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2 py-2">
            {errors.answer && errors.answer.type === 'answerOnlyWhiteSpace' && (
              <div className="tooltip tooltip-open tooltip-error transition-opacity" data-tip={errors.answer.message} />
            )}
            <textarea
              {...register('answer', { required: 'required', maxLength: 2000 })}
              tabIndex={0}
              className={`textarea textarea-sm text-sm h-24 desktop:h-32 window:text-xl desktop:text-2xl bg-transparent placeholder-neutral-300 text-slate-50 ${
                errors.answer && 'textarea-error'
              }`}
              placeholder="回答を入力してください..."
              onKeyDown={onCtrlEnter}
            />

            <div className="w-full flex flex-col gap-3 desktop:flex-row justify-between items-center">
              <div className="flex gap-6 mb-2 desktop:mb-0">
                <div className="flex gap-2 items-center text-xl">
                  <input
                    type="checkbox"
                    className="toggle toggle-accent"
                    onClick={() => setValue('nsfw', !nsfwedAnswer)}
                  />
                  <input type="hidden" {...register('nsfw')} />
                  <span className="text-sm desktop:text-xl">NSFWとしてチェック</span>
                </div>
                <select {...register('visibility')} className="select select-ghost select-sm dark:shadow">
                  <option className={'hidden'} value={undefined}>
                    ...
                  </option>
                  <option value="public">公開</option>
                  <option value="home">ホーム</option>
                  <option value="followers">フォロワー</option>
                </select>
              </div>
              <div className="w-full desktop:w-fit flex justify-center">
                <button
                  type={'submit'}
                  className="btn btn-outline dark:border-white dark:text-slate-200 btn-sm h-10 w-16 desktop:btn-md"
                >
                  回答
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}