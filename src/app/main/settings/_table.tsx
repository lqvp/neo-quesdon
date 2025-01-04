'use client';

import CollapseMenu from '@/app/_components/collapseMenu';
import DialogModalLoadingOneButton from '@/app/_components/modalLoadingOneButton';
import DialogModalTwoButton from '@/app/_components/modalTwoButton';
import { Block, DeleteBlockByIdDto, GetBlockListReqDto, GetBlockListResDto } from '@/app/_dto/blocking/blocking.dto';
import { onApiError } from '@/utils/api-error/onApiError';
import { useEffect, useRef, useState } from 'react';

export default function BlockList() {
  const [untilId, setUntilId] = useState<string | null>(null);
  const [blockList, setBlockList] = useState<Block[]>([]);
  const [unblockId, setUnblockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<HTMLTableRowElement | null>(null);
  const [loadingDoneModalText, setLoadingDoneModalText] = useState<{ title: string; body: string }>({
    title: '完了',
    body: 'ブロックが解除されました！',
  });
  const unblockConfirmModalRef = useRef<HTMLDialogElement>(null);
  const unblockSuccessModalRef = useRef<HTMLDialogElement>(null);

  const doUnBlock = async (id: string) => {
    setIsLoading(true);
    unblockSuccessModalRef.current?.showModal();
    const data: DeleteBlockByIdDto = { targetId: id };
    const res = await fetch('/api/user/blocking/delete', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      setIsLoading(false);
      setLoadingDoneModalText({
        title: 'エラー',
        body: `ブロック解除中にエラーが発生しました！ ${await res.text()}`,
      });
      return;
    }
    setBlockList((prevList) => (prevList ? [...prevList.filter((prev) => prev.id !== id)] : []));
    setIsLoading(false);
  };

  const fetchBlocklist = async (req: GetBlockListReqDto): Promise<Block[]> => {
    const res = await fetch('/api/user/blocking/list', {
      method: 'POST',
      body: JSON.stringify(req),
    });
    try {
      if (res.ok) {
        const blocklist = ((await res.json()) as GetBlockListResDto).blockList;
        return blocklist;
      } else {
        onApiError(res.status, res);
        throw new Error('ブロックリストの取得中にエラーが発生しました！');
      }
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          fetchBlocklist({ limit: 30, ...(untilId ? { untilId: untilId } : {}), sort: 'DESC' }).then((list) => {
            if (list.length === 0) {
              setIsLoading(false);
              return;
            }
            setBlockList((prevlist) => [...prevlist, ...list]);
            setUntilId(list[list.length - 1].id);
          });
        }
      },
      { threshold: 0.7 },
    );
    if (mounted) observer.observe(mounted);
    return () => {
      if (mounted) observer.unobserve(mounted);
    };
  }, [mounted, untilId]);

  return (
    <>
      <CollapseMenu id={'blockList'} text="ブロックしたユーザーを見る">
        <table className="table">
          <thead>
            <tr>
              <th className="text-sm dark:text-white">ユーザーハンドル</th>
            </tr>
          </thead>
          <tbody>
            {blockList.map((el) => (
              <tr key={el.id}>
                <td className="break-all">{el.targetHandle}</td>
                <td>
                  <button
                    className="btn btn-warning btn-sm w-full break-keep"
                    onClick={() => {
                      setUnblockId(el.id);
                      unblockConfirmModalRef.current?.showModal();
                    }}
                  >
                    ブロック解除
                  </button>
                </td>
              </tr>
            ))}
            <tr ref={(ref) => setMounted(ref)}>
              {isLoading ? (
                <td>
                  <span className="loading loading-spinner" />
                </td>
              ) : (
                <>
                  {blockList.length === 0 ? (
                    <>
                      <td>
                        <span className="text-lg">ブロックしたユーザーはいません！</span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <span className="text-lg">終わり！</span>
                      </td>
                    </>
                  )}
                </>
              )}
            </tr>
          </tbody>
        </table>
      </CollapseMenu>
      <DialogModalTwoButton
        title={'ブロック解除'}
        body={'ブロックを解除しますか？'}
        confirmButtonText={'確認'}
        onClick={() => doUnBlock(unblockId!)}
        cancelButtonText={'キャンセル'}
        ref={unblockConfirmModalRef}
      />
      <DialogModalLoadingOneButton
        isLoading={isLoading}
        title_loading={'ブロック解除'}
        title_done={loadingDoneModalText.title}
        body_loading={'ブロック解除中...'}
        body_done={loadingDoneModalText.body}
        loadingButtonText={'ロード中'}
        doneButtonText={'閉じる'}
        ref={unblockSuccessModalRef}
      />
    </>
  );
}