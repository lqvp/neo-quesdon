'use server';

import type { mastodonTootAnswers, MkNoteAnswers } from '@/app';
import { verifyToken } from '@/app/api/_utils/jwt/verify-jwt';
import { sendApiError } from '@/app/api/_utils/apiErrorResponse/sendApiError';
import { GetPrismaClient } from '@/app/api/_utils/getPrismaClient/get-prisma-client';
import { Logger } from '@/utils/logger/Logger';
import { question, server, user } from '@prisma/client';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import { createAnswerDto } from '@/app/_dto/create-answer/create-answer.dto';
import { validateStrict } from '@/utils/validator/strictValidator';
import { RedisPubSubService } from '@/app/api/_service/redis-pubsub/redis-event.service';
import { QuestionDeletedPayload } from '@/app/_dto/websocket-event/websocket-event.dto';
import { AnswerWithProfileDto } from '@/app/_dto/Answers.dto';
import { profileToDto } from '@/app/api/_utils/profileToDto';

export async function getQuestion(id: number) {
  const prisma = GetPrismaClient.getClient();

  const findWithId = await prisma.question.findUnique({
    where: {
      id: id,
    },
  });

  return findWithId;
}

export async function postAnswer(questionId: question['id'] | null, reqData: createAnswerDto) {
  const postLogger = new Logger('postAnswer');
  const prisma = GetPrismaClient.getClient();
  const cookieStore = await cookies();
  const jwtToken = cookieStore.get('jwtToken')?.value;
  let tokenPayload;
  // JWTトークンの検証
  try {
    tokenPayload = await verifyToken(jwtToken);
  } catch {
    return sendApiError(401, 'Unauthorized');
  }
  if (!questionId) {
    return sendApiError(400, 'Bad Request');
  }
  const typedAnswer = await validateStrict(createAnswerDto, reqData);
  const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  if (q.questioneeHandle !== tokenPayload.handle) {
    throw new Error(`この質問はあなた宛ではありません`);
  }
  const answeredUser = await prisma.user.findUniqueOrThrow({
    where: {
      handle: tokenPayload.handle,
    },
  });
  const server = await prisma.server.findUniqueOrThrow({
    where: {
      instances: answeredUser.hostName,
    },
  });

  const userSettings = await prisma.profile.findUniqueOrThrow({
    where: {
      handle: tokenPayload.handle,
    },
  });
  const createdAnswer = await prisma.answer.create({
    data: {
      question: q.question,
      questioner: q.questioner,
      answer: typedAnswer.answer,
      answeredPersonHandle: tokenPayload.handle,
      nsfwedAnswer: typedAnswer.nsfwedAnswer,
    },
  });
  const answerUrl = `${process.env.WEB_URL}/main/user/${answeredUser.handle}/${createdAnswer.id}`;

  if (!userSettings.stopPostAnswer) {
    let title;
    let text;
    if (typedAnswer.nsfwedAnswer === true) {
      title = `⚠️ この質問はNSFWです！ #neo_quesdon`;
      if (q.questioner) {
        text = `質問者:${q.questioner}\nQ:${q.question}\nA: ${typedAnswer.answer}\n#neo_quesdon ${answerUrl}`;
      } else {
        text = `Q: ${q.question}\nA: ${typedAnswer.answer}\n#neo_quesdon ${answerUrl}`;
      }
    } else {
      title = `Q: ${q.question} #neo_quesdon`;
      if (q.questioner) {
        text = `質問者:${q.questioner}\nA: ${typedAnswer.answer}\n#neo_quesdon ${answerUrl}`;
      } else {
        text = `A: ${typedAnswer.answer}\n#neo_quesdon ${answerUrl}`;
      }
    }
    try {
      switch (server.instanceType) {
        case 'misskey':
        case 'cherrypick':
          await mkMisskeyNote(
            { user: answeredUser, server: server },
            { title: title, text: text, visibility: typedAnswer.visibility },
          );
          break;
        case 'mastodon':
          await mastodonToot({ user: answeredUser }, { title: title, text: text, visibility: typedAnswer.visibility });
          break;
        default:
          break;
      }
    } catch {
      postLogger.warn('回答の投稿に失敗しました！');
      /// Misskey/Mastodonに投稿に失敗した場合、回答を削除
      await prisma.answer.delete({ where: { id: createdAnswer.id } });
      throw new Error('回答の投稿に失敗しました！');
    }
  }

  await prisma.question.delete({
    where: {
      id: q.id,
    },
  });

  const question_numbers = await prisma.question.count({ where: { questioneeHandle: tokenPayload.handle } });
  const pubsub_service = RedisPubSubService.getInstance();
  const profile = await prisma.profile.findUnique({
    where: { handle: tokenPayload.handle },
    include: {
      user: {
        include: { server: { select: { instances: true, instanceType: true } } },
      },
    },
  });
  if (!profile) {
    throw new Error('プロフィールの取得に失敗しました');
  }
  const profileDto = profileToDto(profile, profile.user.hostName, profile.user.server.instanceType);
  pubsub_service.pub<QuestionDeletedPayload>('question-deleted-event', {
    deleted_id: q.id,
    handle: answeredUser.handle,
    question_numbers: question_numbers,
  });
  pubsub_service.pub<AnswerWithProfileDto>('answer-created-event', {
    id: createdAnswer.id,
    question: createdAnswer.question,
    questioner: createdAnswer.questioner,
    answer: createdAnswer.answer,
    answeredAt: createdAnswer.answeredAt,
    answeredPerson: profileDto,
    answeredPersonHandle: createdAnswer.answeredPersonHandle,
    nsfwedAnswer: createdAnswer.nsfwedAnswer,
  });

  postLogger.log('新しい回答が作成されました:', answerUrl);
}

async function mkMisskeyNote(
  {
    user,
    server,
  }: {
    user: user;
    server: server;
  },
  {
    title,
    text,
    visibility,
  }: {
    title: string;
    text: string;
    visibility: MkNoteAnswers['visibility'];
  },
) {
  const NoteLogger = new Logger('mkMisskeyNote');
  // Misskey CWの長さ制限処理
  if (title.length > 100) {
    title = title.substring(0, 90) + '.....';
  }
  const i = createHash('sha256')
    .update(user.token + server.appSecret, 'utf-8')
    .digest('hex');
  const newAnswerNote: MkNoteAnswers = {
    i: i,
    cw: title,
    text: text,
    visibility: visibility,
  };
  try {
    const res = await fetch(`https://${user.hostName}/api/notes/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${i}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newAnswerNote),
    });
    if (res.status === 401 || res.status === 403) {
      NoteLogger.warn('ユーザーがアクセストークンを取り消しました。JWTを無効化します... 詳細:', await res.text());
      const prisma = GetPrismaClient.getClient();
      await prisma.user.update({ where: { handle: user.handle }, data: { jwtIndex: user.jwtIndex + 1 } });
      throw new Error('ノート作成失敗！ (トークン無効化)');
    } else if (!res.ok) {
      throw new Error(`ノート作成失敗！ ${await res.text()}`);
    } else {
      NoteLogger.log(`ノート作成成功！ ${res.statusText}`);
    }
  } catch (err) {
    NoteLogger.warn(err);
    throw err;
  }
}

async function mastodonToot(
  {
    user,
  }: {
    user: user;
  },
  {
    title,
    text,
    visibility,
  }: {
    title: string;
    text: string;
    visibility: MkNoteAnswers['visibility'];
  },
) {
  const tootLogger = new Logger('mastodonToot');
  let newVisibility: 'public' | 'unlisted' | 'private';
  switch (visibility) {
    case 'public':
      newVisibility = 'public';
      break;
    case 'home':
      newVisibility = 'unlisted';
      break;
    case 'followers':
      newVisibility = 'private';
      break;
    default:
      newVisibility = 'public';
      break;
  }
  const newAnswerToot: mastodonTootAnswers = {
    spoiler_text: title,
    status: text,
    visibility: newVisibility,
  };
  try {
    const res = await fetch(`https://${user.hostName}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newAnswerToot),
    });
    if (res.status === 401 || res.status === 403) {
      tootLogger.warn('ユーザーがアクセストークンを取り消しました。JWTを無効化します... 詳細:', await res.text());
      const prisma = GetPrismaClient.getClient();
      await prisma.user.update({ where: { handle: user.handle }, data: { jwtIndex: user.jwtIndex + 1 } });
      throw new Error('トゥート作成失敗！ (トークン無効化)');
    } else if (!res.ok) {
      throw new Error(`HTTPエラー！ status:${await res.text()}`);
    } else {
      tootLogger.log(`トゥート作成成功！ ${res.statusText}`);
    }
  } catch (err) {
    tootLogger.warn(`トゥート作成失敗！`, err);
    throw err;
  }
}

export async function deleteQuestion(id: number) {
  const prisma = GetPrismaClient.getClient();
  const cookieStore = await cookies();
  const jwtToken = cookieStore.get('jwtToken')?.value;
  try {
    const tokenPayload = await verifyToken(jwtToken);
    await prisma.$transaction(async (tr) => {
      const q = await tr.question.findUniqueOrThrow({ where: { id: id } });
      if (q.questioneeHandle !== tokenPayload.handle) {
        throw new Error(`この質問は削除できません`);
      }
      await tr.question.delete({
        where: {
          id: id,
        },
      });
    });

    const question_numbers = await prisma.question.count({ where: { questioneeHandle: tokenPayload.handle } });
    const pubsub_service = RedisPubSubService.getInstance();
    pubsub_service.pub<QuestionDeletedPayload>('question-deleted-event', {
      deleted_id: id,
      handle: tokenPayload.handle,
      question_numbers: question_numbers,
    });
  } catch (err) {
    throw new Error(`JWTトークンの検証エラー: ${err}`);
  }
}