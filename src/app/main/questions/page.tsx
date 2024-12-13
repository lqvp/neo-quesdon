'use client';

import Question from '@/app/_components/question';
import { useContext, useEffect, useRef, useState } from 'react';
import { deleteQuestion } from '@/app/main/questions/action';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';
import DialogModalLoadingOneButton from '@/app/_components/modalLoadingOneButton';
import { MyProfileContext } from '@/app/main/_profileContext';
import { questionDto } from '@/app/_dto/question/question.dto';
import { MyQuestionEv } from '../_events';
import { Logger } from '@/utils/logger/Logger';
import { QuestionDeletedPayload } from '@/app/_dto/websocket-event/websocket-event.dto';

const fetchQuestions = async (): Promise<questionDto[] | null> => {
  const res = await fetch('/api/db/fetch-my-questions');

  try {
    if (res.status === 401) {
      return null;
    } else if (!res.ok) {
      throw new Error(`自分の質問を取得するのに失敗しました!: ${await res.text()}`);
    } else {
      return await res.json();
    }
  } catch (err) {
    alert(err);
    return null;
  }
};

export default function Questions() {
  const [questions, setQuestions] = useState<questionDto[] | null>();
  const profile = useContext(MyProfileContext);
  const [id, setId] = useState<number>(0);
  const deleteQuestionModalRef = useRef<HTMLDialogElement>(null);
  const answeredQuestionModalRef = useRef<HTMLDialogElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const onNewQuestion = (ev: CustomEvent<questionDto>) => {
    const logger = new Logger('onNewQuestion', { noColor: true });
    logger.log('新しい質問が届きました: ', ev.detail);
    setQuestions((prev) => (prev ? [ev.detail, ...prev] : []));
  };

  const onDeleteQuestion = (ev: CustomEvent<QuestionDeletedPayload>) => {
    const logger = new Logger('onNewQuestion', { noColor: true });
    logger.log('質問が削除されました: ', ev.detail);
    setQuestions((prev) => prev && prev.filter((el) => el.id !== ev.detail.deleted_id));
  };

  useEffect(() => {
    fetchQuestions().then((r) => {
      setQuestions(r);
    });
    MyQuestionEv.addCreatedEventListener(onNewQuestion);
    MyQuestionEv.addDeletedEventListner(onDeleteQuestion);

    return () => {
      MyQuestionEv.removeCreatedEventListener(onNewQuestion);
      MyQuestionEv.removeDeletedEventListener(onDeleteQuestion);
    };
  }, []);

  return (
    <div className="w-[90%] window:w-[80%] desktop:w-[70%] flex flex-col justify-center">
      <h3 className="text-3xl desktop:text-4xl mb-2">未回答の質問</h3>
      {questions === undefined ? (
        <div className="w-full flex justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="w-full">
          {questions !== null ? (
            <div>
              {questions.length > 0 ? (
                <div>
                  {questions.map((el) => (
                    <div key={el.id}>
                      <Question
                        singleQuestion={el}
                        multipleQuestions={questions}
                        setId={setId}
                        setQuestions={setQuestions}
                        answerRef={answeredQuestionModalRef}
                        deleteRef={deleteQuestionModalRef}
                        setIsLoading={setIsLoading}
                        defaultVisibility={profile?.defaultPostVisibility}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-fit p-4 glass rounded-box flex flex-col items-center shadow mb-2">
                  <h1 className="text-xl desktop:text-3xl">👍 未回答の質問はありません！</h1>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <span className="text-2xl">ログインされていません！</span>
            </div>
          )}
        </div>
      )}
      <DialogModalLoadingOneButton
        isLoading={isLoading}
        title_loading={'送信中'}
        title_done={'回答完了'}
        body_loading={'回答を送信中です...'}
        body_done={'回答しました！'}
        loadingButtonText={'ロード中...'}
        doneButtonText={'確認'}
        ref={answeredQuestionModalRef}
      />
      <DialogModalTwoButton
        title={'質問を削除'}
        body={'質問を削除しますか...?'}
        confirmButtonText={'確認'}
        cancelButtonText={'キャンセル'}
        ref={deleteQuestionModalRef}
        onClick={() => {
          deleteQuestion(id);
          setQuestions((prevQuestions) => (prevQuestions ? [...prevQuestions.filter((prev) => prev.id !== id)] : null));
        }}
      />
    </div>
  );
}