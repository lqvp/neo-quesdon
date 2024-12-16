'use client';

import Answer from '@/app/_components/answer';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { fetchAnswer } from './action';
import { AnswerDto } from '@/app/_dto/Answers.dto';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';

export default function SingleAnswer() {
  const [answerBody, setAnswerBody] = useState<AnswerDto>();
  const singleQuestionDeleteModalRef = useRef<HTMLDialogElement>(null);
  const { answer } = useParams() as { answer: string };

  const handleDeleteAnswer = async (id: string) => {
    const res = await fetch(`/api/db/answers/${id}`, {
      method: 'DELETE',
    });
    try {
      if (res.ok) {
        window.history.back();
      } else {
        throw new Error(`回答を削除するのに失敗しました！ ${await res.text()}`);
      }
    } catch (err) {
      alert(err);
    }
  };

  useEffect(() => {
    fetchAnswer(answer).then((r) => setAnswerBody(r));
  }, [answer]);

  return (
    <div className="flex w-[90%] window:w-[80%] desktop:w-[70%]">
      {answerBody && (
        <>
          <Answer value={answerBody} id={answerBody.id} ref={singleQuestionDeleteModalRef} />
          <DialogModalTwoButton
            title={'回答を削除'}
            body={'回答を削除しますか...?'}
            confirmButtonText={'確認'}
            cancelButtonText={'キャンセル'}
            ref={singleQuestionDeleteModalRef}
            onClick={() => handleDeleteAnswer(answerBody.id)}
          />
          <input type="checkbox" id={`answer_delete_modal_${answerBody.id}`} className="modal-toggle" />
          <div className="modal" role="dialog">
            <div className="modal-box">
              <h3 className="py-4 text-2xl">回答を削除しますか...?</h3>
              <div className="modal-action">
                <label
                  htmlFor={`answer_delete_modal_${answerBody.id}`}
                  className="btn btn-error"
                  onClick={() => handleDeleteAnswer(answerBody.id)}
                >
                  確認
                </label>
                <label htmlFor={`answer_delete_modal_${answerBody.id}`} className="btn">
                  キャンセル
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}